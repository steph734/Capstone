// Friendly wording for payment problems. Patients never see raw error codes or stack traces.
// (The server has its own copy of this table for errors it reads from Stripe: api/_lib/paymentAttempts.js.
// This one covers errors Stripe.js reports in the browser, and connection problems.)
export const PAYMENT_MESSAGES = {
  card_declined: 'Your card was declined. Please try a different card or another payment method.',
  insufficient_funds: "Your card doesn't have enough funds for this payment. Please use another card or payment method.",
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: "The security code (CVC) doesn't look right. Please check it and try again.",
  incorrect_number: "The card number doesn't look right. Please check it and try again.",
  authentication_required: "Your bank's extra verification (3D Secure) wasn't completed. Please try again and finish the verification.",
  processing_error: 'The payment provider had a problem processing your card. Please try again in a moment.',
  timeout: "We didn't receive your payment in time, so it was cancelled.",
  payment_not_received: "We couldn't confirm that your payment was received.",
  verification_rejected: "We couldn't find your payment, so the booking was not confirmed.",
  network: "We couldn't reach the payment service. Please check your internet connection and try again.",
  slot_taken: 'That time slot is no longer available. Please pick another time.',
  unavailable: 'Online payment is not available right now. Please try again later or pay at the clinic.',
  unknown: "We couldn't complete your payment. Please try again or use another payment method.",
}

const ALIASES = {
  invalid_cvc: 'incorrect_cvc', invalid_number: 'incorrect_number', invalid_expiry_year: 'expired_card', invalid_expiry_month: 'expired_card',
  payment_intent_authentication_failure: 'authentication_required', card_not_supported: 'card_declined', generic_decline: 'card_declined',
  do_not_honor: 'card_declined', lost_card: 'card_declined', stolen_card: 'card_declined', fraudulent: 'card_declined',
  api_connection_error: 'network', api_error: 'processing_error', rate_limit: 'processing_error',
}

// Accepts a code string, a Stripe.js error ({ code, decline_code, type }), or a failed fetch (TypeError).
export function friendlyPaymentError(source) {
  if (source instanceof TypeError) return { code: 'network', message: PAYMENT_MESSAGES.network }
  const err = typeof source === 'string' ? { code: source } : (source || {})
  const candidates = [err.decline_code, err.code, err.type].filter(Boolean).map((c) => ALIASES[c] || c)
  const code = candidates.find((c) => PAYMENT_MESSAGES[c]) || 'unknown'
  return { code, message: PAYMENT_MESSAGES[code] }
}
