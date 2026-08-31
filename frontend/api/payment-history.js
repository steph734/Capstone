import { getPaymentHistory } from './_lib/paymentHistory.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = req.query?.email
  if (!email) {
    return res.status(400).json({ error: 'Missing email' })
  }

  try {
    const result = await getPaymentHistory({ email, limit: req.query?.limit })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
