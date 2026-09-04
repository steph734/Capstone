import { createPaymentIntent } from './_lib/createPaymentIntent.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { amount, email, name, description, metadata, probe } = req.body || {}

  try {
    // Lightweight availability check — the client calls this when the checkout
    // modal opens to decide real vs demo mode, WITHOUT creating a PaymentIntent.
    if (probe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set on the server')
      }
      return res.status(200).json({ ok: true })
    }

    const result = await createPaymentIntent({ amount, email, name, description, metadata })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
