// The two emails the therapist's request review can send, plus a tracked sender:
//   - decline:   "Your appointment request on Nov 17 was declined"
//   - resubmit:  "We couldn't confirm your payment for Nov 17"   (the therapist asked for new proof)
// Same card layout, colors, sender and footer as the existing confirmation / status emails (appointmentEmail.js).
// Every therapist-written value is HTML-escaped. Neither email contains the therapist's phone, a payment reference number or any internal id.
import { sendEmail } from './brevo.js'
import { declineLabel, problemLabel } from './requestReviewRules.js'

const BRAND = 'TherapyPro'

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function appBase() {
  const base = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  return base || 'https://therapypro.app'
}

const rows = (items) => items.filter(([, v]) => v != null && v !== '').map(([label, value]) => `
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">${esc(label)}</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">${esc(value)}</td>
          </tr>`).join('')

const shell = ({ heading, greeting, body, button, footer }) => `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">${esc(heading)}</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${esc(greeting)}</p>
        ${body}
        ${button ? `<p style="margin:24px 0 0;text-align:center;"><a href="${esc(button.href)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">${esc(button.label)}</a></p>` : ''}
        <p style="margin:20px 0 0;font-size:12px;color:#6b7c75;">${esc(footer)}</p>
      </div>
      <p style="text-align:center;color:#9fb0a9;font-size:11px;margin-top:16px;">${BRAND}</p>
    </div>
  </body>
</html>`

const details = (v) => [
  ['Patient', v.patient], ['Date', v.dateLong], ['Time', v.timeLabel],
  ['Therapist', v.therapistRole ? `${v.therapist} (${v.therapistRole})` : v.therapist], ['Session · Clinic', [v.sessionType, v.clinic || 'Main Clinic'].filter(Boolean).join(' · ')],
]
const detailsText = (v) => details(v).filter(([, x]) => x).map(([k, x]) => `${k}: ${x}`)
const hello = (v) => `Hello ${v.guardianName || 'there'},`

// view: { guardianName, patient, therapist, therapistRole, dateShort ("Nov 17"), dateLong, timeLabel, sessionType, clinic,
//         reason (decline code), message, paymentSent (bool) }
export function buildDeclineEmail(v) {
  const reason = declineLabel(v.reason) || 'The therapist could not take this appointment'
  const msg = String(v.message || '').trim()
  const subject = `Your appointment request on ${v.dateShort} was declined`
  const next = [
    'Book another time with the same therapist, or choose a different therapist.',
    ...(v.paymentSent ? ['The clinic will contact you about returning the payment you sent.'] : []),
  ]
  const body = `
        <p style="margin:0 0 20px;font-size:14px;">We're sorry. ${esc(v.therapist || 'Your therapist')} can't take this appointment request.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows(details(v))}</table>
        <div style="margin:20px 0 0;border:1px solid #f3b4b4;background:#fff5f5;border-radius:10px;padding:12px 14px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.05em;color:#b42318;">REASON FOR DECLINING</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1e3a31;">${esc(reason)}</p>
          ${msg ? `<p style="margin:6px 0 0;font-size:14px;font-style:italic;color:#4b5f56;">&ldquo;${esc(msg)}&rdquo;</p>` : ''}
        </div>
        <p style="margin:20px 0 6px;font-size:14px;font-weight:700;">What you can do next</p>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;">${next.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
  const html = shell({ heading: 'Appointment request declined', greeting: hello(v), body, button: { label: 'Book another appointment', href: `${appBase()}/appointments` }, footer: 'You are receiving this because an appointment was requested with your email address.' })
  const text = [
    hello(v), '', `We're sorry. ${v.therapist || 'Your therapist'} can't take this appointment request.`, '',
    ...detailsText(v), '', `REASON FOR DECLINING: ${reason}`, ...(msg ? [`"${msg}"`] : []), '',
    'What you can do next:', ...next.map((n) => `- ${n}`), '', `Book another appointment: ${appBase()}/appointments`,
  ].join('\n')
  return { subject, html, text }
}

// view: { ..., problem (code), note, holdEnd ("Nov 19, 11:53 AM") }
export function buildResubmitEmail(v) {
  const problem = problemLabel(v.problem) || 'We could not confirm your payment'
  const note = String(v.note || '').trim()
  const subject = `We couldn't confirm your payment for ${v.dateShort}`
  const body = `
        <p style="margin:0 0 20px;font-size:14px;">${esc(v.therapist || 'Your therapist')} couldn't confirm the payment you sent for this appointment request.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows(details(v))}</table>
        <div style="margin:20px 0 0;border:1px solid #f3d284;background:#fff8e6;border-radius:10px;padding:12px 14px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.05em;color:#7a4a06;">WHAT WENT WRONG</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:#1e3a31;">${esc(problem)}</p>
          ${note ? `<p style="margin:6px 0 0;font-size:14px;font-style:italic;color:#4b5f56;">&ldquo;${esc(note)}&rdquo;</p>` : ''}
        </div>
        <p style="margin:20px 0 0;font-size:14px;line-height:1.6;">Your time slot is held for you until <strong>${esc(v.holdEnd)}</strong>. Please send a new receipt and reference number before then or the request will be cancelled.</p>`
  const html = shell({ heading: 'Please resubmit your payment proof', greeting: hello(v), body, button: { label: 'Resubmit payment proof', href: `${appBase()}/appointments/book` }, footer: 'You are receiving this because an appointment was requested with your email address.' })
  const text = [
    hello(v), '', `${v.therapist || 'Your therapist'} couldn't confirm the payment you sent for this appointment request.`, '',
    ...detailsText(v), '', `WHAT WENT WRONG: ${problem}`, ...(note ? [`"${note}"`] : []), '',
    `Your time slot is held for you until ${v.holdEnd}. Please send a new receipt and reference number before then or the request will be cancelled.`, '',
    `Resubmit payment proof: ${appBase()}/appointments/book`,
  ].join('\n')
  return { subject, html, text }
}

// "Your appointment is being processed": sent to the guardian right after the payment proof is saved (NOT a confirmation).
// view: { guardianName, patient, therapist, therapistRole, dateShort, dateLong, timeLabel, sessionType, clinic,
//         paidAt ("Nov 16, 6:24 PM"), payment ("₱300.00 · GCash QR · Ref ending 4544"), holdEnd }
export function buildProcessingEmail(v) {
  const subject = `Your appointment on ${v.dateShort} is being processed`
  const step = (state, title, sub) => {
    const mark = state === 'done' ? '<span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#16a34a;color:#fff;text-align:center;line-height:20px;font-size:12px;">&#10003;</span>'
      : state === 'now' ? '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid #16a34a;"></span>'
      : '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:2px dashed #b9c9c1;"></span>'
    return `<tr><td style="padding:6px 10px 6px 0;vertical-align:top;width:26px;">${mark}</td><td style="padding:6px 0;"><div style="font-size:14px;font-weight:700;color:${state === 'todo' ? '#8aa095' : '#1e3a31'};">${esc(title)}</div><div style="font-size:12px;color:#6b7c75;">${esc(sub)}</div></td></tr>`
  }
  const body = `
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Your appointment is being processed. The clinic will check your payment, then ${esc(v.therapist || 'your therapist')} will accept your appointment. We'll email you again as soon as that happens.</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
          ${step('done', 'Payment recorded', v.paidAt)}
          ${step('now', 'Payment under review', 'Usually within 24 hours')}
          ${step('todo', 'Appointment accepted', "You'll get a confirmation email")}
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows([...details(v), ['Payment', v.payment]])}</table>
        <div style="margin:20px 0 0;border:1px solid #f3d284;background:#fff8e6;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;color:#7a4a06;">Your time slot is held for you until <strong>${esc(v.holdEnd)}</strong>. If we need a new receipt, we'll let you know.</div>`
  const html = shell({ heading: 'We got your payment', greeting: hello(v), body, button: { label: 'View my appointment', href: `${appBase()}/appointments` }, footer: 'You are receiving this because you booked an appointment on TherapyPro. This is not yet a confirmation.' })
  const text = [
    hello(v), '', 'We got your payment.', '',
    `Your appointment is being processed. The clinic will check your payment, then ${v.therapist || 'your therapist'} will accept your appointment. We'll email you again as soon as that happens.`, '',
    `[done] Payment recorded: ${v.paidAt}`, '[now]  Payment under review: usually within 24 hours', "[next] Appointment accepted: you'll get a confirmation email", '',
    ...detailsText(v), `Payment: ${v.payment}`, '',
    `Your time slot is held for you until ${v.holdEnd}. If we need a new receipt, we'll let you know.`, '',
    `View my appointment: ${appBase()}/appointments`, '', 'You are receiving this because you booked an appointment on TherapyPro. This is not yet a confirmation.',
  ].join('\n')
  return { subject, html, text }
}

// Sends an email, retrying twice, and records it in `appointment_emails` (type, to, status, attempts). A failure is stored,
// never thrown: the decision it belongs to is already saved and must not roll back.
//   -> { id, status: 'sent' | 'failed', error? }
export async function sendTracked(db, { appointmentId, type, to, toName, email, sender = sendEmail, backoffMs = 400, now = () => new Date() }) {
  const doc = { appointment_id: appointmentId, type, to: to || '', subject: email.subject, text: email.text, html: email.html, status: 'queued', attempts: 0, error: null, created_at: now(), sent_at: null }
  const ins = await db.collection('appointment_emails').insertOne(doc)
  return deliver(db, ins.insertedId, { ...doc, _id: ins.insertedId }, { toName, sender, backoffMs, now })
}

export async function deliver(db, id, doc, { toName, sender = sendEmail, backoffMs = 400, now = () => new Date() } = {}) {
  if (!doc.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.to)) {
    await db.collection('appointment_emails').updateOne({ _id: id }, { $set: { status: 'failed', error: 'No valid email address on file.' } })
    return { id, status: 'failed', error: 'No valid email address on file.' }
  }
  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await sender({ to: doc.to, toName: toName || undefined, subject: doc.subject, html: doc.html, plain: doc.text })
      await db.collection('appointment_emails').updateOne({ _id: id }, { $set: { status: 'sent', attempts: (doc.attempts || 0) + attempt, sent_at: now(), error: null } })
      return { id, status: 'sent' }
    } catch (err) {
      lastError = err?.message || 'Email failed'
      if (attempt < 3) await new Promise((r) => setTimeout(r, backoffMs * attempt))
    }
  }
  await db.collection('appointment_emails').updateOne({ _id: id }, { $set: { status: 'failed', attempts: (doc.attempts || 0) + 3, error: lastError } })
  return { id, status: 'failed', error: lastError }
}
