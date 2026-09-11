import crypto from 'node:crypto'

// A reset token (minted after the user verifies their 6-digit email code) is
// only good for one hour, matching the old emailed-link flow this replaced.
const TOKEN_TTL_MS = 60 * 60 * 1000

// Env values pasted into a dashboard often arrive with wrapping quotes or a
// stray newline — strip those (same treatment as brevo.js).
function readEnv(name) {
  const raw = process.env[name]
  if (raw == null) return ''
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

// No database in this prototype, so the token has to carry its own proof.
// It is `<payload>.<signature>` where payload is base64url(JSON {email, exp})
// and signature is an HMAC over that payload. Tampering with the email or the
// expiry breaks the signature, so the server can trust a token it never stored.
function signingSecret() {
  return (
    readEnv('RESET_TOKEN_SECRET') ||
    readEnv('BREVO_API_KEY') ||
    'therapypro-dev-reset-secret'
  )
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

export function createResetToken(email, role) {
  const payload = base64url(
    JSON.stringify({ email, role: role || null, exp: Date.now() + TOKEN_TTL_MS })
  )
  const sig = base64url(crypto.createHmac('sha256', signingSecret()).update(payload).digest())
  return `${payload}.${sig}`
}

export function verifyResetToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' }
  }
  const [payload, sig] = token.split('.')
  const expected = base64url(
    crypto.createHmac('sha256', signingSecret()).update(payload).digest()
  )
  // Constant-time compare to avoid leaking the signature byte by byte.
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad-signature' }
  }
  let data
  try {
    data = JSON.parse(fromBase64url(payload))
  } catch {
    return { valid: false, reason: 'malformed' }
  }
  if (!data.email || !data.exp) return { valid: false, reason: 'malformed' }
  if (Date.now() > data.exp) return { valid: false, reason: 'expired' }
  return { valid: true, email: data.email, role: data.role || null }
}
