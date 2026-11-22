// Therapist "My Patients": roster, detail, archive / unarchive, guarded delete, and adding a patient with its first-session payment.
// Every function takes the THERAPIST'S EMPLOYEE RECORD (resolved from the signed-in session), never an id from the request.
//
// Mapping to the real database (see README section "My Patients"):
//   patient            -> patients (guardian fields are embedded: guardian_first_name, guardian_last_name, ...)
//   therapist link     -> patient_assign (active) OR any real appointment with the therapist
//   sessions           -> appointments (employee_id, patient_id, session_date, status)
//   first-session fee  -> payments { payment_for: 'first_session' } (+ payment_receipts for a QR receipt)
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { getMongo } from './mongo.js'
import { realBookingsOnly } from './bookingCore.js'
import { manilaMidnightUtc } from './ownerGamified.js'
import { SESSION_FEE_PESOS } from './pricing.js'
import { validateReference } from './paymentProofRules.js'
import { prepareReceipt } from './receiptFile.js'
import { sendEmail } from './brevo.js'
import { getStripeClient } from './stripeClient.js'
import { makePaymentRef } from './paymentRef.js'
import { invalidateReportsCache } from './reportsCache.js'

export class PatientError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra }
}
export function sendPatientError(res, err, label) {
  if (err instanceof PatientError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra })
  if (err?.code === 121) { // MongoDB schema validation: readable message to the user, details only in the server log
    console.error(`${label}: validator rejected the document`, JSON.stringify(err.errInfo?.details || {}).slice(0, 1500))
    return res.status(422).json({ error: 'Some details did not pass the database checks. Please review the form and try again.', code: 'VALIDATION_FAILED' })
  }
  console.error(`${label}:`, err?.message)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}

const str = (v) => (v == null ? '' : String(v).trim())
const isOid = (v) => /^[a-f0-9]{24}$/i.test(String(v || ''))
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const FEE_CENTAVOS = SESSION_FEE_PESOS * 100
const UPCOMING_STATUSES = ['Pending', 'Confirmed']

export function ageFrom(birthdate, now = new Date()) {
  const b = new Date(birthdate)
  if (!birthdate || Number.isNaN(b.getTime())) return null
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  const m = now.getUTCMonth() - b.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1
  return age
}

async function dbClient() { return (await getMongo()).connection.getClient() }

// ── roster ───────────────────────────────────────────────────────────────────
// A patient is the therapist's when the therapist has an active assignment OR a real (paid / confirmed) appointment with them.
export async function rosterIds(db, employee) {
  const [assigned, booked] = await Promise.all([
    db.collection('patient_assign').distinct('patient_id', { employee_id: employee._id, status: 'active' }),
    db.collection('appointments').distinct('patient_id', { employee_id: employee._id, patient_id: { $ne: null }, ...realBookingsOnly }),
  ])
  const map = new Map()
  for (const id of [...assigned, ...booked]) if (id) map.set(String(id), id)
  return [...map.values()]
}

// last / next session + count per patient, computed with one aggregation (nothing is stored).
async function sessionStats(db, employee, ids) {
  const today = manilaMidnightUtc(0)
  const rows = await db.collection('appointments').aggregate([
    { $match: { employee_id: employee._id, patient_id: { $in: ids }, ...realBookingsOnly, is_archived: { $ne: true }, status: { $ne: 'Cancelled' } } },
    { $group: {
      _id: '$patient_id', sessions: { $sum: 1 },
      last: { $max: { $cond: [{ $lt: ['$session_date', today] }, '$session_date', null] } },
      next: { $min: { $cond: [{ $and: [{ $gte: ['$session_date', today] }, { $in: ['$status', UPCOMING_STATUSES] }] }, '$session_date', null] } },
      condition: { $last: '$condition' },
    } },
  ]).toArray()
  return new Map(rows.map((r) => [String(r._id), r]))
}

export function statusOf(p) { return ['active', 'inactive', 'archived'].includes(p.status) ? p.status : 'active' }
const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(' ')
const guardianName = (p) => [p.guardian_first_name, p.guardian_last_name].filter(Boolean).join(' ')

function toRow(p, st) {
  return {
    id: String(p._id), patientCode: p.patient_code || `P-${String(p._id).slice(-6).toUpperCase()}`,
    name: fullName(p), nickname: p.nickname || null, age: ageFrom(p.birthdate), condition: p.condition || st?.condition || '',
    status: statusOf(p), photoUrl: p.profile_photo?.url || null,
    lastSession: st?.last || null, nextSession: st?.next || null, sessions: st?.sessions || 0,
    guardianName: guardianName(p) || null, createdAt: p.created_at || null,
  }
}

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  last_session: (a, b) => new Date(b.lastSession || 0) - new Date(a.lastSession || 0),
  next_session: (a, b) => (a.nextSession ? new Date(a.nextSession) : Infinity) - (b.nextSession ? new Date(b.nextSession) : Infinity),
}

// Search, filter, sort and page on the SERVER. `counts` always describe the whole roster, whatever the filters.
export async function listPatients(db, employee, q = {}) {
  const ids = await rosterIds(db, employee)
  const empty = { items: [], total: 0, page: 1, limit: 10, counts: { total: 0, active: 0, inactive: 0, archived: 0, upcoming_booked: 0, need_session: 0 } }
  if (!ids.length) return empty
  const [patients, stats] = await Promise.all([
    db.collection('patients').find({ _id: { $in: ids } }, { projection: { first_name: 1, last_name: 1, nickname: 1, birthdate: 1, condition: 1, status: 1, profile_photo: 1, patient_code: 1, guardian_first_name: 1, guardian_last_name: 1, created_at: 1 } }).toArray(),
    sessionStats(db, employee, ids),
  ])
  const rows = patients.map((p) => toRow(p, stats.get(String(p._id))))
  const live = rows.filter((r) => r.status !== 'archived')
  const counts = {
    total: live.length, active: rows.filter((r) => r.status === 'active').length, inactive: rows.filter((r) => r.status === 'inactive').length, archived: rows.filter((r) => r.status === 'archived').length,
    upcoming_booked: rows.filter((r) => r.status === 'active' && r.nextSession).length, need_session: rows.filter((r) => r.status === 'active' && !r.nextSession).length,
  }
  const status = ['active', 'inactive', 'archived'].includes(q.status) ? q.status : 'all'
  const needle = str(q.search).toLowerCase()
  let out = rows.filter((r) => (status === 'all' ? r.status !== 'archived' : r.status === status))
  if (q.needs_session === '1' || q.needs_session === 'true') out = out.filter((r) => r.status === 'active' && !r.nextSession)
  if (needle) out = out.filter((r) => `${r.name} ${r.nickname || ''} ${r.condition} ${r.guardianName || ''}`.toLowerCase().includes(needle))
  // Date filter: keep patients whose last or next session falls inside [from, to] (YYYY-MM-DD, Manila calendar days).
  const dayOf = (d) => (d ? new Date(new Date(d).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) : null)
  const dFrom = /^\d{4}-\d{2}-\d{2}$/.test(str(q.from)) ? str(q.from) : ''
  const dTo = /^\d{4}-\d{2}-\d{2}$/.test(str(q.to)) ? str(q.to) : ''
  if (dFrom || dTo) {
    out = out.filter((r) => [dayOf(r.lastSession), dayOf(r.nextSession)].some((d) => d && (!dFrom || d >= dFrom) && (!dTo || d <= dTo)))
  }
  out.sort(SORTS[q.sort] || SORTS.name)
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 10))
  const total = out.length
  const page = Math.min(Math.max(1, parseInt(q.page, 10) || 1), Math.max(1, Math.ceil(total / limit)))
  return { items: out.slice((page - 1) * limit, page * limit), total, page, limit, counts }
}

// The therapist's own patient, or a 404 (also for a patient that is not on their roster).
async function ownPatient(db, employee, id) {
  if (!isOid(id)) throw new PatientError(404, 'NOT_FOUND', 'That patient was not found.')
  const _id = new ObjectId(id)
  const ids = await rosterIds(db, employee)
  if (!ids.some((x) => String(x) === String(_id))) throw new PatientError(404, 'NOT_FOUND', 'That patient was not found. They may have been deleted.')
  const p = await db.collection('patients').findOne({ _id })
  if (!p) throw new PatientError(404, 'NOT_FOUND', 'That patient was not found. They may have been deleted.')
  return p
}

export async function patientDetail(db, employee, id) {
  const p = await ownPatient(db, employee, id)
  const st = (await sessionStats(db, employee, [p._id])).get(String(p._id))
  const guardianEmail = p.guardian_email || p.email || null
  return {
    ...toRow(p, st),
    joined: p.created_at || null, inviteStatus: p.invite_status || null,
    guardian: {
      name: guardianName(p) || null, relationship: p.guardian_relationship || null,
      contact: p.guardian_contact_number || p.contact_number || null, email: guardianEmail,
    },
  }
}

// ── archive / unarchive ──────────────────────────────────────────────────────
async function upcomingFor(db, patientId, employee = null) {
  const today = manilaMidnightUtc(0)
  return db.collection('appointments').find({
    patient_id: patientId, ...(employee ? { employee_id: employee._id } : {}), ...realBookingsOnly, is_archived: { $ne: true },
    status: { $in: UPCOMING_STATUSES }, session_date: { $gte: today },
  }).sort({ session_date: 1 }).toArray()
}

export async function archivePatient(db, employee, user, id) {
  const p = await ownPatient(db, employee, id)
  if (statusOf(p) === 'archived') return { id: String(p._id), status: 'archived', unchanged: true } // idempotent
  const upcoming = await upcomingFor(db, p._id, employee)
  if (upcoming.length) throw new PatientError(409, 'UPCOMING_SESSION', 'Cancel or reschedule the upcoming session first.', { upcoming: upcoming[0].session_date, count: upcoming.length })
  const now = new Date()
  await db.collection('patients').updateOne({ _id: p._id }, { $set: { status: 'archived', status_before_archive: statusOf(p), archived_at: now, archived_by: user._id, updated_at: now } })
  return { id: String(p._id), status: 'archived' }
}

export async function unarchivePatient(db, employee, id) {
  const p = await ownPatient(db, employee, id)
  if (statusOf(p) !== 'archived') return { id: String(p._id), status: statusOf(p), unchanged: true }
  const back = ['active', 'inactive'].includes(p.status_before_archive) ? p.status_before_archive : 'active'
  await db.collection('patients').updateOne({ _id: p._id }, { $set: { status: back, updated_at: new Date() }, $unset: { archived_at: '', archived_by: '', status_before_archive: '' } })
  return { id: String(p._id), status: back }
}

// ── delete ───────────────────────────────────────────────────────────────────
// Records the patient owns (deleted with them). Appointments and payments are NOT in this list: they stay, anonymised, so the
// Owner's revenue reports keep adding up.
const OWNED = [
  ['therapy_notes', 'patient_id'], ['exercise_assignments', 'patient_id'], ['patient_badges', 'patient_id'], ['game_sessions', 'patient_id'],
  ['game_completions', 'patient_id'], ['patient_unlocks', 'patient_id'], ['session_game_plans', 'patient_id'], ['home_practice_plans', 'patient_id'],
  ['patient_disorders', 'patient_id'], ['patient_assign', 'patient_id'], ['patient_photos', 'patient_id'], ['session_recommendations', 'patient_id'],
  ['pao_profiles', 'patient_id'], ['activity_sessions', 'patient_id'],
]

export async function deletePreview(db, employee, id) {
  const p = await ownPatient(db, employee, id)
  const [sessions, notes, awaiting, other, upcoming] = await Promise.all([
    db.collection('appointments').countDocuments({ patient_id: p._id, ...realBookingsOnly }),
    db.collection('therapy_notes').countDocuments({ patient_id: p._id }),
    db.collection('payments').countDocuments({ patient_id: p._id, status: 'awaiting_verification' }),
    db.collection('appointments').countDocuments({ patient_id: p._id, employee_id: { $ne: employee._id }, ...realBookingsOnly }),
    upcomingFor(db, p._id),
  ])
  const progress = (await Promise.all(['game_sessions', 'game_completions', 'patient_badges', 'exercise_assignments'].map((c) => db.collection(c).countDocuments({ patient_id: p._id })))).reduce((a, b) => a + b, 0)
  const blockers = []
  if (upcoming.length) blockers.push({ code: 'UPCOMING_SESSION', message: 'This patient has an upcoming session. Cancel or reschedule it first.', date: upcoming[0].session_date })
  if (awaiting) blockers.push({ code: 'PAYMENT_AWAITING', message: 'A payment for this patient is awaiting verification. Verify or reject it first.' })
  if (other) blockers.push({ code: 'SHARED_PATIENT', message: 'This patient also has sessions with another therapist, so they cannot be deleted from here. Archive instead.' })
  return { id: String(p._id), name: fullName(p), counts: { sessions, notes, progress }, blockers }
}

export async function deletePatient(db, employee, user, id, confirmName) {
  const p = await ownPatient(db, employee, id)
  if (str(confirmName).toLowerCase() !== fullName(p).toLowerCase()) throw new PatientError(400, 'CONFIRM_NAME', 'Type the patient’s full name exactly to confirm.')
  const prev = await deletePreview(db, employee, id)
  if (prev.blockers.length) throw new PatientError(409, prev.blockers[0].code, prev.blockers[0].message, { blockers: prev.blockers })

  const removed = {}
  const client = await dbClient()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const opts = { session }
      for (const k of Object.keys(removed)) delete removed[k]
      // note versions hang off the notes, so collect the note ids before the notes go
      const noteIds = (await db.collection('therapy_notes').find({ patient_id: p._id }, { projection: { _id: 1 }, session }).toArray()).map((n) => n._id)
      if (noteIds.length) removed.soap_note_versions = (await db.collection('soap_note_versions').deleteMany({ note_id: { $in: noteIds } }, opts)).deletedCount
      for (const [col, field] of OWNED) removed[col] = (await db.collection(col).deleteMany({ [field]: p._id }, opts)).deletedCount
      // Financial integrity: keep the records, strip who they were about.
      removed.payments_anonymised = (await db.collection('payments').updateMany({ patient_id: p._id }, { $set: { patient_name_snapshot: 'Deleted patient', updated_at: new Date() }, $unset: { patient_id: '' } }, opts)).modifiedCount
      await db.collection('payment_attempts').updateMany({ patient_id: p._id }, { $set: { payer: null }, $unset: { patient_id: '' } }, opts)
      removed.appointments_anonymised = (await db.collection('appointments').updateMany({ patient_id: p._id }, {
        $set: { patient_name: 'Deleted patient', guardian_name: null, contact_number: null, contact_email: null, patient_photo_id: null, patient_photo_url: null, patient_id: null, is_archived: true, archived_at: new Date(), updated_at: new Date() },
      }, opts)).modifiedCount
      await db.collection('patients').deleteOne({ _id: p._id }, opts)
    })
  } finally { await session.endSession() }
  await db.collection('audit_logs').insertOne({ user_id: user._id, role: user.role, action: 'patient_delete', patient_id: p._id, ip: null, created_at: new Date(), meta: { name_hash: crypto.createHash('sha256').update(fullName(p)).digest('hex').slice(0, 12), removed } }).catch((e) => console.error('delete audit failed:', e.message))
  await db.collection('auditlogs').insertOne({ user_id: user._id, action: 'patient_delete', ip_address: 'unknown', description: 'Deleted a patient record (financial records kept anonymised).', created_at: new Date() }).catch(() => {})
  return { ok: true, removed }
}

// ── add a patient ────────────────────────────────────────────────────────────
const GENDERS = ['Male', 'Female', 'Other']
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Other']
export const normalizePhone = (raw) => {
  let d = String(raw || '').replace(/[\s()-]/g, '')
  if (d.startsWith('+63')) d = `0${d.slice(3)}`
  else if (d.startsWith('63') && d.length === 12) d = `0${d.slice(2)}`
  return /^09\d{9}$/.test(d) ? d : null
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same rules as the form; the server never trusts the browser. Returns { fields, value }.
export function validateNewPatient(body = {}) {
  const pt = body.patient || {}; const g = body.guardian || {}
  const f = {}
  const need = (key, v, label, max = 80) => { const s = str(v); if (!s) f[key] = `${label} is required.`; else if (s.length > max) f[key] = `${label} is too long.`; return s }
  const firstName = need('firstName', pt.firstName, 'First name', 60)
  const lastName = need('lastName', pt.lastName, 'Last name', 60)
  const nickname = str(pt.nickname).slice(0, 40)
  const gender = GENDERS.includes(pt.gender) ? pt.gender : (f.gender = 'Choose a gender.', '')
  let birthdate = null
  const bd = str(pt.birthdate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || Number.isNaN(Date.parse(bd))) f.birthdate = 'Enter a valid birthdate.'
  else {
    birthdate = new Date(`${bd}T00:00:00.000Z`)
    const age = ageFrom(birthdate)
    if (birthdate > new Date()) f.birthdate = 'Birthdate cannot be in the future.'
    else if (age > 18) f.birthdate = 'Patients must be 18 or younger.'
  }
  const address = need('address', pt.address, 'Address', 200)
  const condition = need('condition', pt.condition, 'Condition', 80)
  const gFirst = need('guardianFirst', g.firstName, 'Guardian first name', 60)
  const gLast = need('guardianLast', g.lastName, 'Guardian last name', 60)
  const relationship = RELATIONSHIPS.includes(g.relationship) ? g.relationship : (f.relationship = 'Choose a relationship.', '')
  const contact = normalizePhone(g.contact) || (f.contact = 'Enter a PH mobile number like 09XX XXX XXXX.', '')
  const email = str(g.email).toLowerCase()
  if (!EMAIL_RE.test(email)) f.email = 'Enter a valid email address.'
  const pay = body.payment || {}
  const method = ['cash', 'gcash', 'paymaya', 'card'].includes(pay.method) ? pay.method : (f.paymentMethod = 'Choose how the first session is paid.', '')
  let reference = null
  if (method === 'gcash' || method === 'paymaya') {
    const ref = validateReference(pay.reference, method)
    if (!ref.ok) f.reference = ref.error; else reference = ref
    if (!str(pay.receipt)) f.receipt = 'Upload a screenshot of your receipt.'
  }
  const paymentIntentId = method === 'card' ? str(pay.payment_intent_id) : ''
  if (method === 'card' && !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) f.paymentMethod = 'The card payment could not be found. Please try again.'
  return { fields: f, value: { paymentIntentId, firstName, lastName, nickname, gender, birthdate, address, condition, gFirst, gLast, relationship, contact, email, method, reference, receipt: str(pay.receipt), photo: str(pt.photo), sendInvite: body.send_invite !== false } }
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const newCode = () => `P-${Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')}`

function decodeDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  try { return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') } } catch { return null }
}

const paymentView = (pay) => ({ id: String(pay._id), method: pay.method, amount: pay.amount, amountCentavos: pay.amount_centavos, status: pay.status, reference: pay.reference_number || null })
const CARD_PURPOSE = 'first_session_new_patient'
// Reads the PaymentIntent from Stripe and checks it is a paid first-session fee that belongs to THIS therapist.
async function verifyCardIntent(employee, id) {
  let pi
  try { pi = await getStripeClient().paymentIntents.retrieve(id) } catch { throw new PatientError(422, 'CARD_NOT_FOUND', 'We could not find that card payment. Nothing was saved.') }
  if (pi.metadata?.purpose !== CARD_PURPOSE || pi.metadata?.therapist_id !== String(employee._id) || pi.currency !== 'php' || pi.amount !== FEE_CENTAVOS) throw new PatientError(422, 'CARD_MISMATCH', 'That card payment does not match this registration. Nothing was saved.')
  if (pi.status !== 'succeeded') throw new PatientError(402, 'CARD_NOT_PAID', pi.status === 'processing' ? 'Your card payment is still processing. Try again in a moment.' : 'The card payment was not completed. You have not been charged for a patient.')
  return pi
}

// Step before paying by card: check the form first (so nobody pays for a registration that would be refused), then start the payment.
export async function startCardPayment(db, employee, body, idempotencyKey) {
  if (!/^[\w-]{16,80}$/.test(idempotencyKey || '')) throw new PatientError(400, 'IDEMPOTENCY_KEY', 'Missing request key. Please reload and try again.')
  const probe = { ...body, payment: { method: 'card', payment_intent_id: 'pi_check' } }
  const { fields, value: v } = validateNewPatient(probe)
  if (Object.keys(fields).length) throw new PatientError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields })
  const rosterSet = new Set((await rosterIds(db, employee)).map(String))
  const dupes = await db.collection('patients').find({ first_name: { $regex: '^' + escapeRe(v.firstName) + '$', $options: 'i' }, birthdate: v.birthdate, $or: [{ guardian_email: v.email }, { email: v.email }] }, { projection: { _id: 1 } }).toArray()
  const dup = dupes.find((d) => rosterSet.has(String(d._id)))
  if (dup) throw new PatientError(409, 'duplicate_patient', 'This patient may already exist.', { patientId: String(dup._id) })
  if (!process.env.STRIPE_SECRET_KEY) throw new PatientError(503, 'CARD_UNAVAILABLE', 'Card payments are not available right now. Use cash or QR.')
  const pi = await getStripeClient().paymentIntents.create({
    amount: FEE_CENTAVOS, currency: 'php', automatic_payment_methods: { enabled: true },
    description: 'TherapyPro first session for ' + v.firstName + ' ' + v.lastName, receipt_email: v.email,
    metadata: { purpose: CARD_PURPOSE, therapist_id: String(employee._id), guardian_email: v.email.slice(0, 200) },
  }, { idempotencyKey: 'patient-card-' + employee._id + '-' + idempotencyKey })
  return { clientSecret: pi.client_secret, paymentIntentId: pi.id, amountCentavos: FEE_CENTAVOS }
}

const STATUS_LABEL = { pending: 'Pay at clinic', awaiting_verification: 'Awaiting verification', completed: 'Paid' }

async function replayResult(db, pay) {
  const patient = await db.collection('patients').findOne({ _id: pay.patient_id })
  return { patient: patient ? { id: String(patient._id), patientCode: patient.patient_code, name: fullName(patient), guardianName: guardianName(patient), guardianEmail: patient.guardian_email } : null, payment: { ...paymentView(pay), statusLabel: STATUS_LABEL[pay.status] || pay.status }, inviteStatus: patient?.invite_status || null, replay: true }
}

export async function createPatient(db, employee, user, body, idempotencyKey) {
  if (!/^[\w-]{16,80}$/.test(idempotencyKey || '')) throw new PatientError(400, 'IDEMPOTENCY_KEY', 'Missing request key. Please reload and try again.')
  const prior = await db.collection('payments').findOne({ idempotency_key: idempotencyKey, therapist_id: employee._id })
  if (prior) return replayResult(db, prior) // double click / retry / refresh: the same patient, never a second one

  const { fields, value: v } = validateNewPatient(body)
  if (Object.keys(fields).length) throw new PatientError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields })

  // Duplicate guard: same guardian email + first name + birthdate already on THIS therapist's roster.
  const rosterSet = new Set((await rosterIds(db, employee)).map(String))
  const dupes = await db.collection('patients').find({
    first_name: { $regex: `^${escapeRe(v.firstName)}$`, $options: 'i' }, birthdate: v.birthdate,
    $or: [{ guardian_email: v.email }, { email: v.email }],
  }, { projection: { _id: 1 } }).toArray()
  const dup = dupes.find((d) => rosterSet.has(String(d._id)))
  if (dup) throw new PatientError(409, 'duplicate_patient', 'This patient may already exist.', { patientId: String(dup._id) })

  // Receipt is checked BEFORE anything is written, so a bad image never leaves half a patient behind.
  let receipt = null
  if (v.method === 'gcash' || v.method === 'paymaya') {
    const raw = decodeDataUrl(v.receipt)
    if (!raw) throw new PatientError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields: { receipt: 'Upload a JPG or PNG screenshot of your receipt.' } })
    try { receipt = prepareReceipt(raw.buffer) } catch (e) { throw new PatientError(e.status || 422, e.code || 'VALIDATION_ERROR', e.message, { fields: { receipt: e.message } }) }
  }
  // Card: the money must already be taken. The SERVER asks Stripe; nothing the browser says counts.
  let cardPi = null
  if (v.method === 'card') {
    const used = await db.collection('payments').findOne({ stripe_payment_intent_id: v.paymentIntentId })
    if (used) return replayResult(db, used)
    cardPi = await verifyCardIntent(employee, v.paymentIntentId)
  }
  const photo = v.photo ? decodeDataUrl(v.photo) : null
  if (photo && (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType) || photo.buffer.length > 5 * 1024 * 1024)) throw new PatientError(422, 'VALIDATION_ERROR', 'Please fix the highlighted fields.', { fields: { photo: 'Use a JPG, PNG or WEBP photo up to 5 MB.' } })

  const now = new Date()
  const patientId = new ObjectId()
  let patientCode = newCode()
  for (let i = 0; i < 5 && await db.collection('patients').findOne({ patient_code: patientCode }, { projection: { _id: 1 } }); i += 1) patientCode = newCode()
  const online = v.method === 'gcash' || v.method === 'paymaya'
  const inviteToken = crypto.randomBytes(32).toString('base64url')
  let inviteEmailKind = null // 'new' | 'child'
  let payment = null

  const client = await dbClient()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const opts = { session }
      // Guardian account: link an existing one by email, or prepare an invited one (7-day token, only the hash is stored).
      let guardianUser = await db.collection('users').findOne({ email: v.email, role: 'Patient' }, { projection: { _id: 1 }, session })
      inviteEmailKind = null
      if (guardianUser) { if (v.sendInvite) inviteEmailKind = 'child' } else if (v.sendInvite) {
        const base = v.email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').toLowerCase().slice(0, 24) || 'guardian'
        let username = base
        for (let n = 2; await db.collection('users').findOne({ username }, { projection: { _id: 1 }, session }); n += 1) username = `${base}${n}`
        const tempDigest = crypto.createHash('sha256').update(crypto.randomBytes(24)).digest('hex')
        const u = await db.collection('users').insertOne({
          username, password: await bcrypt.hash(tempDigest, 10), full_name: `${v.gFirst} ${v.gLast}`, role: 'Patient', email: v.email,
          is_verified: false, status: 'Active', is_locked: false, is_archived: false, failed_login_attempts: 0,
          password_setup_token_hash: crypto.createHash('sha256').update(inviteToken).digest('hex'), password_setup_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          created_at: now, updated_at: now,
        }, opts)
        guardianUser = { _id: u.insertedId }
        inviteEmailKind = 'new'
      }

      let photoRef = null
      if (photo) {
        const publicId = crypto.randomBytes(16).toString('hex')
        const ph = await db.collection('patient_photos').insertOne({ public_id: publicId, patient_id: patientId, content_type: photo.contentType, data: photo.buffer, size_bytes: photo.buffer.length, width: 512, height: 512, created_at: now }, opts)
        photoRef = { photo_id: ph.insertedId, url: `/api/patient-photos/${publicId}`, uploaded_at: now }
      }
      await db.collection('patients').insertOne({
        _id: patientId, PatientID: patientId.toString(), patient_code: patientCode, status: 'active',
        user_id: guardianUser?._id || null, first_name: v.firstName, middle_name: null, last_name: v.lastName, ...(v.nickname ? { nickname: v.nickname } : {}),
        gender: v.gender, birthdate: v.birthdate, address: v.address, condition: v.condition,
        contact_number: v.contact, email: v.email, profile_photo: photoRef,
        guardian_first_name: v.gFirst, guardian_last_name: v.gLast, guardian_relationship: v.relationship, guardian_contact_number: v.contact, guardian_email: v.email,
        created_by: employee._id, invite_status: inviteEmailKind ? 'pending' : null, created_at: now, updated_at: now,
      }, opts)
      await db.collection('patient_assign').insertOne({ patient_id: patientId, employee_id: employee._id, branch_id: employee.branch_id, role: 'primary', therapy_types: [], status: 'active', start_date: now, assigned_by: user._id, created_at: now, updated_at: now }, opts)

      // The amount is the SERVER's; nothing from the browser decides it.
      let payRef = makePaymentRef() // our own 8-digit reference (the validator requires exactly this shape)
      for (let i = 0; i < 5 && await db.collection('payments').findOne({ payment_ref: payRef }, { projection: { _id: 1 }, session }); i += 1) payRef = makePaymentRef()
      const paymentDoc = {
        _id: new ObjectId(), PaymentID: `PAY-${crypto.randomUUID()}`, patient_id: patientId, therapist_id: employee._id, payment_for: 'first_session', method: v.method,
        amount: SESSION_FEE_PESOS, amount_centavos: FEE_CENTAVOS, currency: 'PHP', payment_date: now,
        status: v.method === 'card' ? 'completed' : online ? 'awaiting_verification' : 'pending', ...(v.method === 'card' ? { stripe_payment_intent_id: cardPi.id, paid_at: now } : {}), ...(online ? { reference_number: v.reference.digits, reference_display: v.reference.display } : {}),
        payment_ref: payRef, idempotency_key: idempotencyKey, patient_name_snapshot: `${v.firstName} ${v.lastName}`, created_at: now, updated_at: now,
      }
      if (receipt) {
        const publicId = crypto.randomBytes(16).toString('hex')
        const r = await db.collection('payment_receipts').insertOne({ public_id: publicId, payment_id: paymentDoc._id, content_type: receipt.contentType, data: receipt.buffer, size_bytes: receipt.buffer.length, created_at: now }, opts)
        paymentDoc.receipt_id = r.insertedId
      }
      await db.collection('payments').insertOne(paymentDoc, opts)
      payment = paymentDoc
    })
  } catch (err) {
    if (err?.code === 11000) { // a racing duplicate of the same request: hand back what the first one made
      const again = await db.collection('payments').findOne({ $or: [{ idempotency_key: idempotencyKey, therapist_id: employee._id }, ...(cardPi ? [{ stripe_payment_intent_id: cardPi.id }] : [])] })
      if (again) return replayResult(db, again)
    }
    throw err
  } finally { await session.endSession() }

  // After the commit: an email problem must never undo the registration.
  let inviteStatus = null
  if (inviteEmailKind) {
    try {
      await sendInviteEmail({ to: v.email, name: `${v.gFirst} ${v.gLast}`, child: v.firstName, kind: inviteEmailKind, token: inviteToken, therapist: employee })
      inviteStatus = 'sent'
    } catch (err) { console.error('patient invite email failed:', err.message); inviteStatus = 'failed' }
    await db.collection('patients').updateOne({ _id: patientId }, { $set: { invite_status: inviteStatus, invite_sent_at: inviteStatus === 'sent' ? new Date() : null } }).catch(() => {})
  }
  await db.collection('audit_logs').insertOne({ user_id: user._id, role: user.role, action: 'patient_create', patient_id: patientId, created_at: new Date(), meta: { method: v.method } }).catch(() => {})
  return {
    patient: { id: String(patientId), patientCode, name: `${v.firstName} ${v.lastName}`, nickname: v.nickname || null, guardianName: `${v.gFirst} ${v.gLast}`, guardianEmail: v.email },
    payment: { ...paymentView(payment), statusLabel: STATUS_LABEL[payment.status], reference: online ? v.reference.display : null },
    inviteStatus, holdHours: online ? 72 : null,
  }
}

function appBase() { return (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '') || 'https://therapypro.app' }
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function sendInviteEmail({ to, name, child, kind, token, therapist }) {
  const therapistName = [therapist.first_name, therapist.last_name].filter(Boolean).join(' ') || 'your therapist'
  const link = `${appBase()}/set-password?token=${encodeURIComponent(token)}`
  const subject = kind === 'child' ? `${child} was added to your TherapyPro account` : `You're invited to TherapyPro: follow ${child}'s sessions`
  const body = kind === 'child'
    ? `<p>Hi ${esc(name)},</p><p>${esc(therapistName)} added <strong>${esc(child)}</strong> to your TherapyPro account. Sign in to see sessions and progress.</p>`
    : `<p>Hi ${esc(name)},</p><p>${esc(therapistName)} added <strong>${esc(child)}</strong> to TherapyPro. Set your password to see sessions and progress (this link works for 7 days).</p><p><a href="${link}">Set your password</a></p>`
  await sendEmail({ to, toName: name, subject, html: `<div style="font-family:Arial,sans-serif;color:#2c4a3e">${body}</div>`, plain: kind === 'child' ? `${therapistName} added ${child} to your TherapyPro account.` : `${therapistName} added ${child} to TherapyPro. Set your password: ${link}` })
}

// "Resend invite" from the patient modal: a fresh 7-day link for a guardian who has not set a password yet.
export async function resendInvite(db, employee, id) {
  const p = await ownPatient(db, employee, id)
  const email = p.guardian_email || p.email
  const user = email ? await db.collection('users').findOne({ email, role: 'Patient' }) : null
  if (!user) throw new PatientError(409, 'NO_GUARDIAN_ACCOUNT', 'There is no guardian account to invite.')
  if (user.is_verified) throw new PatientError(409, 'ALREADY_ACTIVE', 'This guardian already has an active account.')
  const token = crypto.randomBytes(32).toString('base64url')
  await db.collection('users').updateOne({ _id: user._id }, { $set: { password_setup_token_hash: crypto.createHash('sha256').update(token).digest('hex'), password_setup_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), updated_at: new Date() } })
  try {
    await sendInviteEmail({ to: email, name: guardianName(p) || 'there', child: p.first_name, kind: 'new', token, therapist: employee })
    await db.collection('patients').updateOne({ _id: p._id }, { $set: { invite_status: 'sent', invite_sent_at: new Date() } })
    return { inviteStatus: 'sent' }
  } catch (err) {
    console.error('resend invite failed:', err.message)
    await db.collection('patients').updateOne({ _id: p._id }, { $set: { invite_status: 'failed' } })
    return { inviteStatus: 'failed' }
  }
}

// ── first-session payments, as shown in the therapist's "Payments to verify" ─────────────────
export async function registrationProofRows(db, employee) {
  const rows = await db.collection('payments').find({ therapist_id: employee._id, payment_for: 'first_session', status: 'awaiting_verification' }).sort({ created_at: -1 }).limit(50).toArray()
  const patients = new Map((await db.collection('patients').find({ _id: { $in: rows.map((r) => r.patient_id).filter(Boolean) } }, { projection: { guardian_first_name: 1, guardian_last_name: 1, contact_number: 1 } }).toArray()).map((p) => [String(p._id), p]))
  const now = Date.now()
  return rows.map((r) => {
    const p = patients.get(String(r.patient_id))
    return {
      attemptId: String(r._id), appointmentId: null, kind: 'registration',
      patient: r.patient_name_snapshot, guardian: p ? guardianName(p) : null, contact: p?.contact_number || null,
      date: r.payment_date, timeLabel: 'First-session fee (new patient)', amount: r.amount, currency: r.currency,
      method: r.method, methodLabel: r.method === 'paymaya' ? 'Maya QR' : 'GCash QR', reference: r.reference_number || null, referenceDisplay: r.reference_display || null,
      hasReceipt: Boolean(r.receipt_id), receiptUrl: r.receipt_id ? `/api/therapist/registration-payments/${r._id}/receipt` : null,
      submittedAt: r.created_at, isNew: now - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000, holdExpiresAt: null, flags: { referenceReused: false, proofChanged: false },
    }
  })
}

// Verify / reject a first-session payment. Returns null when the id is not one of these (so the caller can try the booking flow).
export async function decideRegistrationPayment(db, employee, user, id, approve, reason) {
  if (!isOid(id)) return null
  const pay = await db.collection('payments').findOne({ _id: new ObjectId(id), payment_for: 'first_session' })
  if (!pay) return null
  if (String(pay.therapist_id) !== String(employee._id)) throw new PatientError(403, 'NOT_ALLOWED', 'Only the therapist who added this patient can verify this payment.')
  if (pay.status !== 'awaiting_verification') throw new PatientError(409, 'PAYMENT_ALREADY_DECIDED', 'This payment was already decided.')
  const now = new Date()
  await db.collection('payments').updateOne({ _id: pay._id, status: 'awaiting_verification' }, { $set: { status: approve ? 'completed' : 'failed', decided_at: now, decided_by: user._id, ...(approve ? {} : { reject_reason: str(reason).slice(0, 200) }), updated_at: now } })
  if (approve) invalidateReportsCache() // Owner Reports are cached for about a minute; new money must show up
  await db.collection('audit_logs').insertOne({ user_id: user._id, role: user.role, action: approve ? 'payment_verified' : 'payment_rejected', patient_id: pay.patient_id, created_at: now, meta: { payment: String(pay._id), kind: 'first_session' } }).catch(() => {})
  return { ok: true, paymentStatus: approve ? 'verified' : 'rejected' }
}

export async function registrationReceipt(db, employee, id) {
  if (!isOid(id)) throw new PatientError(404, 'NOT_FOUND', 'Receipt not found.')
  const pay = await db.collection('payments').findOne({ _id: new ObjectId(id), payment_for: 'first_session', therapist_id: employee._id })
  const r = pay?.receipt_id ? await db.collection('payment_receipts').findOne({ _id: pay.receipt_id }) : null
  if (!r) throw new PatientError(404, 'NOT_FOUND', 'Receipt not found.')
  return { contentType: r.content_type, data: r.data.buffer ? Buffer.from(r.data.buffer) : Buffer.from(r.data) }
}
