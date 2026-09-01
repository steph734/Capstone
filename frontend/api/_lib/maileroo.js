// Thin wrapper over the Maileroo Sending API (v2).
// Docs: https://maileroo.com/docs/api-reference/emails/send-email
//   POST https://smtp.maileroo.com/api/v2/emails
//   Authorization: Bearer <sending key>
//
// The sending key and the verified From address live in env vars only —
// never hard-code them here.
const MAILEROO_ENDPOINT = 'https://smtp.maileroo.com/api/v2/emails'

export async function sendEmail({ to, toName, subject, html, plain }) {
  const key = process.env.MAILEROO_SENDING_KEY
  if (!key) throw new Error('MAILEROO_SENDING_KEY is not set on the server')

  const fromAddress = process.env.MAILEROO_FROM_ADDRESS
  if (!fromAddress) {
    throw new Error('MAILEROO_FROM_ADDRESS is not set (must be an address on a Maileroo-verified domain)')
  }
  const fromName = process.env.MAILEROO_FROM_NAME || 'TherapyPro'

  const res = await fetch(MAILEROO_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { address: fromAddress, display_name: fromName },
      to: [toName ? { address: to, display_name: toName } : { address: to }],
      subject,
      html,
      plain,
      tracking: false,
    }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Maileroo send failed (HTTP ${res.status})`)
  }

  return { referenceId: data.reference_id || data.data?.reference_id || null }
}
