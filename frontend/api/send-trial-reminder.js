import { sendTrialEndingEmail } from './_lib/trialEndingEmail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, name, planName, price, trialEndsAt, manageUrl } = req.body || {}
  if (!email || !planName || !trialEndsAt) {
    return res.status(400).json({ error: 'Missing email, planName, or trialEndsAt' })
  }

  try {
    const result = await sendTrialEndingEmail({ email, name, planName, price, trialEndsAt, manageUrl })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
