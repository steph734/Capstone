import { authFetch } from '../../../utils/session'
import { sha256Hex } from '../../../utils/hash'

// Thin client for the secured SOAP-note API (api/_lib/routes/notes-*.js).
// Every call carries the session token; nothing here is cached anywhere
// except React state.
export const listNotes = () => authFetch('/api/notes/therapist-list').then((b) => b.notes)
export const openNote = (id) => authFetch(`/api/notes/${id}`).then((b) => b.note)
export const noteHistory = (id) => authFetch(`/api/notes/${id}/history`)

// Passwords are SHA-256 hashed in the browser first, exactly like the login
// form, so the raw password never goes over the wire.
async function withPassword(body) {
  const { password, ...rest } = body
  return password === undefined ? rest : { ...rest, password: await sha256Hex(password) }
}

export async function createNote(body) { return authFetch('/api/notes/create', { method: 'POST', body: await withPassword(body) }) }
export async function updateDraft(id, body) { return authFetch(`/api/notes/${id}`, { method: 'PATCH', body }) }
export async function signDraft(id, body) { return authFetch(`/api/notes/${id}/sign`, { method: 'POST', body: await withPassword(body) }) }
export async function addAddendum(id, body) { return authFetch(`/api/notes/${id}/addendum`, { method: 'POST', body: await withPassword(body) }) }
export const voidNote = (id, reason) => authFetch(`/api/notes/${id}/void`, { method: 'POST', body: { reason } })
export const shareNote = (id, sections, summary, domain) => authFetch(`/api/notes/${id}/share`, { method: 'POST', body: { sections, summary, domain } })
export const unshareNote = (id) => authFetch(`/api/notes/${id}/unshare`, { method: 'POST', body: {} })
export const logExport = (id, event) => authFetch(`/api/notes/${id}/audit`, { method: 'POST', body: { event } })
export async function reauth(password) { return authFetch('/api/auth/reauth', { method: 'POST', body: { password: await sha256Hex(password) } }) }
