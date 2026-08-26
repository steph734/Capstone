const { createSubscription } = require('./_lib/createSubscription')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { tierId, billingPeriod, email, name } = req.body || {}
    const result = await createSubscription({ tierId, billingPeriod, email, name })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
