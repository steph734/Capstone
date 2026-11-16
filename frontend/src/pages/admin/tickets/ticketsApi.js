import { authFetch, getSessionToken } from '../../../utils/session'

// Thin wrappers over /api/admin/tickets/*. The server derives the admin from the session.
const base = '/api/admin/tickets'
const enc = encodeURIComponent

export const listTickets = (query) => authFetch(base, { query })
export const getStats = () => authFetch(`${base}/stats`)
export const getTicket = (number) => authFetch(`${base}/${enc(number)}`)
export const patchTicket = (number, body) => authFetch(`${base}/${enc(number)}`, { method: 'PATCH', body })
export const saveResolutionNotes = (number, text) => authFetch(`${base}/${enc(number)}/resolution-notes`, { method: 'PUT', body: { text } })
export const resolveTicket = (number, body) => authFetch(`${base}/${enc(number)}/resolve`, { method: 'POST', body })
export const reopenTicket = (number, version) => authFetch(`${base}/${enc(number)}/reopen`, { method: 'POST', body: { version } })
export const openAttachment = (messageId, index) => authFetch(`/api/admin/support/attachments/${enc(messageId)}/${index}`)

export async function postReply(number, { body, internal, file }) {
  if (!file) return authFetch(`${base}/${enc(number)}/replies`, { method: 'POST', body: { body, internal: !!internal } })
  const form = new FormData()
  form.append('body', body || '')
  form.append('internal', internal ? 'true' : 'false')
  form.append('file', file)
  const res = await fetch(`${base}/${enc(number)}/replies`, { method: 'POST', headers: { Authorization: `Bearer ${getSessionToken()}` }, body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, code: data.code })
  return data
}
