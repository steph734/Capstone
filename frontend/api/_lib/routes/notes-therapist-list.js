// GET /api/notes/therapist-list -> status and sharing for every note on the
// signed-in therapist's own, still-assigned patients. Never returns note text:
// the text is fetched one note at a time (GET /api/notes/:id), which is what
// gets audited and integrity-checked.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor, noteMeta } from '../noteAccess.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist'] })
    if (!ctx) return
    const { db, user } = ctx
    const employee = await employeeFor(db, user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.' })

    const assigned = await db.collection('appointments').distinct('patient_id', { employee_id: employee._id, patient_id: { $ne: null } })
    const notes = await db.collection('therapy_notes')
      .find({ employee_id: employee._id, patient_id: { $in: assigned }, is_archived: { $ne: true } },
        { projection: { subjective: 0, objective: 0, assessment: 0, plan: 0, signature_image: 0, addendum_text: 0, addendum_reason: 0 } })
      .sort({ session_date: -1, created_at: -1 }).toArray()

    const mains = notes.filter((n) => !n.addendum_to)
    const addenda = new Map()
    for (const a of notes.filter((n) => n.addendum_to)) addenda.set(String(a.addendum_to), (addenda.get(String(a.addendum_to)) || 0) + 1)
    const shares = await db.collection('note_shares').find({ note_id: { $in: mains.map((n) => n._id) }, revoked_at: null }).toArray()
    const shareBy = new Map(shares.map((s) => [String(s.note_id), s]))

    return res.status(200).json({
      notes: mains.map((n) => {
        const s = shareBy.get(String(n._id))
        return noteMeta(n, { addendaCount: addenda.get(String(n._id)) || 0, shared: !!s, sharedSections: s ? s.sections : [], sharedAt: s ? s.shared_at : null })
      }),
    })
  } catch (err) {
    console.error('notes/therapist-list error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not load session notes.' })
  }
}
