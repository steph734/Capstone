import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { SpeechPhrase } from '../models/speechPhrase.js'
import { SpeechDeletion } from '../models/speechDeletion.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'

const PURGE_DAYS = 30

// DELETE /api/speech-phrases/:id?therapistEmail= -> soft delete a custom
// phrase (built-in phrases live only in the frontend, so they're never
// reachable here).
export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const id = req.params?.id
  const therapistEmail = req.query?.therapistEmail
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid phrase id.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(404).json({ error: 'Phrase not found.' })

    const doc = await SpeechPhrase.findOne({ _id: id, is_deleted: false })
    if (!doc || String(doc.created_by) !== String(creator.id)) return res.status(404).json({ error: 'Phrase not found.' })

    const now = new Date()
    doc.is_deleted = true
    doc.status = 'deleted'
    doc.deleted_at = now
    doc.deleted_by = creator.id
    doc.purge_after = new Date(now.getTime() + PURGE_DAYS * 24 * 60 * 60 * 1000)
    await doc.save()

    await SpeechDeletion.create({
      collection_name: 'speech_phrases',
      record_id: doc._id,
      patient_id: doc.patient_id,
      branch_id: doc.branch_id,
      label: doc.text,
      method: 'manual',
      deleted_by: creator.id,
      deleted_by_role: creator.role,
      had_audio_file: false,
      deleted_at: now,
    })

    return res.status(200).json({ id })
  } catch (err) {
    console.error('speech-phrases/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the phrase.' })
  }
}
