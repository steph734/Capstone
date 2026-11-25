// POST /api/pao/styles/clear -> { patientEmail | activitySessionId, type? }
// Unsets the named field ("pose" or "expression"), or both when type is omitted.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { SELECT_FIELD, resolveSelection } from '../paoStyles.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const patientEmail = String(body.patientEmail || '').trim()
  const activitySessionId = String(body.activitySessionId || '').trim() || null
  if (type && !SELECT_FIELD[type]) return res.status(400).json({ error: 'Type must be "pose" or "expression".' })

  try {
    await getMongo()
    const db = await getDb()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patient_id = resolved.patientId

    const fields = type ? [SELECT_FIELD[type]] : Object.values(SELECT_FIELD)
    const $unset = Object.fromEntries(fields.map((f) => [f, '']))
    await PaoProfile.updateOne({ patient_id }, { $unset, $set: { updated_at: new Date() } })

    const next = await PaoProfile.findOne({ patient_id }).lean()
    return res.status(200).json(await resolveSelection(db, next))
  } catch (err) {
    if (err?.code === 121) return res.status(422).json({ error: 'The change did not pass the database rules.' })
    console.error('pao/styles/clear error:', err)
    return res.status(500).json({ error: err.message || 'Could not clear that choice.' })
  }
}
