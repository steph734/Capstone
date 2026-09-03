import crypto from 'node:crypto'
import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'
// A reset link is only good for one hour after it is issued.
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

export function createResetToken(email) {
  const payload = base64url(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS }))
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
  return { valid: true, email: data.email }
}

function buildHtml({ brand, name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Reset your password</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>

        <p style="margin:0 0 20px;font-size:14px;color:#2c4a3e;">
          We received a request to reset the password for your ${brand} account. Click the button
          below to choose a new password. This link expires in 1 hour.
        </p>

        <p style="margin:24px 0;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#4a6b5d;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;">
            Reset your password
          </a>
        </p>

        <p style="margin:20px 0 0;font-size:12px;color:#6b7c75;">
          If the button doesn&rsquo;t work, copy and paste this link into your browser:<br />
          <a href="${link}" style="color:#4a6b5d;word-break:break-all;">${link}</a>
        </p>

        <p style="margin:22px 0 0;color:#9aab9f;font-size:11px;">
          If you didn&rsquo;t ask to reset your password, you can safely ignore this email &mdash;
          your password won&rsquo;t change.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildText({ brand, name, link }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `We received a request to reset the password for your ${brand} account.`,
    'Open this link to choose a new password (it expires in 1 hour):',
    '',
    link,
    '',
    "If you didn't ask to reset your password, you can safely ignore this email.",
  ].join('\n')
}

// Issues a signed reset token and emails the user a link back to the app's
// /reset-password page. Called by POST /api/send-reset-password.
export async function sendResetPasswordEmail({ email, name, appUrl }) {
  if (!email) throw new Error('Missing email')

  const token = createResetToken(email)
  const base = (appUrl || readEnv('APP_URL') || 'http://localhost:5173').replace(/\/+$/, '')
  const link =
    `${base}/reset-password?token=${encodeURIComponent(token)}` +
    `&email=${encodeURIComponent(email)}`

  const view = { brand: BRAND, name: name || '', link }

  const { referenceId } = await sendEmail({
    to: email,
    toName: name,
    subject: `Reset your ${BRAND} password`,
    html: buildHtml(view),
    plain: buildText(view),
  })

  return { sent: true, referenceId }
}
