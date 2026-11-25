// GET /api/pao/styles?patientEmail=|activitySessionId=
// -> { items, selected_pose_key, selected_expression_key, active }
// items: active, non-archived poses then expressions, by sort_order. The
// selection part is only filled in when a patient is identified.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { listActiveStyles, resolveSelection } from '../paoStyles.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const db = await getDb()
    const items = await listActiveStyles(db)

    let profile = null
    const patientEmail = String(req.query.patientEmail || '').trim()
    const activitySessionId = String(req.query.activitySessionId || '').trim() || null
    if (patientEmail || activitySessionId) {
      const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
      if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
      profile = await PaoProfile.findOne({ patient_id: resolved.patientId }).lean()
    }
    const selection = await resolveSelection(db, profile)
    // The selection is per patient, so the response must not be shared.
    res.setHeader('Cache-Control', 'private, no-cache')
    return res.status(200).json({ items, ...selection })
  } catch (err) {
    console.error('pao/styles error:', err)
    return res.status(500).json({ error: err.message || 'Could not load poses and expressions.' })
  }
}
