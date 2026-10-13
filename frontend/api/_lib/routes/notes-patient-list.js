// GET /api/notes/patient-list -> the signed-in guardian's notes: ONLY signed,
// un-voided notes the therapist actively shared, and ONLY the sections the
// therapist chose. Who the guardian is comes from the session, not a query.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { guardianPatientIds, audit, viewedRecently } from '../noteAccess.js'
import { decryptField } from '../soapCrypto.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Patient'] })
    if (!ctx) return
    const { db, user, ip } = ctx
    const patientIds = await guardianPatientIds(db, user.email)
    if (!patientIds.length) return res.status(200).json({ notes: [] })

    const shares = await db.collection('note_shares').find({ patient_id: { $in: patientIds }, revoked_at: null }).sort({ shared_at: -1 }).toArray()
    const notes = await db.collection('therapy_notes').find({ _id: { $in: shares.map((s) => s.note_id) }, status: 'signed', voided: { $ne: true }, is_archived: { $ne: true } }).toArray()
    const noteBy = new Map(notes.map((n) => [String(n._id), n]))

    const out = []
    for (const s of shares) {
      const n = noteBy.get(String(s.note_id))
      if (!n) continue
      const id = String(n._id)
      const sections = Object.fromEntries(s.sections.map((f) => [f, decryptField(n[f], id, f) ?? '']))
      if (!(await viewedRecently(db, user._id, n._id))) await audit(db, { user, action: 'view', patientId: n.patient_id, noteId: n._id, ip })
      out.push({
        id, patientId: String(n.patient_id), patientName: n.patient_name, therapistName: n.employee_name,
        diagnosis: n.diagnosis, date: n.session_date, domain: s.domain || null,
        sections, sharedSummary: s.summary || '', sharedWithGuardian: true, createdAt: n.created_at,
      })
    }
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    return res.status(200).json({ notes: out })
  } catch (err) {
    console.error('notes/patient-list error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load session notes.' })
  }
}
