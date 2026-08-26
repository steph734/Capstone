const { createSubscription } = require('./_lib/createSubscription')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tierId, billingPeriod, email, name } = req.body || {}
  if (!tierId || !billingPeriod || !email) {
    return res.status(400).json({ error: 'Missing tierId, billingPeriod, or email' })
  }

  try {
    const result = await createSubscription({ tierId, billingPeriod, email, name })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
