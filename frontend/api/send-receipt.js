import { sendSubscriptionReceipt } from './_lib/receiptEmail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, name, paymentIntentId } = req.body || {}
  if (!email || !paymentIntentId) {
    return res.status(400).json({ error: 'Missing email or paymentIntentId' })
  }

  try {
    const result = await sendSubscriptionReceipt({ email, name, paymentIntentId })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
