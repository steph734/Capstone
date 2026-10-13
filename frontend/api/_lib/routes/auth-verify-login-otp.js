// POST /api/auth/verify-login-otp { email, code } -> second step of a
// therapist / owner login. A wrong code counts toward the same five-strikes
// account lock as a wrong password.
import { getMongo, getDb } from '../mongo.js'
import { User } from '../models/user.js'
import { EmailOtp } from '../models/emailOtp.js'
import { OTP_MAX_ATTEMPTS, verifyCodeHash } from '../otp.js'
import { createSession } from '../session.js'
import { recordFailure, recordSuccess } from '../passwordCheck.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const code = String(req.body?.code || '').trim()
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code from your email.' })

    const user = await User.findOne({ email })
    if (!user || user.is_archived) return res.status(401).json({ error: 'That code is not valid. Sign in again.' })
    if (user.is_locked && user.lock_until && user.lock_until > new Date()) {
      return res.status(423).json({ error: 'Account is temporarily locked. Try again later.', locked: true, lockUntil: user.lock_until })
    }
    const otp = await EmailOtp.findOne({ email, purpose: 'login2fa' })
    if (!otp || otp.expires_at.getTime() < Date.now()) {
      if (otp) await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
      return res.status(410).json({ error: 'This code has expired. Sign in again to get a new one.' })
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
      return res.status(429).json({ error: 'Too many wrong codes. Sign in again.' })
    }

    const db = await getDb()
    if (!(await verifyCodeHash(code, otp.code_hash))) {
      otp.attempts += 1
      await otp.save()
      const f = await recordFailure(db, user.toObject())
      return res.status(f.locked ? 423 : 400).json({
        error: f.locked ? 'Too many wrong attempts. This account is locked for 5 minutes.' : `Incorrect code. ${f.left} attempt${f.left === 1 ? '' : 's'} left.`,
        locked: f.locked, lockUntil: f.lockUntil || undefined,
      })
    }

    await EmailOtp.deleteOne({ _id: otp._id }).catch(() => {})
    await recordSuccess(db, user.toObject())
    user.last_login = new Date()
    await user.save()
    const token = await createSession(user, req, { mfa: true })
    return res.status(200).json({ success: true, user: user.toSafeJSON(), token })
  } catch (err) {
    console.error('auth/verify-login-otp error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not verify the code.' })
  }
}
