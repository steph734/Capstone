// The therapist's request review. Every route here:
//   - needs a signed-in session, and the therapist is taken FROM THE SESSION (never from the request),
//   - only works on the therapist's OWN appointments (403 NOT_YOUR_APPOINTMENT otherwise),
//   - is rate limited per user, and leaves an audit entry (who decided what, when; no payment data).
//
//   GET  /api/therapist/requests                         the requests to review + recently handled
//   POST /api/appointments/:id/payment/verify            { checks: { amountSeen: true, referenceMatches: true } }
//   POST /api/appointments/:id/payment/reject            { reason, note?, nextAction: "request_new_proof" | "decline_request" }
//   POST /api/appointments/:id/accept
//   POST /api/appointments/:id/decline                   { reason, message? }
//   GET  /api/appointments/:id/emails                    emails sent for this appointment
//   POST /api/appointments/:id/emails/resend             { emailId }
//
// Error codes: PAYMENT_NOT_VERIFIED, REASON_REQUIRED, NOTE_REQUIRED_FOR_OTHER, MESSAGE_REQUIRED_FOR_OTHER, INVALID_NEXT_ACTION,
// HOLD_EXPIRED, ALREADY_DECIDED, NOT_YOUR_APPOINTMENT. An email that could not be sent is NOT an error: it comes back as `warning`.
import { ObjectId } from 'mongodb'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { tooManyRequests } from '../rateLimit.js'
import { ReviewError, loadOwned, verifyPayment, rejectPayment, acceptAppointment, declineAppointment, listEmails, resendEmail, listRequests } from '../requestReview.js'

function guarded(method, fn, { needsId = true } = {}) {
  return async function handler(req, res) {
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json({ error: 'Method not allowed' }) }
    try {
      const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
      if (!ctx) return
      const { db, user, ip } = ctx
      const employee = await employeeFor(db, user)
      if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.', code: 'NOT_YOUR_APPOINTMENT' })
      if (method === 'POST' && await tooManyRequests(res, `review:${user._id || user.email}`, { max: 60, windowMs: 10 * 60 * 1000 })) return
      let appt = null
      if (needsId) {
        const id = String(req.params.id || '')
        if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(404).json({ error: 'Appointment not found.' })
        appt = await loadOwned(db, employee, new ObjectId(id)).catch(async (e) => {
          if (e.code === 'NOT_YOUR_APPOINTMENT') await audit(db, { user, action: 'denied', ip, meta: { attempted: 'review appointment' } }).catch(() => {})
          throw e
        })
      }
      const log = (action) => audit(db, { user, action, patientId: appt?.patient_id, ip, meta: { appointment: String(appt?._id) } }).catch(() => {})
      return await fn({ req, res, db, user, employee, appt, log })
    } catch (err) {
      if (err instanceof ReviewError) return res.status(err.status).json({ error: err.message, code: err.code })
      console.error('appointments/review error:', err)
      return res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }
  }
}

export const requests = guarded('GET', async ({ res, db, employee }) => {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json(await listRequests(db, employee))
}, { needsId: false })

export const payment = (req, res) => {
  const action = req.params.action
  if (action === 'verify') {
    return guarded('POST', async ({ req: r, res: s, db, user, appt, log }) => {
      const out = await verifyPayment(db, appt, { checks: r.body?.checks, by: user.email })
      if (!out.already) await log('payment_verified')
      return s.status(200).json({ ok: true, ...out })
    })(req, res)
  }
  if (action === 'reject') {
    return guarded('POST', async ({ req: r, res: s, db, user, appt, log }) => {
      const out = await rejectPayment(db, appt, r.body || {}, { by: user.email })
      await log(out.nextAction === 'decline_request' ? 'payment_rejected_declined' : 'payment_rejected_new_proof')
      return s.status(200).json({ ok: true, nextAction: out.nextAction, status: out.status, email: { id: String(out.email.id), status: out.email.status }, warning: out.warning })
    })(req, res)
  }
  return res.status(404).json({ error: 'Not found.' })
}

export const accept = guarded('POST', async ({ res, db, user, appt, log }) => {
  const out = await acceptAppointment(db, appt, { by: user.email })
  await log('appointment_accepted')
  return res.status(200).json({ ok: true, status: out.status, email: { id: String(out.email.id), status: out.email.status }, warning: out.warning })
})

export const decline = guarded('POST', async ({ req, res, db, user, appt, log }) => {
  const out = await declineAppointment(db, appt, req.body || {}, { by: user.email })
  await log('appointment_declined')
  return res.status(200).json({ ok: true, status: out.status, email: { id: String(out.email.id), status: out.email.status }, warning: out.warning })
})

export const emails = (req, res) => {
  if (req.params.action === 'resend' || req.method === 'POST') {
    return guarded('POST', async ({ req: r, res: s, db, appt }) => {
      const out = await resendEmail(db, appt, r.body?.emailId)
      return s.status(200).json({ ok: true, email: { id: String(out.id), status: out.status }, warning: out.status === 'failed' ? { code: 'EMAIL_FAILED', message: "The email couldn't be sent. You can resend it." } : null })
    })(req, res)
  }
  return guarded('GET', async ({ res: s, db, appt }) => s.status(200).json({ emails: await listEmails(db, appt) }))(req, res)
}
