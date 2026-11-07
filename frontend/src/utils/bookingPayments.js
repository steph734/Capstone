// Browser side of the online booking + payment flow (the server side is api/_lib/routes/bookings-*.js and payments-*.js).
//
// The order is: 1) hold the time slot  2) start a payment attempt  3) pay  4) the SERVER confirms.
// The browser never decides that a payment worked; it only asks the server (which asks Stripe).
//
// What is remembered in sessionStorage (so a refresh can resume): the booking id, the secret booking token, and the
// attempt id. No card details and no personal data. It is removed when the booking is finished or cancelled.
import { friendlyPaymentError } from './paymentMessages'

const KEY = 'tp_checkout_v1'

export const newKey = () => `${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`.replace(/[^\w-]/g, '').padEnd(16, 'x')

export function loadSaved() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null }
}
export function save(patch) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...(loadSaved() || {}), ...patch })) } catch { /* private mode: resume just won't work */ }
}
export function clearSaved() {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

// Calls the API and turns every failure into an Error with a friendly message and a code.
async function call(path, { method = 'GET', body, token } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-booking-token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    throw Object.assign(new Error(friendlyPaymentError(err).message), { code: 'network' })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // The server already words its errors for patients; a 404 on start means the payment API is not deployed.
    const message = data.error || friendlyPaymentError(res.status === 404 ? 'unavailable' : 'unknown').message
    throw Object.assign(new Error(message), { code: data.code || 'unknown', status: res.status })
  }
  return data
}

export const startBooking = (body, idempotencyKey) => call('/api/bookings/start', { method: 'POST', body: { ...body, idempotencyKey } })
export const createAttempt = (bookingId, token, payload) => call(`/api/bookings/${bookingId}/attempts`, { method: 'POST', token, body: payload })
export const getBookingState = (bookingId, token) => call(`/api/bookings/${bookingId}/state`, { token })
export const cancelBooking = (bookingId, token) => call(`/api/bookings/${bookingId}/cancel`, { method: 'POST', token, body: {} })
export const getStatus = (attemptId, token) => call(`/api/payments/${attemptId}/status`, { token })
export const submitQrDetails = (attemptId, token, payload) => call(`/api/payments/${attemptId}/qr-submit`, { method: 'POST', token, body: payload })

// The statuses after which polling stops.
export const TERMINAL = ['succeeded', 'failed', 'expired', 'pending_verification']
