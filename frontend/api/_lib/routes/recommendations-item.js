import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { oid, expireStale, isGuardianOf, serializeRecommendation } from '../sessionRecommendations.js'

// GET /api/recommendations/:id -> one recommendation, for the guardian it was sent to.
// An expired one is returned with status 'Expired' so the page can say so.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const _id = oid(String(req.params?.id || ''))
  if (!_id) return res.status(400).json({ error: 'Invalid recommendation id.' })

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Patient'] })
    if (!ctx) return
    const { db, user } = ctx

    await expireStale(db).catch((err) => console.error('expireStale:', err.message))

    const rec = await db.collection('session_recommendations').findOne({ _id })
    // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
    if (!rec || !(await isGuardianOf(db, user, rec.patient_id))) {
      return res.status(404).json({ error: 'Recommendation not found.' })
    }

    const [appt, emp] = await Promise.all([
      db.collection('appointments').findOne({ _id: rec.appointment_id }),
      db.collection('employees').findOne({ _id: rec.therapist_id }, { projection: { first_name: 1, last_name: 1, specialty: 1 } }),
    ])
    return res.status(200).json({
      recommendation: serializeRecommendation(rec, {
        patientName: appt?.patient_name || '',
        therapistName: emp ? [emp.first_name, emp.last_name].filter(Boolean).join(' ') : appt?.therapist_name || '',
        therapistRole: emp?.specialty || appt?.therapist_role || '',
        expired: rec.status === 'Expired' || (rec.status === 'Sent' && rec.expires_at < new Date()),
      }),
    })
  } catch (err) {
    console.error('recommendations/item error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load the recommendation.' })
  }
}
