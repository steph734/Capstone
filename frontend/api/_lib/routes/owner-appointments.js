import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

// GET /api/owner/appointments -> every (non-archived) record in the `appointments`
// collection, newest session first, with the therapist's branch resolved from
// `employees`. Owner and Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner', 'Super Admin'] })
    if (!ctx) return
    const { db } = ctx

    const [appts, employees, branches] = await Promise.all([
      db.collection('appointments').find({ is_archived: { $ne: true } }).sort({ session_date: -1, start_time: -1 }).toArray(),
      db.collection('employees').find({}, { projection: { branch_id: 1, first_name: 1, last_name: 1 } }).toArray(),
      db.collection('branchs').find({}, { projection: { branch_name: 1 } }).toArray(),
    ])
    const branchName = new Map(branches.map((b) => [String(b._id), b.branch_name]))
    const empById = new Map(employees.map((e) => [String(e._id), e]))
    // Older bookings can point at a staff record that was re-created; fall back to the therapist's name.
    const empByName = new Map(employees.map((e) => [[e.first_name, e.last_name].filter(Boolean).join(' ').toLowerCase(), e]))

    const list = appts.map((a) => {
      const emp = (a.employee_id ? empById.get(String(a.employee_id)) : null) || empByName.get(String(a.therapist_name || '').toLowerCase()) || null
      return {
        id: String(a._id),
        patient: a.patient_name || 'Unknown patient',
        avatar: a.patient_photo_url || null,
        therapist: a.therapist_name || (emp ? [emp.first_name, emp.last_name].filter(Boolean).join(' ') : ''),
        service: a.session_type ? `${a.session_type} Therapy` : a.therapist_role || 'Therapy session',
        branch: emp?.branch_id ? branchName.get(String(emp.branch_id)) || '' : '',
        date: a.session_date || null,
        time: a.time_slot_label || [a.start_time, a.end_time].filter(Boolean).join(' - '),
        status: a.status || 'Pending',
        bookedOn: a.created_at || null,
        mode: a.session_mode || '',
        condition: a.condition || '',
        paymentMethod: a.payment_method || '',
        total: a.total_due ?? null,
        guardian: a.guardian_name || '',
        contact: a.contact_number || '',
        cancelledReason: a.cancelled_reason || '',
      }
    })

    res.setHeader('Cache-Control', 'no-store')
    return res.json({ appointments: list, branches: branches.map((b) => b.branch_name).filter(Boolean).sort() })
  } catch (err) {
    console.error('owner appointments error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load appointments.' })
  }
}
