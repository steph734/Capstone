import crypto from 'crypto'
import { getDb } from '../mongo.js'
import { insertPaymentWithRef } from '../paymentRef.js'
import { createBookingRecords, activeSlotFilter, markAvailability, expireStaleHolds, str } from '../bookingCore.js'

// POST /api/appointments/create: a pay-at-clinic (cash) booking.
//
// Online payments (card, GCash QR, Maya QR) do NOT come through here any more. They go through the
// secure checkout: POST /api/bookings/start holds the slot first, and the booking is only confirmed after
// the payment is verified on the SERVER (see bookings-start.js, payments-status.js and stripe-webhook.js).
// This route used to trust the browser's claim "I paid", which let anyone create a paid booking for free.
const resolvePaymentMethod = (payment) => (String(payment.method || '').toLowerCase() === 'cash' ? 'cash' : null)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const { patient = {}, therapist = {}, session = {}, payment = {} } = body

  if (!str(patient.firstName) || !str(patient.lastName)) {
    return res.status(400).json({ error: 'Patient first and last name are required.' })
  }
  if (!str(patient.birthdate) || !str(patient.address)) {
    return res.status(400).json({ error: 'Patient birthdate and address are required.' })
  }
  if (String(payment.method || '').toLowerCase() !== 'cash') {
    return res.status(400).json({ error: 'Online payments are booked through the secure checkout. Please start your booking again.' })
  }

  try {
    const db = await getDb()
    const now = new Date()
    await expireStaleHolds(db, now).catch(() => {})

    const { appointmentId, patientId, appointmentDoc } = await createBookingRecords(db, body)

    // The slot must still be free (a held or booked slot blocks it).
    if (appointmentDoc.employee_id && appointmentDoc.start_time) {
      const clash = await db.collection('appointments').findOne(activeSlotFilter(appointmentDoc.employee_id, appointmentDoc.session_date, appointmentDoc.start_time, now, appointmentId))
      if (clash) {
        await db.collection('appointments').updateOne({ _id: appointmentId }, { $set: { status: 'Cancelled', cancelled_reason: 'Time slot was already taken', updated_at: new Date() } })
        return res.status(409).json({ error: 'That time slot was just taken. Please pick another time.', code: 'SLOT_TAKEN' })
      }
    }

    // Flip the therapist's availability slot (if they opened one) so a second patient can't book it too.
    await markAvailability(db, appointmentDoc, true)

    // Payment row. Cash is recorded as pending until the clinic receives it. `paymentRecorded` is returned
    // so the confirmation screen can tell the payer whether the payment row was really written.
    const total = Number(payment.total) || null
    const paymentMethod = resolvePaymentMethod(payment)
    let paymentRecorded = false
    let paymentError = null
    let paymentRef = null
    if (paymentMethod && total != null) {
      try {
        const payDoc = await insertPaymentWithRef(db.collection('payments'), {
          // Unique legacy key (the collection has a unique index on PaymentID); without a value every second insert collides on null.
          PaymentID: `PAY-${crypto.randomUUID()}`,
          payment_for: 'appointment',
          appointment_id: appointmentId,
          patient_id: patientId,
          amount: total,
          currency: 'PHP',
          method: paymentMethod,
          payment_date: now,
          status: 'pending',
        })
        await db.collection('appointments').updateOne({ _id: appointmentId }, { $set: { payment_id: payDoc._id, updated_at: new Date() } })
        paymentRecorded = true
        paymentRef = payDoc.payment_ref
      } catch (err) {
        console.error('appointments/create: failed to record payment:', err)
        paymentError = err.message || 'Could not record the payment.'
      }
    }

    return res.status(201).json({ success: true, appointmentId, patientId, paymentRecorded, paymentError, paymentRef, amount: total, method: paymentMethod })
  } catch (err) {
    console.error('appointments/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the appointment.' })
  }
}
