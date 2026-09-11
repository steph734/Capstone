import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { EmailOtp } from '../models/emailOtp.js'
import { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS, generateCode, hashCode, sendOtpEmail } from '../otp.js'

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
    const body = req.body || {}
    const identifier = String(body.email || body.username || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }
    if (user.is_archived) {
      return res.status(403).json({ error: 'This account has been archived.' })
    }
    if (user.is_locked && user.lock_until && user.lock_until > new Date()) {
      return res.status(423).json({ error: 'Account is temporarily locked. Try again later.' })
    }

    const ok = await bcrypt.compare(password, user.password)
    user.last_login_attempt = new Date()

    if (!ok) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1
      await user.save()
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    // Credentials are right, but the email was never confirmed — issue a fresh
    // code and send them to the verification screen instead of logging in.
    if (!user.is_verified) {
      await user.save() // persist last_login_attempt
      try {
        const existing = await EmailOtp.findOne({ email: user.email, purpose: 'signup' })
        const stale = !existing || Date.now() - existing.last_sent_at.getTime() >= OTP_RESEND_COOLDOWN_MS
        if (stale) await issueOtp({ email: user.email, name: user.full_name })
      } catch (mailErr) {
        console.error('login OTP re-send failed:', mailErr.message)
      }
      return res.status(403).json({
        error: 'Please verify your email to continue. We just sent you a 6-digit code.',
        requiresVerification: true,
        email: user.email,
      })
    }

    user.failed_login_attempts = 0
    user.last_login = new Date()
    await user.save()

    return res.status(200).json({ success: true, user: user.toSafeJSON() })
  } catch (err) {
    console.error('auth/login error:', err)
    return res.status(500).json({ error: 'Could not sign you in.' })
  }
}
