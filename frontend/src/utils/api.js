// Thin wrapper around the Express backend (backend/server.js).
// Base URL comes from VITE_API_URL; falls back to localhost:5000 in dev.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

// Quick connectivity check — hits GET /api/health on the backend.
export function checkBackendHealth() {
  return apiGet('/api/health')
}
