// Thin client for /api/emails. Same-origin (this app's own Vercel serverless
// functions), not the separate backend/server.js — see utils/api.js for why
// that one doesn't work on the deployed site.
async function parse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export function listEmails(email, { folder = 'inbox', search = '', page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ email, folder, page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  return fetch(`/api/emails?${params}`).then(parse)
}

export function getUnreadCount(email) {
  return fetch(`/api/emails/unread-count?email=${encodeURIComponent(email)}`).then(parse)
}

export function getThread(email, id) {
  return fetch(`/api/emails/${id}?email=${encodeURIComponent(email)}`).then(parse)
}

export function patchEmail(email, id, body) {
  return fetch(`/api/emails/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, ...body }),
  }).then(parse)
}

export function deleteEmail(email, id) {
  return fetch(`/api/emails/${id}?email=${encodeURIComponent(email)}`, { method: 'DELETE' }).then(parse)
}

export function attachmentUrl(email, id, index) {
  return fetch(`/api/emails/${id}/attachments/${index}?email=${encodeURIComponent(email)}`).then(parse)
}

// `payload` is the JSON body shape the backend expects; `files` (optional)
// triggers a multipart request instead.
export function sendEmail(payload, files = []) {
  if (files.length) {
    const form = new FormData()
    form.set('data', JSON.stringify(payload))
    files.forEach((f) => form.append('attachments', f))
    return fetch('/api/emails', { method: 'POST', body: form }).then(parse)
  }
  return fetch('/api/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(parse)
}
