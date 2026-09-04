import { useEffect, useMemo, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripe } from '../utils/stripe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ─────────────────────────  helpers  ───────────────────────── */

const peso = (centavos) =>
  '₱ ' +
  (Number(centavos || 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const METHOD_LABELS = {
  card: 'Card',
  gcash: 'GCash',
  grabpay: 'GrabPay',
  paymaya: 'Maya',
  link: 'Link',
}
const labelForMethod = (type) =>
  METHOD_LABELS[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Card')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEFAULT_LINE_ITEMS = [
  { name: 'JBRB Booking - Downpayment', qty: 1, unitCentavos: 712500 },
]

/* ─────────────────────────  icons  ───────────────────────── */

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 6 10 7 10-7" />
  </svg>
)
const CheckIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const Spinner = () => (
  <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="4" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

/* ─────────────────────────  left panel  ───────────────────────── */

function OrderSummary({ total, merchantName, lineItems, paidMeta }) {
  return (
    <div className="flex w-full flex-col gap-5 bg-slate-50/60 p-6 md:w-[45%] md:border-r md:border-slate-200">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Payment amount
        </div>
        <div className="mt-1 text-2xl font-bold text-pm-green">{peso(total)}</div>
      </div>

      {paidMeta && (
        <div className="space-y-1 border-t border-slate-200 pt-3 text-[13px]">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Payment date</span>
            <span className="text-right text-slate-700">{paidMeta.dateLabel}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Payment method</span>
            <span className="text-slate-700">{paidMeta.method}</span>
          </div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Payment for
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-700">{merchantName}</div>
      </div>

      <div className="text-sm">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Item name</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
        </div>
        {lineItems.map((li, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2">
            <span className="text-slate-700">{li.name}</span>
            <span className="text-right text-slate-500">{li.qty}</span>
            <span className="text-right text-slate-700">
              {peso(li.unitCentavos * (li.qty || 1))}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-semibold text-slate-500">Total:</span>
        <span className="text-base font-bold text-slate-800">{peso(total)}</span>
      </div>

      <div className="text-center text-[10px] uppercase tracking-wide text-slate-300">
        Secured checkout · Stripe
      </div>
    </div>
  )
}

/* ─────────────────────────  right panel (inside <Elements>)  ───────────────────────── */

const btnBase =
  'rounded-lg px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'
const btnOutline = `${btnBase} border border-slate-300 text-slate-600 hover:bg-slate-50`
const btnPrimary = `${btnBase} bg-pm-green text-white hover:bg-pm-green-dark`

// Wrapper that lives inside <Elements> and feeds the Stripe hooks in as props,
// so CheckoutStepsBase can also run in demo mode without an <Elements> provider.
function RealCheckoutSteps(props) {
  const stripe = useStripe()
  const elements = useElements()
  return <CheckoutStepsBase {...props} stripe={stripe} elements={elements} />
}

function CheckoutStepsBase({
  step,
  setStep,
  onClose,
  onPaid,
  redirectSeconds,
  onRedirect,
  demo = false,
  stripe = null,
  elements = null,
}) {
  const [pmType, setPmType] = useState(null)
  const [pmComplete, setPmComplete] = useState(false)

  useEffect(() => {
    if (demo) {
      setPmType('card')
      setPmComplete(true)
    }
  }, [demo])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [agree, setAgree] = useState(false)
  const [touched, setTouched] = useState({})

  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  const [count, setCount] = useState(redirectSeconds)

  const nameValid = name.trim().length > 0
  const emailValid = EMAIL_RE.test(email.trim())
  const canComplete =
    nameValid && emailValid && agree && !submitting && (demo || (!!stripe && !!elements))

  /* Success-screen countdown → auto-redirect exactly once */
  const redirectedRef = useRef(false)
  useEffect(() => {
    if (step !== 3) return
    redirectedRef.current = false
    setCount(redirectSeconds)
    const id = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(id)
          if (!redirectedRef.current) {
            redirectedRef.current = true
            onRedirect?.()
          }
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, redirectSeconds, onRedirect])

  const handleComplete = async () => {
    setTouched({ name: true, email: true })
    if (!canComplete) return
    setSubmitting(true)
    setPayError('')

    const dateLabel = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    // Demo mode: no payment backend reachable — simulate a successful charge so
    // the flow can still be demonstrated end to end.
    if (demo) {
      await sleep(1200)
      onPaid({ method: labelForMethod(pmType) || 'Card', dateLabel })
      return
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: {
          billing_details: {
            name: name.trim(),
            email: email.trim(),
            ...(mobile.trim() ? { phone: `+63${mobile.replace(/\D/g, '')}` } : {}),
          },
        },
      },
    })

    if (error) {
      setPayError(error.message || 'Payment could not be completed.')
      setSubmitting(false)
      return
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onPaid({ method: labelForMethod(pmType), dateLabel })
    } else {
      setPayError(`Payment status: ${paymentIntent?.status || 'unknown'}. Please try again.`)
      setSubmitting(false)
    }
  }

  /* ── Step 3: success ── */
  if (step === 3) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pm-green text-white">
          <CheckIcon />
        </div>
        <h3 className="mt-4 text-base font-semibold text-pm-green-dark">
          {labelForMethod(pmType)} payment received!
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          An automated receipt will be sent to your email.
        </p>
        <button
          type="button"
          onClick={() => onRedirect?.()}
          className={`${btnPrimary} mt-6 w-full`}
        >
          Redirect back to merchant
        </button>
        <p className="mt-3 text-[11px] text-slate-400">
          You will be redirected in {count} second{count === 1 ? '' : 's'}.
        </p>
      </div>
    )
  }

  /* ── Step 2: customer information ── */
  if (step === 2) {
    return (
      <div className="flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Payment Method</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {labelForMethod(pmType)}
          </span>
        </div>

        <h3 className="mb-3 text-sm font-semibold text-slate-800">Customer Information</h3>

        {/* Name */}
        <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none focus:border-pm-green ${
            touched.name && !nameValid ? 'border-red-400' : 'border-slate-300'
          }`}
        />
        {touched.name && !nameValid && (
          <p className="mt-1 text-xs text-red-500">Name is required.</p>
        )}

        {/* Email */}
        <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">
          Email address
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <MailIcon />
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-pm-green ${
              touched.email && !emailValid ? 'border-red-400' : 'border-slate-300'
            }`}
          />
        </div>
        {touched.email && !emailValid && (
          <p className="mt-1 text-xs text-red-500">Enter a valid email address.</p>
        )}

        {/* Mobile */}
        <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">
          Mobile number <span className="text-slate-400">(optional)</span>
        </label>
        <div className="flex">
          <span className="flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
            +63
          </span>
          <input
            value={mobile}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
            placeholder="9XXXXXXXXX"
            className="w-full rounded-r-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-pm-green"
          />
        </div>

        {/* Terms */}
        <label className="mt-4 flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-pm-green"
          />
          <span>
            I have read and agreed to the{' '}
            <a href="#" onClick={(e) => e.preventDefault()} className="font-medium text-pm-blue underline">
              Terms
            </a>{' '}
            /{' '}
            <a href="#" onClick={(e) => e.preventDefault()} className="font-medium text-pm-blue underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {payError && <p className="mt-3 text-xs text-red-500">{payError}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={btnOutline} onClick={() => setStep(1)} disabled={submitting}>
            Back
          </button>
          <button type="button" className={btnPrimary} onClick={handleComplete} disabled={!canComplete}>
            {submitting ? 'Processing…' : 'Complete payment'}
          </button>
        </div>
      </div>
    )
  }

  /* ── Step 1: payment method ── */
  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Choose your payment method</h2>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Secure
        </span>
      </div>

      {demo ? (
        <div className="space-y-2">
          <div className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Payment service isn&rsquo;t reachable — running in demo mode (no real charge).
          </div>
          <div className="flex items-center justify-between rounded-lg border-2 border-pm-green bg-green-50/50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Card</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-pm-green">
              <span className="h-2 w-2 rounded-full bg-pm-green" />
            </span>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2 font-mono text-xs tracking-widest text-slate-400">
            •••• •••• •••• 4242
          </div>
        </div>
      ) : (
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: { billingDetails: { name: 'never', email: 'never', phone: 'never' } },
          }}
          onChange={(e) => {
            setPmComplete(e.complete)
            setPmType(e.value?.type ?? null)
          }}
        />
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className={btnOutline} onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => setStep(2)}
          disabled={!pmComplete}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────  modal shell  ───────────────────────── */

export default function CheckoutModal({
  open,
  onClose,
  merchantName = 'JBRB Booking',
  lineItems = DEFAULT_LINE_ITEMS,
  amountCentavos,
  redirectSeconds = 5,
  onSuccess,
  onRedirect,
}) {
  const computedTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.unitCentavos * (li.qty || 1), 0),
    [lineItems]
  )
  const total = amountCentavos ?? computedTotal

  const [step, setStep] = useState(1)
  const [paidMeta, setPaidMeta] = useState(null)
  const [clientSecret, setClientSecret] = useState('')
  const [demo, setDemo] = useState(false)
  const [initializing, setInitializing] = useState(true)

  /* Reset every time the modal is (re)opened */
  useEffect(() => {
    if (!open) return
    setStep(1)
    setPaidMeta(null)
  }, [open])

  /* Lock background scroll while open */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  /* Create the PaymentIntent. If the API isn't reachable (plain `npm run dev`,
     or Stripe not configured on the server) fall back to a demo checkout so the
     flow can still be shown end to end. */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setClientSecret('')
    setDemo(false)
    setInitializing(true)

    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data.clientSecret) {
          throw new Error(data.error || `payment API returned HTTP ${r.status}`)
        }
        if (!cancelled) setClientSecret(data.clientSecret)
      })
      .catch((e) => {
        if (cancelled) return
        console.warn('[CheckoutModal] real payment unavailable, using demo mode:', e.message)
        setDemo(true)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, total])

  if (!open) return null

  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#22c55e',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
      borderRadius: '10px',
      fontSizeBase: '14px',
      spacingUnit: '3px',
    },
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 hover:bg-slate-50"
        >
          ×
        </button>

        <div className="flex w-full flex-col overflow-y-auto md:flex-row">
          <OrderSummary
            total={total}
            merchantName={merchantName}
            lineItems={lineItems}
            paidMeta={paidMeta}
          />

          <div className="flex w-full flex-col p-6 md:w-[55%]">
            {(() => {
              const onPaid = (meta) => {
                setPaidMeta(meta)
                setStep(3)
                onSuccess?.(meta)
              }
              const stepProps = {
                step,
                setStep,
                onClose,
                redirectSeconds,
                onRedirect: onRedirect || onClose,
                onPaid,
              }

              if (initializing) {
                return (
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-slate-500">
                    <Spinner />
                    Preparing secure checkout…
                  </div>
                )
              }
              if (demo || !clientSecret) {
                return <CheckoutStepsBase {...stepProps} demo />
              }
              return (
                <Elements stripe={getStripe()} options={{ clientSecret, appearance }}>
                  <RealCheckoutSteps {...stepProps} />
                </Elements>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
