import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { EmailOtp } from '../models/emailOtp.js'
import { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS, generateCode, hashCode, sendOtpEmail } from '../otp.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function issueOtp({ email, name, purpose = 'signup' }) {
  const code = generateCode()
  const code_hash = await hashCode(code)
  const now = Date.now()
  await EmailOtp.findOneAndUpdate(
    { email, purpose },
    { email, purpose, code_hash, attempts: 0, expires_at: new Date(now + OTP_TTL_MS), last_sent_at: new Date(now) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  await sendOtpEmail({ email, name, code })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const email = String((req.body || {}).email || '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    const user = await User.findOne({ email })
    // Don't reveal whether an account exists — respond the same either way.
    if (!user || user.is_verified) {
      return res.status(200).json({ success: true, message: 'If that account needs verification, a new code is on its way.' })
    }

    const existing = await EmailOtp.findOne({ email, purpose: 'signup' })
    if (existing) {
      const since = Date.now() - existing.last_sent_at.getTime()
      if (since < OTP_RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - since) / 1000)
        return res.status(429).json({ error: `Please wait ${wait}s before requesting another code.`, retryAfter: wait })
      }
    }

    try {
      await issueOtp({ email, name: user.full_name })
    } catch (mailErr) {
      console.error('resend-otp send failed:', mailErr.message)
      return res.status(502).json({ error: 'Could not send the email. Please try again shortly.' })
    }

    return res.status(200).json({ success: true, message: 'A new code is on its way.' })
  } catch (err) {
    console.error('auth/resend-otp error:', err)
    return res.status(500).json({ error: 'Could not resend the code.' })
  }
}
