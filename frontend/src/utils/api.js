// Thin wrapper around the Express backend (backend/server.js).
// Base URL comes from VITE_API_URL; falls back to localhost:5000 in dev.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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

// Quick connectivity check — hits GET /api/health on the backend.
export function checkBackendHealth() {
  return apiGet('/api/health')
}
