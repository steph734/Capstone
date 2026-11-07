// /api/payments/:id/:action  (id = a payment attempt)
//
//   GET  /api/payments/:id/status      patient (booking token): where is this payment? Cards are checked against STRIPE here.
//   POST /api/payments/:id/qr-submit   patient (booking token): attach the GCash/Maya reference number and/or a screenshot
//   POST /api/payments/:id/review      the BOOKED THERAPIST: { action: "approve" | "reject" } for a QR payment
import { getDb } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { sendEmail } from '../brevo.js'
import { loadAttempt } from '../bookingAccess.js'
import { refreshCardAttempt, attemptView, submitQr, reviewQr, friendlyFailure, markFailed, PAYMENT_MESSAGES } from '../paymentAttempts.js'
import { releaseHold } from '../bookingCore.js'
import { ObjectId } from 'mongodb'

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default async function handler(req, res) {
  const action = req.params?.action
  const allowed = { status: 'GET', 'qr-submit': 'POST', review: 'POST' }
  if (!allowed[action]) return res.status(404).json({ error: 'Not found.' })
  if (req.method !== allowed[action]) { res.setHeader('Allow', allowed[action]); return res.status(405).json({ error: 'Method not allowed' }) }

  try {
    if (action === 'review') return await review(req, res)

    const db = await getDb()
    const found = await loadAttempt(db, req, res, req.params.id)
    if (!found) return
    let { attempt, appointment } = found
    const now = new Date()

    if (action === 'status') {
      // Cards: ask Stripe (the source of truth), and confirm the booking if it succeeded.
      if (attempt.method === 'card') attempt = await refreshCardAttempt(db, attempt, now).catch((e) => { console.error('status refresh failed:', e.message); return attempt })
      appointment = await db.collection('appointments').findOne({ _id: appointment._id })
      // A hold that ran out while the patient never finished paying.
      if (['created', 'processing', 'requires_action'].includes(attempt.status) && appointment.payment_state === 'awaiting_payment' && appointment.hold_expires_at && new Date(appointment.hold_expires_at) <= now) {
        attempt = await markFailed(db, attempt, friendlyFailure('timeout'))
        await releaseHold(db, appointment, 'expired')
        appointment = await db.collection('appointments').findOne({ _id: appointment._id })
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(attemptView(attempt, appointment))
    }

    // qr-submit
    if (attempt.method === 'card') return res.status(400).json({ error: 'This is a card payment.' })
    if (attempt.status !== 'pending_verification') return res.status(409).json({ error: 'This payment is no longer waiting for verification.' })
    if (!String(req.body?.reference || '').trim() && !req.body?.screenshot) return res.status(400).json({ error: 'Add a reference number or a screenshot first.', code: 'EMPTY_DETAILS' })
    try {
      await submitQr(db, attempt, appointment, { reference: req.body?.reference, screenshot: req.body?.screenshot })
    } catch (err) {
      if (err.code === 'INVALID_REFERENCE') return res.status(400).json({ error: err.message, code: err.code })
      throw err
    }
    const next = await db.collection('payment_attempts').findOne({ _id: attempt._id })
    return res.status(200).json(attemptView(next, await db.collection('appointments').findOne({ _id: appointment._id })))
  } catch (err) {
    console.error('payments/item error:', err)
    return res.status(500).json({ error: PAYMENT_MESSAGES.unknown })
  }
}

// The therapist who got the booking verifies (or rejects) the QR payment. Nobody else can.
async function review(req, res) {
  const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
  if (!ctx) return
  const { db, user, ip } = ctx
  const id = String(req.params.id || '')
  const decision = req.body?.action
  if (!/^[a-f0-9]{24}$/i.test(id) || !['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject.' })

  const attempt = await db.collection('payment_attempts').findOne({ _id: new ObjectId(id) })
  const appointment = attempt ? await db.collection('appointments').findOne({ _id: attempt.appointment_id }) : null
  const employee = await employeeFor(db, user)
  if (!attempt || !appointment || !employee || String(appointment.employee_id) !== String(employee._id)) {
    await audit(db, { user, action: 'denied', ip, meta: { attempted: 'verify payment' } }).catch(() => {})
    return res.status(403).json({ error: 'Only the therapist who received this booking can verify its payment.' })
  }

  const out = await reviewQr(db, attempt._id, decision === 'approve')
  if (!out.ok) return res.status(409).json({ error: out.error })
  await audit(db, { user, action: decision === 'approve' ? 'payment_verified' : 'payment_rejected', patientId: appointment.patient_id, ip, meta: { attempt: id } }).catch(() => {})

  // Tell the patient (best-effort; a failed email never undoes the decision).
  try {
    if (appointment.contact_email) {
      const approved = decision === 'approve'
      await sendEmail({
        to: appointment.contact_email, toName: appointment.guardian_name || undefined,
        subject: approved ? 'Your TherapyPro payment was verified' : "We couldn't verify your TherapyPro payment",
        html: `<div style="font-family:Arial,sans-serif;color:#1f3d2f;max-width:520px"><p>Hi ${esc(appointment.guardian_name || '')},</p><p>${approved
          ? `Your ${esc(attempt.method === 'paymaya' ? 'Maya' : 'GCash')} payment was verified and your session with ${esc(appointment.therapist_name)} is booked.`
          : `We couldn't find your ${esc(attempt.method === 'paymaya' ? 'Maya' : 'GCash')} payment, so your session with ${esc(appointment.therapist_name)} was not booked. If money left your account, please contact support and we'll check it for you.`}</p></div>`,
        plain: approved ? 'Your payment was verified and your session is booked.' : "We couldn't verify your payment, so your session was not booked. Please contact support if money left your account.",
      })
    }
  } catch (err) { console.error('payment review email failed:', err.message) }

  return res.status(200).json({ ok: true, status: decision === 'approve' ? 'succeeded' : 'failed' })
}
