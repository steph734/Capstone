// Tests for the read-only offline cache used on the patient and owner sides
// (run with:  npx vitest run src/offline/readCache.test.js).
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, clearAll } from './db'
import { installReadCache, uninstallReadCache } from './readCache'

const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
let serverFetch
const events = []

beforeEach(async () => {
  uninstallReadCache()
  await clearAll()
  events.length = 0
  serverFetch = vi.fn()
  vi.stubGlobal('window', {
    fetch: (...a) => serverFetch(...a),
    location: { origin: 'https://app.test' },
    dispatchEvent: (e) => events.push(e),
  })
})

const waitForSave = async () => { for (let i = 0; i < 50 && (await db.readCache.count()) === 0; i += 1) await new Promise((r) => setTimeout(r, 10)) }

describe('read-only cache (patient / owner)', () => {
  it('saves an allowed page while online, then serves it when the connection fails', async () => {
    await installReadCache('Owner', 'owner@test')
    serverFetch.mockImplementationOnce(() => json({ stats: { patients: 42 } }))
    const live = await window.fetch('/api/owner/dashboard?days=7')
    expect((await live.json()).stats.patients).toBe(42)
    await waitForSave()

    serverFetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    const offline = await window.fetch('/api/owner/dashboard?days=7')
    expect(offline.status).toBe(200)
    expect((await offline.json()).stats.patients).toBe(42)
    expect(offline.headers.get('X-From-Offline-Cache')).toBeTruthy()
    expect(events.at(-1).type).toBe('tp:offline-cache')
  })

  it('stores the answer encrypted (no readable data, no readable URL)', async () => {
    await installReadCache('Patient', 'p@test')
    serverFetch.mockImplementationOnce(() => json({ notes: [{ summary: 'Very private clinical summary' }] }))
    await window.fetch('/api/notes/patient-list?email=guardian@test.com')
    await waitForSave()
    const raw = JSON.stringify(await db.readCache.toArray())
    expect(raw).not.toContain('Very private clinical summary')
    expect(raw).not.toContain('guardian@test.com')
  })

  it('never caches or serves endpoints that are not on the allow-list', async () => {
    await installReadCache('Owner', 'owner@test')
    serverFetch.mockImplementation(() => json({ ok: true }))
    await window.fetch('/api/create-payment-intent')
    await window.fetch('/api/auth/login')
    await new Promise((r) => setTimeout(r, 50))
    expect(await db.readCache.count()).toBe(0)
    serverFetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(window.fetch('/api/create-payment-intent')).rejects.toThrow()
  })

  it('does not let one role read another role\'s pages', async () => {
    await installReadCache('Patient', 'p@test')
    serverFetch.mockImplementation(() => json({ x: 1 }))
    await window.fetch('/api/owner/dashboard')
    await new Promise((r) => setTimeout(r, 50))
    expect(await db.readCache.count()).toBe(0)
  })

  it('passes real server errors through (401/500 are never hidden by saved data)', async () => {
    await installReadCache('Owner', 'owner@test')
    serverFetch.mockImplementationOnce(() => json({ stats: 1 }))
    await window.fetch('/api/owner/dashboard')
    await waitForSave()
    serverFetch.mockImplementation(() => json({ error: 'Please sign in again.' }, 401))
    const res = await window.fetch('/api/owner/dashboard')
    expect(res.status).toBe(401)
  })

  it('fails normally when a page was never opened online (nothing saved)', async () => {
    await installReadCache('Owner', 'owner@test')
    serverFetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(window.fetch('/api/owner/patients')).rejects.toThrow('Failed to fetch')
  })

  it('only caches GET requests', async () => {
    await installReadCache('Owner', 'owner@test')
    serverFetch.mockImplementation(() => json({ ok: true }))
    await window.fetch('/api/owner/leave-requests?id=1', { method: 'PATCH', body: '{}' })
    await new Promise((r) => setTimeout(r, 50))
    expect(await db.readCache.count()).toBe(0)
  })

  it('a different person on the same device never sees the previous person\'s saved pages', async () => {
    await installReadCache('Owner', 'first@test')
    serverFetch.mockImplementationOnce(() => json({ stats: 'first owner data' }))
    await window.fetch('/api/owner/dashboard')
    await waitForSave()
    uninstallReadCache()
    await installReadCache('Owner', 'second@test') // different owner key clears the cache
    expect(await db.readCache.count()).toBe(0)
  })
})
