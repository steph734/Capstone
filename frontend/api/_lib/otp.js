// ESM port of backend/utils/otp.js so the Vercel functions in api/_lib/routes/
// can issue/verify the same 6-digit email codes without depending on the
// Express backend (which isn't reachable from the deployed site).
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { sendEmail } from './brevo.js'

const BRAND = 'TherapyPro'

export const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds

// Six digits, zero-padded (so "004217" is valid). crypto.randomInt is uniform.
export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashCode(code) {
  return bcrypt.hash(String(code), 10)
}

export function verifyCodeHash(code, hash) {
  return bcrypt.compare(String(code), String(hash || ''))
}

// Copy differs slightly by purpose ('signup' vs 'reset') but the code box,
// expiry, and layout are shared.
const COPY = {
  signup: {
    heading: 'Verify your email',
    intro: (brand) => `Use this code to finish creating your ${brand} account. It expires in 10 minutes.`,
    footer: (brand) => `If you didn't try to sign up for ${brand}, you can ignore this email.`,
    subject: (brand) => `Your ${brand} verification code`,
  },
  reset: {
    heading: 'Reset your password',
    intro: (brand) => `Use this code to reset your ${brand} password. It expires in 10 minutes.`,
    footer: () => "If you didn't ask to reset your password, you can ignore this email — your password won't change.",
    subject: (brand) => `Your ${brand} password reset code`,
  },
}

function buildOtpHtml({ name, code, purpose }) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const copy = COPY[purpose] || COPY.signup
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">${copy.heading}</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>
        <p style="margin:0 0 16px;font-size:14px;">
          ${copy.intro(BRAND)}
        </p>
        <p style="margin:0 0 20px;text-align:center;">
          <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;
            background:#f0fbf5;border:1px solid #c8eeda;border-radius:12px;padding:14px 22px;color:#1a2e26;">
            ${code}
          </span>
        </p>
        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          ${copy.footer(BRAND)}
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildOtpText({ name, code, purpose }) {
  const copy = COPY[purpose] || COPY.signup
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Your ${BRAND} code is: ${code}`,
    'It expires in 10 minutes.',
    '',
    copy.footer(BRAND),
  ].join('\n')
}

export async function sendOtpEmail({ email, name, code, purpose = 'signup' }) {
  const copy = COPY[purpose] || COPY.signup
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `${copy.subject(BRAND)}: ${code}`,
    html: buildOtpHtml({ name, code, purpose }),
    plain: buildOtpText({ name, code, purpose }),
  })
}
