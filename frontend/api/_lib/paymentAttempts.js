// The server side of an online payment. One document in `payment_attempts` per try:
//   id, appointment_id, patient_id, method (card | gcash | paymaya), amount, currency,
//   status, provider_ref (Stripe id / QR reference), failure_code, failure_message, created_at, updated_at
//
// status:  created -> processing -> (requires_action) -> succeeded | failed | expired
//          QR payments:  pending_verification -> succeeded (therapist verified) | failed (rejected) | expired
//
// Stripe is the source of truth for cards: the status is always read from Stripe (and by webhook), never
// from what the browser says. The booking is confirmed exactly once, by finalizePaid().
import crypto from 'crypto'
import { insertPaymentWithRef } from './paymentRef.js'
import { getStripeClient } from './stripeClient.js'
import { ONLINE_AMOUNT_PESOS, ONLINE_AMOUNT_CENTAVOS, CURRENCY, HOLD_MS, QR_REVIEW_HOLD_MS, QR_REVIEW_HOURS } from './pricing.js'
import { slotKey, releaseHold, releaseSlotLock, extendSlotLock, acquireSlotLock, activeSlotFilter, markAvailability } from './bookingCore.js'
import { sendAppointmentConfirmationEmail } from './appointmentEmail.js'
import { sendAppointmentConfirmationSms } from './appointmentSms.js'

/* ───────────────────────── friendly messages ───────────────────────── */

// Patients never see raw Stripe codes or stack traces: every failure is turned into one of these sentences.
export const PAYMENT_MESSAGES = {
  card_declined: 'Your card was declined. Please try a different card or another payment method.',
  insufficient_funds: "Your card doesn't have enough funds for this payment. Please use another card or payment method.",
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: "The security code (CVC) doesn't look right. Please check it and try again.",
  incorrect_number: "The card number doesn't look right. Please check it and try again.",
  authentication_required: "Your bank's extra verification (3D Secure) wasn't completed. Please try again and finish the verification.",
  processing_error: 'The payment provider had a problem processing your card. Please try again in a moment.',
  timeout: "We didn't receive your payment in time, so it was cancelled.",
  payment_not_received: "We couldn't confirm that your payment was received.",
  verification_rejected: "We couldn't find your payment, so the booking was not confirmed.",
  network: "We couldn't reach the payment service. Please check your internet connection and try again.",
  slot_taken: 'That time slot is no longer available. Please pick another time.',
  unknown: "We couldn't complete your payment. Please try again or use another payment method.",
}

const CODE_ALIASES = {
  invalid_cvc: 'incorrect_cvc', invalid_number: 'incorrect_number', invalid_expiry_year: 'expired_card', invalid_expiry_month: 'expired_card',
  payment_intent_authentication_failure: 'authentication_required', card_not_supported: 'card_declined', generic_decline: 'card_declined',
  do_not_honor: 'card_declined', lost_card: 'card_declined', stolen_card: 'card_declined', fraudulent: 'card_declined',
  api_connection_error: 'network', api_error: 'processing_error', rate_limit: 'processing_error',
}

// Accepts a code string or a Stripe error object ({ code, decline_code, type }).
export function friendlyFailure(source) {
  const err = typeof source === 'string' ? { code: source } : (source || {})
  const candidates = [err.decline_code, err.code, err.type].filter(Boolean).map((c) => CODE_ALIASES[c] || c)
  const code = candidates.find((c) => PAYMENT_MESSAGES[c]) || 'unknown'
  return { code, message: PAYMENT_MESSAGES[code] }
}

/* ───────────────────────── capability token ───────────────────────── */

// A booking is controlled with a random secret given to the browser that started it (the patient may not have a
// server login). Only its SHA-256 is stored, so a database leak does not leak working tokens.
export function newToken() {
  const token = crypto.randomBytes(24).toString('hex')
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') }
}
export function tokenMatches(token, hash) {
  if (!token || !hash) return false
  const given = crypto.createHash('sha256').update(String(token)).digest()
  const want = Buffer.from(hash, 'hex')
  return given.length === want.length && crypto.timingSafeEqual(given, want)
}

/* ───────────────────────── Stripe -> our status ───────────────────────── */

// Turns a PaymentIntent into { status, failure? }. `requires_payment_method` with no error just means the
// patient has not submitted the card yet (not a failure).
export function mapIntent(pi, attempt, now = new Date()) {
  if (pi.status === 'succeeded') return { status: 'succeeded' }
  if (pi.status === 'processing') return { status: 'processing' }
  if (pi.status === 'requires_action' || pi.status === 'requires_confirmation') return { status: 'requires_action' }
  if (pi.status === 'canceled') return { status: 'failed', failure: friendlyFailure(pi.cancellation_reason === 'abandoned' ? 'timeout' : 'payment_not_received') }
  if (pi.status === 'requires_payment_method') {
    if (pi.last_payment_error) return { status: 'failed', failure: friendlyFailure(pi.last_payment_error) }
    const age = now.getTime() - new Date(attempt.created_at).getTime()
    if (age > HOLD_MS) return { status: 'failed', failure: friendlyFailure('timeout') }
    return { status: 'created' }
  }
  return { status: 'processing' }
}

/* ───────────────────────── attempts ───────────────────────── */

const ACTIVE = ['created', 'processing', 'requires_action', 'pending_verification']
let indexReady = false
async function ensureIndexes(db) {
  if (indexReady) return
  indexReady = true
  await db.collection('payment_attempts').createIndex({ idempotency_key: 1 }, { unique: true }).catch(() => {})
  await db.collection('payment_attempts').createIndex({ provider_ref: 1 }, { sparse: true }).catch(() => {})
  await db.collection('appointments').createIndex({ booking_key: 1 }, { unique: true, partialFilterExpression: { booking_key: { $type: 'string' } } }).catch(() => {})
}
export { ensureIndexes }

const readDoc = (r) => (r && r.value !== undefined ? r.value : r)

// Creates the attempt, or returns the one this idempotency key already made (double clicks / retries never create a second).
export async function createAttempt(db, { appointment, method, idempotencyKey, payer = {} }) {
  await ensureIndexes(db)
  const existing = await db.collection('payment_attempts').findOne({ idempotency_key: idempotencyKey })
  if (existing) return { attempt: existing, created: false }
  const now = new Date()
  const doc = {
    idempotency_key: idempotencyKey,
    appointment_id: appointment._id,
    patient_id: appointment.patient_id,
    method,
    amount: ONLINE_AMOUNT_PESOS,
    amount_centavos: ONLINE_AMOUNT_CENTAVOS,
    currency: CURRENCY,
    status: method === 'card' ? 'created' : 'pending_verification',
    provider_ref: null, failure_code: null, failure_message: null,
    payer: { name: String(payer.name || '').slice(0, 120), email: String(payer.email || '').slice(0, 160), phone: String(payer.phone || '').slice(0, 30) },
    created_at: now, updated_at: now,
  }
  try {
    const r = await db.collection('payment_attempts').insertOne(doc)
    return { attempt: { ...doc, _id: r.insertedId }, created: true }
  } catch (err) {
    if (err.code === 11000) return { attempt: await db.collection('payment_attempts').findOne({ idempotency_key: idempotencyKey }), created: false }
    throw err
  }
}

// Card: make (or reuse) the Stripe PaymentIntent for this attempt. The amount is the server's, not the browser's.
export async function ensurePaymentIntent(db, attempt, appointment) {
  const stripe = getStripeClient()
  if (attempt.provider_ref) {
    const pi = await stripe.paymentIntents.retrieve(attempt.provider_ref)
    return { stripe, pi }
  }
  const pi = await stripe.paymentIntents.create({
    amount: ONLINE_AMOUNT_CENTAVOS,
    currency: CURRENCY.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    description: `TherapyPro session with ${appointment.therapist_name || 'therapist'}`,
    ...(attempt.payer?.email ? { receipt_email: attempt.payer.email } : {}),
    metadata: { attempt_id: String(attempt._id), appointment_id: String(appointment._id), booking_type: 'appointment' },
  }, { idempotencyKey: `pi-${attempt._id}` })
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: pi.id, updated_at: new Date() } })
  return { stripe, pi }
}

// Reads the truth from Stripe for a card attempt, updates our record, and confirms the booking on success.
export async function refreshCardAttempt(db, attempt, now = new Date()) {
  if (!ACTIVE.includes(attempt.status) || !attempt.provider_ref) return attempt
  const stripe = getStripeClient()
  const pi = await stripe.paymentIntents.retrieve(attempt.provider_ref, { expand: ['payment_method'] })
  const mapped = mapIntent(pi, attempt, now)
  if (mapped.status === 'succeeded') return (await finalizePaid(db, attempt._id, { via: 'stripe', pi })).attempt
  if (mapped.status === 'failed') {
    if (pi.status !== 'canceled' && mapped.failure.code === 'timeout') await stripe.paymentIntents.cancel(pi.id).catch(() => {})
    return markFailed(db, attempt, mapped.failure)
  }
  if (mapped.status !== attempt.status) {
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { status: mapped.status, updated_at: now } })
    return { ...attempt, status: mapped.status }
  }
  return attempt
}

export async function markFailed(db, attempt, failure) {
  const now = new Date()
  await db.collection('payment_attempts').updateOne(
    { _id: attempt._id, status: { $ne: 'succeeded' } },
    { $set: { status: 'failed', failure_code: failure.code, failure_message: failure.message, updated_at: now } },
  )
  return { ...attempt, status: 'failed', failure_code: failure.code, failure_message: failure.message }
}

/* ───────────────────────── confirming a paid booking (exactly once) ───────────────────────── */

const METHOD_LABEL = { card: 'Card', gcash: 'GCash QR', paymaya: 'Maya QR' }
const APPT_PAYMENT_METHOD = { card: 'Stripe', gcash: 'GCash QR', paymaya: null } // the appointments schema has no "Maya" value
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

export async function finalizePaid(db, attemptId, { via, pi = null, reference = null } = {}) {
  const now = new Date()
  // The one-time switch: only the caller that flips status to "succeeded" does the rest. A second caller
  // (webhook + polling at the same time, a retry, a double click) finds it already done and changes nothing.
  const before = readDoc(await db.collection('payment_attempts').findOneAndUpdate(
    { _id: attemptId, status: { $ne: 'succeeded' } },
    { $set: { status: 'succeeded', confirmed_at: now, confirmed_via: via, updated_at: now, ...(reference ? { provider_ref: reference } : {}) } },
    { returnDocument: 'before' },
  ))
  const current = await db.collection('payment_attempts').findOne({ _id: attemptId })
  if (!before) return { attempt: current, already: true }

  const appointment = await db.collection('appointments').findOne({ _id: current.appointment_id })
  if (!appointment) return { attempt: current, already: false }

  // Late payment: the hold ran out and the slot may have been given away. Try to take it back, else refund.
  if (appointment.payment_state === 'expired' || appointment.status === 'Cancelled') {
    const key = slotKey(appointment.employee_id, appointment.session_date, appointment.start_time)
    const gotLock = await acquireSlotLock(db, key, appointment._id, HOLD_MS, now)
    const someoneElse = gotLock
      ? await db.collection('appointments').findOne(activeSlotFilter(appointment.employee_id, appointment.session_date, appointment.start_time, now, appointment._id))
      : true
    if (someoneElse) {
      await refundLate(db, current, via)
      return { attempt: await db.collection('payment_attempts').findOne({ _id: attemptId }), already: false, refunded: true }
    }
  }

  // Payment row (our own 8-digit reference is made here, server side only).
  let paymentRef = current.payment_ref || null
  let paymentId = current.payment_id || null
  try {
    const payDoc = await insertPaymentWithRef(db.collection('payments'), {
      PaymentID: `PAY-${crypto.randomUUID()}`,
      payment_for: 'appointment',
      appointment_id: appointment._id,
      patient_id: appointment.patient_id,
      amount: current.amount,
      currency: current.currency,
      method: current.method === 'paymaya' ? 'paymaya' : current.method,
      payment_date: now,
      status: 'completed',
      reference_number: String(current.provider_ref || reference || '').slice(0, 120) || undefined,
    })
    paymentRef = payDoc.payment_ref
    paymentId = payDoc._id
  } catch (err) {
    console.error('finalizePaid: could not write the payment row (money was received):', err)
  }

  const card = pi?.payment_method?.card
  await db.collection('payment_attempts').updateOne({ _id: attemptId }, { $set: {
    payment_ref: paymentRef, payment_id: paymentId, updated_at: new Date(),
    ...(card ? { card_brand: card.brand, card_last4: card.last4 } : {}),
  } })
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: {
    payment_state: 'paid', hold_expires_at: null, payment_id: paymentId, payment_method: APPT_PAYMENT_METHOD[current.method] ?? null,
    status: 'Pending', cancelled_reason: null, total_due: current.amount, updated_at: new Date(),
  } })
  if (appointment.employee_id) await releaseSlotLock(db, slotKey(appointment.employee_id, appointment.session_date, appointment.start_time), appointment._id)
  await markAvailability(db, { ...appointment }, true)

  await notifyBooked(appointment, { ...current, payment_ref: paymentRef })
  return { attempt: await db.collection('payment_attempts').findOne({ _id: attemptId }), already: false }
}

// Confirmation email + SMS, sent ONLY after a verified payment. A failure here (for example a missing SMS key)
// is logged for the clinic and never shown to the patient, and never undoes the booking.
export async function notifyBooked(appointment, attempt) {
  const date = longDate(appointment.session_date)
  const time = appointment.time_slot_label || ''
  try {
    if (appointment.contact_email) {
      await sendAppointmentConfirmationEmail({
        email: appointment.contact_email, guardianName: appointment.guardian_name || '', patient: appointment.patient_name || '',
        condition: appointment.condition || '', therapist: appointment.therapist_name || '', therapistRole: appointment.therapist_role || '',
        sessionMode: appointment.session_type || appointment.session_mode || '', date, time,
        payment: METHOD_LABEL[attempt.method] || '', paymentRef: attempt.payment_ref || '', total: attempt.amount,
      })
    }
  } catch (err) { console.error('booking confirmation email failed (booking is still confirmed):', err.message) }
  try {
    if (appointment.contact_number) {
      await sendAppointmentConfirmationSms({ phone: appointment.contact_number, patient: appointment.patient_name || '', therapist: appointment.therapist_name || '', date, time })
    }
  } catch (err) { console.error('booking confirmation SMS failed (booking is still confirmed):', err.message) }
}

// The payment arrived after the held slot was lost to someone else: give the money back automatically.
async function refundLate(db, attempt, via) {
  let refunded = false
  try {
    if (via === 'stripe' && attempt.provider_ref) {
      await getStripeClient().refunds.create({ payment_intent: attempt.provider_ref })
      refunded = true
    }
  } catch (err) { console.error('late payment refund failed (needs manual refund):', err.message) }
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { needs_refund: !refunded, refunded, failure_code: 'slot_taken', failure_message: PAYMENT_MESSAGES.slot_taken, updated_at: new Date() } })
}

/* ───────────────────────── QR (GCash / Maya) ───────────────────────── */

// The patient says they sent the money. Nothing is confirmed: the booked therapist verifies it. The slot stays held meanwhile.
// The reference number a GCash receipt shows is 13 digits. Maya's is shorter and varies, so it accepts 10 to 16 digits.
export const REFERENCE_RULE = { gcash: { min: 13, max: 13, text: 'Enter the 13-digit reference number from your GCash receipt.' }, paymaya: { min: 10, max: 16, text: 'Enter the reference number from your Maya receipt (digits only).' } }
export function cleanReference(raw, method) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return { value: '' } // optional
  const rule = REFERENCE_RULE[method] || REFERENCE_RULE.gcash
  if (digits.length < rule.min || digits.length > rule.max) return { error: rule.text }
  return { value: digits }
}

export async function submitQr(db, attempt, appointment, { reference = '', screenshot = '' } = {}) {
  const now = new Date()
  const cleaned = cleanReference(reference, attempt.method)
  if (cleaned.error) throw Object.assign(new Error(cleaned.error), { status: 400, code: 'INVALID_REFERENCE' })
  const ref = cleaned.value
  const shot = typeof screenshot === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(screenshot) && screenshot.length <= 1_500_000 ? screenshot : null
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: {
    status: 'pending_verification', provider_ref: ref || attempt.provider_ref || null, ...(shot ? { qr_screenshot: shot } : {}),
    ...(ref || shot ? { qr_details_sent: true } : {}), qr_submitted_at: attempt.qr_submitted_at || now, updated_at: now,
  } })
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { payment_state: 'pending_verification', hold_expires_at: new Date(now.getTime() + QR_REVIEW_HOLD_MS), updated_at: now } })
  if (appointment.employee_id) await extendSlotLock(db, slotKey(appointment.employee_id, appointment.session_date, appointment.start_time), appointment._id, QR_REVIEW_HOLD_MS, now)
}

// The therapist's decision on a QR payment.
export async function reviewQr(db, attemptId, approve) {
  const attempt = await db.collection('payment_attempts').findOne({ _id: attemptId })
  if (!attempt || attempt.status !== 'pending_verification') return { ok: false, error: 'This payment is not waiting for verification.' }
  if (approve) {
    const out = await finalizePaid(db, attemptId, { via: 'qr_verified' })
    return { ok: true, attempt: out.attempt }
  }
  const failure = friendlyFailure('verification_rejected')
  await markFailed(db, attempt, failure)
  const appointment = await db.collection('appointments').findOne({ _id: attempt.appointment_id })
  if (appointment) await releaseHold(db, appointment, 'failed')
  return { ok: true, attempt: { ...attempt, status: 'failed' } }
}

/* ───────────────────────── what the browser sees ───────────────────────── */

export function attemptView(attempt, appointment) {
  const t = attempt.confirmed_at || attempt.updated_at
  const status = attempt.status === 'created' ? 'awaiting' : attempt.status
  return {
    attemptId: String(attempt._id),
    status, // awaiting | processing | requires_action | succeeded | failed | expired | pending_verification
    method: attempt.method,
    methodLabel: METHOD_LABEL[attempt.method] || 'Payment',
    amount: attempt.amount,
    currency: attempt.currency,
    createdAt: attempt.created_at,
    paidAt: attempt.status === 'succeeded' ? t : null,
    referenceNo: attempt.payment_ref || null,
    card: attempt.card_last4 ? { brand: attempt.card_brand, last4: attempt.card_last4 } : null,
    failure: attempt.status === 'failed' || attempt.status === 'expired'
      ? { code: attempt.failure_code || 'unknown', message: attempt.failure_message || PAYMENT_MESSAGES[attempt.failure_code] || PAYMENT_MESSAGES.unknown }
      : null,
    slotLost: attempt.failure_code === 'slot_taken',
    // QR (GCash / Maya) waiting screen
    reviewHours: QR_REVIEW_HOURS, // the single "usually within X hours" setting (api/_lib/pricing.js)
    paymentSentAt: attempt.qr_submitted_at || attempt.created_at,
    detailsSent: Boolean(attempt.qr_details_sent), // the patient added a reference number and/or screenshot
    hasScreenshot: Boolean(attempt.qr_screenshot),
    reference: attempt.method !== 'card' ? attempt.provider_ref || null : null,
    booking: appointment ? {
      appointmentId: String(appointment._id), therapist: appointment.therapist_name, therapistRole: appointment.therapist_role,
      date: appointment.session_date, timeLabel: appointment.time_slot_label, paymentState: appointment.payment_state || null,
      holdExpiresAt: appointment.hold_expires_at || null,
    } : null,
  }
}
