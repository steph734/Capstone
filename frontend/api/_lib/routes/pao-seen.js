// POST /api/pao/seen -> { patientEmail, badgeCodes: [], unlocks: [{itemType, code}] }
// Marks reward-screen entries as seen, so the wardrobe/badge-shelf "New!"
// tag clears once the patient has actually looked at them.
import { getMongo } from '../mongo.js'
import { PatientBadge } from '../models/patientBadge.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const patientEmail = String(body.patientEmail || '').trim()
  const activitySessionId = String(body.activitySessionId || '').trim() || null
  const badgeCodes = Array.isArray(body.badgeCodes) ? body.badgeCodes.map(String) : []
  const unlocks = Array.isArray(body.unlocks) ? body.unlocks : []

  try {
    await getMongo()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patientId = resolved.patientId

    await Promise.all([
      badgeCodes.length
        ? PatientBadge.updateMany({ patient_id: patientId, badge_code: { $in: badgeCodes } }, { $set: { seen: true } })
        : Promise.resolve(),
      ...unlocks.map((u) => {
        const itemType = u.itemType === 'hair' ? 'hair' : 'item'
        const code = String(u.code || '')
        if (!code) return Promise.resolve()
        return PatientUnlock.updateOne({ patient_id: patientId, item_type: itemType, item_code: code }, { $set: { seen: true } })
      }),
    ])

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('pao/seen error:', err)
    return res.status(500).json({ error: err.message || 'Could not mark these as seen.' })
  }
}
