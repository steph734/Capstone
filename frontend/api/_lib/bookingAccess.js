// Who may look at or change ONE booking / payment attempt.
//
// The patient who started the booking holds a random secret (the "booking token"), sent in the
// `x-booking-token` header. It is checked against a SHA-256 stored on the appointment. This works even for
// patients without a server login, and the token cannot be guessed. A wrong id or token gets the same 404.
import { ObjectId } from 'mongodb'
import { tokenMatches } from './paymentAttempts.js'

export const tokenOf = (req) => String(req.headers?.['x-booking-token'] || '')

export async function loadBooking(db, req, res, id) {
  if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) { res.status(404).json({ error: 'Booking not found.' }); return null }
  const appointment = await db.collection('appointments').findOne({ _id: new ObjectId(String(id)) })
  if (!appointment || !tokenMatches(tokenOf(req), appointment.access_token_hash)) { res.status(404).json({ error: 'Booking not found.' }); return null }
  return appointment
}

export async function loadAttempt(db, req, res, attemptId) {
  if (!/^[a-f0-9]{24}$/i.test(String(attemptId || ''))) { res.status(404).json({ error: 'Payment not found.' }); return null }
  const attempt = await db.collection('payment_attempts').findOne({ _id: new ObjectId(String(attemptId)) })
  if (!attempt) { res.status(404).json({ error: 'Payment not found.' }); return null }
  const appointment = await db.collection('appointments').findOne({ _id: attempt.appointment_id })
  if (!appointment || !tokenMatches(tokenOf(req), appointment.access_token_hash)) { res.status(404).json({ error: 'Payment not found.' }); return null }
  return { attempt, appointment }
}
