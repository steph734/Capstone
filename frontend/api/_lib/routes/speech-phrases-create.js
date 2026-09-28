import { getMongo } from '../mongo.js'
import { SpeechPhrase } from '../models/speechPhrase.js'
import { resolveSpeechCreator } from '../resolveSpeechCreator.js'
import { serializeSpeechPhrase } from '../serializeSpeechPhrase.js'
import { CUE_FRONTEND_TO_DB } from '../speechCueMap.js'

const str = (v) => (v == null ? '' : String(v).trim())
const GROUPS = ['start', 'instructions', 'praise', 'end']

// POST /api/speech-phrases/create -> a therapist's custom "Talk to {patient}"
// phrase, saved so it survives a refresh and shows up next to the built-ins.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { therapistEmail, patientId, group, text, cue } = req.body || {}
  if (!str(therapistEmail)) return res.status(400).json({ error: 'Missing therapistEmail.' })
  if (!GROUPS.includes(group)) return res.status(400).json({ error: 'Invalid phrase group.' })
  if (!str(text)) return res.status(400).json({ error: 'Missing phrase text.' })

  try {
    await getMongo()
    const creator = await resolveSpeechCreator(therapistEmail)
    if (!creator) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const validPatientId = patientId && /^[0-9a-fA-F]{24}$/.test(patientId) ? patientId : null

    const doc = await SpeechPhrase.create({
      created_by: creator.id,
      patient_id: validPatientId,
      branch_id: creator.branchId,
      group,
      text: str(text).slice(0, 200),
      picture_cue: cue ? (CUE_FRONTEND_TO_DB[cue] || null) : null,
      status: 'active',
      is_archived: false,
      is_deleted: false,
    })

    return res.status(201).json({ phrase: serializeSpeechPhrase(doc) })
  } catch (err) {
    console.error('speech-phrases/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the phrase.' })
  }
}
