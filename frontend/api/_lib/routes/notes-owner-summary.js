// GET /api/notes/owner-summary -> counts and status only, per therapist. No
// note text. Opening a note's full text goes through GET /api/notes/:id,
// which makes the owner state a reason and logs it.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner'] })
    if (!ctx) return
    const { db } = ctx
    const notes = await db.collection('therapy_notes').find({ addendum_to: null, is_archived: { $ne: true } },
      { projection: { employee_id: 1, employee_name: 1, patient_name: 1, session_date: 1, status: 1, voided: 1, signed_at: 1, shared_with_guardian: 1 } }).sort({ session_date: -1 }).toArray()
    const by = new Map()
    for (const n of notes) {
      const k = String(n.employee_id)
      if (!by.has(k)) by.set(k, { therapistId: k, therapistName: n.employee_name || 'Therapist', signed: 0, drafts: 0, voided: 0, shared: 0, notes: [] })
      const t = by.get(k)
      if (n.voided) t.voided += 1
      else if (n.status === 'signed') t.signed += 1
      else t.drafts += 1
      if (n.shared_with_guardian) t.shared += 1
      t.notes.push({ id: String(n._id), patientName: n.patient_name, date: n.session_date, status: n.voided ? 'void' : n.status, shared: !!n.shared_with_guardian })
    }
    return res.status(200).json({
      totals: {
        notes: notes.length,
        signed: notes.filter((n) => n.status === 'signed' && !n.voided).length,
        drafts: notes.filter((n) => n.status === 'draft' && !n.voided).length,
        voided: notes.filter((n) => n.voided).length,
      },
      therapists: [...by.values()],
    })
  } catch (err) {
    console.error('notes/owner-summary error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load the summary.' })
  }
}
