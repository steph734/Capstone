import { verifyResetToken } from './_lib/resetPasswordEmail.js'
import { saveResetCredential } from './_lib/credentialStore.js'

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

  // This prototype has no user database. If a Vercel KV store is connected we
  // persist the new password there (so it works on any browser/device);
  // otherwise the client falls back to per-browser localStorage. Either way the
  // reset is not blocked on the store.
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

  return res.status(200).json({ ok: true, email: check.email, role: check.role || null, persisted })
}
