import { authFetch } from '../../../utils/session'

// My Patients API client. Errors carry { status, code, fields, data } (see authFetch).
export const patientsApi = {
  list: (query) => authFetch('/api/therapist/patients', { query }),
  get: (id) => authFetch(`/api/therapist/patients/${id}`),
  archive: (id) => authFetch(`/api/therapist/patients/${id}/archive`, { method: 'PATCH', body: {} }),
  unarchive: (id) => authFetch(`/api/therapist/patients/${id}/unarchive`, { method: 'PATCH', body: {} }),
  deletePreview: (id) => authFetch(`/api/therapist/patients/${id}/delete-preview`),
  remove: (id, confirmName) => authFetch(`/api/therapist/patients/${id}`, { method: 'DELETE', body: { confirm_name: confirmName } }),
  resendInvite: (id) => authFetch(`/api/therapist/patients/${id}/resend-invite`, { method: 'POST', body: {} }),
  // One Idempotency-Key per Add patient attempt: a double click or a retry can never create two patients or two payments.
  // Card: validates the form on the server, then starts the Stripe payment. The same key always gives the same payment.
  cardIntent: (body, key) => authFetch('/api/therapist/patients/card-intent', { method: 'POST', body, headers: { 'Idempotency-Key': key } }),
  create: (body, key) => authFetch('/api/therapist/patients', { method: 'POST', body, headers: { 'Idempotency-Key': key } }),
}
