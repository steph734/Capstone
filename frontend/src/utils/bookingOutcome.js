// What the booking's last page (step 3, "Confirmation") says. It is derived from ONE state, so a success message and a
// failure message can never appear together (this page used to show "Appointment Booked!" next to "Couldn't save the
// appointment" because each line came from a separate flag).
//
//   online  = what the checkout reported (null if there was none):
//             { paymentStatus: 'verified' | 'proof_submitted' } (card success counts as verified)
//   cash    = the save of a pay-at-clinic booking: { status: 'saving' | 'saved' | 'error', error }
//
// -> { kind: 'saving' | 'booked' | 'awaiting_therapist' | 'failed', heading, message, tone }
//    Notices (email / SMS) are NOT part of this: they are shown only as a small note when kind is booked or awaiting_therapist.
export function bookingOutcome({ payMethod, online = null, cash = null, therapist = '', amountLabel = '₱300.00' } = {}) {
  const who = therapist || 'your therapist'
  if (payMethod === 'stripe') {
    if (online?.paymentStatus === 'verified') {
      return { kind: 'booked', tone: 'success', heading: 'Appointment Booked!', message: "Your payment was received and your appointment is confirmed. We'll send a reminder before your session." }
    }
    if (online?.paymentStatus === 'proof_submitted') {
      return { kind: 'awaiting_therapist', tone: 'pending', heading: 'Payment recorded', message: `Waiting for ${who} to confirm your payment. Your time slot is reserved, and we'll text and email you once it's confirmed.` }
    }
    return { kind: 'failed', tone: 'error', heading: "We couldn't confirm your payment", message: 'Your booking was not completed. Please start your booking again.' }
  }
  if (cash?.status === 'saving' || !cash) return { kind: 'saving', tone: 'pending', heading: 'Saving your appointment…', message: 'This only takes a moment.' }
  if (cash.status === 'saved') return { kind: 'booked', tone: 'success', heading: 'Appointment Booked!', message: `Pay ${amountLabel} in cash at the clinic. We'll send a reminder before your session.` }
  return { kind: 'failed', tone: 'error', heading: "We couldn't save your appointment", message: cash.error || 'Your booking was not saved. Please try again.' }
}

// The note about the confirmation text / email. Only ever a small, non-blocking line, and only when the booking really was saved.
export function noticeNote(kind, { emailStatus, smsStatus } = {}) {
  if (kind !== 'booked' && kind !== 'awaiting_therapist') return null
  if (emailStatus === 'error' && smsStatus === 'error') return "We couldn't send a text or email. Your booking is still saved."
  if (smsStatus === 'error') return "We couldn't send a text. Your booking is still saved."
  if (emailStatus === 'error') return "We couldn't send an email. Your booking is still saved."
  return null
}
