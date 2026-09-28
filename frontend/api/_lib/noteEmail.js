import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function buildHtml(view) {
  const { brand, greetingName, patientName, therapistName, dateStr, summary } = view
  const greeting = greetingName ? `Hi ${esc(greetingName)},` : 'Hi,'
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">New session note added</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 20px;font-size:14px;color:#2c4a3e;">
          ${therapistName ? esc(therapistName) : 'Your therapist'} just wrote a new SOAP note
          ${patientName ? `for ${esc(patientName)}` : ''} after the session on ${esc(dateStr)}.
          You can read the full note anytime in your ${esc(brand)} account under
          <strong>Notes</strong>.
        </p>

        ${
          summary
            ? `<div style="background:#f5faf8;border-radius:10px;padding:14px 16px;font-size:13px;color:#2c4a3e;">
          <strong style="display:block;margin-bottom:4px;">Summary</strong>
          ${esc(summary)}
        </div>`
            : ''
        }

        <p style="margin:22px 0 0;font-size:12px;color:#6b7c75;">
          Log in to ${esc(brand)} and open the Notes page to see the full session details.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildText(view) {
  const { brand, greetingName, patientName, therapistName, dateStr, summary } = view
  return [
    greetingName ? `Hi ${greetingName},` : 'Hi,',
    '',
    `${therapistName || 'Your therapist'} just wrote a new SOAP note${patientName ? ` for ${patientName}` : ''} after the session on ${dateStr}.`,
    `Log in to ${brand} and open the Notes page to see the full session details.`,
    '',
    summary ? `Summary: ${summary}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

// Emails the patient/guardian a heads-up that their therapist just wrote a
// new session note — sent right after POST /api/notes/create persists it.
// Best-effort: a failed send must never fail the note save itself.
export async function sendNoteCreatedEmail(payload = {}) {
  const email = String(payload.email || '').trim()
  if (!email) throw new Error('Missing email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')

  const view = {
    brand: BRAND,
    greetingName: payload.guardianName ? String(payload.guardianName).trim() : '',
    patientName: payload.patientName ? String(payload.patientName).trim() : '',
    therapistName: payload.therapistName ? String(payload.therapistName).trim() : '',
    dateStr: payload.sessionDate ? formatDate(payload.sessionDate) : '',
    summary: payload.summary ? String(payload.summary).trim() : '',
  }

  const { referenceId } = await sendEmail({
    to: email,
    toName: view.greetingName || undefined,
    subject: `${BRAND}: a new session note was added${view.patientName ? ` for ${view.patientName}` : ''}`,
    html: buildHtml(view),
    plain: buildText(view),
  })

  return { sent: true, referenceId }
}
