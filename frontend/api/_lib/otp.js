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

function buildOtpHtml({ name, code }) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5faf8;font-family:Arial,Helvetica,sans-serif;color:#2c4a3e;">
    <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
      <div style="background:#fff;border:1px solid #e8f5f0;border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 4px;font-size:20px;">Verify your email</h1>
        <p style="margin:0 0 20px;color:#6b7c75;font-size:13px;">${greeting}</p>
        <p style="margin:0 0 16px;font-size:14px;">
          Use this code to finish creating your ${BRAND} account. It expires in 10 minutes.
        </p>
        <p style="margin:0 0 20px;text-align:center;">
          <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;
            background:#f0fbf5;border:1px solid #c8eeda;border-radius:12px;padding:14px 22px;color:#1a2e26;">
            ${code}
          </span>
        </p>
        <p style="margin:18px 0 0;color:#9aab9f;font-size:11px;">
          If you didn't try to sign up for ${BRAND}, you can ignore this email.
        </p>
      </div>
    </div>
  </body>
</html>`
}

function buildOtpText({ name, code }) {
  return [
    name ? `Hi ${name},` : 'Hi,',
    '',
    `Your ${BRAND} verification code is: ${code}`,
    'It expires in 10 minutes.',
    '',
    "If you didn't try to sign up, you can ignore this email.",
  ].join('\n')
}

export async function sendOtpEmail({ email, name, code }) {
  return sendEmail({
    to: email,
    toName: name || undefined,
    subject: `Your ${BRAND} verification code: ${code}`,
    html: buildOtpHtml({ name, code }),
    plain: buildOtpText({ name, code }),
  })
}
