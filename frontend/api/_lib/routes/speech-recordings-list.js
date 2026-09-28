import { getMongo } from '../mongo.js'
import { SpeechToTextRecording } from '../models/speechToTextRecording.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSttRecording } from '../serializeSttRecording.js'

// GET /api/speech-recordings/list?therapistEmail=&patientId= -> every active
// (not-deleted) recording made by this account, newest first.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const therapistEmail = String(req.query.therapistEmail || '').trim().toLowerCase()
  const patientId = req.query.patientId ? String(req.query.patientId) : null
  if (!therapistEmail) return res.status(400).json({ error: 'Missing therapistEmail.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(200).json({ recordings: [] })

    const query = { created_by: creator.id, is_deleted: false }
    if (patientId && /^[0-9a-fA-F]{24}$/.test(patientId)) query.patient_id = patientId

    const docs = await SpeechToTextRecording.find(query).sort({ created_at: -1 }).limit(200)
    return res.status(200).json({ recordings: docs.map(serializeSttRecording) })
  } catch (err) {
    console.error('speech-recordings/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load recordings.' })
  }
}
