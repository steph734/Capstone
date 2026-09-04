import Stripe from 'stripe'

// Default downpayment, used when the client sends no amount (or an invalid one).
// Must match TOTAL_DUE_NOW in frontend/src/pages/BookAppointmentPage.jsx (₱550.00).
const DEFAULT_AMOUNT_CENTAVOS = 55000
const CURRENCY = 'php'

// Stripe's minimum charge for PHP is ₱20.00; cap high to catch obvious garbage.
const MIN_CENTAVOS = 2000
const MAX_CENTAVOS = 100_000_000 // ₱1,000,000.00

function resolveAmount(raw) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < MIN_CENTAVOS || n > MAX_CENTAVOS) {
    return DEFAULT_AMOUNT_CENTAVOS
  }
  return n
}

export async function createPaymentIntent(amount) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const amountCentavos = resolveAmount(amount)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCentavos,
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
  })

  return {
    clientSecret: paymentIntent.client_secret,
    amount: amountCentavos,
    currency: CURRENCY,
  }
}
