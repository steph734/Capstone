// The API now refuses requests that have no sign-in token (default deny, see api/_lib/guard.js).
// Many pages call plain fetch('/api/...'). Rather than edit every call, this wraps fetch ONCE and adds
// "Authorization: Bearer <token>" to every request to our own API that doesn't already carry one.
// The token is only ever sent to our own origin (or VITE_API_URL), never to third-party sites.
import { getSessionToken } from './session'
import { sessionEnded } from '../session/sessionBus'
import { notifyDowntime } from '../downtime/api'

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
    return realFetch(input, { ...(init || {}), headers }).then((res) => endedByServer(res, token))
  }
}

// The server said this sign-in is over (idle limit, logged out elsewhere, expired): every page that keeps asking
// would otherwise pile up 401s while the screen still looks signed in. Tell the idle gate once; it logs out
// and shows the signed-out page. The sign-in routes themselves (/api/auth/...) are left alone.
function endedByServer(res, sentToken) {
  try {
    if (res.status === 503 && !new URL(res.url, window.location.origin).pathname.startsWith('/api/auth/')) {
      res.clone().json().then((d) => { if (d?.code === 'SYSTEM_DOWNTIME') notifyDowntime({ endAt: d.endAt }) }).catch(() => {})
    }
    if (res.status === 401 && !new URL(res.url, window.location.origin).pathname.startsWith('/api/auth/')) {
      res.clone().json().then((d) => {
        if (d?.code !== 'SESSION_IDLE' && d?.code !== 'NO_SESSION') return
        // A slow request sent with an OLD token (before a re-login or token change) must not log out the new session.
        if (sentToken !== getSessionToken()) return
        console.warn('[session] ended by server:', d.code, d.reason || '', res.url)
        sessionEnded(d.code)
      }).catch(() => {})
    }
  } catch { /* never let this break a request */ }
  return res
}
