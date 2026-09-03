import { sendResetPasswordEmail } from './_lib/resetPasswordEmail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, name, appUrl, role } = req.body || {}
  if (!email) {
    return res.status(400).json({ error: 'Missing email' })
  }

  try {
    const result = await sendResetPasswordEmail({ email, name, appUrl, role })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
