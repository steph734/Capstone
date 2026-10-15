import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'
import { AuditLog } from '../models/auditLog.js'
import { EmailOtp } from '../models/emailOtp.js'
import { createSession } from '../session.js'
import { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS, generateCode, hashCode, sendOtpEmail } from '../otp.js'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MS = 5 * 60 * 1000

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

async function logAudit(fields) {
  try {
    await AuditLog.create({ created_at: new Date(), ...fields })
  } catch (err) {
    console.error('audit log write failed:', err.message)
  }
}

// Emailed sign-in codes are off for every role: a correct password signs you in.
// (Signup email verification is separate and unchanged.) To bring the second
// step back for patients and therapists, set REQUIRE_LOGIN_2FA=true.
const needsSecondFactor = (role) => (role === 'Therapist' || role === 'Patient') && String(process.env.REQUIRE_LOGIN_2FA || '').trim().toLowerCase() === 'true'

async function issueOtp({ email, name, purpose = 'signup' }) {
  const code = generateCode()
  const code_hash = await hashCode(code)
  const now = Date.now()
  await EmailOtp.findOneAndUpdate(
    { email, purpose },
    { email, purpose, code_hash, attempts: 0, expires_at: new Date(now + OTP_TTL_MS), last_sent_at: new Date(now) },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
  await sendOtpEmail({ email, name, code, purpose })
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
    const now = new Date()
    const clientIp = getClientIp(req)
    // Set once a lockout is triggered and never cleared until a login
    // succeeds, so a failure arriving after `lock_until` has passed (i.e.
    // still failing once the 5-minute lock has run out) is distinguishable
    // from a normal first-time failure.
    const wasLockedAndExpired = Boolean(user.is_locked && user.lock_until && user.lock_until <= now)

    if (user.is_locked && user.lock_until && user.lock_until > now) {
      return res.status(423).json({
        error: 'Account is temporarily locked. Try again later.',
        locked: true,
        lockUntil: user.lock_until,
      })
    }

    const ok = await bcrypt.compare(password, user.password)
    user.last_login_attempt = now

    if (!ok) {
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1

      if (wasLockedAndExpired) {
        await logAudit({
          user_id: user._id,
          action: 'login_failed_after_lockout',
          ip_address: clientIp,
          description: `Failed login for ${user.email} after a previous 5-minute account lockout had already expired.`,
        })
      }

      if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        const alreadyLocked = user.is_locked
        user.is_locked = true
        user.lock_until = new Date(now.getTime() + LOCK_DURATION_MS)
        if (!alreadyLocked) {
          await logAudit({
            user_id: user._id,
            action: 'account_locked',
            ip_address: clientIp,
            description: `Account locked for 5 minutes after ${user.failed_login_attempts} failed login attempts.`,
          })
        }
      }

      await user.save()
      const locked = user.is_locked && user.lock_until > now
      return res.status(locked ? 423 : 401).json({
        error: locked
          ? 'Too many failed attempts. Account locked for 5 minutes.'
          : 'Invalid email or password.',
        locked,
        lockUntil: locked ? user.lock_until : undefined,
      })
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

    if (needsSecondFactor(user.role)) {
      // Password was right; don't clear the failure counter or sign in until the code is too.
      await user.save()
      try {
        await issueOtp({ email: user.email, name: user.full_name, purpose: 'login2fa' })
      } catch (mailErr) {
        console.error('login 2FA code send failed:', mailErr.message)
        return res.status(502).json({ error: 'We could not email your sign-in code. Please try again.' })
      }
      return res.status(200).json({ requires2fa: true, email: user.email, message: 'We emailed you a 6-digit sign-in code.' })
    }

    user.failed_login_attempts = 0
    user.is_locked = false
    user.lock_until = null
    user.last_login = now
    await user.save()

    const token = await createSession(user, req, { mfa: false })
    return res.status(200).json({ success: true, user: user.toSafeJSON(), token })
  } catch (err) {
    console.error('auth/login error:', err)
    return res.status(500).json({ error: 'Could not sign you in.' })
  }
}
