import { createSubscription } from '../createSubscription.js'
import { getDb } from '../mongo.js'

export default async function handler(req, res) {
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
    // Link the new Stripe subscription to the signed-in Owner's account, so the clinic's plan is found even when the billing
    // email typed at checkout differs from the account email. clinicPlan.js still requires the subscription to be live.
    const me = req.sessionCtx?.user
    if (me?.role === 'Owner' && result.subscriptionId) {
      try {
        await (await getDb()).collection('users').updateOne({ _id: me._id }, { $set: { stripe_subscription_id: result.subscriptionId, stripe_subscription_plan: String(tierId).toLowerCase() } })
      } catch (err) { console.error('could not link subscription to the owner:', err.message) }
    }
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
