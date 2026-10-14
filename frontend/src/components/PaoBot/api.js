import { authFetch, getSessionToken } from '../../utils/session'

// Client for the Pao FAQ bot and the requester side of support tickets
// (api/_lib/routes/faq.js and support.js). The role always comes from the
// server-side session; nothing here tells the server who the user is.
export const getQuick = () => authFetch('/api/faq/quick').then((b) => b.quick)
export const askPao = (text) => authFetch('/api/faq/ask', { method: 'POST', body: { text } })
export const sendFeedback = (id, helpful) => authFetch(`/api/faq/${id}/feedback`, { method: 'POST', body: { helpful } })
export const listTickets = () => authFetch('/api/support/tickets')
export const getTicket = (id) => authFetch(`/api/support/tickets/${id}`)
export const replyTicket = (id, body) => authFetch(`/api/support/tickets/${id}/messages`, { method: 'POST', body: { body } })
export const attachmentUrl = (messageId, index) => authFetch(`/api/support/attachments/${messageId}/${index}`, { query: { json: 1 } })

// Multipart: a `data` JSON string plus an optional `screenshot` image.
export async function createTicket(data, screenshot) {
  const fd = new FormData()
  fd.append('data', JSON.stringify(data))
  if (screenshot) fd.append('screenshot', screenshot, screenshot.name || 'screenshot.png')
  const res = await fetch('/api/support/tickets', { method: 'POST', headers: { Authorization: `Bearer ${getSessionToken()}` }, body: fd })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || 'Could not send your ticket.'), { status: res.status, code: body.code, fields: body.fields })
  return body
}

// Page + device details attached to a ticket automatically. No account or
// clinical data: just where the problem happened and what it ran on.
export function ticketContext() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  // Order matters: Edge and Opera also say "Chrome" in their user agent.
  const browser = (() => {
    const tests = [[/Edg\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/Firefox\/(\d+)/, 'Firefox'], [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+).*Safari/, 'Safari']]
    for (const [re, name] of tests) { const m = ua.match(re); if (m) return `${name} ${m[1]}` }
    return 'Browser'
  })()
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  return { page: typeof location !== 'undefined' ? location.pathname : '', browser, os, app_version: String(import.meta.env.VITE_APP_VERSION || '') }
}

export const contextLabel = (c) => [c.page, c.browser, c.os].filter(Boolean).join(' · ')

const PREFIX = 'pao:'
export function clearPaoSession() {
  try { Object.keys(sessionStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => sessionStorage.removeItem(k)) } catch { /* nothing stored */ }
}
export const chatKey = (userId) => `${PREFIX}chat:${userId}`
