// Shared helpers for "Mark as completed" and "Recommend another session".
import { ObjectId } from 'mongodb'
import { SessionRecommendation } from './models/sessionRecommendation.js'

export const SESSION_TYPES = ['Cognitive', 'Speech', 'Occupational']
export const SESSION_MODES = ['In-Person', 'Online']
export const SEND_VIA = ['chat', 'email', 'in_app']
export const RECOMMENDATION_TTL_MS = 3 * 24 * 60 * 60 * 1000
export const HOLD_MS = 30 * 60 * 1000
export const DEFAULT_SESSION_FEE = 300 // same fee the booking page charges (BookAppointmentPage SESSION_FEE)
export const LIVE_STATUSES = ['Confirmed', 'Pending']

// Same fixed one-hour slots the therapist Availability modal offers.
export const DEFAULT_SLOTS = [
  { label: '8:00 - 9:00 AM', start: '08:00', end: '09:00' },
  { label: '9:00 - 10:00 AM', start: '09:00', end: '10:00' },
  { label: '10:00 - 11:00 AM', start: '10:00', end: '11:00' },
  { label: '11:00 - 12:00 PM', start: '11:00', end: '12:00' },
  { label: '1:00 - 2:00 PM', start: '13:00', end: '14:00' },
  { label: '2:00 - 3:00 PM', start: '14:00', end: '15:00' },
  { label: '3:00 - 4:00 PM', start: '15:00', end: '16:00' },
  { label: '4:00 - 5:00 PM', start: '16:00', end: '17:00' },
]

const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })
export const manilaToday = (d = new Date()) => manilaDay.format(d)

export const oid = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null)

// `session_date` is stored as Date.UTC(y, m, d), so its UTC day is the calendar day.
export const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
export const dayDate = (key) => new Date(`${key}T00:00:00.000Z`)

// The moment a session starts: its calendar day + "HH:mm", read as Asia/Manila (UTC+8, no DST).
export function sessionStart(appt) {
  return new Date(`${dayKey(appt.session_date)}T${appt.start_time || '00:00'}:00+08:00`)
}

export const publicBase = () => (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://therapypro.app'

export function fmtLongDate(key) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
export function fmt12(t) {
  const [h, m] = String(t || '').split(':').map(Number)
  if (!Number.isFinite(h)) return ''
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export const slotLabel = (start, end) => DEFAULT_SLOTS.find((s) => s.start === start)?.label || `${fmt12(start)} - ${fmt12(end)}`
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function ensureRecommendationIndexes() {
  // Best effort, once per warm instance.
  if (!ensureRecommendationIndexes.done) {
    ensureRecommendationIndexes.done = true
    SessionRecommendation.createIndexes().catch((err) => console.error('session_recommendations indexes:', err.message))
  }
}

// In-app notification — same shape every other notice in this app uses.
export async function notify(db, { email, type, title, body, link, requestId }) {
  if (!email) return
  try {
    await db.collection('notifications').insertOne({
      recipient_email: String(email).toLowerCase(), type, title, body, link: link || null,
      request_id: requestId || null, read: false, created_at: new Date(),
    })
  } catch (err) {
    console.error('notify failed:', err.message)
  }
}

// Does the patient already have a live (Confirmed/Pending) appointment from today on?
export async function hasUpcoming(db, patientId) {
  return Boolean(await db.collection('appointments').findOne({
    patient_id: patientId, status: { $in: LIVE_STATUSES }, is_archived: { $ne: true },
    session_date: { $gte: dayDate(manilaToday()) },
  }, { projection: { _id: 1 } }))
}

export async function hasOpenRecommendation(db, patientId) {
  return Boolean(await db.collection('session_recommendations').findOne(
    { patient_id: patientId, status: 'Sent', expires_at: { $gt: new Date() } }, { projection: { _id: 1 } }
  ))
}

export async function canRecommend(db, patientId) {
  if (!patientId) return false
  return !(await hasUpcoming(db, patientId)) && !(await hasOpenRecommendation(db, patientId))
}

// Flips overdue 'Sent' recommendations to 'Expired' and tells each therapist.
// Run by the scheduled job, and also opportunistically whenever recommendations
// are read, so an overdue one is never shown as open.
export async function expireStale(db) {
  const now = new Date()
  const stale = await db.collection('session_recommendations').find({ status: 'Sent', expires_at: { $lt: now } }).limit(200).toArray()
  let expired = 0
  for (const rec of stale) {
    const res = await db.collection('session_recommendations').updateOne(
      { _id: rec._id, status: 'Sent' }, { $set: { status: 'Expired', updated_at: now } }
    )
    if (!res.modifiedCount) continue
    expired += 1
    const [emp, appt] = await Promise.all([
      db.collection('employees').findOne({ _id: rec.therapist_id }, { projection: { email: 1 } }),
      db.collection('appointments').findOne({ _id: rec.appointment_id }, { projection: { patient_name: 1 } }),
    ])
    await notify(db, {
      email: emp?.email, type: 'recommendation_expired', title: 'Session recommendation expired',
      body: `${appt?.patient_name || 'A patient'}'s recommended next session wasn't booked in time.`,
      link: '/therapist/appointments', requestId: rec._id,
    })
  }
  return expired
}

// Is this signed-in user the guardian of the patient? Matches the same ways
// the rest of the app links an account to a patient (user id, or email).
export async function isGuardianOf(db, user, patientId) {
  const email = String(user.email || '').toLowerCase()
  return Boolean(await db.collection('patients').findOne({
    _id: patientId,
    $or: [{ user_id: user._id }, { email }, { guardian_email: email }],
  }, { projection: { _id: 1 } }))
}

export function serializeRecommendation(r, extra = {}) {
  return {
    id: String(r._id),
    appointmentId: String(r.appointment_id),
    patientId: String(r.patient_id),
    therapistId: String(r.therapist_id),
    sessionType: r.session_type,
    sessionMode: r.session_mode,
    durationMinutes: r.duration_minutes,
    sessionFee: r.session_fee,
    message: r.message || '',
    sentVia: r.sent_via || [],
    status: r.status,
    bookedAppointmentId: r.booked_appointment_id ? String(r.booked_appointment_id) : null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    ...extra,
  }
}
