import { useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '../utils/stripe'
import './StripeSubscribeForm.css'
import './BillingModal.css'

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

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Collects a new card via a SetupIntent, then promotes it to the customer's
// default payment method (and repoints live subscriptions) server-side.
function UpdateInner({ email, name, onClose }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // null | { cardBrand, cardLast4 }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      let data
      try {
        data = await res.json()
      } catch {
        throw new Error(
          "Couldn't reach the payment server. If you're running `npm run dev`, the /api routes " +
          'are not served that way — run `vercel dev` instead.'
        )
      }
      if (!res.ok) throw new Error(data.error || 'Could not start card update')

      const result = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: { name, email },
        },
      })
      if (result.error) throw new Error(result.error.message)

      const paymentMethodId = result.setupIntent.payment_method
      const saveRes = await fetch('/api/set-default-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, paymentMethodId }),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) throw new Error(saveData.error || 'Card verified but could not be set as default')

      setDone({ cardBrand: saveData.cardBrand, cardLast4: saveData.cardLast4 })
    } catch (err) {
      setError(err.message || 'Could not update the payment method.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="update-pm-success">
        <div className="success-check">
          <CheckIcon />
        </div>
        <h3>Payment method updated</h3>
        <p>
          {done.cardBrand && done.cardLast4
            ? `${done.cardBrand} ···· ${done.cardLast4} is now your default card for renewals.`
            : 'Your new card is now the default for renewals.'}
        </p>
        <div className="update-pm-actions">
          <button type="button" className="update-pm-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="ssf-form" onSubmit={handleSubmit}>
      <label className="ssf-label" htmlFor="update-pm-card">New card details</label>
      <div className="ssf-card-box" id="update-pm-card">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && <div className="ssf-error">{error}</div>}

      <div className="update-pm-actions">
        <button type="button" className="update-pm-btn secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="update-pm-btn primary" disabled={!stripe || submitting}>
          {submitting ? 'Saving…' : 'Save card'}
        </button>
      </div>
      <p className="ssf-secure-note">🔒 Processed by Stripe. Your card details never touch our servers.</p>
    </form>
  )
}

export default function UpdatePaymentMethodModal({ email, name, onClose }) {
  return (
    <div className="billing-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-pm-title" onClick={onClose}>
      <div className="billing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div>
            <h2 id="update-pm-title">Update Payment Method</h2>
            <p>Replace the card Stripe charges for your subscription renewals</p>
          </div>
          <button type="button" className="billing-modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="billing-modal-body">
          <Elements stripe={getStripe()}>
            <UpdateInner email={email} name={name} onClose={onClose} />
          </Elements>
        </div>
      </div>
    </div>
  )
}
