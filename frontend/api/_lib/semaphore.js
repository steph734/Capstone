// Thin wrapper over the Semaphore SMS API (a Philippines-focused gateway —
// unlike Vonage/Twilio, its default sender name is already registered with
// PH carriers, so messages actually deliver without our own NTC sender-ID
// registration). Docs: https://semaphore.co/docs
//   POST https://api.semaphore.co/api/v4/messages
//   apikey, number (PH local format, e.g. "09171234567"), message
const SEMAPHORE_ENDPOINT = 'https://api.semaphore.co/api/v4/messages'

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those so a copy-paste slip doesn't read as "unset".
function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

// Accepts local PH mobile formats ("09171234567", "9171234567",
// "+639171234567", "639171234567") and normalizes to the "09XXXXXXXXX" form
// Semaphore expects. Returns null if it doesn't look like a number.
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return null
  if (digits.startsWith('63') && digits.length === 12) return `0${digits.slice(2)}`
  if (digits.startsWith('0')) return digits
  if (digits.length === 10) return `0${digits}` // e.g. "9171234567"
  return digits
}

export async function sendSms({ to, text }) {
  const apiKey = readEnv('SEMAPHORE_API_KEY')
  if (!apiKey) {
    throw new Error('Semaphore env not configured on the server — missing: SEMAPHORE_API_KEY')
  }

  const senderName = readEnv('SEMAPHORE_SENDER_NAME') // optional — blank uses the shared default sender
  const phone = normalizePhone(to)
  if (!phone) throw new Error('Invalid phone number')

  const body = new URLSearchParams({ apikey: apiKey, number: phone, message: text })
  if (senderName) body.set('sendername', senderName)

  const res = await fetch(SEMAPHORE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  })

  // Errors sometimes come back as plain text (e.g. an account-approval
  // message), not JSON — read as text first so that isn't lost as "HTTP 403".
  const rawBody = await res.text()
  let data = null
  try {
    data = JSON.parse(rawBody)
  } catch {
    /* not JSON */
  }

  // A successful call returns 200 with an array containing the queued message.
  const first = Array.isArray(data) ? data[0] : null
  if (!res.ok || !first) {
    const detail = (data && (data.message || data.error)) || rawBody.trim() || `HTTP ${res.status}`
    throw new Error(`Semaphore send failed: ${detail}`)
  }

  return { referenceId: first.message_id ?? null }
}
