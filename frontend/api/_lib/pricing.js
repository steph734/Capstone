// What an online booking payment costs. The SERVER decides the amount; the browser's number is never used
// to charge or to record a payment (before this, a client could ask for any price).
//
// Keep in step with SESSION_FEE in src/pages/BookAppointmentPage.jsx. The checkout modal charges the
// session fee only (the service charge is shown on the booking summary and is not part of the online charge).
export const SESSION_FEE_PESOS = 300
export const ONLINE_AMOUNT_PESOS = SESSION_FEE_PESOS
export const ONLINE_AMOUNT_CENTAVOS = ONLINE_AMOUNT_PESOS * 100
export const CURRENCY = 'PHP'

// A held (unpaid) slot is kept for this long.
export const HOLD_MS = 15 * 60 * 1000
// A QR payment waits for the therapist to verify it. QR_REVIEW_HOURS is the ONE setting behind the patient-facing
// "usually within X hours" (the server sends it to the checkout screen). The slot is held three times that long, so a
// slow verification does not lose the patient's slot.
export const QR_REVIEW_HOURS = 24
export const QR_REVIEW_HOLD_MS = QR_REVIEW_HOURS * 3 * 60 * 60 * 1000

// An online booking only counts as a real appointment once its payment is verified. Until then (held, waiting for a
// therapist to verify a QR payment) and after it fell through (expired, failed, cancelled) it must not show up as a
// request, give a therapist access to a patient, or appear in owner lists.
export const NOT_A_REAL_BOOKING = ['awaiting_payment', 'pending_verification', 'expired', 'failed', 'cancelled']
