// /api/bookings/:id/:action  (all need the booking token, header "x-booking-token")
//
//   POST /api/bookings/:id/attempts   start a payment attempt (card or QR). Body: { method, idempotencyKey, payer }
//   GET  /api/bookings/:id/state      where this booking and its latest payment are right now (used to RESUME after a refresh)
//   POST /api/bookings/:id/cancel     give the held slot back (patient closed the checkout)
//
// Card attempts create a Stripe PaymentIntent with the SERVER's amount. QR attempts never confirm anything by
// themselves: they wait for the booked therapist to verify the payment.
import { getDb } from '../mongo.js'
import { tooManyRequests } from '../rateLimit.js'
import { loadBooking } from '../bookingAccess.js'
import { createAttempt, ensurePaymentIntent, refreshCardAttempt, submitQr, attemptView, PAYMENT_MESSAGES, friendlyFailure } from '../paymentAttempts.js'
import { activeSlotFilter, acquireSlotLock, extendSlotLock, releaseHold, markAvailability, slotKey } from '../bookingCore.js'
import { getStripeClient } from '../stripeClient.js'
import { HOLD_MS } from '../pricing.js'

const KEY_RE = /^[\w-]{16,80}$/
const METHODS = ['card', 'gcash', 'paymaya']

// Make sure the booking is still held for this patient (or take the slot back if it ran out and is still free).
async function reopenHold(db, appointment, now) {
  const key = slotKey(appointment.employee_id, appointment.session_date, appointment.start_time)
  const stillHeld = appointment.payment_state === 'awaiting_payment' && appointment.hold_expires_at && new Date(appointment.hold_expires_at) > now
  if (stillHeld) {
    await extendSlotLock(db, key, appointment._id, HOLD_MS, now)
    await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { hold_expires_at: new Date(now.getTime() + HOLD_MS), updated_at: now } })
    return true
  }
  if (!(await acquireSlotLock(db, key, appointment._id, HOLD_MS, now))) return false
  const clash = await db.collection('appointments').findOne(activeSlotFilter(appointment.employee_id, appointment.session_date, appointment.start_time, now, appointment._id))
  if (clash) return false
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { status: 'Pending', payment_state: 'awaiting_payment', cancelled_reason: null, hold_expires_at: new Date(now.getTime() + HOLD_MS), updated_at: now } })
  await markAvailability(db, appointment, true)
  return true
}

export default async function handler(req, res) {
  const action = req.params?.action
  const allowed = { attempts: 'POST', state: 'GET', cancel: 'POST' }
  if (!allowed[action]) return res.status(404).json({ error: 'Not found.' })
  if (req.method !== allowed[action]) { res.setHeader('Allow', allowed[action]); return res.status(405).json({ error: 'Method not allowed' }) }

  try {
    const db = await getDb()
    const appointment = await loadBooking(db, req, res, req.params.id)
    if (!appointment) return
    const now = new Date()
    const latest = async () => (await db.collection('payment_attempts').find({ appointment_id: appointment._id }).sort({ created_at: -1 }).limit(1).toArray())[0] || null

    if (action === 'state') {
      let attempt = await latest()
      if (attempt && attempt.method === 'card') attempt = await refreshCardAttempt(db, attempt, now).catch((e) => { console.error('state refresh failed:', e.message); return attempt })
      const fresh = await db.collection('appointments').findOne({ _id: appointment._id })
      return res.status(200).json({
        bookingId: String(appointment._id), paymentState: fresh.payment_state || null, holdExpiresAt: fresh.hold_expires_at || null,
        attempt: attempt ? attemptView(attempt, fresh) : null,
      })
    }

    if (action === 'cancel') {
      if (appointment.payment_state !== 'awaiting_payment') return res.status(200).json({ ok: true, state: appointment.payment_state || null })
      const open = await db.collection('payment_attempts').find({ appointment_id: appointment._id, status: { $in: ['created', 'processing', 'requires_action'] } }).toArray()
      for (const a of open) {
        if (a.provider_ref) await getStripeClient().paymentIntents.cancel(a.provider_ref).catch(() => {})
        await db.collection('payment_attempts').updateOne({ _id: a._id }, { $set: { status: 'expired', failure_code: 'payment_not_received', updated_at: now } })
      }
      await releaseHold(db, appointment, 'cancelled')
      return res.status(200).json({ ok: true, state: 'cancelled' })
    }

    // ── attempts ──
    const { method, idempotencyKey, payer } = req.body || {}
    if (!METHODS.includes(method)) return res.status(400).json({ error: 'Choose a payment method.' })
    if (!KEY_RE.test(String(idempotencyKey || ''))) return res.status(400).json({ error: 'Missing payment key.' })
    if (await tooManyRequests(res, `attempt:${appointment._id}`, { max: 12, windowMs: 15 * 60 * 1000 })) return
    if (appointment.payment_state === 'paid') return res.status(409).json({ error: 'This booking is already paid.', code: 'ALREADY_PAID' })

    // Same key = same attempt (double click / retry): never a second charge.
    const known = await db.collection('payment_attempts').findOne({ idempotency_key: idempotencyKey })
    if (known && String(known.appointment_id) !== String(appointment._id)) return res.status(404).json({ error: 'Payment not found.' })

    if (!known) {
      if (appointment.payment_state === 'pending_verification') return res.status(409).json({ error: 'Your payment is already waiting for verification.', code: 'ALREADY_SUBMITTED' })
      // The time slot must still be ours (held, or free again). If someone else took it, say so.
      if (!(await reopenHold(db, appointment, now))) return res.status(409).json({ error: PAYMENT_MESSAGES.slot_taken, code: 'SLOT_TAKEN' })
    }

    const fresh = await db.collection('appointments').findOne({ _id: appointment._id })
    const { attempt: created } = await createAttempt(db, { appointment: fresh, method, idempotencyKey, payer })

    if (method === 'card') {
      try {
        const { pi } = await ensurePaymentIntent(db, created, fresh)
        const view = attemptView({ ...created, provider_ref: pi.id }, fresh)
        return res.status(201).json({ ...view, clientSecret: pi.status === 'requires_payment_method' || pi.status === 'requires_confirmation' || pi.status === 'requires_action' ? pi.client_secret : null })
      } catch (err) {
        console.error('bookings/attempts: could not create the PaymentIntent:', err.message)
        const failure = friendlyFailure('processing_error')
        await db.collection('payment_attempts').updateOne({ _id: created._id }, { $set: { status: 'failed', failure_code: failure.code, failure_message: failure.message, updated_at: new Date() } })
        return res.status(502).json({ error: failure.message, code: failure.code })
      }
    }

    // QR: record that the patient says they paid; the booked therapist verifies it.
    if (created.status !== 'pending_verification' || fresh.payment_state !== 'pending_verification') await submitQr(db, created, fresh, {})
    const after = await db.collection('appointments').findOne({ _id: appointment._id })
    return res.status(201).json(attemptView(await db.collection('payment_attempts').findOne({ _id: created._id }), after))
  } catch (err) {
    console.error('bookings/item error:', err)
    return res.status(500).json({ error: PAYMENT_MESSAGES.unknown })
  }
}
