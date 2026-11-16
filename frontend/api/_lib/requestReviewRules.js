// Pure rules for the therapist's appointment-request review. No imports, so the SERVER validates with exactly the same
// rules the modals use to enable / disable their buttons.

export const NOTE_MAX = 300 // "Payment not received" note
export const MESSAGE_MAX = 500 // decline message to the guardian

// Why a payment could not be confirmed ("Payment not received" modal).
export const PROBLEM_REASONS = [
  { code: 'amount_missing', label: "The amount didn't arrive" },
  { code: 'amount_wrong', label: 'The amount is wrong' },
  { code: 'reference_not_found', label: "I can't find this reference number" },
  { code: 'receipt_unclear', label: 'The receipt is unclear' },
  { code: 'other', label: 'Other' },
]
export const NEXT_ACTIONS = ['request_new_proof', 'decline_request']

// Why an appointment is declined ("Decline this appointment?" modal).
export const DECLINE_REASONS = [
  { code: 'not_available', label: "I'm not available at this time" },
  { code: 'payment_unverified', label: "Payment couldn't be verified" },
  { code: 'service_unsuitable', label: "This service isn't suitable · referral needed" },
  { code: 'slot_unavailable', label: 'The time slot is no longer available' },
  { code: 'other', label: 'Other (please explain)' },
]

export const problemLabel = (code) => PROBLEM_REASONS.find((r) => r.code === code)?.label || ''
export const declineLabel = (code) => DECLINE_REASONS.find((r) => r.code === code)?.label || ''

// Trims, drops control characters, limits the length.
export const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)

// Every validator returns { ok, value?, code?, message?, field? } with the API's error codes.
export function validateDecline({ reason, message } = {}) {
  if (!DECLINE_REASONS.some((r) => r.code === reason)) return { ok: false, code: 'REASON_REQUIRED', field: 'reason', message: 'Please choose a reason before declining.' }
  const msg = cleanText(message, MESSAGE_MAX)
  if (reason === 'other' && !msg) return { ok: false, code: 'MESSAGE_REQUIRED_FOR_OTHER', field: 'message', message: 'Please explain your reason.' }
  return { ok: true, value: { reason, message: msg } }
}

export function validateReject({ reason, note, nextAction } = {}) {
  if (!PROBLEM_REASONS.some((r) => r.code === reason)) return { ok: false, code: 'REASON_REQUIRED', field: 'reason', message: 'Choose what went wrong.' }
  const n = cleanText(note, NOTE_MAX)
  if (reason === 'other' && !n) return { ok: false, code: 'NOTE_REQUIRED_FOR_OTHER', field: 'note', message: 'Add a short note for the guardian.' }
  if (!NEXT_ACTIONS.includes(nextAction)) return { ok: false, code: 'INVALID_NEXT_ACTION', field: 'nextAction', message: 'Choose what should happen next.' }
  return { ok: true, value: { reason, note: n, nextAction } }
}

// Both "Before you confirm" boxes must be true.
export const checksOk = (checks) => Boolean(checks && checks.amountSeen === true && checks.referenceMatches === true)

// The reason line of a decline: "Payment couldn't be verified" plus the detail, when the decline came from the payment modal.
export function declineReasonText(reasonCode, message) {
  return { label: declineLabel(reasonCode), message: cleanText(message, MESSAGE_MAX) }
}

// "Sorry, I'm away" -> short preview used by the live preview box in the decline modal (same wording as the real email).
export function declinePreview({ therapist, patient, dateShort, dateTab, timeStart, reason, message }) {
  const first = String(patient || '').split(' ')[0] || 'the patient'
  return {
    subject: `Your appointment request on ${dateShort} was declined`,
    body: `${therapist || 'Your therapist'} declined ${first}'s appointment on ${dateTab || dateShort} at ${timeStart}.`,
    reasonLabel: declineLabel(reason),
    message: cleanText(message, MESSAGE_MAX),
  }
}
