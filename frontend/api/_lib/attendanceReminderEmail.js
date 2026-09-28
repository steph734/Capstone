import { sendEmail } from './brevo.js'

const BRAND = 'BrickPath'

function buildHtml({ name, kind }) {
  const isTimeIn = kind === 'time_in'
  const heading = isTimeIn ? 'Your shift starts in 5 minutes' : 'Your shift ends in 5 minutes'
  const body = isTimeIn
    ? "Your shift starts at <strong>8:00 AM</strong>. Don't forget to scan your ID badge at the clinic when you arrive."
    : "Your shift ends at <strong>5:00 PM</strong>. Don't forget to scan your ID badge before you leave."

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:19px;">${heading}</h1>
        <p style="margin:0 0 4px;font-size:14px;">Hi ${name || 'there'},</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">${body}</p>
        <p style="margin:22px 0 0;color:#9aab9f;font-size:11px;">
          You're receiving this because you're listed as active staff at ${BRAND}.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildText({ name, kind }) {
  const isTimeIn = kind === 'time_in'
  const body = isTimeIn
    ? "Your shift starts at 8:00 AM. Don't forget to scan your ID badge at the clinic when you arrive."
    : "Your shift ends at 5:00 PM. Don't forget to scan your ID badge before you leave."
  return `Hi ${name || 'there'},\n\n${body}\n\n— ${BRAND}`
}

// Fired 5 minutes ahead of the clinic's fixed 8:00 AM / 5:00 PM shift edges
// by api/_lib/routes/attendance-remind.js (itself hit on a schedule by
// Vercel Cron — see vercel.json). `kind` is 'time_in' or 'time_out'.
export async function sendAttendanceReminder({ email, name, kind }) {
  if (!email) throw new Error('Missing email')
  if (kind !== 'time_in' && kind !== 'time_out') throw new Error('Invalid kind')

  const subject = kind === 'time_in'
    ? `${BRAND}: shift starts in 5 minutes`
    : `${BRAND}: shift ends in 5 minutes`

  const { referenceId } = await sendEmail({
    to: email,
    toName: name,
    subject,
    html: buildHtml({ name, kind }),
    plain: buildText({ name, kind }),
  })

  return { sent: true, referenceId }
}
