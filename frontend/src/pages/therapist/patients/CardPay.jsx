import { useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, AlertTriangle, Lock } from 'lucide-react'
import { getStripe } from '../../../utils/stripe'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { peso } from './format'

// Card payment for the first-session fee. The SERVER creates the PaymentIntent (amount and therapist are its own) and, after
// the card is charged, asks Stripe again before it saves the patient. Nothing here decides that a payment worked.
const APPEARANCE = { theme: 'stripe', variables: { colorPrimary: '#2b4a3f', colorText: '#111111', borderRadius: '12px' } }

function CardForm({ amount, paidId, sending, serverError, onPaid, onBack }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pay = async () => {
    if (!stripe || !elements || busy || sending) return
    setError('')
    // The card was already charged but saving the patient failed: only retry the saving, never charge twice.
    if (paidId) { onPaid(paidId); return }
    setBusy(true)
    try {
      const { error: submitError } = await elements.submit()
      if (submitError) { setError(submitError.message || 'Please check your card details.'); return }
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' })
      if (confirmError) { setError(confirmError.message || 'The card was declined. Try another card.'); return }
      if (paymentIntent?.status === 'succeeded') await onPaid(paymentIntent.id)
      else setError(paymentIntent?.status === 'processing' ? 'Your bank is still processing the payment. Wait a moment, then press Pay again.' : 'The payment was not completed. You have not been charged.')
    } catch (e) { setError(e.message || 'Something went wrong with the card payment.') } finally { setBusy(false) }
  }
  const working = busy || sending
  useIdleBusy('payment', working) // card being charged
  return (
    <>
      <div className="pm-card-box">
        {paidId
          ? <p className="pm-note amber"><AlertTriangle size={14} aria-hidden="true" /> Your card was charged, but the patient could not be saved yet. Press the button to finish. You will not be charged again.</p>
          : <PaymentElement options={{ layout: 'tabs' }} />}
      </div>
      {(error || serverError) && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error || serverError}</p>}
      <div className="pm-pay-foot">
        <button type="button" className="pm-btn light" onClick={onBack} disabled={working}>Back</button>
        <button type="button" className="pm-btn primary" onClick={pay} disabled={!stripe || working} data-autofocus>
          {working ? <><Loader2 size={15} className="pm-spin" aria-hidden="true" /> Processing…</> : <><Lock size={14} aria-hidden="true" /> {paidId ? 'Finish saving patient' : `Pay ${peso(amount)}`}</>}
        </button>
      </div>
    </>
  )
}

export default function CardPay({ amount, getIntent, paidId, sending, serverError, onPaid, onBack }) {
  const [state, setState] = useState({ loading: true, secret: '', error: '' })
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    getIntent()
      .then((r) => setState({ loading: false, secret: r.clientSecret, error: '' }))
      .catch((e) => setState({ loading: false, secret: '', error: e.message || 'Card payment could not start.' }))
  }, [getIntent])

  if (state.loading) return <div className="pm-card-box"><div className="pm-skel-block" aria-busy="true" /></div>
  if (state.error || !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    return (
      <>
        <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {state.error || 'Card payments are not set up yet. Use cash or QR.'}</p>
        <div className="pm-pay-foot"><button type="button" className="pm-btn light" onClick={onBack}>Back</button></div>
      </>
    )
  }
  return (
    <Elements stripe={getStripe()} options={{ clientSecret: state.secret, appearance: APPEARANCE }}>
      <CardForm amount={amount} paidId={paidId} sending={sending} serverError={serverError} onPaid={onPaid} onBack={onBack} />
    </Elements>
  )
}
