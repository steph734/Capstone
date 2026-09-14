import Stripe from 'stripe'

// Fixed, server-side Stripe Price IDs — the client only ever sends a tier id
// and billing period, never a price or amount, so what gets charged can't be
// tampered with from the browser. Yearly Price IDs aren't set up yet.
const PRICE_IDS = {
  silver: { monthly: 'price_1U8LYZ6BClqAeYB0rj0RWvMp' },
  gold: { monthly: 'price_1U8LYt6BClqAeYB0t0Ps5kNO' },
}

export async function createSubscription({ tierId, billingPeriod, email, name }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  const priceId = PRICE_IDS[tierId]?.[billingPeriod]
  if (!priceId) {
    throw new Error(`No Stripe price configured for ${tierId} / ${billingPeriod} billing yet`)
  }
  if (!email) {
    throw new Error('Missing billing email')
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Reuse an existing customer for this email if one exists, otherwise create one.
  const existing = await stripe.customers.list({ email, limit: 1 })
  const customer = existing.data[0]
    ? await stripe.customers.update(existing.data[0].id, { name })
    : await stripe.customers.create({ email, name })

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent', 'latest_invoice.confirmation_secret'],
  })

  // Newer Stripe API versions ("Basil" and later) dropped Invoice.payment_intent
  // in favor of Invoice.confirmation_secret — support both so this keeps working
  // regardless of which API version the account is pinned to.
  const invoice = subscription.latest_invoice
  const clientSecret = invoice?.payment_intent?.client_secret || invoice?.confirmation_secret?.client_secret
  if (!clientSecret) {
    throw new Error('Stripe did not return a payment client secret for this subscription')
  }

  return {
    subscriptionId: subscription.id,
    clientSecret,
  }
}
