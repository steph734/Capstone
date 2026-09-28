import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { SessionRecording } from '../models/sessionRecording.js'
import { serializeRecording } from '../serializeRecording.js'

const str = (v) => (v == null ? '' : String(v).trim())

// PATCH /api/recordings/:id -> rename, re-assign patient, or update the
// summary (used by the "Try again" retry and by /summarize itself).
// DELETE /api/recordings/:id -> removes the Mongo document; the caller is
// responsible for also deleting the IndexedDB audio blob (the browser owns
// that store, not this API).
// Both require `therapistEmail` so one account can never touch another's
// recording, even by guessing an id.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function ownedRecording(id, therapistEmail) {
  if (!mongoose.isValidObjectId(id)) return { error: 'Invalid recording id.', status: 400 }
  const email = str(therapistEmail).toLowerCase()
  if (!email) return { error: 'Missing therapistEmail.', status: 400 }
  const doc = await SessionRecording.findById(id)
  if (!doc) return { error: 'Recording not found.', status: 404 }
  if (doc.therapist_email !== email) return { error: 'Recording not found.', status: 404 }
  return { doc }
}

async function handlePatch(req, res) {
  const id = req.params?.id
  const { therapistEmail, title, patientId, patientName, summary, summaryStatus } = req.body || {}

  try {
    await getMongo()
    const { doc, error, status } = await ownedRecording(id, therapistEmail)
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

    await doc.save()
    return res.status(200).json({ recording: serializeRecording(doc) })
  } catch (err) {
    console.error('recordings/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the recording.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  const therapistEmail = req.query?.therapistEmail

  try {
    await getMongo()
    const { doc, error, status } = await ownedRecording(id, therapistEmail)
    if (error) return res.status(status).json({ error })
    const audioKey = doc.audio_key
    await SessionRecording.findByIdAndDelete(id)
    return res.status(200).json({ id, audioKey })
  } catch (err) {
    console.error('recordings/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the recording.' })
  }
}
