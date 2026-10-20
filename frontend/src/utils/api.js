// Thin wrapper around this app's /api/* endpoints. Historically these hit a
// separate Express server (backend/server.js on :5000) via VITE_API_URL, but
// that var is only ever set in a developer's local, gitignored .env — the
// deployed Vercel site never has it, so every request silently fell back to
// http://localhost:5000 and only worked on a machine happening to run that
// server locally (everyone else, including the same site opened on a phone,
// got nothing). The matching endpoints have since been ported to this app's
// own Vercel serverless functions under api/_lib/routes/, so same-origin
// (relative path, no host) is now the correct default.
import { getSessionToken } from './session'

export const API_BASE = import.meta.env.VITE_API_URL || ''

const authHeaders = () => { const t = getSessionToken(); return t ? { Authorization: `Bearer ${t}` } : {} }

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `GET ${path} failed: ${res.status}`)
  return data
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `POST ${path} failed: ${res.status}`)
  return data
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `PATCH ${path} failed: ${res.status}`)
  return data
}

export async function apiDelete(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `DELETE ${path} failed: ${res.status}`)
  return data
}

// Like apiPost, but for multipart/form-data bodies (file uploads) — the
// browser sets the multipart boundary itself, so no Content-Type header here.
export async function apiPostForm(path, formData) {
  // Uploads can be slow; give up after 60 s with a clear message instead of an endless "Saving…".
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 60000)
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: authHeaders(), body: formData, signal: ctl.signal })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || (res.status === 504 || res.status === 502 ? 'The server took too long. Please try again.' : `POST ${path} failed: ${res.status}`))
    return data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('This is taking too long. Check your connection and try again.')
    throw e
  } finally { clearTimeout(timer) }
}

// Quick connectivity check — hits GET /api/health on the backend.
export function checkBackendHealth() {
  return apiGet('/api/health')
}
