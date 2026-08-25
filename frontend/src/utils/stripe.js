import { loadStripe } from '@stripe/stripe-js'

// Singleton so we only ever load Stripe.js once, no matter how many
// StripeSubscribeForm instances mount.
let stripePromise

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}
