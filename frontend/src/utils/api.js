// Thin wrapper around this app's /api/* endpoints. Historically these hit a
// separate Express server (backend/server.js on :5000) via VITE_API_URL, but
// that var is only ever set in a developer's local, gitignored .env — the
// deployed Vercel site never has it, so every request silently fell back to
// http://localhost:5000 and only worked on a machine happening to run that
// server locally (everyone else, including the same site opened on a phone,
// got nothing). The matching endpoints have since been ported to this app's
// own Vercel serverless functions under api/_lib/routes/, so same-origin
// (relative path, no host) is now the correct default.
export const API_BASE = import.meta.env.VITE_API_URL || ''

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `GET ${path} failed: ${res.status}`)
  return data
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `POST ${path} failed: ${res.status}`)
  return data
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `PATCH ${path} failed: ${res.status}`)
  return data
}

export async function apiDelete(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `POST ${path} failed: ${res.status}`)
  return data
}

// Quick connectivity check — hits GET /api/health on the backend.
export function checkBackendHealth() {
  return apiGet('/api/health')
}
