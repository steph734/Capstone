// Tests for the server sync rules (run with:  npx vitest run api/_lib/syncRules.test.js).
// The database is a tiny in-memory stand-in, so nothing touches the real MongoDB.
import { describe, expect, it, beforeAll } from 'vitest'
import { ObjectId } from 'mongodb'

let applyEntry

const store = { therapy_notes: [], appointments: [], patients: [], soap_note_versions: [], audit_logs: [] }
const match = (d, q) => Object.entries(q).every(([k, v]) => {
  if (v && typeof v === 'object' && '$ne' in v) return String(d[k]) !== String(v.$ne)
  if (v && typeof v === 'object' && '$nin' in v) return !v.$nin.includes(d[k])
  if (v instanceof Date) return d[k] instanceof Date && d[k].getTime() === v.getTime()
  return String(d[k]) === String(v)
})
const col = (n) => ({
  findOne: async (q) => store[n].find((d) => match(d, q)) || null,
  find: (q) => ({ toArray: async () => store[n].filter((d) => match(d, q)) }),
  insertOne: async (d) => { store[n].push(d); return {} },
  updateOne: async (q, u) => { Object.assign(store[n].find((d) => match(d, q)), u.$set); return {} },
})
const db = { collection: col }
const employee = { _id: new ObjectId(), first_name: 'Tina', last_name: 'Therapist' }
const patientId = new ObjectId()
const ctx = { db, user: { _id: new ObjectId() }, employee, ip: '127.0.0.1' }

beforeAll(async () => {
  process.env.SOAP_ENCRYPTION_KEY = 'a'.repeat(64)
  ;({ applyEntry } = await import('./syncRules.js'))
  store.patients.push({ _id: patientId, first_name: 'Eli', last_name: 'Reyes' })
  store.appointments.push({ _id: new ObjectId(), employee_id: employee._id, patient_id: patientId, session_date: new Date(Date.UTC(2026, 9, 25)), start_time: '09:00', end_time: '10:00', status: 'Confirmed' })
})

const noteId = String(new ObjectId())
const note = (extra, op = 'create') => ({ collection: 'soapNotes', op, docId: noteId, doc: { _id: noteId, patient_id: String(patientId), session_date: '2026-10-22', subjective: 'Child was calm and focused today.', baseVersion: 0, ...extra } })

describe('SOAP drafts', () => {
  it('creates a note once, and a retried create is idempotent', async () => {
    expect(await applyEntry(ctx, note())).toMatchObject({ status: 'ok', version: 1 })
    expect(await applyEntry(ctx, note())).toMatchObject({ status: 'ok' })
    expect(store.therapy_notes).toHaveLength(1)
  })
  it('accepts an edit made from the current version', async () => {
    expect(await applyEntry(ctx, note({ subjective: 'Edited on device A today.', baseVersion: 1 }, 'update'))).toMatchObject({ status: 'ok', version: 2 })
  })
  it('answers conflict (and does not overwrite) when edited from an older version', async () => {
    const r = await applyEntry(ctx, note({ subjective: 'Edited on device B from v1.', baseVersion: 1 }, 'update'))
    expect(r).toMatchObject({ status: 'conflict', code: 'NEWER_ON_SERVER' })
    expect(r.server.subjective).toBe('Edited on device A today.')
    expect(store.therapy_notes[0].version).toBe(2)
  })
  it('accepts the same edit once it is rebased on the server version', async () => {
    expect(await applyEntry(ctx, note({ subjective: 'B keeps mine, based on v2.', baseVersion: 2 }, 'update'))).toMatchObject({ status: 'ok', version: 3 })
  })
  it('refuses to edit a note that was signed meanwhile', async () => {
    store.therapy_notes[0].status = 'signed'
    expect(await applyEntry(ctx, note({ baseVersion: 3 }, 'update'))).toMatchObject({ status: 'conflict', code: 'NOTE_LOCKED' })
  })
  it('rejects a patient the therapist is not assigned to', async () => {
    const other = String(new ObjectId())
    const r = await applyEntry(ctx, { collection: 'soapNotes', op: 'create', docId: other, doc: { _id: other, patient_id: String(new ObjectId()), session_date: '2026-10-22', subjective: 'Not my patient at all.', baseVersion: 0 } })
    expect(r).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
  })
})

describe('appointments', () => {
  const appt = (id, start, end) => ({ collection: 'appointments', op: 'create', docId: id, doc: { _id: id, patient_id: String(patientId), session_date: '2026-10-25', start_time: start, end_time: end } })
  const a2 = String(new ObjectId())
  it('rejects an overlapping slot with a clear message', async () => {
    const r = await applyEntry(ctx, appt(String(new ObjectId()), '09:30', '10:30'))
    expect(r).toMatchObject({ status: 'rejected', code: 'SLOT_TAKEN' })
    expect(r.message).toContain('09:00-10:00')
  })
  it('accepts a back-to-back slot, then rejects one that overlaps it', async () => {
    expect((await applyEntry(ctx, appt(a2, '10:00', '11:00'))).status).toBe('ok')
    expect(await applyEntry(ctx, appt(String(new ObjectId()), '10:30', '11:30'))).toMatchObject({ status: 'rejected', code: 'SLOT_TAKEN' })
  })
  it('updates the status of the therapist\'s own appointment', async () => {
    const r = await applyEntry(ctx, { collection: 'appointments', op: 'update', docId: a2, doc: { _id: a2, status: 'Completed', completion_remarks: 'Went well' } })
    expect(r.status).toBe('ok')
    expect(store.appointments.find((x) => String(x._id) === a2).status).toBe('Completed')
  })
})

describe('input checks', () => {
  it('rejects an unknown collection', async () => {
    expect((await applyEntry(ctx, { collection: 'nope', op: 'create', docId: 'x', doc: {} })).status).toBe('rejected')
  })
})

describe('role limits (patient and owner)', () => {
  const gameDoc = (id) => ({ collection: 'gameSessions', op: 'create', docId: id, doc: { _id: id, game_id: String(new ObjectId()), started_at: new Date().toISOString(), result: {} } })
  it('a patient can only push game sessions, never notes or appointments', async () => {
    const pctx = { ...ctx, role: 'Patient', patientId: new ObjectId() }
    const id = String(new ObjectId())
    expect(await applyEntry(pctx, note())).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
    expect(await applyEntry(pctx, { collection: 'appointments', op: 'create', docId: id, doc: { _id: id } })).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
    expect(await applyEntry(pctx, { collection: 'leaveDecisions', op: 'create', docId: id, doc: { _id: id, action: 'approve' } })).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
  })
  it('an owner can only push leave decisions', async () => {
    const octx = { ...ctx, role: 'Owner' }
    expect(await applyEntry(octx, note())).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
    expect(await applyEntry(octx, gameDoc(String(new ObjectId())))).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
  })
  it('an invalid leave decision is refused before anything runs', async () => {
    const octx = { ...ctx, role: 'Owner' }
    expect(await applyEntry(octx, { collection: 'leaveDecisions', op: 'create', docId: 'x', doc: { _id: 'not-an-id', action: 'approve' } })).toMatchObject({ status: 'rejected', code: 'BAD_DATA' })
    const id = String(new ObjectId())
    expect(await applyEntry(octx, { collection: 'leaveDecisions', op: 'create', docId: id, doc: { _id: id, action: 'delete-everything' } })).toMatchObject({ status: 'rejected', code: 'BAD_DATA' })
  })
  it('a patient cannot replay a play record that belongs to another patient', async () => {
    const id = new ObjectId()
    store.game_sessions = [{ _id: id, patient_id: new ObjectId(), status: 'in_progress' }]
    const pctx = { ...ctx, role: 'Patient', patientId: new ObjectId() }
    const r = await applyEntry(pctx, { collection: 'gameSessions', op: 'create', docId: String(id), doc: { _id: String(id), game_id: String(new ObjectId()), result: {} } })
    expect(r).toMatchObject({ status: 'rejected', code: 'NOT_ALLOWED' })
  })
})
