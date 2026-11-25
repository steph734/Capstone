// POST /api/pao/styles/select -> { patientEmail | activitySessionId, type, key }
// Pao uses a pose OR an expression, never both. If the other type is set the
// answer is 409 STYLE_CONFLICT and nothing changes. The patient comes from the
// session/email resolution, never from a body patient id.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { COLLECTION, SELECT_FIELD, resolveSelection } from '../paoStyles.js'

const OTHER = { pose: 'expression', expression: 'pose' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  const patientEmail = String(body.patientEmail || '').trim()
  const activitySessionId = String(body.activitySessionId || '').trim() || null

  if (!SELECT_FIELD[type]) return res.status(400).json({ error: 'Type must be "pose" or "expression".' })
  if (!key) return res.status(400).json({ error: 'Missing key.' })

  try {
    await getMongo()
    const db = await getDb()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patient_id = resolved.patientId

    const row = await db.collection(COLLECTION).findOne({ type, key, is_active: true, is_archived: false })
    if (!row) return res.status(400).json({ error: 'That pose or expression is not available.' })

    const current = await PaoProfile.findOne({ patient_id }).lean()
    const state = await resolveSelection(db, current)
    const otherKey = type === 'pose' ? state.selected_expression_key : state.selected_pose_key
    if (otherKey) {
      return res.status(409).json({ code: 'STYLE_CONFLICT', message: `Remove the current ${OTHER[type]} first.` })
    }

    // One update: set this field, unset the other (also clears a stale,
    // archived value so the document never holds both).
    await PaoProfile.updateOne(
      { patient_id },
      { $set: { [SELECT_FIELD[type]]: key, updated_at: new Date() }, $unset: { [SELECT_FIELD[OTHER[type]]]: '' } },
      { upsert: true, setDefaultsOnInsert: true },
    )

    const next = await PaoProfile.findOne({ patient_id }).lean()
    return res.status(200).json(await resolveSelection(db, next))
  } catch (err) {
    if (err?.code === 121) {
      return res.status(422).json({ error: 'The saved value did not pass the database rules. Please try another choice.' })
    }
    console.error('pao/styles/select error:', err)
    return res.status(500).json({ error: err.message || 'Could not save that choice.' })
  }
}
