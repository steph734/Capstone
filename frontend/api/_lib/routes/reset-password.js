import bcrypt from 'bcryptjs'
import { verifyResetToken } from '../resetPasswordEmail.js'
import { saveResetCredential } from '../credentialStore.js'
import { getDb } from '../mongo.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, password } = req.body || {}
  if (!token || !password) {
    return res.status(400).json({ error: 'Missing token or password' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const check = verifyResetToken(token)
  if (!check.valid) {
    const msg =
      check.reason === 'expired'
        ? 'This reset link has expired. Request a new one.'
        : 'This reset link is invalid. Request a new one.'
    return res.status(400).json({ error: msg })
  }

  // Primary: overwrite the hashed password on the MongoDB `users` document, the
  // same collection /api/auth/login checks. Accounts created via Sign Up live
  // here, so this is what makes their reset actually take effect.
  let mongoUpdated = false
  try {
    const db = await getDb()
    const password_hash = await bcrypt.hash(String(password), 10)
    const result = await db.collection('users').updateOne(
      { email: check.email },
      { $set: { password: password_hash, password_change_at: new Date(), updated_at: new Date() } }
    )
    mongoUpdated = result.matchedCount > 0
  } catch (err) {
    console.error('reset-password: could not update MongoDB —', err.message)
  }

  // Secondary/legacy: the built-in demo accounts (TEMP_USERS) aren't in MongoDB
  // at all, so also write to Vercel KV (if connected) / let the client fall back
  // to localStorage, exactly as before. Non-fatal either way.
  let persisted = false
  try {
    persisted = await saveResetCredential({
      email: check.email,
      role: check.role,
      password,
    })
  } catch (err) {
    console.error('reset-password: could not persist to KV —', err.message)
  }

  return res.status(200).json({
    ok: true,
    email: check.email,
    role: check.role || null,
    persisted: mongoUpdated || persisted,
    mongoUpdated,
  })
}
