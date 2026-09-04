import Stripe from 'stripe'
import { findOrCreateCustomer } from './stripeClient.js'

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

// Keep metadata values to short strings — Stripe rejects nested objects and
// caps each value at 500 chars.
function cleanMetadata(input) {
  const out = {}
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (v == null || v === '') continue
      out[String(k).slice(0, 40)] = String(v).slice(0, 450)
    }
  }
  return out
}

export async function createPaymentIntent({ amount, email, name, description, metadata } = {}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set on the server')
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const amountCentavos = resolveAmount(amount)

  // Attach the payer as a Stripe Customer so the payment is recorded against
  // them (name/email show up in the dashboard). Non-fatal if it fails.
  let customer = null
  if (email) {
    try {
      customer = await findOrCreateCustomer(stripe, email, name)
    } catch (err) {
      console.warn('createPaymentIntent: could not resolve customer —', err.message)
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCentavos,
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
    description: description || 'TherapyPro appointment',
    ...(customer ? { customer: customer.id } : {}),
    ...(email ? { receipt_email: email } : {}),
    metadata: {
      ...cleanMetadata(metadata),
      ...(name ? { payer_name: name } : {}),
    },
  })

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: amountCentavos,
    currency: CURRENCY,
  }
}
