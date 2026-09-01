// Thin wrapper over the MailerSend Email API (v1).
// Docs: https://developers.mailersend.com/api/v1/email.html
//   POST https://api.mailersend.com/v1/email
//   Authorization: Bearer <API token>
//
// The API token and the verified From address live in env vars only —
// never hard-code them here.
const MAILERSEND_ENDPOINT = 'https://api.mailersend.com/v1/email'

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those so a copy-paste slip doesn't read as "unset".
function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

export async function sendEmail({ to, toName, subject, html, plain }) {
  const token = readEnv('MAILERSEND_API_TOKEN')
  const fromAddress = readEnv('MAILERSEND_FROM_ADDRESS')

  if (!token || !fromAddress) {
    const missing = [
      !token && 'MAILERSEND_API_TOKEN',
      !fromAddress && 'MAILERSEND_FROM_ADDRESS',
    ].filter(Boolean)
    const present = ['MAILERSEND_API_TOKEN', 'MAILERSEND_FROM_ADDRESS', 'MAILERSEND_FROM_NAME']
      .filter((n) => readEnv(n))
    throw new Error(
      `MailerSend env not configured on the server — missing: ${missing.join(', ')}` +
      `${present.length ? ` (present: ${present.join(', ')})` : ' (none present)'}. ` +
      'MAILERSEND_FROM_ADDRESS must be an address on a domain verified in your MailerSend account.'
    )
  }

  const fromName = readEnv('MAILERSEND_FROM_NAME') || 'TherapyPro'

  const res = await fetch(MAILERSEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      from: { email: fromAddress, name: fromName },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      html,
      text: plain,
    }),
  })

  // A successful send returns 202 Accepted with an empty body and the message
  // id in a response header. Only parse JSON when the request failed.
  if (res.status === 202) {
    return { referenceId: res.headers.get('x-message-id') || null }
  }

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  const detail =
    data.message ||
    (data.errors && Object.values(data.errors).flat().join('; ')) ||
    `HTTP ${res.status}`
  throw new Error(`MailerSend send failed: ${detail}`)
}
