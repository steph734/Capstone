// GET /api/activities/session/current?employeeEmail=
// The therapist's remembered session, if one is still live (last_active_at
// within 30 minutes). A stale one is ended with end_reason 'timeout' and
// reported as gone, rather than silently resumed into a session the
// therapist has clearly walked away from.
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { ActivitySession } from '../models/activitySession.js'
import { PaoProfile } from '../models/paoProfile.js'

const TIMEOUT_MS = 30 * 60 * 1000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const employeeEmail = String(req.query.employeeEmail || '').trim().toLowerCase()
  if (!employeeEmail) return res.status(400).json({ error: 'Missing employeeEmail.' })

  try {
    await getMongo()
    const employee = await Employee.findOne({ email: employeeEmail }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const session = await ActivitySession.findOne({ therapist_id: employee._id, status: 'active' })
    if (!session) return res.status(200).json({ session: null })

    const idleMs = Date.now() - new Date(session.last_active_at).getTime()
    if (idleMs > TIMEOUT_MS || !session.remember) {
      session.status = 'ended'
      session.ended_at = new Date()
      session.end_reason = session.remember ? 'timeout' : 'closed'
      await session.save()
      return res.status(200).json({ session: null })
    }

    const db = await getDb()
    let patient = null
    if (session.patient_id) {
      const p = await db.collection('patients').findOne({ _id: session.patient_id })
      const profile = await PaoProfile.findOne({ patient_id: session.patient_id }).lean()
      if (p) {
        patient = {
          id: String(p._id),
          displayName: p.nickname || p.first_name,
          fullName: [p.first_name, p.last_name].filter(Boolean).join(' '),
          email: p.email || null,
          photoUrl: p.profile_photo?.url || null,
          pao: { level: profile?.level ?? 1, xp: profile?.xp ?? 0, xpToNext: (profile?.level ?? 1) >= 50 ? null : 100 + ((profile?.level ?? 1) - 1) * 50 },
        }
      }
    }

    return res.status(200).json({
      session: {
        id: String(session._id),
        mode: session.mode,
        language: session.language,
        patient,
      },
    })
  } catch (err) {
    console.error('activities/session/current error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the current session.' })
  }
}
