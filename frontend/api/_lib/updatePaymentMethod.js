import { getStripeClient, findCustomerByEmail, findOrCreateCustomer } from './stripeClient.js'

// Step 1 — hand the browser a SetupIntent so the new card can be collected
// and verified by Stripe.js without the raw card details ever touching us.
export async function createCardSetupIntent({ email, name }) {
  const stripe = getStripeClient()
  const customer = await findOrCreateCustomer(stripe, email, name)

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    usage: 'off_session', // so it can be charged for future subscription renewals
  })

  return { clientSecret: setupIntent.client_secret, customerId: customer.id }
}

// Step 2 — once Stripe.js has confirmed the SetupIntent, promote that payment
// method to the customer's default and repoint every live subscription at it.
export async function setDefaultPaymentMethod({ email, paymentMethodId }) {
  if (!paymentMethodId) throw new Error('Missing paymentMethodId')

  const stripe = getStripeClient()
  const customer = await findCustomerByEmail(stripe, email)
  if (!customer) throw new Error('No Stripe customer found for this email')

  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })
  const liveStatuses = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])
  await Promise.all(
    subs.data
      .filter((s) => liveStatuses.has(s.status))
      .map((s) => stripe.subscriptions.update(s.id, { default_payment_method: paymentMethodId })),
  )

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  return {
    ok: true,
    cardBrand: pm.card?.brand || null,
    cardLast4: pm.card?.last4 || null,
    updatedSubscriptions: subs.data.filter((s) => liveStatuses.has(s.status)).length,
  }
}
