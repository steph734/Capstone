import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { TextToSpeechMessage } from '../models/textToSpeechMessage.js'
import { SpeechDeletion } from '../models/speechDeletion.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSpeechMessage } from '../serializeSpeechMessage.js'

const PURGE_DAYS = 30

// PATCH /api/speech-messages/:id -> bump replay_count when "Hear it again"
// is tapped. DELETE /api/speech-messages/:id -> soft delete + audit log.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function ownedMessage(id, therapistEmail) {
  if (!mongoose.isValidObjectId(id)) return { error: 'Invalid message id.', status: 400 }
  const creator = await resolveSpeechCreator(therapistEmail)
  if (!creator) return { error: 'Message not found.', status: 404 }
  const doc = await TextToSpeechMessage.findOne({ _id: id, is_deleted: false })
  if (!doc || String(doc.created_by) !== String(creator.id)) return { error: 'Message not found.', status: 404 }
  return { doc, creator }
}

async function handlePatch(req, res) {
  const id = req.params?.id
  const { therapistEmail, incrementReplay, archive } = req.body || {}

  try {
    await getMongo()
    const { doc, error, status, creator } = await ownedMessage(id, therapistEmail)
    if (error) return res.status(status).json({ error })

    if (incrementReplay) doc.replay_count = (doc.replay_count || 0) + 1

    if (archive === true) {
      const now = new Date()
      doc.is_archived = true
      doc.status = 'archived'
      doc.archived_at = now
      doc.archived_by = creator.id
    } else if (archive === false) {
      doc.is_archived = false
      doc.status = 'active'
      doc.restored_at = new Date()
      doc.restored_by = creator.id
    }

    await doc.save()
    return res.status(200).json({ message: serializeSpeechMessage(doc) })
  } catch (err) {
    console.error('speech-messages/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the message.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  const therapistEmail = req.query?.therapistEmail

  try {
    await getMongo()
    const { doc, error, status, creator } = await ownedMessage(id, therapistEmail)
    if (error) return res.status(status).json({ error })

    const now = new Date()
    doc.is_deleted = true
    doc.status = 'deleted'
    doc.deleted_at = now
    doc.deleted_by = creator.id
    doc.purge_after = new Date(now.getTime() + PURGE_DAYS * 24 * 60 * 60 * 1000)
    await doc.save()

    await SpeechDeletion.create({
      collection_name: 'text_to_speech_messages',
      record_id: doc._id,
      patient_id: doc.patient_id,
      branch_id: doc.branch_id,
      label: doc.input_text.slice(0, 120),
      method: 'manual',
      deleted_by: creator.id,
      deleted_by_role: creator.role,
      had_audio_file: false,
      deleted_at: now,
    })

    return res.status(200).json({ id })
  } catch (err) {
    console.error('speech-messages/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the message.' })
  }
}
