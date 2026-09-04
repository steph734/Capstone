import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'

function formatPeso(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Escape anything the client sent before dropping it into the HTML body.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function rows(items) {
  return items
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([label, value, opts = {}]) => `
          <tr>
            <td style="padding:8px 0;color:#6b7c75;">${esc(label)}</td>
            <td style="padding:8px 0;text-align:right;font-weight:${opts.strong ? 700 : 600};${
        opts.strong ? 'font-size:16px;' : ''
      }">${esc(value)}</td>
          </tr>`
    )
    .join('')
}

function buildHtml(view) {
  const {
    brand, greetingName, patient, condition, therapist, therapistRole,
    sessionMode, dateStr, timeStr, paymentLabel, total, amountReceived, amountChange,
  } = view
  const greeting = greetingName ? `Hi ${esc(greetingName)},` : 'Hi,'
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Appointment confirmed</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 20px;font-size:14px;color:#2c4a3e;">
          Your appointment with ${brand} has been successfully booked. Here are the details:
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows([
            ['Patient', patient],
            ['Condition', condition],
            ['Therapist', therapistRole ? `${therapist} (${therapistRole})` : therapist],
            ['Session Mode', sessionMode],
            ['Date', dateStr],
            ['Time', timeStr],
            ['Payment', paymentLabel],
          ])}
          ${
            total
              ? `<tr>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;font-weight:700;font-size:16px;">Total</td>
            <td style="padding:14px 0 0;border-top:2px solid #e8f5f0;text-align:right;font-weight:700;font-size:16px;">${esc(
              total
            )}</td>
          </tr>`
              : ''
          }
          ${rows([
            ['Amount Received', amountReceived],
            ['Amount Change', amountChange],
          ])}
        </table>

        <p style="margin:22px 0 0;font-size:12px;color:#6b7c75;">
          We'll send a reminder before your session. You can reschedule or cancel up to 24 hours
          before the appointment.
        </p>

        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you didn't book this appointment, please contact ${brand} support.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildText(view) {
  const {
    brand, greetingName, patient, condition, therapist, therapistRole,
    sessionMode, dateStr, timeStr, paymentLabel, total, amountReceived, amountChange,
  } = view
  return [
    greetingName ? `Hi ${greetingName},` : 'Hi,',
    '',
    `Your appointment with ${brand} has been successfully booked.`,
    '',
    patient && `Patient: ${patient}`,
    condition && `Condition: ${condition}`,
    therapist && `Therapist: ${therapistRole ? `${therapist} (${therapistRole})` : therapist}`,
    sessionMode && `Session Mode: ${sessionMode}`,
    dateStr && `Date: ${dateStr}`,
    timeStr && `Time: ${timeStr}`,
    paymentLabel && `Payment: ${paymentLabel}`,
    total && `Total: ${total}`,
    amountReceived && `Amount Received: ${amountReceived}`,
    amountChange && `Amount Change: ${amountChange}`,
    '',
    "We'll send a reminder before your session. You can reschedule or cancel up to 24 hours before the appointment.",
    '',
    "If you didn't book this appointment, please contact support.",
  ]
    .filter(Boolean)
    .join('\n')
}

// Emails an appointment confirmation to the address the patient entered on the
// booking form. Called by POST /api/send-appointment-confirmation once the
// booking reaches its confirmation step. No database in this prototype, so the
// server formats and sends what the client reports — it does not persist it.
export async function sendAppointmentConfirmationEmail(payload = {}) {
  const email = String(payload.email || '').trim()
  if (!email) throw new Error('Missing email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')

  const view = {
    brand: BRAND,
    greetingName: payload.guardianName ? String(payload.guardianName).trim() : '',
    patient: payload.patient ? String(payload.patient).trim() : '',
    condition: payload.condition ? String(payload.condition).trim() : '',
    therapist: payload.therapist ? String(payload.therapist).trim() : '',
    therapistRole: payload.therapistRole ? String(payload.therapistRole).trim() : '',
    sessionMode: payload.sessionMode ? String(payload.sessionMode).trim() : '',
    dateStr: payload.date ? String(payload.date).trim() : '',
    timeStr: payload.time ? String(payload.time).trim() : '',
    paymentLabel: payload.payment ? String(payload.payment).trim() : '',
    total: formatPeso(payload.total),
    amountReceived: formatPeso(payload.amountReceived),
    amountChange: formatPeso(payload.amountChange),
  }

  const subjectDate = view.dateStr ? ` — ${view.dateStr}` : ''
  const { referenceId } = await sendEmail({
    to: email,
    toName: view.greetingName || undefined,
    subject: `Your ${BRAND} appointment is confirmed${subjectDate}`,
    html: buildHtml(view),
    plain: buildText(view),
  })

  return { sent: true, referenceId }
}
