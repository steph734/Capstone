// Booking approval flow: Guardian pays -> Owner checks the payment -> Therapist accepts -> Confirmed.
// Pure rules shared by the server and the browser (no imports).
//
// No migration is needed: the stage is READ from the fields appointments already have.
//   stage                    status      payment_state                      extra
//   awaiting_payment         Pending     awaiting_payment                   (not paid yet: shown to nobody for review)
//   awaiting_payment_check   Pending     pending_verification               old paid-but-unchecked requests land here
//   payment_rejected         Pending     awaiting_payment                   payment.status 'rejected' or review_state 'needs_proof'
//   awaiting_therapist       Pending     paid / null (cash, older records)
//   confirmed                Confirmed
//   declined                 Cancelled                                      therapistResponse / decision 'declined'
//   cancelled, completed, no_show        unchanged

export function stageOf(a) {
  if (!a) return null
  if (a.status === 'Confirmed') return 'confirmed'
  if (a.status === 'Completed') return 'completed'
  if (a.status === 'No Show') return 'no_show'
  if (a.status === 'Cancelled') return a.therapistResponse?.action === 'declined' || a.decision === 'declined' ? 'declined' : 'cancelled'
  if (a.payment_state === 'pending_verification') return 'awaiting_payment_check'
  if (a.payment?.status === 'rejected' || a.review_state === 'needs_proof') return 'payment_rejected'
  if (a.payment_state === 'awaiting_payment') return 'awaiting_payment'
  if (['expired', 'failed', 'cancelled'].includes(a.payment_state)) return 'cancelled'
  return 'awaiting_therapist'
}

// What Owner / Super Admin lists show.
export const STAGE_LABELS = {
  awaiting_payment: 'Awaiting payment',
  awaiting_payment_check: 'Payments to verify',
  payment_rejected: 'Payment needs fixing',
  awaiting_therapist: 'Waiting for therapist',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No Show',
}
// What the guardian reads.
export const GUARDIAN_LABELS = {
  awaiting_payment: 'Waiting for your payment',
  awaiting_payment_check: 'Payment under review',
  payment_rejected: 'Payment needs fixing',
  awaiting_therapist: 'Waiting for therapist',
  confirmed: 'Confirmed',
  declined: 'Declined, refund on the way',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'Missed session',
}

export const REJECT_HOLD_HOURS = 24
export const REJECT_MESSAGE_MAX = 500
export const OWNER_REJECT_REASONS = [
  { code: 'amount_less', label: 'Amount is less than the fee', message: (fee) => `The amount we received is lower than the session fee. Please upload a new receipt for ${fee} so we can confirm your booking.` },
  { code: 'receipt_unclear', label: 'Receipt is unclear', message: () => 'We could not read your receipt clearly. Please upload a clearer screenshot so we can confirm your booking.' },
  { code: 'reference_not_found', label: 'Reference number not found', message: () => 'We could not find your reference number. Please check it and upload your receipt again.' },
  { code: 'wrong_account', label: 'Wrong account', message: () => 'The payment seems to have gone to a different account. Please check where it was sent and upload the right receipt.' },
  { code: 'other', label: 'Other', message: () => '' },
]

export function validateOwnerReject({ reason, message } = {}) {
  const r = OWNER_REJECT_REASONS.find((x) => x.code === reason)
  if (!r) return { ok: false, code: 'REASON_REQUIRED', error: 'Choose a reason.' }
  const text = String(message ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
  if (text.length > REJECT_MESSAGE_MAX) return { ok: false, code: 'MESSAGE_TOO_LONG', error: `Keep the message under ${REJECT_MESSAGE_MAX} characters.` }
  if (reason === 'other' && !text) return { ok: false, code: 'MESSAGE_REQUIRED_FOR_OTHER', error: 'Write a short message for the guardian.' }
  return { ok: true, reason, message: text }
}

export const pesoFromCentavos = (c) => `₱${(Number(c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
