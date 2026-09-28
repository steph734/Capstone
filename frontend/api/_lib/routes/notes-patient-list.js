import { getMongo, getDb } from '../mongo.js'
import { TherapyNote } from '../models/therapyNote.js'

// GET /api/notes/patient-list?email=... -> every signed session note written
// for this patient, matched by the email the guardian used when booking
// (patients.email) — the same email a patient logs in with. A single email
// can be split across more than one `patients` doc (bookings don't dedupe by
// email today), so this collects notes across all matching patient ids
// rather than assuming a single patient record.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const patients = await db.collection('patients').find({ email }, { projection: { _id: 1 } }).toArray()
    if (!patients.length) {
      return res.status(200).json({ notes: [] })
    }
    const patientIds = patients.map((p) => p._id)

    const notes = await TherapyNote.find({
      patient_id: { $in: patientIds },
      is_archived: { $ne: true },
      status: 'signed',
    })
      .sort({ session_date: -1, created_at: -1 })
      .lean()

    return res.status(200).json({
      notes: notes.map((n) => ({
        id: String(n._id),
        patientId: String(n.patient_id),
        patientName: n.patient_name,
        therapistName: n.employee_name,
        diagnosis: n.diagnosis,
        date: n.session_date,
        subjective: n.subjective,
        objective: n.objective,
        assessment: n.assessment,
        plan: n.plan,
        domain: n.title,
        sharedWithGuardian: !!n.shared_with_guardian,
        sharedSummary: n.shared_summary,
        createdAt: n.created_at,
      })),
    })
  } catch (err) {
    console.error('notes/patient-list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load session notes.' })
  }
}
