import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Check, CreditCard, QrCode } from 'lucide-react'
import { getStripe } from '../utils/stripe'
import { getSessionToken } from '../utils/session'
import { prepareForUpload } from '../utils/receiptImage'
import { formatReference, validateReference } from '../../api/_lib/paymentProofRules'
import PaymentProofStep from './payments/PaymentProofStep'

// The Owner's plan checkout, laid out like the patient's booking checkout: the order on the left, the steps on the right.
//   Card  select -> confirm -> success            Stripe charges it and the plan starts at once.
//   QR    select -> confirm -> proof -> sent      the Super Admin checks the receipt, then the plan starts.
const QR = [
  { id: 'gcash', label: 'GCash', src: '/instapay-qr.jpg' },
  { id: 'paymaya', label: 'Maya', src: '/maya-qr.jpg' },
]
const peso = (n) => `₱ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const btn = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 disabled:cursor-not-allowed disabled:opacity-40'
const outline = `${btn} border border-solid border-slate-200 bg-white text-slate-600 hover:bg-slate-50`
const primary = `${btn} bg-pm-green text-white hover:bg-pm-green-dark`

function Steps({ labels, current }) {
  return (
    <ol className="m-0 mb-4 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 pr-12" aria-label="Payment steps">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${i <= current ? 'bg-pm-green text-white' : 'border border-solid border-slate-300 text-slate-400'}`}>{i < current ? <Check size={12} strokeWidth={4} /> : i + 1}</span>
          <span className={`text-xs ${i === current ? 'font-bold text-slate-800' : 'font-semibold text-slate-400'}`}>{l}</span>
        </li>
      ))}
    </ol>
  )
}

function Body({ planName, planId, period, amount, billing, onCardPaid, onQrSent, onClose, setBusyShell }) {
  const stripe = useStripe()
  const elements = useElements()
  const [step, setStep] = useState('select') // select | confirm | proof | success | sent
  const [channel, setChannel] = useState('card')
  const [wallet, setWallet] = useState('gcash')
  const [card, setCard] = useState(null) // { id, label }
  const [cardComplete, setCardComplete] = useState(false)
  const [ticked, setTicked] = useState(false)
  const [reference, setReference] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [busy, setBusyState] = useState(false)
  const [error, setError] = useState('')
  const cardToken = useRef(null) // the created Stripe PaymentMethod survives going back and forth
  const controls = useRef(null)
  const setBusy = (v) => { setBusyState(v); setBusyShell(v) }

  const isQr = channel === 'qr'
  const qr = QR.find((q) => q.id === wallet)
  const methodLabel = isQr ? `${qr.label} QR` : card?.label || 'Card'
  const per = period === 'yearly' ? 'year' : 'month'
  const labels = isQr ? ['Pay', 'Confirm payment', 'Reference & receipt'] : ['Pay', 'Confirm payment']

  // The card field is unmounted on the confirm step, so the PaymentMethod is created here, before leaving it. No charge yet.
  const next = async () => {
    setError('')
    if (isQr) { setStep('confirm'); return }
    if (!stripe || !elements) { setError('Card payments are not available right now. Pay with a QR code instead.'); return }
    setBusy(true)
    try {
      const { paymentMethod, error: err } = await stripe.createPaymentMethod({
        type: 'card', card: elements.getElement(CardElement),
        billing_details: { name: billing.name || undefined, email: billing.email || undefined, ...(billing.phone?.trim().length > 4 ? { phone: billing.phone } : {}) },
      })
      if (err) { setError(err.message); return }
      cardToken.current = paymentMethod.id
      setCard({ id: paymentMethod.id, label: `Card •••• ${paymentMethod.card.last4}` })
      setStep('confirm')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const payCard = async () => {
    setError(''); setBusy(true)
    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSessionToken()}` },
        body: JSON.stringify({ tierId: planId, billingPeriod: period, email: billing.email, name: billing.name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not start the subscription.')
      const out = await stripe.confirmCardPayment(data.clientSecret, { payment_method: cardToken.current })
      if (out.error) throw new Error(out.error.message)
      if (out.paymentIntent.status !== 'succeeded') throw new Error(`Payment ${out.paymentIntent.status}. Please try a different card.`)
      await onCardPaid({ subscriptionId: data.subscriptionId, paymentIntent: out.paymentIntent })
      setStep('success')
    } catch (e) { setError(e.message || 'Payment failed. Please check your card and try again.') } finally { setBusy(false) }
  }

  const sendProof = async () => {
    setError(''); setBusy(true)
    try {
      const form = new FormData()
      const file = await prepareForUpload(receipt)
      form.append('plan', planId); form.append('period', period); form.append('method', wallet); form.append('reference', reference)
      form.append('receipt', file, file.name || 'receipt')
      const res = await fetch('/api/owner/subscription/qr', { method: 'POST', headers: { Authorization: `Bearer ${getSessionToken()}` }, body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'We could not send your payment. Please try again.')
      onQrSent?.(data.payment)
      setStep('sent')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const alert = error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>

  if (step === 'success' || step === 'sent') {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pm-green text-white"><Check size={34} strokeWidth={3} /></span>
        <h2 className="m-0 text-2xl font-bold text-slate-800">{step === 'success' ? 'Payment successful!' : 'Payment proof sent'}</h2>
        <p role="status" className="mt-2 text-sm text-slate-600">
          {step === 'success'
            ? `Your ${planName} plan is now active. It renews automatically every ${per}.`
            : `We will check your ${qr.label} payment. Your ${planName} plan starts as soon as it is approved.`}
        </p>
        <button type="button" className={`${primary} mt-5 w-full`} onClick={() => onClose(true)}>Back to subscription</button>
      </div>
    )
  }

  if (step === 'proof') {
    const ok = validateReference(reference, wallet).ok && receipt
    return (
      <div className="flex flex-col">
        <Steps labels={labels} current={2} />
        <PaymentProofStep method={wallet} reference={reference} onReference={(v) => { setReference(v); setError('') }} file={receipt} onFile={(f) => { setReceipt(f); setError('') }} controls={controls} error={error} verifier="TherapyPro" />
        {reference && ok && <p className="mt-2 text-xs text-slate-500">Reference {formatReference(reference, wallet)} will be checked before your plan starts.</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={outline} onClick={() => setStep('confirm')} disabled={busy}>Back</button>
          <button type="button" className={primary} onClick={sendProof} disabled={!ok || busy}>{busy ? 'Sending…' : 'Submit payment'}</button>
        </div>
      </div>
    )
  }

  // "select" stays mounted (hidden) on "confirm" so the card details are still there after Back.
  return (
    <>
      {step === 'confirm' && (
        <div className="flex flex-col">
          <Steps labels={labels} current={1} />
          <h2 className="m-0 text-2xl font-bold text-slate-800">Confirm your payment</h2>
          <p className="mt-1 text-sm text-slate-500">Please check the details before you pay for your plan.</p>
          <dl className="mt-4 rounded-xl border border-solid border-slate-200 px-4 text-sm">
            {[['Payment method', methodLabel], ['Amount', peso(amount)], ['Plan', `${planName} · ${period === 'yearly' ? 'Yearly' : 'Monthly'}`], ['Billed to', billing.email || '—']].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-slate-500">{k}</dt><dd className="m-0 break-all text-right font-semibold text-slate-800">{v}</dd></div>
            ))}
          </dl>
          {isQr
            ? (
              <label className={`mt-4 flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 border-solid px-3 py-2 text-sm font-semibold text-slate-700 ${ticked ? 'border-pm-green bg-green-50' : 'border-slate-200'}`}>
                <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} style={{ appearance: 'auto', width: 18, height: 18, margin: 0, flexShrink: 0 }} />
                I sent exactly {peso(amount)} using the {qr.label} QR code
              </label>
            )
            : <p className="mt-3 text-xs text-slate-400">Your card is charged {peso(amount)} now and again every {per} until you cancel.</p>}
          {alert}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" className={outline} onClick={() => { setError(''); setStep('select') }} disabled={busy}>Back</button>
            <button type="button" className={primary} disabled={busy || (isQr && !ticked)} onClick={isQr ? () => setStep('proof') : payCard}>{busy ? 'Processing…' : 'Yes, confirm payment'}</button>
          </div>
        </div>
      )}
      <div className="flex flex-col" style={step === 'select' ? undefined : { display: 'none' }}>
        <Steps labels={labels} current={0} />
        <h2 className="m-0 mb-4 text-base font-semibold text-slate-700">Choose your payment method</h2>
        <div className="mb-5 grid grid-cols-2 gap-3" role="tablist">
          {[{ id: 'card', label: 'Pay with card', desc: 'Visa, Mastercard · auto-renews', Icon: CreditCard }, { id: 'qr', label: 'Pay with QR code', desc: 'GCash or Maya · scan to pay', Icon: QrCode }].map(({ id, label, desc, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={channel === id} onClick={() => { setChannel(id); setError('') }}
              className={`flex flex-col gap-2 rounded-xl border border-solid p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 ${channel === id ? 'border-pm-green bg-green-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${channel === id ? 'bg-pm-green text-white' : 'bg-slate-100 text-slate-500'}`}><Icon size={16} aria-hidden="true" /></span>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
              <span className="text-[11px] leading-tight text-slate-500">{desc}</span>
            </button>
          ))}
        </div>
        <div style={isQr ? { display: 'none' } : undefined}>
          <span className="mb-1.5 block text-sm font-bold text-slate-800">Card details</span>
          <div className="rounded-xl border border-solid border-slate-200 bg-white px-3 py-3.5">
            <CardElement options={{ style: { base: { fontSize: '15px', color: '#1f2937' }, invalid: { color: '#dc2626' } } }} onChange={(e) => { setCardComplete(e.complete); setError(e.error?.message || '') }} />
          </div>
        </div>
        {isQr && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
            <div className="text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scan to pay</div>
              <div className="mt-0.5 text-lg font-bold text-pm-green">{peso(amount)}</div>
            </div>
            <div className="flex gap-2">
              {QR.map((q) => (
                <button key={q.id} type="button" aria-pressed={wallet === q.id} onClick={() => { setWallet(q.id); setTicked(false); setReference('') }}
                  className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${wallet === q.id ? 'border-0 bg-pm-green text-white' : 'border border-solid border-slate-200 bg-white text-slate-500'}`}>{q.label}</button>
              ))}
            </div>
            <img src={qr.src} alt={`${qr.label} QR code`} className="w-full max-w-[240px] rounded-lg border border-solid border-slate-200 bg-white object-contain" />
            <p className="m-0 text-center text-xs text-slate-500">Open your {qr.label} app, scan this code, and send exactly <strong>{peso(amount)}</strong>.</p>
          </div>
        )}
        {step === 'select' && alert}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={outline} onClick={() => onClose(false)} disabled={busy}>Back</button>
          <button type="button" className={primary} onClick={next} disabled={busy || (!isQr && !cardComplete)}>{busy ? 'Checking…' : 'Continue'}</button>
        </div>
      </div>
    </>
  )
}

export default function SubscriptionCheckoutModal(props) {
  const { planName, period, amount, onClose } = props
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const item = `${planName} plan (${period === 'yearly' ? 'Yearly' : 'Monthly'})`
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Plan payment" className="relative flex max-h-[92vh] w-full max-w-[880px] overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl [color-scheme:light]">
        {!busy && <button type="button" onClick={() => onClose(false)} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-solid border-slate-200 bg-white text-lg text-slate-500 hover:bg-slate-50">×</button>}
        <div className="flex w-full flex-col overflow-y-auto md:flex-row">
          <div className="flex w-full flex-col gap-4 bg-slate-50 p-5 md:w-[45%] md:border-r md:border-slate-200 md:p-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment amount</div>
              <div className="mt-1 text-2xl font-bold text-pm-green">{peso(amount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment for</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">TherapyPro · {planName} plan</div>
            </div>
            <div className="hidden text-sm md:block">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-solid border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><span>Item name</span><span>Qty</span><span>Price</span></div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2"><span>{item}</span><span className="text-slate-500">1</span><span>{peso(amount)}</span></div>
            </div>
            <div className="mt-auto hidden items-center justify-between border-t border-solid border-slate-200 pt-3 md:flex">
              <span className="text-sm font-semibold text-slate-500">Total:</span><span className="font-bold">{peso(amount)}</span>
            </div>
            <div className="hidden text-center text-[10px] uppercase tracking-wide text-slate-300 md:block">Secured checkout · Stripe</div>
          </div>
          <div className="flex w-full flex-col p-5 md:w-[55%] md:p-6">
            <Elements stripe={getStripe()}><Body {...props} setBusyShell={setBusy} /></Elements>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
