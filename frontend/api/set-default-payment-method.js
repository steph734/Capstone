import { setDefaultPaymentMethod } from './_lib/updatePaymentMethod.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, paymentMethodId } = req.body || {}
  if (!email || !paymentMethodId) {
    return res.status(400).json({ error: 'Missing email or paymentMethodId' })
  }

  try {
    const result = await setDefaultPaymentMethod({ email, paymentMethodId })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
