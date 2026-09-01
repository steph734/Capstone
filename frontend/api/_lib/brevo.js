// Thin wrapper over the Brevo (formerly Sendinblue) Transactional Email API (v3).
// Docs: https://developers.brevo.com/reference/sendtransacemail
//   POST https://api.brevo.com/v3/smtp/email
//   api-key: <API key>
//
// The API key and the verified sender address live in env vars only —
// never hard-code them here.
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those so a copy-paste slip doesn't read as "unset".
function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

export async function sendEmail({ to, toName, subject, html, plain }) {
  const apiKey = readEnv('BREVO_API_KEY')
  const fromAddress = readEnv('BREVO_FROM_ADDRESS')

  if (!apiKey || !fromAddress) {
    const missing = [
      !apiKey && 'BREVO_API_KEY',
      !fromAddress && 'BREVO_FROM_ADDRESS',
    ].filter(Boolean)
    const present = ['BREVO_API_KEY', 'BREVO_FROM_ADDRESS', 'BREVO_FROM_NAME']
      .filter((n) => readEnv(n))
    throw new Error(
      `Brevo env not configured on the server — missing: ${missing.join(', ')}` +
      `${present.length ? ` (present: ${present.join(', ')})` : ' (none present)'}. ` +
      'BREVO_FROM_ADDRESS must be a sender verified in your Brevo account.'
    )
  }

  const fromName = readEnv('BREVO_FROM_NAME') || 'TherapyPro'

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromAddress, name: fromName },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      htmlContent: html,
      textContent: plain,
    }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  // A successful send returns 201 Created (202 if scheduled) with a messageId.
  if (res.status === 201 || res.status === 202) {
    return { referenceId: data.messageId || null }
  }

  const detail = data.message || data.code || `HTTP ${res.status}`
  throw new Error(`Brevo send failed: ${detail}`)
}
