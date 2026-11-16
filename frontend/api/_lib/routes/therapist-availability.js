import { getMongo } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { Attendance } from '../models/attendance.js'
import { TherapistAvailability } from '../models/therapistAvailability.js'
import { TherapistAvailabilityUndo } from '../models/therapistAvailabilityUndo.js'
import '../models/branch.js'
import { requireSession } from '../session.js'
import { AVAILABILITY_SLOTS, SLOT_STARTS, clinicHour, slotLabelFor } from '../../../src/utils/availabilitySlots.js'

const CLINIC_TIMEZONE = 'Asia/Manila'
const UNDO_WINDOW_MS = 2 * 60 * 1000
const MAX_RANGE_DAYS = 62
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const todayStamp = () => dayKeyFormatter.format(new Date())

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// Slot objects the client renders: only what the card needs.
const publicSlots = (slots) => (slots || []).map((s) => ({ start: s.start, end: s.end, status: s.status }))
const snapshotOf = (record) => (record
  ? { existed: true, status: record.status, slots: publicSlots(record.slots), confirmed_at: record.confirmed_at || null }
  : { existed: false, status: null, slots: null, confirmed_at: null })

// Routes:
//   GET  /api/therapist/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
//   PUT  /api/therapist/availability/:date           { slots: ['08:00', ...], requestId }
//   POST /api/therapist/availability/:date/undo      { requestId }
// The therapist is always the signed-in user; no id or email is read from the client.
export default async function handler(req, res) {
  try {
    const ctx = await requireSession(req, res, { roles: ['Therapist'] })
    if (!ctx) return
    await getMongo()
    const employee = await Employee.findOne({ email: String(ctx.user.email || '').trim().toLowerCase() }).populate('branch_id', 'branch_name')
    if (!employee) throw new ApiError(404, 'NOT_ALLOWED', 'No staff record is linked to this account yet.')

    const isUndo = /\/undo\/?$/.test(String(req.path || req.url || '').split('?')[0])
    if (req.method === 'GET' && !req.params?.date) return await list(req, res, employee)
    if (req.method === 'PUT' && req.params?.date && !isUndo) return await save(req, res, employee)
    if (req.method === 'POST' && req.params?.date && isUndo) return await undo(req, res, employee)
    res.setHeader('Allow', 'GET, PUT, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, code: err.code })
    console.error('therapist/availability error:', err)
    return res.status(500).json({ error: 'Could not save your availability. Please try again.' })
  }
}

async function list(req, res, employee) {
  const today = todayStamp()
  const from = String(req.query.from || today)
  const to = String(req.query.to || from)
  if (!isRealDate(from) || !isRealDate(to) || to < from) throw new ApiError(400, 'INVALID_SLOT', 'Invalid date range.')
  if ((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000 > MAX_RANGE_DAYS) {
    throw new ApiError(400, 'INVALID_SLOT', `Date range is limited to ${MAX_RANGE_DAYS} days.`)
  }
  const docs = await TherapistAvailability.find({
    therapist: employee._id, date: { $gte: from, $lte: to }, is_archived: { $ne: true },
  }).lean()
  return res.status(200).json({
    records: docs.map((d) => ({ date: d.date, status: d.status, slots: publicSlots(d.slots), updatedAt: d.updated_at || null })),
  })
}

function parseBody(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  if (!REQUEST_ID_RE.test(requestId)) throw new ApiError(400, 'INVALID_SLOT', 'Missing or invalid request id.')
  return { body, requestId }
}

async function save(req, res, employee) {
  const date = String(req.params.date || '')
  const { body, requestId } = parseBody(req)

  if (!isRealDate(date)) throw new ApiError(400, 'INVALID_SLOT', 'Invalid date.')
  const today = todayStamp()
  if (date < today) throw new ApiError(400, 'SLOT_IN_PAST', "Past dates can't be edited.")

  // Retry of a request that already went through: replay the stored answer.
  const memo = await TherapistAvailabilityUndo.findOne({ therapist: employee._id, date }).lean()
  if (memo?.request_id === requestId && memo.response) return res.status(200).json(memo.response)

  // Schema: array of unique, allowed 'HH:mm' starts; at least one; at most the grid size.
  const raw = body.slots
  if (!Array.isArray(raw) || raw.length === 0) throw new ApiError(400, 'INVALID_SLOT', 'Select at least one slot.')
  if (raw.length > AVAILABILITY_SLOTS.length) throw new ApiError(400, 'INVALID_SLOT', 'Too many slots for one day.')
  const submitted = new Set()
  for (const v of raw) {
    if (typeof v !== 'string' || !SLOT_STARTS.includes(v)) throw new ApiError(400, 'INVALID_SLOT', 'One of the selected slots does not exist.')
    if (submitted.has(v)) throw new ApiError(400, 'INVALID_SLOT', 'Duplicate slots were submitted.')
    submitted.add(v)
  }

  const existing = await TherapistAvailability.findOne({ therapist: employee._id, date, is_archived: { $ne: true } })
  const existingByStart = new Map((existing?.slots || []).map((s) => [s.start, s]))

  const isToday = date === today
  const hourNow = clinicHour(new Date(), CLINIC_TIMEZONE)
  const pastStarts = new Set(isToday ? AVAILABILITY_SLOTS.filter((s) => hourNow >= s.endHour).map((s) => s.start) : [])

  // A slot that already has a patient booking cannot be taken away.
  for (const s of existing?.slots || []) {
    if (s.status === 'booked' && !submitted.has(s.start)) {
      throw new ApiError(409, 'SLOT_HAS_BOOKING', `${slotLabelFor(s.start)} already has an appointment.`)
    }
  }
  // Slots that already ended can't be newly opened. Ones already on record are history and stay as they are.
  for (const start of submitted) {
    if (pastStarts.has(start) && !existingByStart.has(start)) {
      throw new ApiError(400, 'SLOT_IN_PAST', `${slotLabelFor(start)} has already passed.`)
    }
  }

  const slots = AVAILABILITY_SLOTS
    .filter((def) => submitted.has(def.start) || (pastStarts.has(def.start) && existingByStart.has(def.start)))
    .map((def) => {
      const prior = existingByStart.get(def.start)
      if (prior?.status === 'booked') return { start: prior.start, end: prior.end, status: 'booked', appointment: prior.appointment || null }
      return { start: def.start, end: def.end, status: 'available', appointment: null }
    })

  const timeIn = await Attendance.findOne({ employee: employee._id, type: 'time_in', is_archived: { $ne: true } }).sort({ scanned_at: -1 })
  const name = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
  const previous = snapshotOf(existing)

  const record = await TherapistAvailability.findOneAndUpdate(
    { therapist: employee._id, date },
    {
      $set: {
        therapist_name: name,
        branch_id: employee.branch_id?._id || null,
        branch_name: employee.branch_id?.branch_name || null,
        timezone: CLINIC_TIMEZONE,
        attendance: timeIn?._id || null,
        slots,
        status: 'confirmed',
        confirmed_at: new Date(),
        is_archived: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const response = { date, status: record.status, slots: publicSlots(record.slots), updatedAt: (record.updated_at || new Date()).toISOString?.() || record.updated_at, previous }
  await TherapistAvailabilityUndo.findOneAndUpdate(
    { therapist: employee._id, date },
    { $set: { request_id: requestId, response, previous, undone: false, undo_request_id: null, undo_response: null, saved_at: new Date() } },
    { upsert: true }
  )
  return res.status(200).json(response)
}

async function undo(req, res, employee) {
  const date = String(req.params.date || '')
  const { requestId } = parseBody(req)
  if (!isRealDate(date)) throw new ApiError(400, 'INVALID_SLOT', 'Invalid date.')

  const memo = await TherapistAvailabilityUndo.findOne({ therapist: employee._id, date })
  if (memo?.undo_request_id === requestId && memo.undo_response) return res.status(200).json(memo.undo_response)
  if (!memo || memo.undone || !memo.previous || Date.now() - new Date(memo.saved_at).getTime() > UNDO_WINDOW_MS) {
    throw new ApiError(410, 'UNDO_EXPIRED', 'This change can no longer be undone.')
  }
  if (date < todayStamp()) throw new ApiError(400, 'SLOT_IN_PAST', "Past dates can't be edited.")

  const current = await TherapistAvailability.findOne({ therapist: employee._id, date, is_archived: { $ne: true } })
  const prev = memo.previous
  // A patient booked something in the new window that the old schedule didn't have: undoing would orphan it.
  const prevBooked = new Set((prev.slots || []).filter((s) => s.status === 'booked').map((s) => s.start))
  const newlyBooked = (current?.slots || []).find((s) => s.status === 'booked' && !prevBooked.has(s.start))
  if (newlyBooked) {
    throw new ApiError(409, 'SLOT_HAS_BOOKING', `Can't undo: ${slotLabelFor(newlyBooked.start)} has already been booked by a patient.`)
  }

  let response
  if (!prev.existed) {
    await TherapistAvailability.deleteOne({ therapist: employee._id, date })
    response = { date, status: null, slots: null, updatedAt: new Date().toISOString(), restored: true }
  } else {
    // Keep appointment links for slots that are still booked.
    const currentByStart = new Map((current?.slots || []).map((s) => [s.start, s]))
    const slots = (prev.slots || []).map((s) => {
      const live = currentByStart.get(s.start)
      return { start: s.start, end: s.end, status: s.status, appointment: s.status === 'booked' ? live?.appointment || null : null }
    })
    const record = await TherapistAvailability.findOneAndUpdate(
      { therapist: employee._id, date },
      { $set: { slots, status: prev.status || 'confirmed', confirmed_at: prev.confirmed_at || null } },
      { new: true }
    )
    response = { date, status: record.status, slots: publicSlots(record.slots), updatedAt: (record.updated_at || new Date()).toISOString?.() || record.updated_at, restored: true }
  }
  memo.undone = true
  memo.undo_request_id = requestId
  memo.undo_response = response
  await memo.save()
  return res.status(200).json(response)
}
