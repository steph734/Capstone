import Stripe from 'stripe'

// One place that knows how to build a Stripe client and resolve the
// customer that owns a given billing email. Every subscription-management
// endpoint (payment history, update card) goes through here so the
// "find the customer for this email" rule stays identical to the one
// createSubscription.js already uses.

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Returns the existing Stripe customer for this email, or null.
export async function findCustomerByEmail(stripe, email) {
  if (!email) throw new Error('Missing billing email')
  const existing = await stripe.customers.list({ email, limit: 1 })
  return existing.data[0] || null
}

// Returns the customer for this email, creating one if none exists yet.
export async function findOrCreateCustomer(stripe, email, name) {
  const found = await findCustomerByEmail(stripe, email)
  if (found) return found
  return stripe.customers.create({ email, name: name || undefined })
}
