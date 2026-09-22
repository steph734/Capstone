import bcrypt from 'bcryptjs'
import { getMongo } from '../mongo.js'
import { User } from '../models/user.js'

// POST /api/auth/change-password   body: { email, currentPassword, newPassword }
// Both passwords arrive pre-hashed with SHA-256 client-side, same convention
// as login/signup/reset — see the comment in utils/hash.js.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const body = req.body || {}
    const email = String(body.email || '').trim().toLowerCase()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      // Lets the caller fall back to the local (no-DB demo account) path.
      return res.status(404).json({ error: 'No account found for that email.' })
    }

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect.' })
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' })
    }

    user.password = await bcrypt.hash(newPassword, 10)
    user.password_change_at = new Date()
    await user.save()

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('change-password error:', err)
    return res.status(500).json({ error: 'Could not update your password.' })
  }
}
