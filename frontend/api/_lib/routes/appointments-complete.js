import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit, employeeFor } from '../noteAccess.js'
import { oid, sessionStart, dayKey, fmtLongDate, canRecommend, notify } from '../sessionRecommendations.js'

// The rules for completing a session, kept apart from the HTTP layer so they can
// be tested. Returns { status, body } — never throws for an expected refusal.
export async function completeAppointment({ db, user, ip = null, id, remarks, now = () => new Date() }) {
  const appt = await db.collection('appointments').findOne({ _id: id })
  if (!appt) return { status: 404, body: { error: 'Appointment not found.' } }

  // Only the assigned therapist, or a branch admin (Owner / Super Admin).
  if (user.role === 'Therapist') {
    const employee = await employeeFor(db, user)
    if (!employee || !appt.employee_id || String(appt.employee_id) !== String(employee._id)) {
      return { status: 403, body: { error: 'Only the assigned therapist can complete this session.' } }
    }
  }

  if (appt.is_archived) return { status: 409, body: { error: 'Archived appointments cannot be completed.' } }
  if (appt.status !== 'Confirmed') {
    return { status: 409, body: { error: `Only Confirmed sessions can be marked as completed (this one is ${appt.status}).` } }
  }
  if (sessionStart(appt) > now()) {
    return { status: 409, body: { error: 'You can only complete a session after it starts.' } }
  }

  const stamp = now()
  // One atomic update, so a session can only ever be completed once.
  const updated = await db.collection('appointments').findOneAndUpdate(
    { _id: id, status: 'Confirmed', is_archived: { $ne: true } },
    { $set: { status: 'Completed', completed_at: stamp, completed_by: user._id, completion_remarks: remarks || null, updated_at: stamp } },
    { returnDocument: 'after' }
  )
  const doc = updated && updated.value !== undefined ? updated.value : updated // driver v5 wraps it in { value }
  if (!doc) return { status: 409, body: { error: 'This session was already updated. Refresh and try again.' } }

  await audit(db, { user, action: 'appointment_completed', patientId: doc.patient_id || null, ip, meta: { appointmentId: String(id), patientId: doc.patient_id ? String(doc.patient_id) : null } })

  // Tell the parent. Prefer their login email (that's what the bell reads); fall back to the booking email.
  let parentEmail = doc.contact_email || null
  if (doc.booked_by) {
    const booker = await db.collection('users').findOne({ _id: doc.booked_by }, { projection: { email: 1 } })
    if (booker?.email) parentEmail = booker.email
  }
  const firstName = String(doc.patient_name || 'Your child').split(/\s+/)[0]
  await notify(db, {
    email: parentEmail, type: 'session_completed', title: 'Session completed',
    body: `${firstName}'s session on ${fmtLongDate(dayKey(doc.session_date)).replace(/^\w+, /, '')} is marked completed.`,
    link: '/appointments', requestId: id,
  })

  return {
    status: 200,
    body: {
      ok: true,
      appointment: {
        id: String(doc._id), status: doc.status, completedAt: doc.completed_at,
        completionRemarks: doc.completion_remarks || null, patientId: doc.patient_id ? String(doc.patient_id) : null,
      },
      canRecommend: await canRecommend(db, doc.patient_id),
    },
  }
}

// PATCH /api/appointments/:id/complete  { remarks? }
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const _id = oid(String(req.params?.id || ''))
  if (!_id) return res.status(400).json({ error: 'Invalid appointment id.' })

  const remarks = req.body?.remarks == null ? null : String(req.body.remarks).trim()
  if (remarks && remarks.length > 500) return res.status(400).json({ error: 'Remarks can be at most 500 characters.' })

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist', 'Owner', 'Super Admin'] })
    if (!ctx) return
    const out = await completeAppointment({ db: ctx.db, user: ctx.user, ip: ctx.ip, id: _id, remarks })
    return res.status(out.status).json(out.body)
  } catch (err) {
    console.error('appointments/complete error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete the appointment.' })
  }
}
