// The signed-in user's server session token. Kept in sessionStorage (gone when
// the tab closes, never shared across tabs) rather than localStorage, and
// only ever the opaque token: clinical note text is never written to browser
// storage anywhere in the app.
import { noteActivity, sessionEnded } from '../session/sessionBus'
import { notifyDowntime } from '../downtime/api'

const KEY = 'sessionToken'

export function getSessionToken() {
  try { return sessionStorage.getItem(KEY) || '' } catch { return '' }
}
export function setSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch { /* storage unavailable: the user just has to sign in again */ }
}

// fetch() that sends the bearer token and turns API errors into Error
// objects carrying { status, code, fields } so callers can react (lock
// screen on SESSION_LOCKED, per-field messages, etc.).
export async function authFetch(path, { method = 'GET', body, query, headers = {} } = {}) {
  const url = query ? `${path}?${new URLSearchParams(query)}` : path
  const token = getSessionToken()
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  // Idle logout: something the user did (a save, an upload, a send) counts as activity; background reads do not.
  if (res.ok && method !== 'GET') noteActivity()
  // The server ended the session (idle limit or revoked): the idle gate logs out once and shows the signed-out page.
  if (res.status === 401 && token && token === getSessionToken() && (data.code === 'SESSION_IDLE' || data.code === 'NO_SESSION')) {
    console.warn('[session] ended by server:', data.code, data.reason || '', url)
    sessionEnded(data.code)
  }
  // The system is down for an update: the provider signs this person out and shows the maintenance screen.
  if (res.status === 503 && data.code === 'SYSTEM_DOWNTIME') notifyDowntime({ endAt: data.endAt })
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = data.code
    err.fields = data.fields
    err.data = data
    throw err
  }
  return data
}

// Display helper: the server stores note text HTML-escaped (defence in depth);
// React already escapes on render, so decode once for display / PDF text.
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
export const unescapeHtml = (s) => String(s ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENT[m])
