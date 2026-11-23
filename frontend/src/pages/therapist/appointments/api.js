import { authFetch } from '../../../utils/session'

// Therapist Appointments API client. The therapist is always the signed-in user; nothing here sends an id or an email for "who".
// Errors carry { status, code, fields } (see authFetch).
const BASE = '/api/therapist/appointments'

export const apptApi = {
  summary: () => authFetch(`${BASE}/summary`),
  calendar: (month) => authFetch(`${BASE}/calendar`, { query: { month } }),
  day: (date) => authFetch(`${BASE}/day`, { query: { date } }),
  requests: (limit) => authFetch(`${BASE}/requests`, { query: limit ? { limit } : undefined }),
  list: (query) => authFetch(BASE, { query }),
  archive: (id) => authFetch(`${BASE}/${id}/archive`, { method: 'PATCH', body: {} }),
  restore: (id) => authFetch(`${BASE}/${id}/restore`, { method: 'PATCH', body: {} }),
  reschedule: (id, body) => authFetch(`${BASE}/${id}/reschedule`, { method: 'PATCH', body }),
  complete: (id, remarks) => authFetch(`${BASE}/${id}/complete`, { method: 'PATCH', body: { remarks } }),
  // The review itself (payment check, accept, decline) is the existing, tested flow.
  verifyPayment: (id) => authFetch(`/api/appointments/${id}/payment/verify`, { method: 'POST', body: { checks: { amountSeen: true, referenceMatches: true } } }),
  rejectPayment: (id, body) => authFetch(`/api/appointments/${id}/payment/reject`, { method: 'POST', body }),
  accept: (id) => authFetch(`/api/appointments/${id}/accept`, { method: 'POST', body: {} }),
  decline: (id, body) => authFetch(`/api/appointments/${id}/decline`, { method: 'POST', body }),
}
