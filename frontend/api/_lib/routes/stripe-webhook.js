// POST /api/stripe/webhook: Stripe tells US what happened to a payment, so a booking is confirmed (or released)
// even if the patient closed the tab.
//
// Setup (once, in the Stripe dashboard -> Developers -> Webhooks):
//   endpoint URL:  https://<your-site>/api/stripe/webhook
//   events:        payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled
//   copy the "Signing secret" (whsec_...) into the STRIPE_WEBHOOK_SECRET environment variable.
// The request body must stay RAW (api/index.js mounts this route before the JSON parser), because the
// signature is checked against the exact bytes Stripe sent.
import { getDb } from '../mongo.js'
import { getStripeClient } from '../stripeClient.js'
import { finalizePaid, markFailed, friendlyFailure } from '../paymentAttempts.js'

export default async function handler(req, res) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    console.error('stripe webhook: STRIPE_WEBHOOK_SECRET is not set')
    return res.status(503).json({ error: 'Webhook is not configured.' })
  }

  let event
  try {
    event = getStripeClient().webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret)
  } catch (err) {
    console.error('stripe webhook: bad signature:', err.message)
    return res.status(400).json({ error: 'Invalid signature.' })
  }

  try {
    const pi = event.data?.object
    if (!pi?.id || !String(event.type).startsWith('payment_intent.')) return res.status(200).json({ received: true })
    const db = await getDb()
    const attempt = await db.collection('payment_attempts').findOne({ provider_ref: pi.id })
    if (!attempt) return res.status(200).json({ received: true, ignored: true }) // not a booking payment (e.g. a subscription)

    if (event.type === 'payment_intent.succeeded') {
      // Amount check: only confirm if Stripe received what the server asked for.
      if (pi.amount_received != null && pi.amount_received < attempt.amount_centavos) {
        console.error('stripe webhook: amount mismatch for attempt', String(attempt._id))
        return res.status(200).json({ received: true, ignored: 'amount' })
      }
      await finalizePaid(db, attempt._id, { via: 'stripe', pi })
    } else if (event.type === 'payment_intent.payment_failed') {
      if (attempt.status !== 'succeeded') await markFailed(db, attempt, friendlyFailure(pi.last_payment_error))
    } else if (event.type === 'payment_intent.canceled') {
      if (attempt.status !== 'succeeded') await markFailed(db, attempt, friendlyFailure('payment_not_received'))
    }
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('stripe webhook processing error:', err)
    return res.status(500).json({ error: 'Could not process the event.' }) // Stripe retries automatically
  }
}
