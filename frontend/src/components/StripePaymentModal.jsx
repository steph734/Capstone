import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '../utils/stripeConfig'
import './StripePaymentModal.css'

const ShieldIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a9e6b" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>

function CheckoutForm({ amountLabel, onSuccess, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message)
      setLoading(false)
      return
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    })

    if (confirmError) {
      setError(confirmError.message)
      setLoading(false)
      return
    }

    onSuccess(paymentIntent.id)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="book-modal-body stripe-modal-body">
        <PaymentElement />
      </div>
      {error && <div className="step-error stripe-error">{error}</div>}
      <div className="book-modal-actions">
        <button type="button" className="book-cancel-btn" onClick={onCancel} disabled={loading}>
          CANCEL
        </button>
        <button type="submit" className="book-continue-btn" disabled={!stripe || loading}>
          {loading ? 'Processing…' : `PAY ${amountLabel}`}
        </button>
      </div>
    </form>
  )
}

export default function StripePaymentModal({ amountLabel, onSuccess, onClose }) {
  const [clientSecret, setClientSecret] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/create-payment-intent', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.error) setLoadError(data.error)
        else setClientSecret(data.clientSecret)
      })
      .catch(err => { if (!cancelled) setLoadError(err.message) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="book-modal-backdrop" onClick={onClose}>
      <div className="book-modal" onClick={e => e.stopPropagation()}>
        <div className="book-modal-header">
          <ShieldIcon />
          <div>
            <h3>Secure Online Payment</h3>
            <p>Powered by Stripe — your card details never touch our servers</p>
          </div>
        </div>

        {loadError && (
          <>
            <div className="step-error stripe-error">{loadError}</div>
            <div className="book-modal-actions">
              <button className="book-cancel-btn" onClick={onClose}>CLOSE</button>
            </div>
          </>
        )}

        {!loadError && !clientSecret && (
          <div className="book-modal-body stripe-modal-body stripe-loading">Loading secure payment form…</div>
        )}

        {!loadError && clientSecret && (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <CheckoutForm amountLabel={amountLabel} onSuccess={onSuccess} onCancel={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}
