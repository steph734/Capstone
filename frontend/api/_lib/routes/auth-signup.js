import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { EmailOtp } from '../models/emailOtp.js'
import { OTP_TTL_MS, generateCode, hashCode, sendOtpEmail } from '../otp.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The sign-up form only offers these two; the other roles are created by admins.
const SIGNUP_ROLES = ['Therapist', 'Patient']

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
    const full_name = String(body.full_name || body.fullName || '').trim()
    const username = String(body.username || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || '').trim()
    const password = String(body.password || '')

    if (!full_name || !username || !email || !role || !password) {
      return res.status(400).json({ error: 'All fields are required.' })
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    if (!SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${SIGNUP_ROLES.join(', ')}.` })
    }

    const clash = await User.findOne({ $or: [{ email }, { username }] }).lean()
    if (clash) {
      const field = clash.email === email ? 'email' : 'username'
      return res.status(409).json({ error: `That ${field} is already registered.` })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const user = await User.create({
      full_name, username, email, role,
      password: password_hash,
      is_verified: false,
      status: 'Active',
    })

    // Email a verification code. If it can't be sent, roll the account back so
    // the user can retry sign-up cleanly.
    try {
      await issueOtp({ email, name: full_name })
    } catch (mailErr) {
      console.error('signup OTP send failed, rolling back user:', mailErr.message)
      await User.deleteOne({ _id: user._id }).catch(() => {})
      await EmailOtp.deleteOne({ email, purpose: 'signup' }).catch(() => {})
      return res.status(502).json({
        error: 'Could not send the verification email. Please try again in a moment.',
      })
    }

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email,
      message: 'We emailed you a 6-digit verification code.',
    })
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That email or username is already registered.' })
    }
    console.error('auth/signup error:', err)
    return res.status(500).json({ error: 'Could not create the account.' })
  }
}
