// POST /api/bookings/start: step one of an ONLINE booking. It does NOT take any money.
//
//   body: { idempotencyKey, patient, therapist, session, bookedBy, photo }
//
// It creates the appointment as an unpaid HOLD (status "Pending", payment_state "awaiting_payment",
// hold_expires_at = now + 15 minutes) and locks the time slot, so nobody else can take it while this
// patient pays. The appointment only becomes a real booking when the payment is verified on the server
// (payments-status.js / stripe-webhook.js / a therapist verifying a QR payment).
//
// Safe to send twice: the same idempotencyKey returns the same booking and never creates a second one.
import { ObjectId } from 'mongodb'
import { getDb } from '../mongo.js'
import { tooManyRequests } from '../rateLimit.js'
import { createBookingRecords, activeSlotFilter, acquireSlotLock, releaseSlotLock, markAvailability, expireStaleHolds, slotKey, parseSlot, str, asObjectId } from '../bookingCore.js'
import { ensureIndexes, newToken, PAYMENT_MESSAGES } from '../paymentAttempts.js'
import { HOLD_MS, ONLINE_AMOUNT_PESOS, CURRENCY } from '../pricing.js'

const KEY_RE = /^[\w-]{16,80}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const body = req.body || {}
  const { patient = {}, therapist = {}, session = {} } = body
  const idempotencyKey = String(body.idempotencyKey || '')

  if (!KEY_RE.test(idempotencyKey)) return res.status(400).json({ error: 'Missing booking key.' })
  if (!str(patient.firstName) || !str(patient.lastName)) return res.status(400).json({ error: 'Patient first and last name are required.' })
  if (!str(patient.birthdate) || !str(patient.address)) return res.status(400).json({ error: 'Patient birthdate and address are required.' })
  if (!asObjectId(therapist.id)) return res.status(400).json({ error: 'Please choose a therapist.' })
  if (!str(session.timeSlot)) return res.status(400).json({ error: 'Please choose a time slot.' })
  if (await tooManyRequests(res, `booking-start:${req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip'}`, { max: 20, windowMs: 15 * 60 * 1000 })) return

  try {
    const db = await getDb()
    const now = new Date()
    await ensureIndexes(db)
    await expireStaleHolds(db, now).catch((e) => console.error('expireStaleHolds failed:', e.message))

    // Same key again (double click, retry, refresh): hand back the booking we already made.
    const existing = await db.collection('appointments').findOne({ booking_key: idempotencyKey })
    if (existing) {
      return res.status(200).json({ bookingId: String(existing._id), accessToken: null, replay: true, amount: ONLINE_AMOUNT_PESOS, currency: CURRENCY, holdExpiresAt: existing.hold_expires_at || null })
    }

    // 1. Is the slot free? (a paid/held booking blocks it; an expired hold does not)
    const probe = createProbe(body)
    const taken = () => db.collection('appointments').findOne(activeSlotFilter(probe.employeeId, probe.sessionDate, probe.start, now))
    if (await taken()) return res.status(409).json({ error: PAYMENT_MESSAGES.slot_taken, code: 'SLOT_TAKEN' })

    // 2. Lock it (atomic: only one patient can win), then check once more.
    const appointmentId = new ObjectId()
    const key = slotKey(probe.employeeId, probe.sessionDate, probe.start)
    if (!(await acquireSlotLock(db, key, appointmentId, HOLD_MS, now))) return res.status(409).json({ error: PAYMENT_MESSAGES.slot_taken, code: 'SLOT_TAKEN' })
    if (await taken()) {
      await releaseSlotLock(db, key, appointmentId)
      return res.status(409).json({ error: PAYMENT_MESSAGES.slot_taken, code: 'SLOT_TAKEN' })
    }

    // 3. Create the patient + the held appointment.
    const { token, hash } = newToken()
    let created
    try {
      created = await createBookingRecords(db, body, {
        _id: appointmentId, booking_key: idempotencyKey, source: 'booking',
        payment_state: 'awaiting_payment', hold_expires_at: new Date(now.getTime() + HOLD_MS), access_token_hash: hash,
        total_due: ONLINE_AMOUNT_PESOS, payment_method: null,
      })
    } catch (err) {
      await releaseSlotLock(db, key, appointmentId)
      if (err.code === 11000) { // a parallel request with the same key won
        const winner = await db.collection('appointments').findOne({ booking_key: idempotencyKey })
        if (winner) return res.status(200).json({ bookingId: String(winner._id), accessToken: null, replay: true, amount: ONLINE_AMOUNT_PESOS, currency: CURRENCY, holdExpiresAt: winner.hold_expires_at || null })
      }
      throw err
    }
    await markAvailability(db, created.appointmentDoc, true)

    return res.status(201).json({
      bookingId: String(appointmentId), accessToken: token,
      amount: ONLINE_AMOUNT_PESOS, currency: CURRENCY, holdExpiresAt: created.appointmentDoc.hold_expires_at,
    })
  } catch (err) {
    console.error('bookings/start error:', err)
    return res.status(500).json({ error: 'We could not start your booking. Please try again.' })
  }
}

// Works out which slot is being asked for, without creating anything.
function createProbe(body) {
  const { therapist = {}, session = {} } = body
  const { start } = parseSlot(session.timeSlot)
  const sessionDate = new Date(Date.UTC(Number(session.year), Number(session.month), Number(session.day)))
  return { employeeId: asObjectId(therapist.id), sessionDate, start }
}
