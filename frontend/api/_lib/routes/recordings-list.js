import { getMongo } from '../mongo.js'
import { SessionRecording } from '../models/sessionRecording.js'
import { serializeRecording } from '../serializeRecording.js'

// GET /api/recordings/list?therapistEmail=... -> only this user's own
// recordings — these are therapy session recordings, never shared across
// accounts.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const therapistEmail = String(req.query.therapistEmail || '').trim().toLowerCase()
  if (!therapistEmail) return res.status(400).json({ error: 'Missing therapistEmail.' })

  try {
    await getMongo()
    const docs = await SessionRecording.find({ therapist_email: therapistEmail }).sort({ created_at: -1 }).lean()
    return res.status(200).json({ recordings: docs.map(serializeRecording) })
  } catch (err) {
    console.error('recordings/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load recordings.' })
  }
}
