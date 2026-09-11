// Thin wrapper over the Vonage SMS API (the classic SMS endpoint — no SDK
// dependency, same "plain fetch" shape as brevo.js).
// Docs: https://developer.vonage.com/en/api/sms
//   POST https://rest.nexmo.com/sms/json
//   api_key / api_secret in the body (or query string)
//
// Credentials live in env vars only — never hard-code them here.
const VONAGE_ENDPOINT = 'https://rest.nexmo.com/sms/json'

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those so a copy-paste slip doesn't read as "unset".
function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

// Accepts local PH mobile formats ("09171234567", "9171234567",
// "+639171234567") and normalizes to the digits-only E.164 form Vonage
// expects ("639171234567"). Returns null if it doesn't look like a number.
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.startsWith('63')) return digits
  if (digits.startsWith('0')) return `63${digits.slice(1)}`
  if (digits.length === 10) return `63${digits}` // e.g. "9171234567"
  return digits
}

export async function sendSms({ to, text }) {
  const apiKey = readEnv('VONAGE_API_KEY')
  const apiSecret = readEnv('VONAGE_API_SECRET')

  if (!apiKey || !apiSecret) {
    const missing = [!apiKey && 'VONAGE_API_KEY', !apiSecret && 'VONAGE_API_SECRET'].filter(Boolean)
    throw new Error(`Vonage env not configured on the server — missing: ${missing.join(', ')}`)
  }

  const from = readEnv('VONAGE_FROM_NAME') || 'TherapyPro'
  const phone = normalizePhone(to)
  if (!phone) throw new Error('Invalid phone number')

  const res = await fetch(VONAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      api_secret: apiSecret,
      to: phone,
      from,
      text,
    }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  const first = data.messages?.[0]
  // Vonage returns 200 OK even on a per-message failure — the real result is
  // each message's own "status" ("0" = success).
  if (!first || first.status !== '0') {
    const detail = first ? `${first['error-text'] || 'unknown error'} (status ${first.status})` : `HTTP ${res.status}`
    throw new Error(`Vonage send failed: ${detail}`)
  }

  return { referenceId: first['message-id'] || null }
}
