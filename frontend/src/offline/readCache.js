// Read-only offline cache for the patient and owner sides.
//
// Idea: pages keep calling fetch() exactly as before. This module wraps fetch ONCE and,
// for a short list of safe GET endpoints, (a) saves every good answer on the device and
// (b) when the network is down, answers from that saved copy instead of failing.
// So a page the user already opened still shows its last data offline, with no change to
// the page's own code. A small banner says the data is saved, not live.
//
// Rules:
//   * Only GET requests to the allow-lists below. Payments, auth, messaging, file downloads
//     and anything not listed are never cached.
//   * Only real connection failures fall back to the cache. A normal error from the
//     server (401, 403, 500 ...) is passed through untouched, so security errors are never hidden.
//   * Saved answers are encrypted (same key as SOAP drafts, see noteCrypto.js) and are erased on logout.
import { db, getMeta, setMeta } from './db'
import { seal, open } from './noteCrypto'

// Endpoints each role may cache. A string ends the match at the path (query strings are ignored);
// a RegExp is tested against the path.
const ALLOWED = {
  Patient: ['/api/notes/patient-list', /^\/api\/notes\/[a-f0-9]{24}$/i, '/api/patient/progress', '/api/pao', '/api/pao/badges', '/api/games', '/api/games/list', '/api/games/by-name', '/api/appointments/therapists', '/api/badges/list'],
  Owner: ['/api/owner/dashboard', '/api/owner/patients', '/api/owner/appointments', '/api/owner/leave-requests', '/api/owner/gamified/overview', '/api/employees', '/api/branches', '/api/reports'],
}

const isAllowed = (role, path) => (ALLOWED[role] || []).some((rule) => (rule instanceof RegExp ? rule.test(path) : rule === path))

async function keyFor(url) {
  const bytes = new TextEncoder().encode(url)
  const hash = await crypto.subtle.digest('SHA-256', bytes) // the URL can contain an email, so it is hashed
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

const toPathAndFull = (input) => {
  const raw = typeof input === 'string' ? input : input?.url || ''
  try { const u = new URL(raw, window.location.origin); return { path: u.pathname, full: u.pathname + u.search, sameOrigin: u.origin === window.location.origin } } catch { return { path: '', full: '', sameOrigin: false } }
}

let realFetch = null
let installedFor = null

// Starts caching for this role. Safe to call again (e.g. after a re-render).
export async function installReadCache(role, ownerKey) {
  if (typeof window === 'undefined' || !ALLOWED[role]) return
  // A different person on the same device must never see the previous person's saved pages.
  if (ownerKey && (await getMeta('cacheOwner')) !== ownerKey) { await db.readCache.clear(); await setMeta('cacheOwner', ownerKey) }
  if (installedFor) { installedFor = role; return }
  installedFor = role
  realFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const method = String(init?.method || input?.method || 'GET').toUpperCase()
    const { path, full, sameOrigin } = toPathAndFull(input)
    if (method !== 'GET' || !sameOrigin || !installedFor || !isAllowed(installedFor, path)) return realFetch(input, init)

    try {
      const res = await realFetch(input, init)
      if (res.ok) {
        // Saving must never slow down or break the page: do it in the background.
        res.clone().json().then(async (data) => {
          await db.readCache.put({ key: await keyFor(full), sealed: await seal({ data }), savedAt: new Date().toISOString() })
        }).catch(() => {})
      }
      return res
    } catch (err) {
      if (!(err instanceof TypeError)) throw err // not a connection failure
      const row = await db.readCache.get(await keyFor(full)).catch(() => null)
      if (!row) throw err // never opened before: nothing saved to show
      try {
        const { data } = await open(row.sealed)
        window.dispatchEvent(new CustomEvent('tp:offline-cache', { detail: { savedAt: row.savedAt, path } }))
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'X-From-Offline-Cache': row.savedAt } })
      } catch { throw err }
    }
  }
}

// Stops caching and restores the browser's own fetch (called on logout).
export function uninstallReadCache() {
  if (realFetch && typeof window !== 'undefined') window.fetch = realFetch
  realFetch = null
  installedFor = null
}
