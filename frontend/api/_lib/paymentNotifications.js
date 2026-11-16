// Every message about an online (QR) payment, in ONE place: the wording (TEMPLATES) and the sending.
// Sending is best effort. A failed text or email is logged and NEVER changes the booking or the payment result.
import { sendEmail } from './brevo.js'
import { sendSms } from './semaphore.js'
import { HOLD_REMINDER_HOURS } from './paymentProofRules.js'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const CLINIC_TZ = 'Asia/Manila'

export const sessionWhen = (a) => {
  const d = a?.session_date ? new Date(a.session_date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : ''
  return [d, a?.time_slot_label].filter(Boolean).join(' · ')
}
export const clinicTime = (date) => (date ? new Date(date).toLocaleString('en-US', { timeZone: CLINIC_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export const TEMPLATES = {
  therapistNewProof: ({ patient, when, changed }) => ({
    title: changed ? 'Payment details updated' : 'New payment to verify',
    body: `${changed ? 'Updated payment details' : 'New payment'} received from ${patient || 'a patient'} for ${when}. Please verify.`,
  }),
  patientProofReceived: ({ therapist }) => ({
    title: 'We received your payment details',
    body: `We received your payment details. ${therapist || 'Your therapist'} will verify them soon.`,
  }),
  patientVerified: ({ when }) => ({
    title: 'Your appointment is confirmed',
    body: `Your appointment on ${when} is confirmed.`,
  }),
  patientRejected: ({ reason, holdEnd }) => ({
    title: "Your payment wasn't received",
    body: `Your payment wasn't received. ${reason ? `${String(reason).replace(/[.!?]+$/, '')}. ` : ''}You can resubmit before ${holdEnd}.`,
  }),
  patientHoldReminder: ({ when, holdEnd }) => ({
    title: 'Your time slot is about to be released',
    body: `Your slot on ${when} is held until ${holdEnd}. Send your payment proof before then so you don't lose it.`,
  }),
}

async function inApp(db, email, tpl, link) {
  if (!email) return false
  try {
    await db.collection('notifications').insertOne({ recipient_email: String(email).toLowerCase(), type: 'payment', title: tpl.title, body: tpl.body, link, read: false, created_at: new Date() })
    return true
  } catch (err) { console.error('payment notification (in-app) failed:', err.message); return false }
}

// -> { inApp, email, sms }  (booleans; never throws)
async function deliver(db, { email, name, phone, tpl, link, channels = ['inApp', 'email', 'sms'] }) {
  const out = { inApp: false, email: false, sms: false }
  if (channels.includes('inApp')) out.inApp = await inApp(db, email, tpl, link)
  if (channels.includes('email') && email) {
    try {
      await sendEmail({
        to: email, toName: name || undefined, subject: tpl.title,
        html: `<div style="font-family:Arial,sans-serif;color:#1f3d2f;max-width:520px"><p>${name ? `Hi ${esc(name)},` : 'Hi,'}</p><p>${esc(tpl.body)}</p></div>`,
        plain: `${name ? `Hi ${name},` : 'Hi,'}\n\n${tpl.body}\n`,
      })
      out.email = true
    } catch (err) { console.error('payment email failed (result unchanged):', err.message) }
  }
  if (channels.includes('sms') && phone) {
    try { await sendSms({ to: phone, text: `TherapyPro: ${tpl.body}`.slice(0, 300) }); out.sms = true } catch (err) { console.error('payment SMS failed (result unchanged):', err.message) }
  }
  return out
}

// The booked therapist (their login email is the employee email) hears that proof arrived.
export async function notifyTherapistProof(db, appointment, { changed = false } = {}) {
  const emp = appointment.employee_id ? await db.collection('employees').findOne({ _id: appointment.employee_id }) : null
  const tpl = TEMPLATES.therapistNewProof({ patient: appointment.patient_name, when: sessionWhen(appointment), changed })
  return deliver(db, { email: emp?.email, name: emp?.first_name || undefined, tpl, link: '/therapist/appointments', channels: ['inApp'] })
}

// kind: proofReceived | verified | rejected | holdReminder
export async function notifyPatient(db, kind, appointment, vars = {}) {
  const tpl = {
    proofReceived: () => TEMPLATES.patientProofReceived({ therapist: appointment.therapist_name }),
    verified: () => TEMPLATES.patientVerified({ when: sessionWhen(appointment) }),
    rejected: () => TEMPLATES.patientRejected({ reason: vars.reason, holdEnd: clinicTime(appointment.hold_expires_at) }),
    holdReminder: () => TEMPLATES.patientHoldReminder({ when: sessionWhen(appointment), holdEnd: clinicTime(appointment.hold_expires_at) }),
  }[kind]?.()
  if (!tpl) return { inApp: false, email: false, sms: false }
  // "verified" already gets the full booking confirmation (email + text) from finalizePaid, so only the in-app note here.
  const channels = kind === 'verified' ? ['inApp'] : kind === 'proofReceived' ? ['inApp', 'sms'] : ['inApp', 'email', 'sms'] // proofReceived: the rich "being processed" email is sent by the proof route
  return deliver(db, { email: appointment.contact_email, name: appointment.guardian_name, phone: appointment.contact_number, tpl, link: '/appointments', channels })
}

// Run by the hold-expiry cron: reminds patients who still have not sent proof when HOLD_REMINDER_HOURS are left.
export async function sendHoldReminders(db, now = new Date()) {
  const soon = new Date(now.getTime() + HOLD_REMINDER_HOURS * 3600 * 1000)
  const rows = await db.collection('appointments').find({ payment_state: 'awaiting_payment', hold_expires_at: { $gt: now, $lte: soon }, hold_reminder_sent: { $ne: true } }).toArray()
  let sent = 0
  for (const a of rows) {
    const attempt = await db.collection('payment_attempts').findOne({ appointment_id: a._id, method: { $in: ['gcash', 'paymaya'] } })
    if (!attempt) continue // card holds are short and never reminded
    await db.collection('appointments').updateOne({ _id: a._id }, { $set: { hold_reminder_sent: true } })
    await notifyPatient(db, 'holdReminder', a)
    sent += 1
  }
  return sent
}
