// ESM port of backend/routes/setPassword.js — the deployed frontend calls
// relative /api/... paths (see api/index.js), which never reach the
// separately-hosted Express backend, so this flow needs its own copy here
// the same way auth-login.js etc. do.
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'

function hashInviteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Looks up a non-expired "set your password" link by its raw token. Returns
// the User doc (with the hash + password selected) or null.
async function findByToken(token) {
  if (!token || typeof token !== 'string') return null
  const hash = hashInviteToken(token)
  return User.findOne({
    password_setup_token_hash: hash,
    password_setup_expires_at: { $gt: new Date() },
  }).select('+password_setup_token_hash')
}

// GET  /api/set-password/:token       -> basic info for the "First login as ..." screen.
// POST /api/set-password/:token  body: { password } -> replaces the temp password.
export default async function handler(req, res) {
  try {
    await getMongo()
    const token = req.params?.token

    if (req.method === 'GET') {
      const user = await findByToken(token)
      if (!user) {
        return res.status(410).json({ error: 'This link is invalid or has expired.' })
      }
      return res.status(200).json({ name: user.full_name, email: user.email })
    }

    if (req.method === 'POST') {
      // Already SHA-256'd client-side (see SetPassword.jsx) — same convention
      // as login/signup/reset/change-password, so it's compared/re-hashed
      // here as an opaque string, exactly like every other password field.
      const password = String((req.body || {}).password || '')
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' })
      }
      if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
        return res.status(400).json({ error: 'Password must include a number or symbol.' })
      }

      const user = await findByToken(token)
      if (!user) {
        return res.status(410).json({ error: 'This link is invalid or has expired.' })
      }

      const sameAsTemp = await bcrypt.compare(password, user.password)
      if (sameAsTemp) {
        return res.status(400).json({ error: 'Choose a password different from the temporary one.' })
      }

      user.password = await bcrypt.hash(password, 10)
      user.must_set_password = false
      user.password_change_at = new Date()
      user.password_setup_token_hash = undefined
      user.password_setup_expires_at = undefined
      await user.save()

      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('set-password error:', err)
    return res.status(500).json({ error: 'Could not process this request.' })
  }
}
