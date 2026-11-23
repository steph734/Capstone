// Therapist Appointments page. The therapist always comes from the signed-in session, never from the request.
//   GET    /api/therapist/appointments?tab=active|archived&status=&q=&page=1&pageSize=7   the "All appointments" list
//   GET    /api/therapist/appointments/summary                                           the five card numbers
//   GET    /api/therapist/appointments/calendar?month=2026-11                            Available / Booked / Closed per day
//   GET    /api/therapist/appointments/day?date=2026-11-25                               one day: appointments + open slots
//   GET    /api/therapist/appointments/requests?limit=2                                  pending requests, oldest first
//   PATCH  /api/therapist/appointments/:id/reschedule   { date: 'YYYY-MM-DD', start: 'HH:mm' }
//   PATCH  /api/therapist/appointments/:id/complete     { remarks? }
//   PATCH  /api/therapist/appointments/:id/archive  |  /restore
// Checking the payment, accepting and declining keep using /api/appointments/:id/payment/verify|reject, /accept, /decline (appointments-review.js).
// Errors: 403 NOT_YOUR_APPOINTMENT, 404, 409 (SLOT_TAKEN, ILLEGAL_TRANSITION, ...), 422 (validation, Mongo code 121).
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { tooManyRequests } from '../rateLimit.js'
import { sendEmail } from '../brevo.js'
import { notify } from '../sessionRecommendations.js'
import { completeAppointment } from './appointments-complete.js'
import * as T from '../therapistAppointments.js'

const allow = (res, methods) => { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }) }
const fmtDay = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const fmtTime = (t) => { const [h, m] = String(t).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// After the change is saved: tell the guardian by email and in the app. A failed email never undoes the change.
async function tellGuardianAboutMove(db, employee, appt, result) {
  const when = `${fmtDay(result.appointment.date)}, ${fmtTime(result.appointment.start)} to ${fmtTime(result.appointment.end)}`
  const therapist = [employee.first_name, employee.last_name].filter(Boolean).join(' ')
  let emailStatus = 'skipped'
  if (appt.contact_email) {
    try {
      await sendEmail({
        to: appt.contact_email, toName: appt.guardian_name || undefined, subject: `TherapyPro: ${appt.patient_name}'s session was moved`,
        html: `<p>Hello ${esc(appt.guardian_name) || 'there'},</p><p>${esc(therapist)} moved ${esc(appt.patient_name)}'s session to <b>${esc(when)}</b>.</p><p>If this time does not work for you, please message your therapist in TherapyPro.</p>`,
        plain: `${therapist} moved ${appt.patient_name}'s session to ${when}. If this time does not work for you, please message your therapist in TherapyPro.`,
      })
      emailStatus = 'sent'
    } catch (err) { console.error('reschedule email failed:', err.message); emailStatus = 'failed' }
  }
  await notify(db, { email: appt.contact_email, type: 'appointment_rescheduled', title: 'Session moved', body: `${appt.patient_name}'s session is now ${when}.`, link: '/appointments' })
  return emailStatus
}

export default async function handler(req, res) {
  const { id, action } = req.params || {}
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
    if (!ctx) return
    const { db, user, ip } = ctx
    const employee = await employeeFor(db, user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.', code: 'NOT_YOUR_APPOINTMENT' })
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'GET') {
      if (!id) return res.status(200).json(await T.list(db, employee, req.query || {}))
      if (id === 'summary') return res.status(200).json(await T.summary(db, employee))
      if (id === 'calendar') return res.status(200).json(await T.calendar(db, employee, String(req.query?.month || '')))
      if (id === 'day') return res.status(200).json(await T.day(db, employee, String(req.query?.date || '')))
      if (id === 'requests') return res.status(200).json(await T.requests(db, employee, req.query?.limit))
      return res.status(404).json({ error: 'Not found.' })
    }
    if (req.method !== 'PATCH' || !id || !action) return allow(res, ['GET', 'PATCH'])
    if (await tooManyRequests(res, `appts:${user._id || user.email}`, { max: 90, windowMs: 10 * 60 * 1000 })) return

    if (!T.isOid(id)) return res.status(404).json({ error: 'Appointment not found.' })
    const log = (what, appt) => audit(db, { user, action: what, patientId: appt?.patient_id || null, ip, meta: { appointment: id } }).catch(() => {})

    if (action === 'archive') { const out = await T.archive(db, employee, user, id); if (!out.already) await log('appointment_archived', await T.ownedAppointment(db, employee, id)); return res.status(200).json(out) }
    if (action === 'restore') { const out = await T.restore(db, employee, id); if (!out.already) await log('appointment_restored', await T.ownedAppointment(db, employee, id)); return res.status(200).json(out) }
    if (action === 'reschedule') {
      const out = await T.reschedule(db, employee, user, id, req.body || {})
      await log('appointment_rescheduled', out.appt)
      const email = await tellGuardianAboutMove(db, employee, out.appt, out)
      return res.status(200).json({ ok: true, appointment: out.appointment, from: out.from, guardianEmail: email })
    }
    if (action === 'complete') {
      await T.ownedAppointment(db, employee, id) // 403 for another therapist's appointment, before anything else
      const r = await completeAppointment({ db, user, ip, id: new ObjectId(id), remarks: req.body?.remarks })
      return res.status(r.status).json(r.body)
    }
    return res.status(404).json({ error: 'Not found.' })
  } catch (err) {
    if (err instanceof T.ApptError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra })
    if (err?.code === 121) { // MongoDB schema validation: readable message, details only in the server log
      console.error('therapist appointments: validator rejected the document', JSON.stringify(err.errInfo?.details || {}).slice(0, 1200))
      return res.status(422).json({ error: 'Some details did not pass the database checks. Please review them and try again.', code: 'VALIDATION_FAILED' })
    }
    console.error('therapist appointments error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
