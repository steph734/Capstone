// Tests for the offline layer (run with:  npx vitest run src/offline).
// IndexedDB is replaced by an in-memory fake, and the server by a scripted fetch,
// so these run without a browser or a network.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, clearAll, getMeta } from './db'
import { saveLocal, getDoc } from './repo'
import { newId } from './ids'
import { syncNow, resolveKeepMine, resolveUseTheirs, getSyncState } from './syncService'

// Minimal browser stand-ins used by the sync engine.
const store = new Map()
vi.stubGlobal('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
vi.stubGlobal('navigator', { onLine: true })

const reply = (body, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
const PATIENT = 'a'.repeat(24)
const note = (extra = {}) => ({ patient_id: PATIENT, session_date: '2026-10-22', subjective: 'Child was calm and focused.', baseVersion: 0, ...extra })

beforeEach(async () => {
  await clearAll()
  store.set('sessionToken', 'test-token')
  navigator.onLine = true
  vi.unstubAllGlobals?.()
  vi.stubGlobal('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })
  vi.stubGlobal('navigator', { onLine: true })
})

describe('ids', () => {
  it('makes unique 24-hex ObjectId-shaped ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, newId))
    expect(ids.size).toBe(2000)
    expect([...ids].every((i) => /^[0-9a-f]{24}$/.test(i))).toBe(true)
  })
})

describe('saving locally (outbox + encryption)', () => {
  it('writes the record as pending and adds exactly one outbox entry, even after several edits', async () => {
    const a = await saveLocal('soapNotes', note(), 'create')
    await saveLocal('soapNotes', { _id: a._id, subjective: 'Edited text for the note.' }, 'update')
    expect(await db.outbox.count()).toBe(1)
    const entry = await db.outbox.toCollection().first()
    expect(entry).toMatchObject({ collection: 'soapNotes', op: 'create', docId: a._id })
    expect((await getDoc('soapNotes', a._id)).syncStatus).toBe('pending')
  })

  it('never stores SOAP text in readable form, and reads it back correctly', async () => {
    const a = await saveLocal('soapNotes', note({ subjective: 'Secret clinical sentence.' }), 'create')
    const raw = await db.soapNotes.get(a._id)
    expect(JSON.stringify(raw)).not.toContain('Secret clinical sentence')
    expect(raw.sealed).toBeTruthy()
    expect((await getDoc('soapNotes', a._id)).subjective).toBe('Secret clinical sentence.')
  })

  it('logout clears every table and the encryption key', async () => {
    await saveLocal('soapNotes', note(), 'create')
    await clearAll()
    expect(await db.soapNotes.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect(await getMeta('noteKey')).toBe(null)
  })
})

describe('sync engine', () => {
  it('clears the outbox only after the server says ok, and marks the record synced', async () => {
    const a = await saveLocal('soapNotes', note(), 'create')
    vi.stubGlobal('fetch', vi.fn((url) => (url.includes('/push')
      ? reply({ results: [{ collection: 'soapNotes', docId: a._id, status: 'ok', version: 1 }] })
      : reply({ serverTime: '2026-10-22T10:00:00.000Z', docs: {} }))))
    await syncNow({ force: true })
    expect(await db.outbox.count()).toBe(0)
    const rec = await getDoc('soapNotes', a._id)
    expect(rec).toMatchObject({ syncStatus: 'synced', version: 1, baseVersion: 1 })
    expect(await getMeta('lastSyncTime')).toBe('2026-10-22T10:00:00.000Z') // the server's clock
  })

  it('keeps the entry and backs off when the server cannot be reached (nothing is dropped)', async () => {
    await saveLocal('soapNotes', note(), 'create')
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await syncNow({ force: true })
    const entry = await db.outbox.toCollection().first()
    expect(entry.tries).toBe(1)
    expect(entry.nextTryAt).toBeGreaterThan(Date.now())
    // A normal (non-forced) run before nextTryAt does not hammer the server.
    const spy = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    vi.stubGlobal('fetch', spy)
    await syncNow()
    expect(spy.mock.calls.filter(([url]) => url.includes('/push')).length).toBe(0) // (a pull may still run)
  })

  it('keeps everything and asks for login when the token has expired', async () => {
    await saveLocal('soapNotes', note(), 'create')
    vi.stubGlobal('fetch', vi.fn(() => reply({ error: 'Please sign in again.', code: 'NO_SESSION' }, 401)))
    await syncNow({ force: true })
    expect(getSyncState().needsLogin).toBe(true)
    expect(await db.outbox.count()).toBe(1)
  })

  it('does not call the server at all while offline', async () => {
    await saveLocal('soapNotes', note(), 'create')
    navigator.onLine = false
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    await syncNow({ force: true })
    expect(spy).not.toHaveBeenCalled()
    expect(await db.outbox.count()).toBe(1)
  })

  it('SOAP conflict: keeps both versions, and "keep mine" re-sends based on the server version', async () => {
    const a = await saveLocal('soapNotes', note({ subjective: 'My offline edit.', baseVersion: 1 }), 'update')
    const server = { _id: a._id, patient_id: PATIENT, session_date: '2026-10-22', subjective: 'Edited on the other device.', version: 2 }
    vi.stubGlobal('fetch', vi.fn((url) => (url.includes('/push')
      ? reply({ results: [{ collection: 'soapNotes', docId: a._id, status: 'conflict', code: 'NEWER_ON_SERVER', server }] })
      : reply({ serverTime: 't1', docs: {} }))))
    await syncNow({ force: true })

    let rec = await getDoc('soapNotes', a._id)
    expect(rec.syncStatus).toBe('conflict')
    expect(rec.subjective).toBe('My offline edit.') // my text is untouched
    expect(rec.serverCopy.subjective).toBe('Edited on the other device.')
    expect(await db.outbox.count()).toBe(0) // not retried until the user chooses

    await resolveKeepMine('soapNotes', a._id)
    rec = await getDoc('soapNotes', a._id)
    expect(rec).toMatchObject({ syncStatus: 'pending', baseVersion: 2 })
    expect(await db.outbox.count()).toBe(1)
  })

  it('SOAP conflict: "use the other version" replaces the local copy and clears the outbox', async () => {
    const a = await saveLocal('soapNotes', note({ subjective: 'My offline edit.', baseVersion: 1 }), 'update')
    const server = { _id: a._id, patient_id: PATIENT, session_date: '2026-10-22', subjective: 'Edited on the other device.', version: 2 }
    vi.stubGlobal('fetch', vi.fn((url) => (url.includes('/push')
      ? reply({ results: [{ collection: 'soapNotes', docId: a._id, status: 'conflict', code: 'NEWER_ON_SERVER', server }] })
      : reply({ serverTime: 't1', docs: {} }))))
    await syncNow({ force: true })
    await resolveUseTheirs('soapNotes', a._id)
    const rec = await getDoc('soapNotes', a._id)
    expect(rec).toMatchObject({ syncStatus: 'synced', subjective: 'Edited on the other device.', version: 2 })
    expect(await db.outbox.count()).toBe(0)
  })

  it('a refused change (e.g. overlapping appointment) is marked rejected with its message', async () => {
    const id = newId()
    await saveLocal('appointments', { _id: id, patient_id: PATIENT, session_date: '2026-10-25', start_time: '09:30', end_time: '10:30' }, 'create')
    vi.stubGlobal('fetch', vi.fn((url) => (url.includes('/push')
      ? reply({ results: [{ collection: 'appointments', docId: id, status: 'rejected', code: 'SLOT_TAKEN', message: 'That time overlaps another session.' }] })
      : reply({ serverTime: 't2', docs: {} }))))
    await syncNow({ force: true })
    const rec = await getDoc('appointments', id)
    expect(rec).toMatchObject({ syncStatus: 'rejected', rejectedMessage: 'That time overlaps another session.' })
    expect(await db.outbox.count()).toBe(0)
  })

  it('pull never overwrites a record that still has unsent local changes', async () => {
    const a = await saveLocal('soapNotes', note({ subjective: 'Local unsent text.', baseVersion: 1 }), 'update')
    vi.stubGlobal('fetch', vi.fn((url) => (url.includes('/push')
      ? reply({ error: 'down' }, 500)
      : reply({ serverTime: 't3', docs: { soapNotes: [{ _id: a._id, patient_id: PATIENT, session_date: '2026-10-22', subjective: 'Server text.', version: 2 }] } }))))
    await syncNow({ force: true })
    expect((await getDoc('soapNotes', a._id)).subjective).toBe('Local unsent text.')
  })
})
