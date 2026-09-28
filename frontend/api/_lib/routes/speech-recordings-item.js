import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { SpeechToTextRecording } from '../models/speechToTextRecording.js'
import { SpeechDeletion } from '../models/speechDeletion.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSttRecording } from '../serializeSttRecording.js'

const str = (v) => (v == null ? '' : String(v).trim())
const PURGE_DAYS = 30

// PATCH /api/speech-recordings/:id -> rename, re-assign patient, or update
// the summary. DELETE /api/speech-recordings/:id -> soft delete (moves to
// Trash: is_deleted/status flip, purge_after set 30 days out) and logs a
// speech_deletions entry; the caller also deletes the IndexedDB audio blob.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function ownedRecording(id, therapistEmail) {
  if (!mongoose.isValidObjectId(id)) return { error: 'Invalid recording id.', status: 400 }
  const creator = await resolveSpeechCreator(therapistEmail)
  if (!creator) return { error: 'Recording not found.', status: 404 }
  const doc = await SpeechToTextRecording.findOne({ _id: id, is_deleted: false })
  if (!doc) return { error: 'Recording not found.', status: 404 }
  if (String(doc.created_by) !== String(creator.id)) return { error: 'Recording not found.', status: 404 }
  return { doc, creator }
}

async function handlePatch(req, res) {
  const id = req.params?.id
  const { therapistEmail, title, patientId, patientName, summary, summaryStatus, archive } = req.body || {}

  try {
    await getMongo()
    const { doc, error, status, creator } = await ownedRecording(id, therapistEmail)
    if (error) return res.status(status).json({ error })

    if (title !== undefined) doc.title = str(title) || doc.title
    if (patientId !== undefined) doc.patient_id = mongoose.isValidObjectId(patientId) ? new mongoose.Types.ObjectId(patientId) : null
    if (patientName !== undefined) doc.patient_name = str(patientName) || null
    if (summary !== undefined) {
      doc.summary = summary ? {
        overview: str(summary.overview),
        goals: Array.isArray(summary.goals) ? summary.goals.map(str).filter(Boolean) : [],
        progress: Array.isArray(summary.progress) ? summary.progress.map(str).filter(Boolean) : [],
        next_steps: Array.isArray(summary.nextSteps) ? summary.nextSteps.map(str).filter(Boolean) : [],
        generated_at: new Date(),
      } : null
    }
    if (summaryStatus !== undefined) doc.summary_status = summaryStatus

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
    return res.status(200).json({ recording: serializeSttRecording(doc) })
  } catch (err) {
    console.error('speech-recordings/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the recording.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  const therapistEmail = req.query?.therapistEmail

  try {
    await getMongo()
    const { doc, error, status, creator } = await ownedRecording(id, therapistEmail)
    if (error) return res.status(status).json({ error })

    const now = new Date()
    doc.is_deleted = true
    doc.status = 'deleted'
    doc.deleted_at = now
    doc.deleted_by = creator.id
    doc.purge_after = new Date(now.getTime() + PURGE_DAYS * 24 * 60 * 60 * 1000)
    await doc.save()

    await SpeechDeletion.create({
      collection_name: 'speech_to_text_recordings',
      record_id: doc._id,
      patient_id: doc.patient_id,
      branch_id: doc.branch_id,
      label: doc.title || null,
      method: 'manual',
      deleted_by: creator.id,
      deleted_by_role: creator.role,
      had_audio_file: !!doc.file_path,
      deleted_at: now,
    })

    const audioKey = doc.file_path && doc.file_path.startsWith('indexeddb:') ? doc.file_path.slice('indexeddb:'.length) : null
    return res.status(200).json({ id, audioKey })
  } catch (err) {
    console.error('speech-recordings/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the recording.' })
  }
}
