import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { SessionRecording } from '../models/sessionRecording.js'
import { serializeRecording } from '../serializeRecording.js'

const str = (v) => (v == null ? '' : String(v).trim())

// POST /api/recordings/create -> save a finished recording's metadata
// (transcript, timing, audio_key pointing at the IndexedDB blob). The
// summary is filled in afterwards by a separate call to
// /api/recordings/:id/summarize, so this always starts as 'pending'
// (or 'none' when there's no transcript to summarize).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    therapistEmail, patientId, patientName, title, transcript, segments,
    durationSec, wordCount, audioKey,
  } = req.body || {}

  if (!str(therapistEmail)) return res.status(400).json({ error: 'Missing therapistEmail.' })
  if (!str(audioKey)) return res.status(400).json({ error: 'Missing audioKey.' })

  try {
    await getMongo()

    const doc = await SessionRecording.create({
      therapist_email: str(therapistEmail).toLowerCase(),
      patient_id: mongoose.isValidObjectId(patientId) ? new mongoose.Types.ObjectId(patientId) : null,
      patient_name: str(patientName) || null,
      title: str(title) || 'Untitled session',
      transcript: str(transcript),
      segments: Array.isArray(segments) ? segments.filter((s) => s && str(s.text)).map((s) => ({ t: Number(s.t) || 0, text: str(s.text) })) : [],
      duration_sec: Number.isFinite(durationSec) ? durationSec : 0,
      word_count: Number.isFinite(wordCount) ? wordCount : 0,
      summary: null,
      summary_status: str(transcript) ? 'pending' : 'none',
      audio_key: str(audioKey),
    })

    return res.status(201).json({ recording: serializeRecording(doc) })
  } catch (err) {
    console.error('recordings/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the recording.' })
  }
}
