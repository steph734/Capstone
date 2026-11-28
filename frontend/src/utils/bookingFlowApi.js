import { authFetch, getSessionToken } from './session'

// Browser side of the booking approval flow (server: api/_lib/routes/booking-flow.js).
const at = (action, extra = '') => `/api/booking-flow?action=${action}${extra}`
const changed = () => window.dispatchEvent(new Event('tp:booking-flow')) // the sidebar count refreshes

const post = async (action, body) => { const out = await authFetch(at(action), { method: 'POST', body }); changed(); return out }

export const flowApi = {
  badge: () => authFetch(at('badge')),
  ownerQueue: () => authFetch(at('ownerPaymentQueue')),
  verify: (appointmentId) => post('ownerVerifyPayment', { appointmentId }),
  reject: (appointmentId, reason, message) => post('ownerRejectPayment', { appointmentId, reason, message }),
  respond: (appointmentId, action, reason) => post('therapistRespond', { appointmentId, action, reason }),
  guardianBookings: () => authFetch(at('guardianBookings')),
  async resubmit(appointmentId, { reference, file, key }) {
    const form = new FormData()
    form.append('reference', reference)
    form.append('receipt', file, file.name || 'receipt')
    const res = await fetch(at('guardianResubmitPayment', `&appointmentId=${appointmentId}`), { method: 'POST', headers: { Authorization: `Bearer ${getSessionToken()}`, 'Idempotency-Key': key }, body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.error || 'We could not send your receipt. Please try again.'), { code: data.code })
    return data
  },
}
