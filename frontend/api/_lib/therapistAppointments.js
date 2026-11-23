// Therapist "Appointments" page: everything it reads and changes, scoped to the signed-in therapist.
//
// Real field names used (see api/_lib/bookingCore.js): appointments { employee_id, patient_id, patient_name, guardian_name,
// contact_email, session_date (UTC midnight of the Manila calendar day), start_time / end_time ('HH:mm', Manila), session_type,
// session_mode, status ('Pending' | 'Confirmed' | 'Completed' | 'Cancelled'), payment_state, is_archived, archived_at, created_at }.
// The request review itself (payment check, accept, decline) stays in requestReview.js: this file only reads it.
import { ObjectId } from 'mongodb'
import { realBookingsOnly, activeSlotFilter, slotKey, acquireSlotLock, releaseSlotLock, markAvailability, dateKeyOf } from './bookingCore.js'
import { listRequests } from './requestReview.js'
import { sessionStart } from './sessionRecommendations.js'
import { AVAILABILITY_SLOTS } from '../../src/utils/availabilitySlots.js'

export class ApptError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra }
}

// The clinic does not run on these weekdays (0 = Sunday). A day the therapist skipped in their availability is closed too.
export const CLOSED_WEEKDAYS = [0]
const CLINIC = 'Main Clinic'
const ACTIVE = ['Confirmed', 'Pending']
const PAGE_SIZE = 7
const LOCK_TTL_MS = 100 * 365 * 24 * 60 * 60 * 1000 // a confirmed booking keeps its slot until it is moved or ended

const manilaKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
const dayDate = (key) => new Date(`${key}T00:00:00Z`)
const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m }
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const isOid = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''))

async function branchName(db, employee) {
  if (!employee.branch_id) return CLINIC
  const b = await db.collection('branchs').findOne({ _id: employee.branch_id }, { projection: { branch_name: 1 } }).catch(() => null)
  return b?.branch_name || CLINIC
}

const mine = (employee) => ({ employee_id: employee._id, ...realBookingsOnly })

// ── 1. numbers on the five cards ──
export async function summary(db, employee) {
  const col = db.collection('appointments')
  const today = dayDate(manilaKey())
  const [todayCount, scheduled, completed, archived, reqs] = await Promise.all([
    col.countDocuments({ ...mine(employee), is_archived: { $ne: true }, status: { $in: ['Confirmed', 'Pending', 'Completed'] }, session_date: today }),
    col.countDocuments({ ...mine(employee), is_archived: { $ne: true }, status: { $in: ACTIVE } }),
    col.countDocuments({ ...mine(employee), is_archived: { $ne: true }, status: 'Completed' }),
    col.countDocuments({ ...mine(employee), is_archived: true }),
    listRequests(db, employee),
  ])
  return { today: todayCount, scheduled, needsResponse: reqs.requests.length, completed, archived }
}

// ── 2. calendar dots for one month ──
export async function calendar(db, employee, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new ApptError(400, 'INVALID_MONTH', 'Use a month like 2026-11.')
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const [appts, records] = await Promise.all([
    db.collection('appointments').aggregate([
      { $match: { ...mine(employee), is_archived: { $ne: true }, status: { $in: ['Confirmed', 'Pending', 'Completed'] }, session_date: { $gte: dayDate(first), $lte: dayDate(last) } } },
      { $group: { _id: '$session_date', count: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ACTIVE] }, 1, 0] } } } },
    ]).toArray(),
    db.collection('therapist_availability').find({ therapist: employee._id, date: { $gte: first, $lte: last }, is_archived: { $ne: true } }, { projection: { date: 1, status: 1 } }).toArray(),
  ])
  const byDay = new Map(appts.map((a) => [dateKeyOf(a._id), a]))
  const skipped = new Set(records.filter((r) => r.status === 'skipped').map((r) => r.date))
  const days = {}
  for (let d = 1; d <= Number(last.slice(8)); d += 1) {
    const key = `${month}-${String(d).padStart(2, '0')}`
    const a = byDay.get(key)
    const closedDay = CLOSED_WEEKDAYS.includes(dayDate(key).getUTCDay()) || skipped.has(key)
    // Any day with an appointment on it (confirmed, pending or completed) shows as Booked, even on a closed weekday: the therapist must be able to see and open it.
    const state = a?.count ? 'booked' : closedDay ? 'closed' : 'available'
    days[key] = { state, count: a?.count || 0 }
  }
  return { month, days }
}

// ── 3. one day: its appointments and the open slots ──
const serviceOf = (a) => a.session_type || a.session_mode || 'Session'
const minutesOf = (a) => Math.max(15, toMin(a.end_time) - toMin(a.start_time)) || 60

export async function day(db, employee, date) {
  if (!isDay(date)) throw new ApptError(400, 'INVALID_DATE', 'Use a date like 2026-11-25.')
  const [docs, record, branch] = await Promise.all([
    db.collection('appointments').find({ ...mine(employee), is_archived: { $ne: true }, status: { $in: ['Confirmed', 'Pending', 'Completed'] }, session_date: dayDate(date) }).sort({ start_time: 1 }).toArray(),
    db.collection('therapist_availability').findOne({ therapist: employee._id, date, is_archived: { $ne: true } }),
    branchName(db, employee),
  ])
  const appointments = docs.map((a) => ({
    id: String(a._id), patientName: a.patient_name || 'Patient', branch, service: serviceOf(a), start: a.start_time, end: a.end_time, status: a.status,
  }))
  const closedDay = CLOSED_WEEKDAYS.includes(dayDate(date).getUTCDay()) || record?.status === 'skipped'
  let openSlots = []
  const past = date < manilaKey()
  if (!closedDay && !past) {
    const taken = new Set(docs.filter((a) => ACTIVE.includes(a.status)).map((a) => a.start_time))
    // The therapist's own list for the day when they made one; the standard clinic grid when they have not (the booking page does the same).
    const base = record?.status === 'confirmed' ? (record.slots || []).filter((s) => s.status === 'available') : AVAILABILITY_SLOTS
    openSlots = base.filter((s) => !taken.has(s.start)).map((s) => ({ start: s.start, end: s.end }))
    if (date === manilaKey()) { const nowMin = toMin(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }).format(new Date())); openSlots = openSlots.filter((s) => toMin(s.start) > nowMin) }
  }
  return { date, closed: closedDay, appointments, openSlots }
}

// ── 4. requests (oldest first), optionally only the first few ──
export async function requests(db, employee, limit) {
  const all = (await listRequests(db, employee)).requests.slice().sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt))
  const n = Number(limit)
  return { total: all.length, items: Number.isFinite(n) && n > 0 ? all.slice(0, n) : all }
}

// ── 5. the "All appointments" list: upcoming first (soonest first), then the past (newest first) ──
const STATUSES = ['Confirmed', 'Completed', 'Cancelled', 'Pending']
export async function list(db, employee, q = {}, now = new Date()) {
  const archivedTab = q.tab === 'archived'
  const filter = { ...mine(employee), is_archived: archivedTab ? true : { $ne: true } }
  const status = STATUSES.find((s) => s.toLowerCase() === String(q.status || '').toLowerCase())
  if (status) filter.status = status
  // Date filter: from / to, inclusive, as Manila calendar days (YYYY-MM-DD).
  const from = isDay(q.from) ? q.from : ''
  const to = isDay(q.to) ? q.to : ''
  if (from || to) filter.session_date = { ...(from ? { $gte: dayDate(from) } : {}), ...(to ? { $lte: dayDate(to) } : {}) }
  const needle = String(q.q || '').trim().slice(0, 80)
  if (needle) filter.patient_name = { $regex: escapeRe(needle), $options: 'i' }
  const docs = await db.collection('appointments').find(filter, { projection: {
    patient_id: 1, patient_name: 1, guardian_name: 1, contact_email: 1, session_date: 1, start_time: 1, end_time: 1, session_type: 1, session_mode: 1, status: 1, is_archived: 1, completed_at: 1, condition: 1,
  } }).toArray()
  const today = manilaKey(now)
  const rows = docs.map((a) => {
    const date = dateKeyOf(a.session_date)
    const startsAt = sessionStart(a)
    const started = startsAt <= now
    return {
      id: String(a._id), patientId: a.patient_id ? String(a.patient_id) : null, patientName: a.patient_name || 'Patient', guardianName: a.guardian_name || '', guardianEmail: a.contact_email || '',
      condition: a.condition || '', date, start: a.start_time, end: a.end_time, minutes: minutesOf(a), service: serviceOf(a), status: a.status, isArchived: Boolean(a.is_archived),
      past: date < today, startsAt: startsAt.toISOString(),
      // what the "More" menu may offer (the server checks again on every action)
      can: {
        reschedule: !a.is_archived && a.status === 'Confirmed' && !started,
        complete: !a.is_archived && a.status === 'Confirmed' && started,
        message: Boolean(a.patient_id),
        archive: !a.is_archived && a.status !== 'Pending' && (a.status !== 'Confirmed' || started),
        restore: Boolean(a.is_archived),
      },
    }
  })
  const key = (r) => `${r.date} ${r.start}`
  const upcoming = rows.filter((r) => !r.past).sort((a, b) => key(a).localeCompare(key(b)))
  const earlier = rows.filter((r) => r.past).sort((a, b) => key(b).localeCompare(key(a)))
  const ordered = [...upcoming, ...earlier]
  const pageSize = Math.min(20, Math.max(1, parseInt(q.pageSize, 10) || PAGE_SIZE))
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const shown = ordered.slice(0, page * pageSize) // "Show more" asks for the next page and keeps the earlier ones on screen
  return { items: shown, total: ordered.length, page, pageSize, hasMore: shown.length < ordered.length }
}

// ── 6. changes ──
async function owned(db, employee, id) {
  if (!isOid(id)) throw new ApptError(404, 'NOT_FOUND', 'Appointment not found.')
  const appt = await db.collection('appointments').findOne({ _id: new ObjectId(id) })
  if (!appt) throw new ApptError(404, 'NOT_FOUND', 'Appointment not found.')
  if (!appt.employee_id || String(appt.employee_id) !== String(employee._id)) throw new ApptError(403, 'NOT_YOUR_APPOINTMENT', 'This appointment belongs to another therapist.')
  return appt
}
export { owned as ownedAppointment }

export async function archive(db, employee, user, id, now = new Date()) {
  const appt = await owned(db, employee, id)
  if (appt.is_archived) return { ok: true, already: true }
  if (appt.status === 'Pending') throw new ApptError(409, 'NEEDS_RESPONSE', 'Accept or decline this request first.')
  if (appt.status === 'Confirmed' && sessionStart(appt) > now) throw new ApptError(409, 'UPCOMING_SESSION', 'This session has not happened yet. Complete or reschedule it first.')
  await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { is_archived: true, archived_at: now, archived_by: user.email, updated_at: now } })
  return { ok: true }
}

export async function restore(db, employee, id, now = new Date()) {
  const appt = await owned(db, employee, id)
  if (!appt.is_archived) return { ok: true, already: true }
  if (appt.status === 'Confirmed' && sessionStart(appt) > now) { // would take a slot again: it must still be free
    const clash = await db.collection('appointments').findOne(activeSlotFilter(employee._id, appt.session_date, appt.start_time, now, appt._id), { projection: { _id: 1 } })
    if (clash) throw new ApptError(409, 'SLOT_TAKEN', 'That time has been booked by someone else, so this appointment cannot be restored.')
  }
  await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { is_archived: false, archived_at: null, updated_at: now }, $unset: { archived_by: '' } })
  return { ok: true }
}

// Move a confirmed, upcoming session to another free slot. Same checks as booking: the clinic grid, the therapist's own availability for that day,
// a closed day, and the atomic slot lock (so two moves can never take the same slot).
export async function reschedule(db, employee, user, id, body, now = new Date()) {
  const appt = await owned(db, employee, id)
  if (appt.is_archived) throw new ApptError(409, 'ARCHIVED', 'Restore this appointment first.')
  if (appt.status !== 'Confirmed') throw new ApptError(409, 'ILLEGAL_TRANSITION', `Only confirmed sessions can be rescheduled (this one is ${appt.status}).`)
  if (sessionStart(appt) <= now) throw new ApptError(409, 'ALREADY_STARTED', 'This session has already started.')
  const date = String(body?.date || '')
  const start = String(body?.start || '')
  if (!isDay(date)) throw new ApptError(422, 'VALIDATION_ERROR', 'Choose a valid date.', { fields: { date: 'Choose a valid date.' } })
  const slot = AVAILABILITY_SLOTS.find((s) => s.start === start)
  if (!slot) throw new ApptError(422, 'VALIDATION_ERROR', 'Choose one of the clinic time slots.', { fields: { start: 'Choose one of the clinic time slots.' } })
  if (new Date(`${date}T${start}:00+08:00`) <= now) throw new ApptError(422, 'VALIDATION_ERROR', 'Choose a time in the future.', { fields: { date: 'Choose a time in the future.' } })
  if (date === dateKeyOf(appt.session_date) && start === appt.start_time) throw new ApptError(422, 'VALIDATION_ERROR', 'That is the current time. Choose another.', { fields: { start: 'That is the current time. Choose another.' } })

  const record = await db.collection('therapist_availability').findOne({ therapist: employee._id, date, is_archived: { $ne: true } })
  if (CLOSED_WEEKDAYS.includes(dayDate(date).getUTCDay()) || record?.status === 'skipped') throw new ApptError(409, 'DAY_CLOSED', 'The clinic is closed that day.')
  if (record?.status === 'confirmed') {
    const s = (record.slots || []).find((x) => x.start === start)
    if (!s || (s.status !== 'available' && String(s.appointment || '') !== String(appt._id))) throw new ApptError(409, 'NOT_AVAILABLE', 'You are not available at that time.')
  }
  // Any other live booking that overlaps [start, end) on that day?
  const sameDay = await db.collection('appointments').find({ employee_id: employee._id, session_date: dayDate(date), status: { $in: ACTIVE }, is_archived: { $ne: true }, _id: { $ne: appt._id } }, { projection: { start_time: 1, end_time: 1, payment_state: 1, hold_expires_at: 1 } }).toArray()
  const live = sameDay.filter((o) => o.payment_state !== 'awaiting_payment' || (o.hold_expires_at && new Date(o.hold_expires_at) > now))
  if (live.some((o) => toMin(o.start_time) < toMin(slot.end) && toMin(slot.start) < toMin(o.end_time))) throw new ApptError(409, 'SLOT_TAKEN', 'You already have a session at that time.')

  const newKey = slotKey(employee._id, dayDate(date), slot.start)
  if (!(await acquireSlotLock(db, newKey, appt._id, LOCK_TTL_MS, now))) throw new ApptError(409, 'SLOT_TAKEN', 'That time was just taken. Choose another.')
  const label = `${slot.label}`
  const r = await db.collection('appointments').updateOne({ _id: appt._id, status: 'Confirmed', is_archived: { $ne: true } }, {
    $set: { session_date: dayDate(date), start_time: slot.start, end_time: slot.end, time_slot_label: label, rescheduled_at: now, rescheduled_by: user.email, rescheduled_from: { date: dateKeyOf(appt.session_date), start: appt.start_time, end: appt.end_time }, updated_at: now },
  })
  if (!r.matchedCount) { await releaseSlotLock(db, newKey, appt._id).catch(() => {}); throw new ApptError(409, 'ILLEGAL_TRANSITION', 'This appointment changed. Reload and try again.') }
  await releaseSlotLock(db, slotKey(employee._id, appt.session_date, appt.start_time), appt._id).catch(() => {})
  await markAvailability(db, appt, false)
  await markAvailability(db, { ...appt, session_date: dayDate(date), start_time: slot.start }, true)
  return { ok: true, appointment: { id: String(appt._id), date, start: slot.start, end: slot.end }, from: { date: dateKeyOf(appt.session_date), start: appt.start_time }, appt }
}
