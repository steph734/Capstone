import { getMongo } from '../mongo.js'
import { TextToSpeechMessage } from '../models/textToSpeechMessage.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSpeechMessage } from '../serializeSpeechMessage.js'
import { CUE_FRONTEND_TO_DB } from '../speechCueMap.js'

const str = (v) => (v == null ? '' : String(v).trim())
const GROUPS = ['start', 'instructions', 'praise', 'end', 'custom', 'typed']

// POST /api/speech-messages/create -> log one thing Pao said to a patient
// ("Talk to {patient}"), for the Today's session panel and the History modal.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    therapistEmail, patientId, patientName, sessionId, text, phraseGroup, phraseId,
    speed, repeatCount, cue,
  } = req.body || {}

  if (!str(therapistEmail)) return res.status(400).json({ error: 'Missing therapistEmail.' })
  if (!str(text)) return res.status(400).json({ error: 'Missing text.' })
  const group = GROUPS.includes(phraseGroup) ? phraseGroup : 'typed'

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const validPatientId = patientId && /^[0-9a-fA-F]{24}$/.test(patientId) ? patientId : null
    const validPhraseId = phraseId && /^[0-9a-fA-F]{24}$/.test(phraseId) ? phraseId : null

    const doc = await TextToSpeechMessage.create({
      created_by: creator.id,
      created_by_role: creator.role,
      created_by_name: creator.name,
      patient_id: validPatientId,
      patient_name: str(patientName) || null,
      branch_id: creator.branchId,
      session_id: str(sessionId) || null,
      input_text: str(text).slice(0, 500),
      phrase_group: group,
      phrase_id: validPhraseId,
      speed: Number.isFinite(speed) ? speed : 1,
      repeat_count: Number.isFinite(repeatCount) ? repeatCount : 1,
      picture_cue: cue ? (CUE_FRONTEND_TO_DB[cue] || null) : null,
      replay_count: 0,
      voice: 'browser',
      status: 'active',
      is_archived: false,
      is_deleted: false,
    })

    return res.status(201).json({ message: serializeSpeechMessage(doc) })
  } catch (err) {
    console.error('speech-messages/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the message.' })
  }
}
