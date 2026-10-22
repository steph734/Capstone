// Tests for the session-note security rules (run with:  npx vitest run api/_lib/noteSecurity.test.js).
// Uses an in-memory stand-in for MongoDB, so nothing touches the real database.
import { describe, expect, it, beforeAll } from 'vitest'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'

let checkSigningPassword, audit, sealSignature, readSignature, manilaToday, boundedOfflineDate, stripMongoOperators, sameSiteOnly, SIGN_LOCK_MS

// ── tiny fake database ──
const store = { audit_logs: [], auditlogs: [], sign_attempts: [] }
const match = (d, q) => Object.entries(q).every(([k, v]) => String(d[k]) === String(v))
const col = (n) => ({
  findOne: async (q) => store[n].find((d) => match(d, q)) || null,
  insertOne: async (d) => { store[n].push({ ...d }); return {} },
  deleteOne: async (q) => { store[n] = store[n].filter((d) => !match(d, q)); return {} },
  updateOne: async (q, u, opts) => {
    let row = store[n].find((d) => match(d, q))
    if (!row && opts?.upsert) { row = { ...q }; store[n].push(row) }
    Object.assign(row, u.$set)
    return {}
  },
})
const db = { collection: col }
const PASSWORD_HASH = 'a'.repeat(64) // what the browser sends (SHA-256 hex of the password)
const user = { _id: new ObjectId(), role: 'Therapist', password: '' }

beforeAll(async () => {
  process.env.SOAP_ENCRYPTION_KEY = 'b'.repeat(64)
  user.password = await bcrypt.hash(PASSWORD_HASH, 4)
  ;({ checkSigningPassword, SIGN_LOCK_MS } = await import('./passwordCheck.js'))
  ;({ audit, sealSignature, readSignature } = await import('./noteAccess.js'))
  ;({ manilaToday, boundedOfflineDate } = await import('./manilaDate.js'))
  ;({ stripMongoOperators, sameSiteOnly } = await import('./hardening.js'))
})

describe('signing: wrong passwords are logged and lock signing for 15 minutes', () => {
  it('counts down, logs every failure, and locks on the 5th', async () => {
    const noteId = new ObjectId()
    for (let i = 1; i <= 4; i += 1) {
      const r = await checkSigningPassword(db, user, 'wrong', { ip: '1.2.3.4', noteId })
      expect(r.ok).toBe(false)
      expect(r.locked).toBeFalsy()
      expect(r.error).toContain(`${5 - i} attempt`)
    }
    const fifth = await checkSigningPassword(db, user, 'wrong', { ip: '1.2.3.4', noteId })
    expect(fifth).toMatchObject({ ok: false, locked: true })
    expect(fifth.error).toContain('15 minutes')
    expect(store.audit_logs.filter((l) => l.action === 'sign_failed')).toHaveLength(5)
    expect(store.audit_logs.filter((l) => l.action === 'sign_locked')).toHaveLength(1)
  })
  it('refuses even the CORRECT password while locked (and logs the attempt)', async () => {
    const before = store.audit_logs.length
    const r = await checkSigningPassword(db, user, PASSWORD_HASH, { ip: '1.2.3.4' })
    expect(r).toMatchObject({ ok: false, locked: true })
    expect(store.audit_logs.length).toBe(before + 1)
  })
  it('works again after the 15 minutes, and a correct password resets the counter', async () => {
    store.sign_attempts[0].lock_until = new Date(Date.now() - 1000) // the lock has expired
    expect((await checkSigningPassword(db, user, PASSWORD_HASH)).ok).toBe(true)
    expect(store.sign_attempts).toHaveLength(0)
  })
  it('the lock lasts exactly 15 minutes', () => { expect(SIGN_LOCK_MS).toBe(15 * 60 * 1000) })
})

describe('audit trail', () => {
  it('writes the detailed row AND a readable line for the Audit Logs page, without note text', async () => {
    store.audit_logs.length = 0; store.auditlogs.length = 0
    const noteId = new ObjectId()
    await audit(db, { user, action: 'sign', patientId: new ObjectId(), noteId, ip: '9.9.9.9' })
    expect(store.audit_logs).toHaveLength(1)
    expect(store.auditlogs).toHaveLength(1)
    expect(store.auditlogs[0]).toMatchObject({ action: 'sign', ip_address: '9.9.9.9' })
    expect(store.auditlogs[0].description).toContain('signed a session note')
    expect(store.auditlogs[0].description).toContain(String(noteId))
  })
  it('an access-denied line says what was attempted', async () => {
    store.auditlogs.length = 0
    await audit(db, { user, action: 'denied', ip: '9.9.9.9', meta: { attempted: 'PATCH /api/notes/abc' } })
    expect(store.auditlogs[0].description).toContain('was denied access')
    expect(store.auditlogs[0].description).toContain('PATCH /api/notes/abc')
  })
})

describe('server-decided note date', () => {
  it('manilaToday is a YYYY-MM-DD date in Philippine time', () => {
    expect(manilaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 2026-10-22 17:00 UTC is already 2026-10-23 01:00 in Manila
    expect(manilaToday(new Date('2026-10-22T17:00:00Z'))).toBe('2026-10-23')
  })
  it('an offline device date is accepted only when real, not future and at most 7 days old', () => {
    const now = new Date('2026-10-22T04:00:00Z')
    expect(boundedOfflineDate('2026-10-20', now)).toEqual({ date: '2026-10-20', fromDevice: true })
    expect(boundedOfflineDate('2026-10-30', now)).toEqual({ date: '2026-10-22', fromDevice: false }) // future
    expect(boundedOfflineDate('2026-09-01', now)).toEqual({ date: '2026-10-22', fromDevice: false }) // too old
    expect(boundedOfflineDate('not a date', now)).toEqual({ date: '2026-10-22', fromDevice: false })
    expect(boundedOfflineDate(undefined, now)).toEqual({ date: '2026-10-22', fromDevice: false })
  })
})

describe('signature image is encrypted', () => {
  const sig = 'data:image/png;base64,AAAA'
  it('is not readable in the stored value, and reads back for an authorised read', () => {
    const id = new ObjectId()
    const stored = sealSignature(sig, id)
    expect(stored).not.toContain('AAAA')
    expect(stored.startsWith('v1.')).toBe(true)
    expect(readSignature({ _id: id, signature_image: stored })).toBe(sig)
  })
  it('a signature copied onto another note cannot be decrypted', () => {
    const stored = sealSignature(sig, new ObjectId())
    expect(readSignature({ _id: new ObjectId(), signature_image: stored })).toBe(null)
  })
  it('older notes with a plain data URL still display until migrated', () => {
    expect(readSignature({ _id: new ObjectId(), signature_image: sig })).toBe(sig)
  })
})

describe('request hardening', () => {
  it('removes MongoDB operators from request bodies', () => {
    expect(stripMongoOperators({ email: { $ne: null }, nested: [{ $where: 'x', ok: 1 }], name: 'Eli' })).toEqual({ email: {}, nested: [{ ok: 1 }], name: 'Eli' })
  })
  const run = (method, origin, host = 'app.example.com') => {
    const out = { next: false, status: null }
    sameSiteOnly({ method, headers: { origin, host } }, { status(c) { out.status = c; return { json() {} } } }, () => { out.next = true })
    return out
  }
  it('allows our own site, requests with no Origin, and reads', () => {
    expect(run('POST', 'https://app.example.com').next).toBe(true)
    expect(run('POST', undefined).next).toBe(true)
    expect(run('GET', 'https://evil.example').next).toBe(true)
  })
  it('refuses a change that comes from another website', () => {
    const r = run('POST', 'https://evil.example')
    expect(r.next).toBe(false)
    expect(r.status).toBe(403)
  })
})
