import Stripe from 'stripe'

// Fixed, server-side pricing — the client only ever sends a tier id and
// billing period, never a price or amount, so what gets charged can't be
// tampered with from the browser.
//
// Monthly Prices already exist in Stripe (created manually), so we call them
// out by ID directly. Yearly ones don't exist yet; rather than requiring a
// manual Stripe dashboard step before this can work, we find-or-create them
// on first use and pin them to a lookup_key so later calls reuse the same
// Price instead of creating a new one every time.
const MONTHLY_PRICE_IDS = {
  silver: 'price_1U8LYZ6BClqAeYB0rj0RWvMp',
  gold: 'price_1U8LYt6BClqAeYB0t0Ps5kNO',
}
// Must match the yearlyPrice values (in pesos) in subscriptionTiers,
// frontend/src/pages/owner/OwnerSubscriptionPage.jsx.
const YEARLY_AMOUNTS_CENTAVOS = {
  silver: 300000, // ₱3000/year
  gold: 500000, // ₱5000/year
}
const TIER_PRODUCT_NAMES = {
  silver: 'TherapyPro Silver',
  gold: 'TherapyPro Gold',
}
const CURRENCY = 'php'

async function getOrCreateYearlyPriceId(stripe, tierId) {
  const amount = YEARLY_AMOUNTS_CENTAVOS[tierId]
  if (!amount) throw new Error(`No yearly price configured for ${tierId}`)

  const lookupKey = `therapypro_${tierId}_yearly`
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  if (existing.data[0]) return existing.data[0].id

  const product = await stripe.products.create({ name: TIER_PRODUCT_NAMES[tierId] })
  const price = await stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: amount,
    recurring: { interval: 'year' },
    lookup_key: lookupKey,
  })
  return price.id
}

async function resolvePriceId(stripe, tierId, billingPeriod) {
  if (billingPeriod === 'monthly') {
    const priceId = MONTHLY_PRICE_IDS[tierId]
    if (!priceId) throw new Error(`No Stripe price configured for ${tierId} / monthly billing yet`)
    return priceId
  }
  if (billingPeriod === 'yearly') {
    return getOrCreateYearlyPriceId(stripe, tierId)
  }
  throw new Error(`Unsupported billing period: ${billingPeriod}`)
}

export async function createSubscription({ tierId, billingPeriod, email, name }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  if (!email) {
    throw new Error('Missing billing email')
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const priceId = await resolvePriceId(stripe, tierId, billingPeriod)

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
    // Invoice.payment_intent was removed from the API — the PaymentIntent's
    // client_secret now lives under Invoice.confirmation_secret instead.
    expand: ['latest_invoice.confirmation_secret'],
  })

  const clientSecret = subscription.latest_invoice?.confirmation_secret?.client_secret
  if (!clientSecret) {
    throw new Error('Stripe did not return a client secret for this subscription')
  }

  return {
    subscriptionId: subscription.id,
    clientSecret,
  }
}
