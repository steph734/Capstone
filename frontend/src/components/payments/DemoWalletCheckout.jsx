import { useEffect, useRef, useState } from 'react'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '../../utils/stripe'
import { call } from '../../pages/owner/billing/financeApi'
import useDemoWallet, { money, refreshSubscription } from '../../hooks/useDemoWallet'
import '../StripeSubscribeForm.css'
import '../../pages/owner/billing/DemoWallet.css'

export const INSUFFICIENT_MSG = 'Insufficient demo wallet balance. Add funds with Set demo amount on Payouts, then try again.'
const CARD_OPTIONS = { style: { base: { fontSize: '15px', color: '#24352d', fontFamily: 'inherit', '::placeholder': { color: '#9aab9f' } }, invalid: { color: '#dc2626' } } }
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

// "Demo wallet" block in the Order summary: balance now and after this payment.
export function WalletOrderPanel({ price }) {
  const { balance, ready } = useDemoWallet()
  if (!ready) return <div className="dw-order-wallet"><div><span>Demo wallet</span><span>Loading…</span></div></div>
  const after = balance - price
  return (
    <div className="dw-order-wallet">
      <div><span>Demo wallet</span><strong>{money(balance)}</strong></div>
      <div><span>Balance after payment</span><span className={`after ${after < 0 ? 'bad' : 'ok'}`}>{after < 0 ? 'Not enough' : money(after)}</span></div>
    </div>
  )
}

function Overlay({ children, label }) {
  return <div className="dw-overlay" role="dialog" aria-modal="true" aria-label={label}><div className="dw-dialog">{children}</div></div>
}

function Row({ k, v }) { return <div><span>{k}</span><strong>{v}</strong></div> }

function ConfirmingModal({ gcash, step }) {
  const items = gcash ? ['GCash authorized', 'Waiting for confirmation', 'Updating demo wallet'] : ['Card submitted to Stripe', 'Waiting for confirmation', 'Updating demo wallet']
  return (
    <Overlay label="Confirming your payment">
      <div className="dw-spinner" aria-hidden="true" />
      <h2>Confirming your payment…</h2>
      <p className="sub">Please keep this window open.</p>
      <ul className="dw-checklist">
        {items.map((t, i) => <li key={t} className={i <= step ? 'done' : ''}><span className="tick">{i <= step ? '✓' : ''}</span>{t}</li>)}
      </ul>
    </Overlay>
  )
}

function SuccessModal({ r, onDone }) {
  return (
    <Overlay label="Payment successful">
      <div className="dw-result-icon ok" aria-hidden="true">✓</div>
      <h2>Payment successful</h2>
      <p className="sub">Your plan is active and paid from your demo wallet.</p>
      <div className="dw-summary">
        <Row k="Payment method" v={r.method === 'GCash' ? 'GCash (test)' : 'Card ·· 4242'} />
        <Row k="Amount" v={money(r.amount)} />
        <Row k="Reference" v={r.reference} />
        <Row k="Renews on" v={fmtDay(r.renews_at)} />
        <Row k="New wallet balance" v={money(r.balance)} />
      </div>
      <button type="button" className="dw-btn primary dw-gcash-btn" onClick={onDone}>Done</button>
    </Overlay>
  )
}

function FailedModal({ message, balance, onRetry, onBack }) {
  return (
    <Overlay label="Payment failed">
      <div className="dw-result-icon bad" aria-hidden="true">✕</div>
      <h2>Payment failed</h2>
      <p className="sub">{message || 'No amount was deducted'}</p>
      <div className="dw-summary">
        <Row k="Amount deducted" v={money(0)} />
        <Row k="Wallet balance" v={balance == null ? '—' : `${money(balance)} (unchanged)`} />
      </div>
      <div className="dw-stack">
        <button type="button" className="dw-btn primary" onClick={onRetry}>Try again</button>
        <button type="button" className="dw-btn light" onClick={onBack}>Back to checkout</button>
      </div>
    </Overlay>
  )
}

function GcashModal({ price, busy, onAuthorize, onFail, onCancel }) {
  return (
    <Overlay label="Pay with GCash">
      <div className="dw-testbanner">TEST MODE · no real GCash or money is used</div>
      <h2>Pay with GCash</h2>
      <p className="gc-amt dw-gcash-amt">{money(price)}</p>
      <div className="dw-stack">
        <button type="button" className="dw-btn primary" onClick={onAuthorize} disabled={busy}>Authorize Test Payment</button>
        <button type="button" className="dw-btn danger" onClick={onFail} disabled={busy}>Fail Test Payment</button>
        <button type="button" className="dw-btn light" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </Overlay>
  )
}

// Everything between "Subscribe" and the result. stage: null | 'gcash' | 'confirming' | 'success' | 'failed'
// The server decides the price; `price` here (centavos) is only for display and the "not enough" guard.
export default function DemoWalletCheckout({ tierId, billingPeriod, price, method, submitLabel, onPaid, onBack }) {
  const wallet = useDemoWallet()
  const enough = wallet.ready && wallet.balance >= price
  const common = { plan: tierId.toUpperCase(), billing_period: billingPeriod }
  const [stage, setStage] = useState(null)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState(null)
  const [failMsg, setFailMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const keyRef = useRef(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const succeed = async (r, m) => {
    wallet.setBalance(r.balance)
    refreshSubscription()
    onPaid?.(r)
    if (alive.current) { setResult({ ...r, method: m }); setStage('success') }
  }
  const fail = (msg) => { if (!alive.current) return; setFailMsg(msg || 'No amount was deducted'); setStage('failed'); wallet.refresh() }
  const stepper = async () => { setStep(0); await sleep(450); if (alive.current) setStep(1) }

  // ── GCash (simulated modal, no redirect) ──
  const openGcash = () => { keyRef.current = newKey(); setError(''); setStage('gcash') } // one key per attempt, reused for it
  const gcash = async (outcome) => {
    if (busy) return
    setBusy(true)
    try {
      if (outcome === 'authorize') { setStage('confirming'); stepper() }
      const r = await call('subscription/gcash-demo', { method: 'POST', body: { ...common, outcome, idempotency_key: keyRef.current } })
      if (r.status === 'failed') return fail('No amount was deducted')
      if (alive.current) setStep(2)
      await sleep(350)
      await succeed(r, 'GCash')
    } catch (err) {
      fail(err.code === 'INSUFFICIENT_DEMO_BALANCE' ? INSUFFICIENT_MSG : err.message)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // ── Card: checkout endpoint -> Stripe.js confirm -> poll payment-status ──
  const payCard = async (stripe, elements) => {
    if (busy || !stripe || !elements) return
    setBusy(true); setError('')
    let started = false
    try {
      const co = await call('subscription/checkout', { method: 'POST', body: { ...common, method: 'Card' } }) // 422 here = Stripe never called
      started = true
      setStage('confirming'); stepper()
      const res = await stripe.confirmCardPayment(co.clientSecret, { payment_method: { card: elements.getElement(CardElement) } })
      if (res.error) return fail(res.error.message)
      if (alive.current) setStep(1)
      const deadline = Date.now() + 40000
      for (;;) {
        const st = await call('subscription/payment-status', { query: { pi: co.payment_intent } })
        if (st.status === 'succeeded') { if (alive.current) setStep(2); await sleep(350); return succeed(st, 'Card') }
        if (st.status === 'failed') return fail(st.reason || 'No amount was deducted')
        if (Date.now() > deadline || !alive.current) return fail('We could not confirm the payment in time. Check your wallet history before trying again.')
        await sleep(1200)
      }
    } catch (err) {
      if (started) fail(err.message)
      else setError(err.code === 'INSUFFICIENT_DEMO_BALANCE' ? INSUFFICIENT_MSG : err.message)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  return (
    <>
      {wallet.ready && !enough && <p className="dw-insufficient" role="alert">{INSUFFICIENT_MSG}</p>}
      {method === 'GCash' ? (
        <>
          <button type="button" className="dw-btn primary dw-gcash-btn" disabled={!enough || busy} onClick={openGcash}>Continue with GCash — {money(price)}</button>
          {error && <div className="ssf-error">{error}</div>}
        </>
      ) : (
        <Elements stripe={getStripe()}>
          <CardForm disabled={!enough || busy} busy={busy} error={error} submitLabel={submitLabel} onPay={payCard} />
        </Elements>
      )}

      {stage === 'gcash' && <GcashModal price={price} busy={busy} onAuthorize={() => gcash('authorize')} onFail={() => gcash('fail')} onCancel={() => setStage(null)} />}
      {stage === 'confirming' && <ConfirmingModal gcash={method === 'GCash'} step={step} />}
      {stage === 'success' && result && <SuccessModal r={result} onDone={() => { setStage(null); onBack?.() }} />}
      {stage === 'failed' && (
        <FailedModal
          message={failMsg} balance={wallet.balance}
          onRetry={() => (method === 'GCash' ? openGcash() : setStage(null))}
          onBack={() => setStage(null)}
        />
      )}
    </>
  )
}

function CardForm({ disabled, busy, error, submitLabel, onPay }) {
  const stripe = useStripe()
  const elements = useElements()
  return (
    <form className="ssf-form" onSubmit={(e) => { e.preventDefault(); onPay(stripe, elements) }}>
      <label className="ssf-label" htmlFor="ssf-card">Card details</label>
      <div className="ssf-card-box" id="ssf-card"><CardElement options={CARD_OPTIONS} /></div>
      {error && <div className="ssf-error">{error}</div>}
      <button type="submit" className="ssf-submit" disabled={!stripe || disabled}>{busy ? 'Processing…' : submitLabel}</button>
      <p className="ssf-secure-note">🔒 Stripe TEST mode — use card 4242 4242 4242 4242. The amount is deducted from your demo wallet, never from a real card.</p>
    </form>
  )
}
