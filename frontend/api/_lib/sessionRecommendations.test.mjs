// Tests for "Mark as completed" and the recommendation rules, against a tiny
// in-memory stand-in for the Mongo collections (no database needed).
// Run with: node --test api/_lib/sessionRecommendations.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ObjectId } from 'mongodb'
import { completeAppointment } from './routes/appointments-complete.js'
import { canRecommend, sessionStart, DEFAULT_SLOTS } from './sessionRecommendations.js'

// ── minimal fake db: equality, $ne, $in, $gt, $gte, $lt, $nor-free filters ──
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k]
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !(cond instanceof ObjectId) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, x]) => {
        if (op === '$ne') return String(v) !== String(x)
        if (op === '$in') return x.some((y) => String(y) === String(v))
        if (op === '$gt') return v > x
        if (op === '$gte') return v >= x
        if (op === '$lt') return v < x
        throw new Error(`unsupported op ${op}`)
      })
    }
    return String(v) === String(cond)
  })
}
function fakeDb(seed) {
  const cols = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((d) => ({ ...d }))]))
  const col = (name) => {
    cols[name] ||= []
    return {
      findOne: async (f) => cols[name].find((d) => matches(d, f)) || null,
      insertOne: async (d) => { const _id = d._id || new ObjectId(); cols[name].push({ ...d, _id }); return { insertedId: _id } },
      findOneAndUpdate: async (f, u) => {
        const d = cols[name].find((x) => matches(x, f))
        if (!d) return null
        Object.assign(d, u.$set)
        return { ...d }
      },
    }
  }
  return { collection: col, cols }
}

const therapistUser = { _id: new ObjectId(), role: 'Therapist', email: 'ther@x.com' }
const otherUser = { _id: new ObjectId(), role: 'Therapist', email: 'other@x.com' }
const ownerUser = { _id: new ObjectId(), role: 'Owner', email: 'owner@x.com' }
const empMe = { _id: new ObjectId(), email: 'ther@x.com' }
const empOther = { _id: new ObjectId(), email: 'other@x.com' }
const patientId = new ObjectId()

// A session that started an hour ago / starts in a day, read as Asia/Manila.
const NOW = new Date('2026-10-16T10:00:00+08:00')
const apptDoc = (over = {}) => ({
  _id: new ObjectId(), employee_id: empMe._id, patient_id: patientId, patient_name: 'Juan Dela Cruz',
  session_date: new Date('2026-10-16T00:00:00.000Z'), start_time: '09:00', end_time: '10:00',
  status: 'Confirmed', is_archived: false, contact_email: 'maria@x.com', ...over,
})
const run = (db, user, appt, extra = {}) =>
  completeAppointment({ db, user, id: appt._id, remarks: 'Great session', now: () => NOW, ...extra })
const build = (appt, more = {}) => fakeDb({
  appointments: [appt], employees: [empMe, empOther], users: [], audit_logs: [], notifications: [], session_recommendations: [], ...more,
})

test('completes a confirmed session that has started', async () => {
  const appt = apptDoc()
  const db = build(appt)
  const out = await run(db, therapistUser, appt)
  assert.equal(out.status, 200)
  assert.equal(out.body.appointment.status, 'Completed')
  const saved = db.cols.appointments[0]
  assert.equal(saved.status, 'Completed')
  assert.deepEqual(saved.completed_at, NOW)
  assert.equal(String(saved.completed_by), String(therapistUser._id))
  assert.equal(saved.completion_remarks, 'Great session')
  assert.equal(db.cols.audit_logs[0].action, 'appointment_completed')
  assert.equal(db.cols.notifications[0].recipient_email, 'maria@x.com')
  assert.match(db.cols.notifications[0].body, /Juan's session on Oct 16 is marked completed/)
  assert.equal(out.body.canRecommend, true)
})

test('refuses a session that has not started yet', async () => {
  const appt = apptDoc({ start_time: '15:00', end_time: '16:00' })
  const out = await run(build(appt), therapistUser, appt)
  assert.equal(out.status, 409)
  assert.equal(out.body.error, 'You can only complete a session after it starts.')
})

test('refuses a future-dated session', async () => {
  const appt = apptDoc({ session_date: new Date('2026-10-20T00:00:00.000Z') })
  const out = await run(build(appt), therapistUser, appt)
  assert.equal(out.status, 409)
})

test('refuses Cancelled, Pending, archived and already-Completed sessions', async () => {
  for (const over of [{ status: 'Cancelled' }, { status: 'Pending' }, { is_archived: true }, { status: 'Completed' }]) {
    const appt = apptDoc(over)
    const out = await run(build(appt), therapistUser, appt)
    assert.equal(out.status, 409, JSON.stringify(over))
  }
})

test("refuses another therapist's session (403) but allows an owner", async () => {
  const appt = apptDoc()
  assert.equal((await run(build(appt), otherUser, appt)).status, 403)
  const appt2 = apptDoc()
  assert.equal((await run(build(appt2), ownerUser, appt2)).status, 200)
})

test('cannot be completed twice', async () => {
  const appt = apptDoc()
  const db = build(appt)
  assert.equal((await run(db, therapistUser, appt)).status, 200)
  const again = await run(db, therapistUser, appt)
  assert.equal(again.status, 409)
})

test('canRecommend is false when an upcoming appointment or an open recommendation exists', async () => {
  const past = apptDoc({ status: 'Completed' })
  assert.equal(await canRecommend(build(past), patientId), true)

  const upcoming = apptDoc({ status: 'Confirmed', session_date: new Date('2099-01-01T00:00:00.000Z') })
  assert.equal(await canRecommend(build(past, { appointments: [past, upcoming] }), patientId), false)

  const open = { patient_id: patientId, status: 'Sent', expires_at: new Date('2099-01-01') }
  assert.equal(await canRecommend(build(past, { session_recommendations: [open] }), patientId), false)

  const lapsed = { patient_id: patientId, status: 'Sent', expires_at: new Date('2000-01-01') }
  assert.equal(await canRecommend(build(past, { session_recommendations: [lapsed] }), patientId), true)
})

test('session start is read in Asia/Manila', () => {
  assert.equal(sessionStart(apptDoc()).toISOString(), '2026-10-16T01:00:00.000Z')
})

test('default slots are one-hour clinic slots', () => {
  assert.equal(DEFAULT_SLOTS.length, 8)
  assert.ok(DEFAULT_SLOTS.every((s) => s.start < s.end))
})
