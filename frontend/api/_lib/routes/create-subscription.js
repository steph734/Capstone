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
    // Remember the subscription this Owner just started. It becomes the clinic's plan only after POST
    // /api/owner/subscription/confirm re-reads it from Stripe and sees it paid (entitlements.js reads that one record).
    const me = req.sessionCtx?.user
    if (me?.role === 'Owner' && result.subscriptionId) {
      try {
        await (await getDb()).collection('clinic_settings').updateOne({ _id: 'clinic' }, { $set: { pending_subscription: { stripe_subscription_id: result.subscriptionId, plan_key: String(tierId).toUpperCase(), billing_period: billingPeriod, owner_id: me._id, created_at: new Date() } } }, { upsert: true })
      } catch (err) { console.error('could not record the pending subscription:', err.message) }
    }
    return res.status(200).json(result)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }
}
