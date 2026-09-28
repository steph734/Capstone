import { getMongo } from '../mongo.js'
import { TextToSpeechMessage } from '../models/textToSpeechMessage.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSpeechMessage } from '../serializeSpeechMessage.js'

// GET /api/speech-messages/list?therapistEmail=&patientId=&sessionId= ->
// pass sessionId for the "Today's session" panel (that one browser tab's
// messages); omit it for the full History modal, newest first.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const therapistEmail = String(req.query.therapistEmail || '').trim().toLowerCase()
  const patientId = req.query.patientId ? String(req.query.patientId) : null
  const sessionId = req.query.sessionId ? String(req.query.sessionId) : null
  if (!therapistEmail) return res.status(400).json({ error: 'Missing therapistEmail.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(200).json({ messages: [] })

    const query = { created_by: creator.id, is_deleted: false }
    if (patientId && /^[0-9a-fA-F]{24}$/.test(patientId)) query.patient_id = patientId
    if (sessionId) query.session_id = sessionId

    const docs = await TextToSpeechMessage.find(query).sort({ created_at: sessionId ? 1 : -1 }).limit(200)
    return res.status(200).json({ messages: docs.map(serializeSpeechMessage) })
  } catch (err) {
    console.error('speech-messages/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load messages.' })
  }
}
