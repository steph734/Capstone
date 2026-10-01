// GET /api/pao/badges?patientEmail= -> every active badge, with earned
// true/false and earnedAt — the badge shelf. Unlike /api/game-progress/unlocks
// (which recomputes "currently satisfies criteria" fresh every call), this
// reads the durable patient_badges record, so a badge a patient already has
// stays earned even if, say, the admin later changes its criteria.
import { getMongo } from '../mongo.js'
import { Badge } from '../models/badge.js'
import { PatientBadge } from '../models/patientBadge.js'
import { resolvePatientId } from '../resolvePatient.js'
import { serializeBadge } from '../serializeBadge.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientEmail = String(req.query.patientEmail || '').trim()
  if (!patientEmail) return res.status(400).json({ error: 'Missing patientEmail.' })

  try {
    await getMongo()
    const patientId = await resolvePatientId(patientEmail)

    const badges = await Badge.find({ is_active: true, status: 'active' }).sort({ sort_order: 1, name: 1 }).lean()
    const earned = patientId
      ? await PatientBadge.find({ patient_id: patientId }).lean()
      : []
    const earnedByCode = new Map(earned.map((e) => [e.badge_code, e]))

    return res.status(200).json({
      badges: badges.map((b) => {
        const e = earnedByCode.get(b.code)
        return { ...serializeBadge(b), earned: !!e, earnedAt: e?.earned_at || null, seen: e ? !!e.seen : true }
      }),
    })
  } catch (err) {
    console.error('pao/badges error:', err)
    return res.status(500).json({ error: err.message || 'Could not load badges.' })
  }
}
