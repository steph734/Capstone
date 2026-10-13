// The signed-in user's server session token. Kept in sessionStorage (gone when
// the tab closes, never shared across tabs) rather than localStorage, and
// only ever the opaque token: clinical note text is never written to browser
// storage anywhere in the app.
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
export async function authFetch(path, { method = 'GET', body, query } = {}) {
  const url = query ? `${path}?${new URLSearchParams(query)}` : path
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
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
