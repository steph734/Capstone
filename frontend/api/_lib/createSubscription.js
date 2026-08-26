const Stripe = require('stripe')

// Fixed server-side so the amount charged can never be tampered with from the
// client. Must match subscriptionTiers in frontend/src/pages/owner/OwnerSubscriptionPage.jsx.
const TIERS = {
  silver: { productName: 'TherapyPro Silver', monthlyCentavos: 29900 },
  gold: { productName: 'TherapyPro Gold', monthlyCentavos: 49900 },
}
const CURRENCY = 'php'

// Only monthly Prices exist so far — mirrors STRIPE_BILLING_PERIODS in
// frontend/src/pages/owner/OwnerPaymentPage.jsx.
async function getOrCreatePrice(stripe, tierId, tier) {
  const lookupKey = `therapypro_${tierId}_monthly`

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  if (existing.data.length > 0) return existing.data[0]

  const product = await stripe.products.create({ name: tier.productName })
  return stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: tier.monthlyCentavos,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
  })
}

async function getOrCreateCustomer(stripe, email, name) {
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0]
  return stripe.customers.create({ email, name })
}

async function createSubscription({ tierId, billingPeriod, email, name }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  const tier = TIERS[tierId]
  if (!tier) throw new Error(`Unknown subscription tier: ${tierId}`)
  if (billingPeriod !== 'monthly') throw new Error('Only monthly billing is available right now')
  if (!email) throw new Error('Billing email is required')

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

  const [price, customer] = await Promise.all([
    getOrCreatePrice(stripe, tierId, tier),
    getOrCreateCustomer(stripe, email, name),
  ])

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  })

  return {
    subscriptionId: subscription.id,
    clientSecret: subscription.latest_invoice.payment_intent.client_secret,
  }
}

module.exports = { createSubscription }
