import { sendResetPasswordEmail } from '../resetPasswordEmail.js'
import { getDb } from '../mongo.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, name, appUrl, role } = req.body || {}
  if (!email) {
    return res.status(400).json({ error: 'Missing email' })
  }

  // Prefer the real name/role from MongoDB (accounts created via Sign Up)
  // over whatever the client resolved locally (only the built-in demo
  // accounts). Falls back to the client-supplied values so those still work.
  let mongoName = name
  let mongoRole = role
  try {
    const db = await getDb()
    const user = await db.collection('users').findOne(
      { email: String(email).trim().toLowerCase() },
      { projection: { full_name: 1, role: 1 } }
    )
    if (user) {
      mongoName = user.full_name || mongoName
      mongoRole = user.role || mongoRole
    }
  } catch (err) {
    console.error('send-reset-password: MongoDB lookup failed —', err.message)
  }

  try {
    const result = await sendResetPasswordEmail({ email, name: mongoName, appUrl, role: mongoRole })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
