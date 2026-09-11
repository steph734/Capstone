import { sendSms } from './vonage.js'

const BRAND = 'TherapyPro'

// Builds a short SMS — carriers bill per 160-char segment, so this stays
// terse rather than mirroring the full email.
function buildText({ patient, therapist, dateStr, timeStr }) {
  const who = therapist ? ` with ${therapist}` : ''
  const when = [dateStr, timeStr].filter(Boolean).join(' at ')
  return [
    `${BRAND}: Appointment booked for ${patient || 'your child'}${who}`,
    when ? `on ${when}.` : '.',
    "We'll send a reminder before the session.",
  ].join(' ')
}

// Texts an appointment confirmation to the guardian's contact number entered
// on the booking form. Called by POST /api/send-appointment-sms once the
// booking reaches its confirmation step — same trigger and payload shape as
// sendAppointmentConfirmationEmail, just a different channel.
export async function sendAppointmentConfirmationSms(payload = {}) {
  const phone = String(payload.phone || '').trim()
  if (!phone) throw new Error('Missing phone number')

  const text = buildText({
    patient: payload.patient ? String(payload.patient).trim() : '',
    therapist: payload.therapist ? String(payload.therapist).trim() : '',
    dateStr: payload.date ? String(payload.date).trim() : '',
    timeStr: payload.time ? String(payload.time).trim() : '',
  })

  const { referenceId } = await sendSms({ to: phone, text })
  return { sent: true, referenceId }
}
