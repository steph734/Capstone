import { verifyResetToken } from './_lib/resetPasswordEmail.js'

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

  // This prototype has no user database — the client persists the new password
  // locally (localStorage) keyed by the email the server confirms here. In a
  // real backend this is where the hashed password would be written.
  return res.status(200).json({ ok: true, email: check.email })
}
