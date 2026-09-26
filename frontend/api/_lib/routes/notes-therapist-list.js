import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { TherapyNote } from '../models/therapyNote.js'

// GET /api/notes/therapist-list?email=... -> every non-archived session note
// this therapist has written, across all their patients. The Notes &
// Progress page groups these by patientId client-side (small dataset per
// therapist — same shape as the old hardcoded demo notes object).
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
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const notes = await TherapyNote.find({ employee_id: employee._id, is_archived: { $ne: true } })
      .sort({ session_date: -1, created_at: -1 })
      .lean()

    return res.status(200).json({
      notes: notes.map((n) => ({
        id: String(n._id),
        patientId: String(n.patient_id),
        patientName: n.patient_name,
        diagnosis: n.diagnosis,
        date: n.session_date,
        subjective: n.subjective,
        objective: n.objective,
        assessment: n.assessment,
        plan: n.plan,
        status: n.status,
        signatureImage: n.signature_image,
        signedAt: n.signed_at,
        sharedWithGuardian: !!n.shared_with_guardian,
        sharedSummary: n.shared_summary,
        domain: n.title,
        createdAt: n.created_at,
      })),
    })
  } catch (err) {
    console.error('notes/therapist-list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load session notes.' })
  }
}
