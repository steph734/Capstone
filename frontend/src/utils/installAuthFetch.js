// The API now refuses requests that have no sign-in token (default deny, see api/_lib/guard.js).
// Many pages call plain fetch('/api/...'). Rather than edit every call, this wraps fetch ONCE and adds
// "Authorization: Bearer <token>" to every request to our own API that doesn't already carry one.
// The token is only ever sent to our own origin (or VITE_API_URL), never to third-party sites.
import { getSessionToken } from './session'

const API_BASE = import.meta.env.VITE_API_URL || ''

let installed = false

export function installAuthFetch() {
  if (installed || typeof window === 'undefined' || !window.fetch) return
  installed = true
  const realFetch = window.fetch.bind(window)

  const isOurApi = (input) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || ''
    try {
      const u = new URL(raw, window.location.origin)
      const ours = u.origin === window.location.origin || (API_BASE && u.href.startsWith(API_BASE))
      return ours && u.pathname.startsWith('/api/')
    } catch { return false }
  }

  window.fetch = (input, init) => {
    if (!isOurApi(input)) return realFetch(input, init)
    const token = getSessionToken()
    if (!token) return realFetch(input, init)
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return realFetch(input, { ...(init || {}), headers })
  }
}
