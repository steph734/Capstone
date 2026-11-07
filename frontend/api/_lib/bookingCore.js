// Shared booking logic: creating the patient + appointment records, and holding a time slot.
//
// Used by:
//   routes/appointments-create.js  pay-at-clinic (cash) bookings, as before
//   routes/bookings-start.js       online bookings: the slot is HELD first, paid for second
import mongoose from 'mongoose'
import crypto from 'crypto'

import { NOT_A_REAL_BOOKING } from './pricing.js'

const { ObjectId } = mongoose.Types

const PHOTO_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png']
const MAX_PHOTO_BYTES = 1 * 1024 * 1024 // the client sends a 512x512 compressed image, normally 30-120KB

export const asObjectId = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null)
export const str = (v) => (v == null ? '' : String(v).trim())

// `photo` arrives as a data URL. Returns { buffer, contentType } or null, so a booking never fails because of a bad photo.
function decodePhoto(photo) {
  const dataUrl = String(photo || '').trim()
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const [, mimeType, base64] = match
  if (!PHOTO_MIME_TYPES.includes(mimeType)) return null
  let buffer
  try { buffer = Buffer.from(base64, 'base64') } catch { return null }
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return null
  return { buffer, contentType: mimeType }
}

// Maps the booking form's single "session mode" dropdown onto the schema's two axes.
const MODE_MAP = {
  'in-person': { session_mode: 'In-Person', session_type: null },
  cognitive: { session_mode: 'In-Person', session_type: 'Cognitive' },
  speech: { session_mode: 'In-Person', session_type: 'Speech' },
  behavioral: { session_mode: 'In-Person', session_type: 'Behavioral' },
}

// "10:00 - 11:00 AM" / "1:00 - 2:00 PM"  ->  { start: "10:00", end: "11:00" }
export function parseSlot(label) {
  const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return { start: '00:00', end: '00:00' }
  const mer = m[5].toUpperCase()
  const to24 = (h, mm) => {
    let hh = parseInt(h, 10)
    if (mer === 'PM' && hh !== 12) hh += 12
    if (mer === 'AM' && hh === 12) hh = 0
    return `${String(hh).padStart(2, '0')}:${mm}`
  }
  return { start: to24(m[1], m[2]), end: to24(m[3], m[4]) }
}

const PAYMENT_MAP = { cash: 'Cash', stripe: 'Stripe', gcash: 'GCash QR' }

// Creates the patient (+ photo, + disorder link) and the appointment. `extra` is merged into the appointment,
// which is how an online booking is created as an unpaid HOLD (see bookings-start.js).
export async function createBookingRecords(db, body, extra = {}) {
  const { patient = {}, therapist = {}, session = {}, payment = {}, bookedBy = {}, photo = null } = body
  const now = new Date()

  // 1. Who booked it: an id if we have one, else look the user up by email.
  let bookedById = asObjectId(bookedBy.id)
  if (!bookedById && str(bookedBy.email)) {
    const u = await db.collection('users').findOne({ email: str(bookedBy.email).toLowerCase() })
    if (u) bookedById = u._id
  }

  // 1b. Photo, if the parent uploaded one. Best-effort.
  let photoRecord = null
  const decodedPhoto = decodePhoto(photo)
  if (decodedPhoto) {
    try {
      const publicId = crypto.randomBytes(16).toString('hex')
      const photoRes = await db.collection('patient_photos').insertOne({
        public_id: publicId, patient_id: null, content_type: decodedPhoto.contentType, data: decodedPhoto.buffer,
        size_bytes: decodedPhoto.buffer.length, width: 512, height: 512, created_at: now,
      })
      photoRecord = { id: photoRes.insertedId, publicId, url: `/api/patient-photos/${publicId}` }
    } catch (err) {
      console.error('booking: failed to store the photo:', err)
    }
  }

  // 2. Patient record. `patients` has a unique index on `PatientID` (a legacy key the app never reads);
  // it just needs a unique value per insert so it does not collide on null.
  const patientDoc = {
    PatientID: new ObjectId().toString(),
    user_id: bookedById || null,
    first_name: str(patient.firstName), middle_name: null, last_name: str(patient.lastName),
    nickname: str(patient.nickname) || null,
    gender: ['Male', 'Female', 'Other'].includes(patient.gender) ? patient.gender : 'Other',
    birthdate: new Date(patient.birthdate),
    address: str(patient.address),
    contact_number: str(patient.contactNumber),
    email: str(patient.email) || null,
    guardian_first_name: str(patient.guardianFirst), guardian_last_name: str(patient.guardianLast),
    guardian_relationship: ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other'].includes(patient.relationship) ? patient.relationship : 'Guardian',
    guardian_contact_number: str(patient.contactNumber) || null,
    guardian_email: str(patient.email) || null,
    profile_photo: photoRecord ? { photo_id: photoRecord.id, url: photoRecord.url, uploaded_at: now } : null,
    created_at: now, updated_at: now,
  }
  // The same child booking again (same account email, name and birthdate) keeps ONE patient record. Creating a new
  // record per booking is what left a guardian with many copies of the same child, so game plans, home practice and
  // rewards ended up spread over different records.
  const existingPatient = patientDoc.email
    ? await db.collection('patients').findOne({
      email: { $in: [patientDoc.email, patientDoc.email.toLowerCase()] },
      first_name: { $regex: `^${patientDoc.first_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      last_name: { $regex: `^${patientDoc.last_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      birthdate: patientDoc.birthdate,
    })
    : null
  const patientId = existingPatient ? existingPatient._id : (await db.collection('patients').insertOne(patientDoc)).insertedId

  if (photoRecord) {
    try { await db.collection('patient_photos').updateOne({ _id: photoRecord.id }, { $set: { patient_id: patientId } }) } catch (err) { console.error('booking: failed to link the photo:', err) }
  }

  // 2b. Best-effort: register the condition as a disorder + link it.
  if (str(patient.condition) && !existingPatient) { // (a reused record already has its condition linked)
    try {
      const name = str(patient.condition)
      const d = await db.collection('disorders').findOneAndUpdate({ disorder_name: name }, { $setOnInsert: { disorder_name: name } }, { upsert: true, returnDocument: 'after' })
      const disorderId = (d && (d.value?._id || d._id)) || null
      if (disorderId) await db.collection('patient_disorders').insertOne({ patient_id: patientId, disorder_id: disorderId })
    } catch { /* non-critical */ }
  }

  // 3. Appointment.
  const { start, end } = parseSlot(session.timeSlot)
  const modeMap = MODE_MAP[session.mode] || { session_mode: 'In-Person', session_type: null }
  const year = Number(session.year)
  const month = Number(session.month) // 0-based, as the calendar keys it
  const day = Number(session.day)
  const sessionDate = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(Date.UTC(year, month, day)) : now
  const total = Number(payment.total) || null
  const method = PAYMENT_MAP[String(payment.method || '').toLowerCase()] || null

  const appointmentDoc = {
    employee_id: asObjectId(therapist.id) || null,
    patient_id: patientId, payment_id: null, booked_by: bookedById || null,
    patient_name: `${patientDoc.first_name} ${patientDoc.last_name}`.trim(),
    patient_photo_id: photoRecord?.id || null, patient_photo_url: photoRecord?.url || null,
    therapist_name: str(therapist.name) || null, therapist_role: str(therapist.role) || null,
    guardian_name: `${patientDoc.guardian_first_name} ${patientDoc.guardian_last_name}`.trim() || null,
    contact_number: patientDoc.contact_number || null, contact_email: patientDoc.email,
    session_date: sessionDate, start_time: start, end_time: end, time_slot_label: str(session.timeSlot) || null,
    session_mode: modeMap.session_mode, session_type: modeMap.session_type, condition: str(patient.condition) || null,
    status: 'Pending', cancelled_reason: null,
    session_fee: Number(payment.sessionFee) || null, service_charge: Number(payment.serviceCharge) || null, total_due: total, payment_method: method,
    created_at: now, updated_at: now, is_archived: false, archived_at: null,
    ...extra,
  }
  const apptRes = await db.collection('appointments').insertOne(appointmentDoc)
  const appointmentId = apptRes.insertedId
  return { appointmentId, patientId, sessionDate, start, end, appointmentDoc: { ...appointmentDoc, _id: appointmentId } }
}

/* ───────────────────────── slot holding ───────────────────────── */

// Query fragment: only appointments whose booking is real (see NOT_A_REAL_BOOKING in pricing.js).
export { NOT_A_REAL_BOOKING }
export const realBookingsOnly = { payment_state: { $nin: NOT_A_REAL_BOOKING } }

export const dateKeyOf = (d) => new Date(d).toISOString().slice(0, 10)
export const slotKey = (employeeId, date, start) => `${String(employeeId)}|${dateKeyOf(date)}|${start}`

// An appointment blocks its slot unless it is an unpaid hold that has run out.
export function activeSlotFilter(employeeId, sessionDate, start, now = new Date(), exceptId = null) {
  return {
    employee_id: employeeId,
    session_date: sessionDate,
    start_time: start,
    status: { $in: ['Pending', 'Confirmed'] },
    is_archived: { $ne: true },
    $or: [{ payment_state: { $ne: 'awaiting_payment' } }, { hold_expires_at: { $gt: now } }],
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }
}

// Atomic lock: only ONE caller can take a slot at a time (the lock's _id is the slot).
// A lock that expired or was released can be taken over. Returns true if we now hold it.
export async function acquireSlotLock(db, key, appointmentId, ttlMs, now = new Date()) {
  try {
    await db.collection('slot_holds').updateOne(
      { _id: key, $or: [{ expires_at: { $lte: now } }, { released: true }, { appointment_id: appointmentId }] },
      { $set: { appointment_id: appointmentId, expires_at: new Date(now.getTime() + ttlMs), released: false, updated_at: now } },
      { upsert: true },
    )
    return true
  } catch (err) {
    if (err.code === 11000) return false // somebody else holds it
    throw err
  }
}
export async function extendSlotLock(db, key, appointmentId, ttlMs, now = new Date()) {
  await db.collection('slot_holds').updateOne({ _id: key, appointment_id: appointmentId }, { $set: { expires_at: new Date(now.getTime() + ttlMs), released: false, updated_at: now } })
}
export async function releaseSlotLock(db, key, appointmentId) {
  await db.collection('slot_holds').updateOne({ _id: key, appointment_id: appointmentId }, { $set: { released: true, updated_at: new Date() } })
}

// The therapist's own "available slots" list: mark a slot booked / free again (best-effort, as before).
export async function markAvailability(db, appointment, booked) {
  const employeeId = appointment.employee_id
  if (!employeeId || !appointment.start_time) return
  const dateKey = dateKeyOf(appointment.session_date)
  try {
    if (booked) {
      await db.collection('therapist_availability').updateOne(
        { therapist: employeeId, date: dateKey, slots: { $elemMatch: { start: appointment.start_time, status: 'available' } } },
        { $set: { 'slots.$.status': 'booked', 'slots.$.appointment': appointment._id, updated_at: new Date() } },
      )
    } else {
      await db.collection('therapist_availability').updateOne(
        { therapist: employeeId, date: dateKey, slots: { $elemMatch: { start: appointment.start_time, appointment: appointment._id } } },
        { $set: { 'slots.$.status': 'available', 'slots.$.appointment': null, updated_at: new Date() } },
      )
    }
  } catch (err) {
    console.error('booking: could not update the availability slot:', err)
  }
}

// Gives a held slot back (payment failed, timed out, was cancelled, or was rejected).
export async function releaseHold(db, appointment, reason = 'expired') {
  const now = new Date()
  await db.collection('appointments').updateOne(
    { _id: appointment._id, payment_state: { $in: ['awaiting_payment', 'pending_verification'] } },
    { $set: { status: 'Cancelled', cancelled_reason: 'Payment was not completed', payment_state: reason, hold_expires_at: null, updated_at: now } },
  )
  if (appointment.employee_id) await releaseSlotLock(db, slotKey(appointment.employee_id, appointment.session_date, appointment.start_time), appointment._id)
  await markAvailability(db, appointment, false)
}

// Releases every unpaid hold whose time ran out. Called before each new booking and by the cron job.
export async function expireStaleHolds(db, now = new Date()) {
  const stale = await db.collection('appointments').find({ payment_state: { $in: ['awaiting_payment', 'pending_verification'] }, hold_expires_at: { $lte: now } }).toArray()
  for (const appt of stale) {
    await releaseHold(db, appt, 'expired')
    await db.collection('payment_attempts').updateMany({ appointment_id: appt._id, status: { $in: ['created', 'processing', 'requires_action', 'pending_verification'] } }, { $set: { status: 'expired', failure_code: 'timeout', updated_at: now } })
  }
  return stale.length
}
