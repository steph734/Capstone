import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { EmailOtp } from '../models/emailOtp.js'
import { OTP_MAX_ATTEMPTS, verifyCodeHash } from '../otp.js'
import { createResetToken } from '../resetPasswordEmail.js'

const PURPOSE = 'reset'

// POST /api/auth/verify-reset-otp   body: { email, code }
// Checks the code emailed by /api/auth/send-reset-otp. On success, mints the
// same signed reset token the link-based flow used to carry in the email
// link, so /api/reset-password (unchanged) can apply the new password.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const body = req.body || {}
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').trim()

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' })
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the 6-digit code from your email.' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ error: 'No account found for that email.' })
    }

    const otp = await EmailOtp.findOne({ email, purpose: PURPOSE })
    if (!otp) {
      return res.status(410).json({ error: 'This code has expired. Request a new one.' })
    }
    if (otp.expires_at.getTime() < Date.now()) {
      await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
      return res.status(410).json({ error: 'This code has expired. Request a new one.' })
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' })
    }

    const ok = await verifyCodeHash(code, otp.code_hash)
    if (!ok) {
      otp.attempts += 1
      await otp.save()
      const left = Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts)
      return res.status(400).json({
        error: left
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Incorrect code. Request a new one.',
      })
    }

    await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
    const token = createResetToken(email, user.role)

    return res.status(200).json({ success: true, token, email })
  } catch (err) {
    console.error('auth/verify-reset-otp error:', err)
    return res.status(500).json({ error: 'Could not verify the code.' })
  }
}
