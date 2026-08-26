const Stripe = require('stripe')

// Fixed server-side so the amount charged can never be tampered with from the client.
// Must match TOTAL_DUE_NOW in frontend/src/pages/BookAppointmentPage.jsx (₱550.00).
const AMOUNT_DUE_NOW_CENTAVOS = 55000
const CURRENCY = 'php'

async function createPaymentIntent() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: AMOUNT_DUE_NOW_CENTAVOS,
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
  })
  return { clientSecret: paymentIntent.client_secret }
}

module.exports = { createPaymentIntent }
