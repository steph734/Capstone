import { authFetch } from '../utils/session'

export const DOWNTIME_EVENT = 'tp:downtime' // fired when any call gets 503 SYSTEM_DOWNTIME (see installAuthFetch / authFetch / Login)
export const GRACE_MS = 5 * 60 * 1000
export const COUNTDOWN_MS = 5 * 60 * 1000

export const notifyDowntime = (detail = {}) => {
  try { window.dispatchEvent(new CustomEvent(DOWNTIME_EVENT, { detail })) } catch { /* ignore */ }
}

// Public status. `offset` = serverTime - this browser's clock, so every countdown uses SERVER time and changing the
// computer clock cannot break it. If a CDN served a cached copy, the Age header says how old it is.
export async function fetchStatus({ fresh = false } = {}) {
  const res = await fetch(`/api/system?action=status${fresh ? '&fresh=1' : ''}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`status ${res.status}`)
  const data = await res.json()
  const age = Number(res.headers.get('age')) || 0
  return { ...data, offset: Date.parse(data.serverTime) + age * 1000 - Date.now() }
}

// Super Admin calls (the server answers 403 to anyone else).
export const sys = (action, { method = 'GET', id, body } = {}) =>
  authFetch(`/api/system?action=${action}${id ? `&id=${id}` : ''}`, { method, body })

export const askForGrace = () => authFetch('/api/system?action=busy', { method: 'POST', body: {} }).catch(() => null)

// Which audience flag a role belongs to.
export const audienceKey = (role) => (role === 'Owner' ? 'owners' : role === 'Therapist' ? 'therapists' : role === 'Patient' || role === 'Guardian' ? 'patients' : null)
export const isAffected = (role, audience) => { const k = audienceKey(role); return !!(k && audience?.[k]) }
