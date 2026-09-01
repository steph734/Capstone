import { useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '../utils/stripe'
import './StripeSubscribeForm.css'

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '15px',
      color: '#24352d',
      fontFamily: 'inherit',
      '::placeholder': { color: '#9aab9f' },
    },
    invalid: { color: '#dc2626' },
  },
}

// Real recurring-subscription checkout: creates a Stripe Subscription for the
// server-priced tier/billingPeriod (api/create-subscription.js, Price IDs
// fixed server-side), then confirms the first invoice's Payment Intent with
// the card entered here. Card details go straight to Stripe via CardElement —
// they never touch our server.
function CheckoutInner({ tierId, billingPeriod, submitLabel, billingEmail, billingName, billingPhone, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId, billingPeriod, email: billingEmail, name: billingName }),
      })
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(
          "Couldn't reach the payment server (got an empty response from /api/create-subscription). " +
          "If you're running `npm run dev`, the /api routes aren't served that way locally — " +
          'run `vercel dev` instead so this endpoint actually responds.'
        )
      }
      if (!res.ok) throw new Error(data.error || 'Could not start subscription')

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: billingName,
            email: billingEmail,
            ...(billingPhone ? { phone: billingPhone } : {}),
          },
        },
      })

      if (result.error) throw new Error(result.error.message)
      if (result.paymentIntent.status === 'succeeded') {
        // Email the receipt to the address the user entered. Fire-and-forget:
        // the payment already went through, so a mail hiccup must not block
        // the success screen. The endpoint re-verifies the PaymentIntent at
        // Stripe before it sends anything.
        fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: billingEmail,
            name: billingName,
            paymentIntentId: result.paymentIntent.id,
          }),
        })
          .then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}))
              console.warn('Receipt email was not sent:', body.error || `HTTP ${r.status}`)
            }
          })
          .catch((e) => console.warn('Receipt email request failed:', e))

        onSuccess?.({ subscriptionId: data.subscriptionId, paymentIntent: result.paymentIntent })
      } else {
        throw new Error(`Payment ${result.paymentIntent.status}. Please try a different card.`)
      }
    } catch (err) {
      const message = err.message || 'Payment failed. Please check your card and try again.'
      setError(message)
      onError?.(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="ssf-form" onSubmit={handleSubmit}>
      <label className="ssf-label" htmlFor="ssf-card">Card details</label>
      <div className="ssf-card-box" id="ssf-card">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && <div className="ssf-error">{error}</div>}

      <button type="submit" className="ssf-submit" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : submitLabel}
      </button>
      <p className="ssf-secure-note">🔒 Payments are securely processed by Stripe. Your card details never touch our servers.</p>
    </form>
  )
}

export default function StripeSubscribeForm(props) {
  return (
    <Elements stripe={getStripe()}>
      <CheckoutInner {...props} />
    </Elements>
  )
}
