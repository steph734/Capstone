// Server-side rules for offline sync. One function per collection decides what
// the server does with a change that was made on a device.
//
// Conflict rules (see the project's sync design):
//   gameSessions, speechRecordings  append-only  -> a retry never changes or duplicates anything
//   soapNotes (drafts)              versioned    -> if the server copy is newer, answer "conflict"
//   appointments                    validated    -> an overlapping slot for the same therapist is rejected
//
// Every handler returns ONE result object:
//   { status: 'ok' }                          saved (or already saved: pushes are idempotent)
//   { status: 'conflict', server: {...} }     SOAP note changed elsewhere (HTTP 409 equivalent)
//   { status: 'rejected', code, message }     permanent "no": do not retry
//   { status: 'error', message }              temporary problem: the client retries later
// Timestamps are ALWAYS set here (updated_at = server clock), never taken from the device.
import { ObjectId } from 'mongodb'
import { SOAP_FIELDS, encryptField, decryptField, validateSoap, cleanText } from './soapCrypto.js'
import { isAssigned, audit } from './noteAccess.js'
import completeGameSession from './routes/game-sessions-complete.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const oid = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null)
const ok = (extra = {}) => ({ status: 'ok', ...extra })
const rejected = (code, message) => ({ status: 'rejected', code, message })

// Mongo document -> plain JSON the browser stores (ObjectId -> string, Date -> ISO text).
export function toClient(value) {
  if (value instanceof ObjectId) return String(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toClient)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toClient(v)]))
  return value
}

// The server stores note text HTML-escaped; the device keeps the plain text,
// so undo the escaping on the way out (it is re-applied on the way in).
const unescapeHtml = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

// ───────────────────────────── game sessions ─────────────────────────────
// A finished offline play is "replayed": the server creates the session with
// its ORIGINAL start time, then runs the normal /complete logic, so XP, badges
// and outfits are awarded exactly once (that route is already idempotent).
async function pushGameSession(ctx, doc) {
  const { db, employee } = ctx
  const _id = oid(doc._id)
  const gameId = oid(doc.game_id)
  const activityId = oid(doc.activity_session_id)
  if (!_id || !gameId || !activityId) return rejected('BAD_DATA', 'This game record is missing its game or player.')

  const existing = await db.collection('game_sessions').findOne({ _id }, { projection: { status: 1 } })
  if (existing && existing.status !== 'in_progress') return ok() // append-only: already saved, nothing to change

  if (!existing) {
    const activity = await db.collection('activity_sessions').findOne({ _id: activityId })
    if (!activity || String(activity.therapist_id) !== String(employee._id) || !activity.patient_id || activity.mode !== 'patient') {
      return rejected('NOT_ALLOWED', 'That play session does not belong to you.')
    }
    if (!(await db.collection('games').findOne({ _id: gameId }, { projection: { _id: 1 } }))) return rejected('BAD_DATA', 'That game no longer exists.')
    const now = new Date()
    // Never trust the device clock for the future: a start time after "now" is clamped.
    const startedAt = new Date(Math.min(new Date(doc.started_at).getTime() || now.getTime(), now.getTime()))
    await db.collection('game_sessions').insertOne({
      _id, patient_id: activity.patient_id, game_id: gameId, employee_id: employee._id, activity_session_id: activityId,
      language: ['en', 'tl', 'ceb'].includes(doc.language) ? doc.language : 'en',
      status: 'in_progress', started_at: startedAt, completed_at: null, offline: true,
      result: {}, reward: {}, created_at: now, updated_at: now,
    })
  }

  // Run the existing completion route in-process and capture what it answers.
  const out = { status: 200, body: null }
  const fakeRes = { status(c) { out.status = c; return this }, json(b) { out.body = b; return this }, setHeader() {} }
  await completeGameSession({ method: 'POST', params: { id: String(_id) }, body: { result: doc.result || {} }, headers: {} }, fakeRes)
  if (out.status === 200) return ok()
  if (out.status >= 500) return { status: 'error', message: out.body?.error || 'The server could not finish this game.' }
  return rejected('COMPLETE_FAILED', out.body?.error || 'The server did not accept this game result.')
}

// ───────────────────────────── speech recordings ─────────────────────────────
// Metadata + transcript only. (The audio file itself stays in this device's IndexedDB.)
async function pushSpeechRecording(ctx, doc) {
  const { db, user, employee } = ctx
  const _id = oid(doc._id)
  if (!_id) return rejected('BAD_DATA', 'Invalid recording id.')
  if (await db.collection('speechtextrecording').findOne({ _id }, { projection: { _id: 1 } })) return ok() // append-only
  const patientId = doc.patient_id ? oid(doc.patient_id) : null
  if (doc.patient_id && (!patientId || !(await isAssigned(db, employee._id, patientId)))) return rejected('NOT_ALLOWED', 'You are not assigned to that patient.')
  const now = new Date()
  const segments = Array.isArray(doc.segments)
    ? doc.segments.slice(0, 5000).filter((s) => Number.isFinite(s?.t) && typeof s?.text === 'string').map((s) => ({ t: Math.max(0, s.t), text: s.text.slice(0, 2000) }))
    : []
  await db.collection('speechtextrecording').insertOne({
    _id, created_by: user._id, created_by_role: 'therapist',
    created_by_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ') || null,
    patient_id: patientId, patient_name: doc.patient_name ? String(doc.patient_name).slice(0, 120) : null,
    branch_id: employee.branch_id || null, session_id: null,
    title: doc.title ? String(doc.title).slice(0, 120) : null,
    transcript: doc.transcript ? String(doc.transcript).slice(0, 200000) : null,
    segments, word_count: Number.isFinite(doc.word_count) ? doc.word_count : null,
    summary: null, summary_status: 'none', language: doc.language ? String(doc.language).slice(0, 10) : null,
    file_path: null, mime_type: null, file_size: null, duration_seconds: Number.isFinite(doc.duration_seconds) ? doc.duration_seconds : null,
    status: 'active', is_archived: false, archived_at: null, archived_by: null,
    is_deleted: false, deleted_at: null, deleted_by: null, delete_reason: null, purge_after: null, restored_at: null, restored_by: null,
    created_at: now, updated_at: now,
  })
  return ok()
}

// ───────────────────────────── SOAP note drafts ─────────────────────────────
// Only DRAFTS sync. Signing needs the password and a signature, so it stays online-only.
// `baseVersion` is the server version the therapist edited from (0 = brand-new note).
export function noteForClient(n) {
  const id = String(n._id)
  const fields = Object.fromEntries(SOAP_FIELDS.map((f) => [f, unescapeHtml(decryptField(n[f], id, f) ?? '')]))
  return {
    _id: id, patient_id: String(n.patient_id), session_date: n.session_date, diagnosis: unescapeHtml(n.diagnosis || ''),
    status: n.status, voided: !!n.voided, version: n.version || 1, updated_at: toClient(n.updated_at), ...fields,
  }
}
const sameText = (a, b) => SOAP_FIELDS.every((f) => cleanText(a[f]) === cleanText(b[f]))

async function pushSoapNote(ctx, doc) {
  const { db, user, employee, ip } = ctx
  const _id = oid(doc._id)
  const patientId = oid(doc.patient_id)
  if (!_id || !patientId) return rejected('BAD_DATA', 'This note is missing its patient.')
  if (!DATE_RE.test(String(doc.session_date || ''))) return rejected('BAD_DATA', 'Invalid session date.')
  if (!(await isAssigned(db, employee._id, patientId))) {
    await audit(db, { user, action: 'denied', patientId, ip, meta: { attempted: 'sync' } })
    return rejected('NOT_ALLOWED', 'You are not assigned to this patient.')
  }
  const { errors, value } = validateSoap(doc, { complete: false })
  if (Object.keys(errors).length) return rejected('INVALID', Object.values(errors)[0])

  const id = String(_id)
  const enc = () => Object.fromEntries(SOAP_FIELDS.map((f) => [f, value[f] ? encryptField(value[f], id, f) : null]))
  const note = await db.collection('therapy_notes').findOne({ _id })
  const now = new Date()

  if (!note) {
    if (Number(doc.baseVersion) > 0) return rejected('NOT_FOUND', 'This note no longer exists on the server.')
    const patient = await db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, last_name: 1 } })
    if (!patient) return rejected('BAD_DATA', 'Patient not found.')
    const encrypted = enc()
    await db.collection('therapy_notes').insertOne({
      _id, NoteID: id, appointment_id: null, employee_id: employee._id,
      employee_name: [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' '),
      patient_id: patientId, patient_name: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || null,
      diagnosis: cleanText(doc.diagnosis).slice(0, 150) || null, title: null, session_date: doc.session_date, timezone: 'Asia/Manila',
      ...encrypted, status: 'draft', signature_image: null, signed_at: null, signed_by: null, content_hash: null,
      shared_with_guardian: false, shared_summary: null, shared_at: null, addendum_to: null, voided: false,
      version: 1, enc: 1, is_archived: false, archived_at: null, created_at: now, updated_at: now,
    })
    await db.collection('soap_note_versions').insertOne({ note_id: _id, version: 1, kind: 'create', ...encrypted, content_hash: null, created_by: user._id, created_at: now })
    await audit(db, { user, action: 'create', patientId, noteId: _id, ip, meta: { via: 'sync' } })
    return ok({ version: 1 })
  }

  if (String(note.employee_id) !== String(employee._id)) return rejected('NOT_ALLOWED', 'Only the author can edit this note.')
  if (note.status !== 'draft' || note.voided) return { status: 'conflict', code: 'NOTE_LOCKED', server: noteForClient(note) }

  const serverVersion = note.version || 1
  const base = Number(doc.baseVersion) || 0
  // A retried "create" (base 0) whose first attempt already landed: same text = same note, not a conflict.
  if (base === 0 && sameText(doc, noteForClient(note))) return ok({ version: serverVersion })
  // The server copy moved on since this device last saw it: never overwrite silently.
  if (serverVersion > base) return { status: 'conflict', code: 'NEWER_ON_SERVER', server: noteForClient(note) }

  const encrypted = enc()
  const nextVersion = serverVersion + 1
  await db.collection('therapy_notes').updateOne({ _id }, { $set: { ...encrypted, diagnosis: cleanText(doc.diagnosis).slice(0, 150) || null, version: nextVersion, updated_at: now } })
  await db.collection('soap_note_versions').insertOne({ note_id: _id, version: nextVersion, kind: 'edit', ...encrypted, content_hash: null, created_by: user._id, created_at: now })
  await audit(db, { user, action: 'edit', patientId, noteId: _id, ip, meta: { via: 'sync' } })
  return ok({ version: nextVersion })
}

// ───────────────────────────── appointments ─────────────────────────────
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const ACTIVE_STATUSES = { $nin: ['Cancelled', 'No Show'] }
const EDITABLE_STATUS = ['Confirmed', 'Completed', 'Cancelled', 'No Show']

async function pushAppointment(ctx, doc, op) {
  const { db, user, employee } = ctx
  const _id = oid(doc._id)
  if (!_id) return rejected('BAD_DATA', 'Invalid appointment id.')
  const existing = await db.collection('appointments').findOne({ _id })

  if (existing) {
    // Updates: only the therapist's own appointment, and only status + remarks.
    if (String(existing.employee_id) !== String(employee._id)) return rejected('NOT_ALLOWED', 'This is not your appointment.')
    const set = { updated_at: new Date() }
    if (doc.status && doc.status !== existing.status) {
      if (!EDITABLE_STATUS.includes(doc.status)) return rejected('INVALID', 'That status is not allowed.')
      set.status = doc.status
      if (doc.status === 'Completed') { set.completed_at = new Date(); set.completed_by = user._id }
      if (doc.status === 'Cancelled') set.cancelled_reason = doc.cancelled_reason ? String(doc.cancelled_reason).slice(0, 200) : 'Cancelled by therapist'
    }
    if (typeof doc.completion_remarks === 'string') set.completion_remarks = doc.completion_remarks.slice(0, 500)
    await db.collection('appointments').updateOne({ _id }, { $set: set }) // last write wins by server time
    return ok()
  }

  // New follow-up session booked by the therapist for a patient they already see.
  if (op === 'update') return rejected('NOT_FOUND', 'This appointment no longer exists on the server.')
  const patientId = oid(doc.patient_id)
  if (!patientId || !(await isAssigned(db, employee._id, patientId))) return rejected('NOT_ALLOWED', 'You are not assigned to that patient.')
  if (!DATE_RE.test(String(doc.session_date || '')) || !TIME_RE.test(String(doc.start_time || '')) || !TIME_RE.test(String(doc.end_time || '')) || toMin(doc.end_time) <= toMin(doc.start_time)) {
    return rejected('INVALID', 'The date or time of this appointment is not valid.')
  }
  const [y, m, d] = doc.session_date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d))
  const sameDay = await db.collection('appointments').find({
    employee_id: employee._id, session_date: day, status: ACTIVE_STATUSES, is_archived: { $ne: true }, _id: { $ne: _id },
  }, { projection: { start_time: 1, end_time: 1 } }).toArray()
  const clash = sameDay.find((a) => TIME_RE.test(a.start_time || '') && TIME_RE.test(a.end_time || '') && toMin(doc.start_time) < toMin(a.end_time) && toMin(doc.end_time) > toMin(a.start_time))
  if (clash) return rejected('SLOT_TAKEN', `That time overlaps another session (${clash.start_time}-${clash.end_time}) on ${doc.session_date}. Please pick a different slot.`)

  const patient = await db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, last_name: 1 } })
  const now = new Date()
  await db.collection('appointments').insertOne({
    _id, employee_id: employee._id, patient_id: patientId,
    patient_name: [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || null,
    therapist_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ') || null,
    session_date: day, start_time: doc.start_time, end_time: doc.end_time,
    session_mode: ['Face-to-Face', 'Online', 'In-Person'].includes(doc.session_mode) ? doc.session_mode : 'In-Person',
    session_type: doc.session_type ? String(doc.session_type).slice(0, 60) : null,
    status: 'Confirmed', source: 'therapist', is_archived: false, created_at: now, updated_at: now,
  })
  return ok()
}

// One entry from the outbox -> the right handler above.
const HANDLERS = {
  gameSessions: (ctx, e) => pushGameSession(ctx, e.doc),
  speechRecordings: (ctx, e) => pushSpeechRecording(ctx, e.doc),
  soapNotes: (ctx, e) => pushSoapNote(ctx, e.doc),
  appointments: (ctx, e) => pushAppointment(ctx, e.doc, e.op),
}
export async function applyEntry(ctx, entry) {
  const handler = HANDLERS[entry?.collection]
  if (!handler || !entry.doc || typeof entry.doc !== 'object') return rejected('BAD_DATA', 'Unknown or empty change.')
  try {
    return await handler(ctx, entry)
  } catch (err) {
    console.error(`sync push ${entry.collection}/${entry.docId}:`, err)
    return { status: 'error', message: err.status && err.status < 500 ? err.message : 'The server had a problem saving this change.' }
  }
}

// ───────────────────────────── pull ─────────────────────────────
// What this therapist's device may hold: their assigned patients, their appointments,
// their own draft notes, and their own recordings. Nothing else from the clinic.
export async function pullFor(ctx, since) {
  const { db, user, employee, ip } = ctx
  const myAppointments = await db.collection('appointments').find({ employee_id: employee._id, is_archived: { $ne: true } }).toArray()
  const patientIds = [...new Set(myAppointments.map((a) => a.patient_id).filter(Boolean).map(String))].map((s) => new ObjectId(s))

  // Small sets, so assigned patients are always sent in full (older rows may lack updated_at).
  const patients = patientIds.length
    ? await db.collection('patients').find({ _id: { $in: patientIds } }, { projection: { first_name: 1, last_name: 1, middle_name: 1, birthdate: 1, updated_at: 1 } }).toArray()
    : []

  const changed = since ? { $or: [{ updated_at: { $gt: since } }, { created_at: { $gt: since } }] } : {}
  const appointments = myAppointments.filter((a) => !since || (a.updated_at && a.updated_at > since) || (a.created_at && a.created_at > since))

  const noteRows = await db.collection('therapy_notes').find({ employee_id: employee._id, status: 'draft', voided: { $ne: true }, is_archived: false, ...changed }).toArray()
  const soapNotes = []
  for (const n of noteRows) {
    try { soapNotes.push(noteForClient(n)) } catch (err) { console.error('sync pull: could not decrypt note', String(n._id), err.message) }
  }
  if (soapNotes.length) await audit(db, { user, action: 'view', patientId: null, ip, meta: { via: 'sync', notes: soapNotes.length } })

  const speechRecordings = await db.collection('speechtextrecording').find({ created_by: user._id, is_deleted: false, ...changed }, { projection: { summary: 0, segments: 0 } }).toArray()

  return {
    patients: patients.map(toClient),
    appointments: appointments.map(toClient),
    soapNotes, // already plain JSON
    speechRecordings: speechRecordings.map(toClient),
  }
}
