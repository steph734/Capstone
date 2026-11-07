import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripe } from '../utils/stripe'
import { friendlyPaymentError, PAYMENT_MESSAGES } from '../utils/paymentMessages'
import {
  newKey, loadSaved, save, clearSaved, startBooking, createAttempt, getBookingState, cancelBooking, getStatus, submitQrDetails, TERMINAL,
} from '../utils/bookingPayments'
import { downloadReceipt, manilaDateTime } from '../utils/receiptPdf'
import PendingVerification from './PendingVerification'

// The checkout modal. The LEFT column (amount, what you are paying for, total) is the same in every state.
// The RIGHT column is one state machine:
//
//   select_method -> confirm -> processing -> success
//                                          \-> failed  (change method / try again)
//                                          \-> pending_verification  (QR payments wait for the therapist)
//
// Nothing here decides that a payment worked. The browser asks the SERVER (which asks Stripe, or waits for the
// therapist to verify a GCash/Maya payment). See src/utils/bookingPayments.js and api/_lib/routes/bookings-*.js.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const peso = (centavos) => '₱ ' + (Number(centavos || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const METHOD_LABELS = { card: 'Card', gcash: 'GCash', grabpay: 'GrabPay', paymaya: 'Maya', link: 'Link' }
const labelForMethod = (type) => METHOD_LABELS[type] || (type ? type[0].toUpperCase() + type.slice(1) : 'Card')

// Scan-to-pay wallets on the QR tab. Each `src` is a static image in /public.
const QR_PROVIDERS = [
  { id: 'gcash', label: 'GCash', src: '/instapay-qr.jpg', apiMethod: 'gcash' },
  { id: 'maya', label: 'Maya', src: '/maya-qr.jpg', apiMethod: 'paymaya' },
]

const SLOW_AFTER_MS = 30 * 1000

/* ─────────────────────────  icons  ───────────────────────── */

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }
const CheckIcon = ({ size = 26, w = 3 }) => (<svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={w} {...svg} aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>)
const XIcon = ({ size = 26 }) => (<svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="3" {...svg} aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)
const ClockIcon = ({ size = 30 }) => (<svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.5" {...svg} aria-hidden="true"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>)
const AlertIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...svg} aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>)
const ArrowRightIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.5" {...svg} aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>)
const CardIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...svg} aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></svg>)
const QrIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" {...svg} aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><line x1="14" y1="14" x2="14" y2="17" /><line x1="17.5" y1="14" x2="21" y2="14" /><line x1="21" y1="17.5" x2="21" y2="21" /><line x1="14" y1="21" x2="17.5" y2="21" /></svg>)

const Spinner = ({ size = 22, track = '#cbd5e1' }) => (
  <svg className="animate-spin motion-reduce:animate-none" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke={track} strokeWidth="4" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

// The app's global reset sets `appearance: none` on every <input>, which hides a native checkbox,
// so the check state is drawn by hand here.
function Checkbox({ checked, onChange, children, className = '' }) {
  return (
    <label className={`flex min-h-[44px] cursor-pointer items-start gap-2 text-sm text-slate-700 ${className}`}>
      <span
        role="checkbox" aria-checked={checked} tabIndex={0} onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked) } }}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${checked ? 'border-pm-green bg-pm-green text-white' : 'border-slate-300 bg-white'}`}
      >
        {checked && <CheckIcon size={12} w={4} />}
      </span>
      <span>{children}</span>
    </label>
  )
}

/* ─────────────────────────  left panel (never changes)  ───────────────────────── */

function OrderSummary({ total, merchantName, lineItems }) {
  return (
    <div className="flex w-full flex-col gap-4 bg-slate-50/60 p-5 md:w-[45%] md:gap-5 md:border-r md:border-slate-200 md:p-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment amount</div>
        <div className="mt-1 text-2xl font-bold text-pm-green">{peso(total)}</div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Payment for</div>
        <div className="mt-1 text-sm font-semibold text-slate-700">{merchantName}</div>
      </div>
      {/* On phones the summary collapses to the amount and what it is for. */}
      <div className="hidden text-sm md:block">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Item name</span><span className="text-right">Qty</span><span className="text-right">Price</span>
        </div>
        {lineItems.map((li, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2">
            <span className="text-slate-700">{li.name}</span>
            <span className="text-right text-slate-500">{li.qty}</span>
            <span className="text-right text-slate-700">{peso(li.unitCentavos * (li.qty || 1))}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto hidden items-center justify-between border-t border-slate-200 pt-3 md:flex">
        <span className="text-sm font-semibold text-slate-500">Total:</span>
        <span className="text-base font-bold text-slate-800">{peso(total)}</span>
      </div>
      <div className="hidden text-center text-[10px] uppercase tracking-wide text-slate-300 md:block">Secured checkout · Stripe</div>
    </div>
  )
}

const btnBase = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 disabled:cursor-not-allowed disabled:opacity-40'
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]`
const btnPrimary = `${btnBase} bg-pm-green text-white shadow-sm shadow-pm-green/30 hover:bg-pm-green-dark hover:shadow-md active:scale-[.98]`

function DetailList({ rows }) {
  return (
    <dl className="rounded-xl border border-slate-200 px-4 text-sm">
      {rows.map(([label, value], i) => (
        <div key={label} className={`flex justify-between gap-4 py-3 ${i ? 'border-t border-slate-100' : ''}`}>
          <dt className="text-slate-500">{label}</dt>
          <dd className="text-right font-semibold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ─────────────────────────  the state machine (inside <Elements>)  ───────────────────────── */

function RealCheckoutBody(props) {
  const stripe = useStripe()
  const elements = useElements()
  return <CheckoutBody {...props} stripe={stripe} elements={elements} />
}

function CheckoutBody({
  total, bookingBody, payer, sessionLabel, therapistLabel, patientName, merchantName, lineItems, stripe = null, elements = null,
  resumeSaved, redirectSeconds, onSuccess, onRedirect, onPickAnotherTime, onClose, onPhase, setBlocking, headingRef,
}) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState(resumeSaved ? 'processing' : 'select_method')
  const [channel, setChannel] = useState('card')
  const [qrProvider, setQrProvider] = useState('gcash')
  const [qrConfirmed, setQrConfirmed] = useState(false)
  const [pm, setPm] = useState(null) // { id, label } created at "Continue"
  const [pmComplete, setPmComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectError, setSelectError] = useState('')
  const [booking, setBooking] = useState(resumeSaved?.bookingId ? { id: resumeSaved.bookingId, token: resumeSaved.token } : null)
  const [result, setResult] = useState(null) // the server's view of the latest attempt
  const [failure, setFailure] = useState(null) // { code, message }
  const [attemptAt, setAttemptAt] = useState(null)
  const [slow, setSlow] = useState(false)
  const [progress, setProgress] = useState('checking') // 'checking' | 'booking'
  const [count, setCount] = useState(redirectSeconds)
  const [countActive, setCountActive] = useState(true)

  const alive = useRef(true)
  const holdKey = useRef(resumeSaved?.holdKey || newKey())
  const attemptKey = useRef(newKey())
  const methodRef = useRef(resumeSaved?.method || 'card')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const qrP = QR_PROVIDERS.find((p) => p.id === qrProvider)
  const isQr = channel === 'qr'
  const methodLabel = result?.methodLabel && phase !== 'select_method' && phase !== 'confirm' ? result.methodLabel : isQr ? `${qrP.label} QR` : pm?.label || 'Card'
  const providerName = isQr || methodRef.current !== 'card' ? (methodRef.current === 'paymaya' ? 'Maya' : 'GCash') : 'Stripe'
  const cardAvailable = Boolean(stripe && elements)

  // Page leaves are discouraged only while a payment is being checked.
  useEffect(() => {
    setBlocking(phase === 'processing')
    if (phase !== 'processing') return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase, setBlocking])

  // Focus moves to the new state's heading.
  useEffect(() => { headingRef.current?.focus() }, [phase, headingRef])

  // "This is taking longer than usual" after 30 s of processing.
  useEffect(() => {
    if (phase !== 'processing') { setSlow(false); return undefined }
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Success: countdown to the appointment. Any click inside the window cancels it (see onClickCapture below).
  useEffect(() => {
    if (phase !== 'success' || !countActive) return undefined
    setCount(redirectSeconds)
    const id = setInterval(() => setCount((c) => (c <= 1 ? (clearInterval(id), onRedirect?.(), 0) : c - 1)), 1000)
    return () => clearInterval(id)
  }, [phase, countActive, redirectSeconds, onRedirect])

  /* ── polling the server (which asks Stripe) ── */
  const poll = useCallback(async (attemptId, token) => {
    const startedAt = Date.now()
    let errors = 0
    while (alive.current) {
      try {
        const s = await getStatus(attemptId, token)
        errors = 0
        if (s.status === 'succeeded') setProgress('booking')
        if (TERMINAL.includes(s.status)) return s
      } catch (err) {
        errors += 1
        // One dropped request must not fail a payment that may have gone through: keep asking for a while.
        if (errors >= 8 || err.status === 404) return { status: 'failed', failure: friendlyPaymentError(err.code === 'network' ? 'network' : 'unknown') }
      }
      await sleep(Date.now() - startedAt < 120000 ? 2000 : 5000) // every 2 s for ~2 minutes, then every 5 s
    }
    return null
  }, [])

  const finish = useCallback((s) => {
    if (!alive.current || !s) return
    setResult(s)
    if (s.status === 'succeeded') {
      clearSaved()
      setPhase('success')
      onSuccess?.({ method: s.methodLabel, dateLabel: manilaDateTime(s.paidAt), referenceNo: s.referenceNo, appointmentId: s.booking?.appointmentId, amount: s.amount })
    } else if (s.status === 'pending_verification') {
      save({ attemptId: s.attemptId, method: methodRef.current })
      setPhase('pending_verification')
    } else {
      setFailure(s.failure || friendlyPaymentError('unknown'))
      setAttemptAt(new Date())
      setPhase('failed')
    }
  }, [onSuccess])

  // Opened again after a refresh: ask the server where this booking and its payment are, and continue from there.
  useEffect(() => {
    if (!resumeSaved?.bookingId) return
    let stop = false
    ;(async () => {
      try {
        const st = await getBookingState(resumeSaved.bookingId, resumeSaved.token)
        if (stop || !alive.current) return
        const a = st.attempt
        if (!a || a.status === 'awaiting' && !st.holdExpiresAt) { setPhase('select_method'); return }
        methodRef.current = a.method || methodRef.current
        if (a.method !== 'card') { setChannel('qr'); setQrProvider(a.method === 'paymaya' ? 'maya' : 'gcash') }
        if (a.status === 'awaiting') { setPhase('select_method'); return }
        if (TERMINAL.includes(a.status)) { finish(a); return }
        setPhase('processing')
        finish(await poll(a.attemptId, resumeSaved.token))
      } catch (err) {
        if (stop) return
        clearSaved(); setBooking(null); setPhase('select_method')
        setSelectError('We could not find your earlier checkout, so please start again.')
      }
    })()
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── select_method -> confirm ── */
  const goToConfirm = async () => {
    setSelectError('')
    if (isQr) { methodRef.current = qrP.apiMethod; setPhase('confirm'); return }
    if (!cardAvailable) { setSelectError(PAYMENT_MESSAGES.unavailable); return }
    setBusy(true)
    try {
      const { error: submitError } = await elements.submit()
      if (submitError) { setSelectError(friendlyPaymentError(submitError).code === 'unknown' ? 'Please check your payment details.' : friendlyPaymentError(submitError).message); return }
      // Creating the PaymentMethod now (no charge) lets the confirm screen show "Card •••• 4242".
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        elements,
        params: { billing_details: { name: payer?.name || undefined, email: payer?.email || undefined, ...(payer?.phone ? { phone: payer.phone } : {}), address: { country: 'PH' } } },
      })
      if (error || !paymentMethod) { setSelectError(error ? friendlyPaymentError(error).message : PAYMENT_MESSAGES.unknown); return }
      methodRef.current = 'card'
      setPm({ id: paymentMethod.id, label: paymentMethod.card ? `Card •••• ${paymentMethod.card.last4}` : labelForMethod(paymentMethod.type) })
      setPhase('confirm')
    } catch (err) {
      setSelectError(friendlyPaymentError(err).message)
    } finally { setBusy(false) }
  }

  /* ── confirm -> processing -> success | failed | pending_verification ── */
  const runPayment = async () => {
    setFailure(null); setResult(null); setProgress('checking'); setPhase('processing'); setAttemptAt(new Date())
    const method = methodRef.current
    try {
      // 1. Hold the time slot BEFORE any money moves. (Same key = same booking, never two.)
      let b = booking
      if (!b) {
        const started = await startBooking(bookingBody, holdKey.current)
        const token = started.accessToken || loadSaved()?.token
        if (!token) throw Object.assign(new Error(PAYMENT_MESSAGES.unknown), { code: 'unknown' })
        b = { id: started.bookingId, token }
        setBooking(b)
        save({ bookingId: b.id, token, holdKey: holdKey.current, method, sessionLabel, therapistLabel, patientName, merchantName, lineItems, total })
      }
      // 2. Start the payment attempt (the server decides the amount).
      const attempt = await createAttempt(b.id, b.token, { method, idempotencyKey: attemptKey.current, payer })
      save({ attemptId: attempt.attemptId, method })

      if (method !== 'card') { finish(attempt); return } // QR: now waiting for the therapist

      // 3. Card: pay with Stripe (this also runs 3D Secure when the bank asks for it).
      if (attempt.clientSecret) {
        const { error } = await stripe.confirmPayment({
          clientSecret: attempt.clientSecret,
          confirmParams: { payment_method: pm.id, return_url: window.location.href },
          redirect: 'if_required',
        })
        if (error) {
          // Stripe says what went wrong; the server's status (read from Stripe) is the final word.
          const mine = friendlyPaymentError(error)
          const server = await getStatus(attempt.attemptId, b.token).catch(() => null)
          finish(server && TERMINAL.includes(server.status) ? server : { status: 'failed', failure: mine, methodLabel: 'Card', amount: total / 100 })
          return
        }
      }
      // 4. Ask the server until it has the final answer.
      finish(await poll(attempt.attemptId, b.token))
    } catch (err) {
      if (!alive.current) return
      setFailure({ code: err.code || 'unknown', message: err.message || PAYMENT_MESSAGES.unknown })
      setAttemptAt(new Date())
      setPhase('failed')
    }
  }

  /* ── leaving ── (closing from select / confirm / failed gives the held slot back: see handleClose in the shell) */
  const closeWithRelease = () => onClose()
  const closeFinished = () => { clearSaved(); onRedirect?.() }

  // Tell the shell which state we are in, so its close button / Esc / backdrop do the right thing.
  useEffect(() => { onPhase?.(phase) }, [phase, onPhase])

  /* ── QR: optional reference / screenshot after submitting (the form lives in PendingVerification.jsx) ── */
  const sendQrDetails = async ({ reference, screenshot }) => {
    if (!result?.attemptId || !booking) throw new Error('We could not find your payment. Please refresh and try again.')
    const view = await submitQrDetails(result.attemptId, booking.token, { reference, screenshot })
    setResult(view) // the server's view now says the details were sent ("Checking your details")
  }

  const rows = useMemo(() => ({
    confirm: [
      ['Payment method', methodLabel], ['Amount', peso(total)], ['Session', sessionLabel || '—'], ['Therapist', therapistLabel || '—'],
    ],
  }), [methodLabel, total, sessionLabel, therapistLabel])
  const heading = (text, color = 'text-slate-800') => (
    <h2 ref={headingRef} tabIndex={-1} className={`text-2xl font-bold outline-none ${color}`}>{text}</h2>
  )

  /* ───────── PROCESSING ───────── */
  if (phase === 'processing') {
    const steps = [
      { title: 'Payment details received', sub: `${methodLabel} · ${peso(total)}`, state: 'done' },
      { title: `Checking your payment with ${providerName}`, sub: progress === 'booking' ? 'Done' : 'In progress…', state: progress === 'booking' ? 'done' : 'active' },
      { title: 'Booking your session', sub: sessionLabel ? `${sessionLabel} with ${therapistLabel || 'your therapist'}` : 'Almost there', state: progress === 'booking' ? 'active' : 'todo' },
    ]
    return (
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <div className="mb-3 mt-2"><Spinner size={64} track="#dcfce7" /></div>
        {heading('Processing your payment…')}
        <p className="mt-1 text-sm text-slate-500">{slow ? "This is taking longer than usual. We'll keep checking…" : 'This usually takes less than a minute.'}</p>
        <ul className="mt-5 w-full space-y-3 rounded-xl border border-slate-200 p-4 text-left">
          {steps.map((s) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.state === 'done' ? 'bg-pm-green text-white' : s.state === 'active' ? 'border-2 border-pm-green/40' : 'border-2 border-dashed border-slate-300'}`}>
                {s.state === 'done' ? <CheckIcon size={13} w={4} /> : s.state === 'active' ? <Spinner size={14} /> : null}
              </span>
              <span className="block"><span className={`block text-sm font-semibold ${s.state === 'todo' ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}</span><span className="block text-xs text-slate-500">{s.sub}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-5 flex w-full items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-xs font-semibold text-amber-800"><AlertIcon /> Please don&apos;t close this window, refresh, or press Back.</p>
      </div>
    )
  }

  /* ───────── SUCCESS ───────── */
  if (phase === 'success' && result) {
    return (
      <div className="flex flex-col items-center text-center" onClickCapture={() => setCountActive(false)}>
        <span className="mb-3 mt-1 flex h-16 w-16 items-center justify-center rounded-full bg-pm-green text-white"><CheckIcon size={34} /></span>
        {heading('Payment successful!', 'text-pm-green-dark')}
        <p role="status" className="mt-1 text-sm text-slate-600">Your payment was received and your session is booked.</p>
        <div className="mt-4 w-full text-left">
          <DetailList rows={[
            ['Reference no.', result.referenceNo || '—'], ['Paid', `${peso(result.amount * 100)} · ${result.methodLabel}`],
            ['Date', manilaDateTime(result.paidAt)], ['Session', `${sessionLabel || '—'}${therapistLabel ? ` · ${therapistLabel}` : ''}`],
          ]} />
        </div>
        <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className={btnOutline} onClick={() => downloadReceipt({ referenceNo: result.referenceNo, amount: result.amount, methodLabel: result.methodLabel, paidAt: result.paidAt, sessionLabel, therapist: therapistLabel, patient: patientName })}>Download receipt</button>
          <button type="button" className={btnPrimary} onClick={closeFinished}>View my appointment</button>
        </div>
        <p className="mt-3 text-xs text-slate-500" aria-live="polite">
          {countActive ? `A receipt was sent to your email. Taking you to your appointment in ${count} second${count === 1 ? '' : 's'}… (click anywhere to stay here)` : 'A receipt was sent to your email.'}
        </p>
      </div>
    )
  }

  /* ───────── PENDING VERIFICATION (GCash / Maya) ───────── */
  if (phase === 'pending_verification') {
    return (
      <PendingVerification
        attempt={result}
        isMaya={methodRef.current === 'paymaya' || result?.method === 'paymaya'}
        fallbackSession={sessionLabel}
        fallbackTherapist={therapistLabel}
        headingRef={headingRef}
        onSend={sendQrDetails}
        onDone={closeFinished}
      />
    )
  }

  /* ───────── FAILED ───────── */
  if (phase === 'failed') {
    const slotLost = failure?.code === 'slot_taken' || failure?.code === 'SLOT_TAKEN'
    const retryable = !slotLost && Boolean(booking || loadSaved()?.bookingId)
    const supportMessage = `Payment attempt ${result?.attemptId || ''} for ${peso(total)} (${methodLabel}) on ${manilaDateTime(attemptAt)} was not confirmed. Money left my account.`
    const goSupport = (e) => {
      e.preventDefault()
      navigate(`/help?new=1&subject=${encodeURIComponent('Payment not confirmed')}&message=${encodeURIComponent(supportMessage)}`)
    }
    return (
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 mt-1 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white"><XIcon size={32} /></span>
        {heading('Payment unsuccessful', 'text-red-700')}
        <p role="status" className="mt-1 text-sm text-slate-600">We couldn&apos;t confirm your payment, so your session is not booked yet.</p>
        <div className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left">
          <div className="text-xs font-bold text-red-800">What happened</div>
          <p className="mt-1 text-sm text-red-900">{failure?.message || PAYMENT_MESSAGES.unknown}</p>
        </div>
        <div className="mt-3 w-full text-left"><DetailList rows={[['Method', methodLabel], ['Amount', peso(total)], ['Attempt', manilaDateTime(attemptAt)]]} /></div>
        <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {slotLost ? (
            <button type="button" className={`${btnPrimary} sm:col-span-2`} onClick={() => { clearSaved(); onPickAnotherTime?.() }}>Pick another time</button>
          ) : (
            <>
              <button type="button" className={btnOutline} onClick={() => { attemptKey.current = newKey(); setPm(null); setPmComplete(false); setQrConfirmed(false); setSelectError(''); setPhase('select_method') }}>Change payment method</button>
              <button
                type="button" className={btnPrimary}
                onClick={() => { attemptKey.current = newKey(); (methodRef.current === 'card' && !pm) ? setPhase('select_method') : runPayment() }}
                disabled={!retryable && !booking}
              >Try again</button>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Money left your account? <a href="/help" onClick={goSupport} className="font-bold text-pm-green-dark underline">Contact support</a> and we&apos;ll check it for you.
        </p>
      </div>
    )
  }

  /* ───────── CONFIRM ───────── */
  if (phase === 'confirm') {
    const needTick = isQr
    return (
      <div className="flex flex-col">
        {heading('Confirm your payment')}
        <p className="mt-1 text-sm text-slate-500">Please check the details before we record your payment and book your session.</p>
        <div className="mt-4"><DetailList rows={rows.confirm} /></div>
        {needTick && (
          <div className={`mt-4 rounded-xl border-2 px-3 ${qrConfirmed ? 'border-pm-green bg-green-50' : 'border-slate-200'}`}>
            <Checkbox checked={qrConfirmed} onChange={setQrConfirmed}>
              <span className="font-semibold">I sent exactly {peso(total)} using the {qrP.label} QR code</span>
            </Checkbox>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">By confirming you agree to the Terms and Privacy Policy.</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={btnOutline} onClick={() => setPhase('select_method')}>Back</button>
          <button type="button" className={btnPrimary} onClick={runPayment} disabled={needTick && !qrConfirmed}>Yes, confirm payment</button>
        </div>
      </div>
    )
  }

  /* ───────── SELECT METHOD ───────── */
  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-semibold text-slate-700 outline-none">Choose your payment method</h2>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Secure</span>
      </div>
      {resumeSaved?.bookingId && booking && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">Your time slot is still being held for you.</p>}

      <div className="mb-5 grid grid-cols-2 gap-3" role="tablist">
        {[
          { id: 'card', label: 'Pay with card', desc: 'Visa, Mastercard, Stripe Link', Icon: CardIcon },
          { id: 'qr', label: 'Pay with QR code', desc: 'GCash or Maya · scan to pay', Icon: QrIcon },
        ].map(({ id, label, desc, Icon }) => {
          const active = channel === id
          return (
            <button key={id} type="button" role="tab" aria-selected={active} onClick={() => { setChannel(id); setSelectError('') }}
              className={`group relative flex min-h-[44px] flex-col gap-2 rounded-xl border p-3 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40 ${active ? 'border-pm-green bg-pm-green/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
              <span className={`absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-pm-green bg-pm-green text-white' : 'border-slate-300 bg-white'}`}>{active && <CheckIcon size={9} w={4} />}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-pm-green text-white' : 'bg-slate-100 text-slate-500'}`}><Icon /></span>
              <span className="block text-sm font-semibold text-slate-800">{label}</span>
              <span className="block text-[11px] leading-tight text-slate-500">{desc}</span>
            </button>
          )
        })}
      </div>

      {isQr ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scan to pay</div>
            <div className="mt-0.5 text-lg font-bold text-pm-green">{peso(total)}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {QR_PROVIDERS.map((p) => (
              <button key={p.id} type="button" onClick={() => { setQrProvider(p.id); setQrConfirmed(false) }} aria-pressed={qrProvider === p.id}
                className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition ${qrProvider === p.id ? 'bg-pm-green text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>{p.label}</button>
            ))}
          </div>
          <img src={qrP.src} alt={`${qrP.label} QR code`} className="w-full max-w-[260px] rounded-lg border border-slate-200 bg-white object-contain" />
          <div className="text-center text-xs leading-tight text-slate-500">Open your {qrP.label} app, scan this code, and send exactly <span className="font-semibold">{peso(total)}</span>. Your booking is confirmed after the therapist verifies your payment.</div>
        </div>
      ) : cardAvailable ? (
        <PaymentElement
          options={{ layout: 'tabs', fields: { billingDetails: { name: 'never', email: 'never', phone: 'never', address: 'never' } } }}
          onChange={(e) => { setPmComplete(e.complete); setSelectError('') }}
        />
      ) : (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">{PAYMENT_MESSAGES.unavailable}</p>
      )}

      {selectError && <p role="alert" className="mt-3 text-sm text-red-600">{selectError}</p>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className={btnOutline} onClick={closeWithRelease} disabled={busy}>Back</button>
        <button type="button" className={btnPrimary} onClick={goToConfirm} disabled={busy || (!isQr && !pmComplete)}>
          {busy ? 'Checking…' : 'Continue'}{!busy && <ArrowRightIcon />}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────  modal shell  ───────────────────────── */

export default function CheckoutModal({
  open,
  onClose,
  merchantName = 'TherapyPro',
  lineItems = [],
  amountCentavos,
  redirectSeconds = 5,
  bookingBody,
  payer,
  sessionLabel,
  therapistLabel,
  patientName,
  resume = false,
  onSuccess,
  onRedirect,
  onPickAnotherTime,
}) {
  const computedTotal = useMemo(() => lineItems.reduce((sum, li) => sum + li.unitCentavos * (li.qty || 1), 0), [lineItems])
  const total = amountCentavos ?? computedTotal
  const [blocking, setBlocking] = useState(false)
  const [phase, setPhase] = useState('select_method')
  const [instance, setInstance] = useState(0)
  const dialogRef = useRef(null)
  const headingRef = useRef(null)
  const resumeSaved = useMemo(() => (open && resume ? loadSaved() : null), [open, resume]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) setInstance((n) => n + 1) }, [open]) // a fresh state machine every time it opens

  // One place decides what "close" means in each state:
  //   processing            nothing (the window stays until the payment is checked)
  //   success / waiting     go to the appointment (the booking is already made)
  //   select / confirm / failed   give the held time slot back, then close
  const handleClose = useCallback(async () => {
    if (phase === 'processing') return
    if (phase === 'success' || phase === 'pending_verification') { clearSaved(); onRedirect?.(); return }
    const s = loadSaved()
    if (s?.bookingId && s?.token) await cancelBooking(s.bookingId, s.token).catch(() => {})
    clearSaved()
    onClose?.()
  }, [phase, onClose, onRedirect])

  // Background does not scroll while the modal is open.
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Esc closes (except while processing); Tab stays inside the window.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !blocking) { e.preventDefault(); handleClose() }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const f = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe')].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, blocking, handleClose])

  if (!open) return null

  const saved = resumeSaved
  const labels = {
    merchantName: saved?.merchantName || merchantName,
    lineItems: saved?.lineItems || lineItems,
    total: saved?.total ?? total,
    sessionLabel: saved?.sessionLabel || sessionLabel,
    therapistLabel: saved?.therapistLabel || therapistLabel,
    patientName: saved?.patientName || patientName,
  }
  const appearance = {
    theme: 'stripe',
    variables: { colorPrimary: '#22c55e', colorText: '#1f2937', colorDanger: '#dc2626', fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif', borderRadius: '10px', fontSizeBase: '14px', spacingUnit: '3px' },
  }
  const hasStripeKey = Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

  const bodyProps = {
    total: labels.total, bookingBody, payer, sessionLabel: labels.sessionLabel, therapistLabel: labels.therapistLabel, patientName: labels.patientName,
    merchantName: labels.merchantName, lineItems: labels.lineItems, resumeSaved: saved, redirectSeconds, onSuccess, onRedirect, onPickAnotherTime,
    onClose: handleClose, onPhase: setPhase, setBlocking, headingRef,
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={() => { if (!blocking) handleClose() }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Payment"
        aria-busy={blocking}
        className="relative flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl [color-scheme:light] md:flex-row"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* No close button while a payment is being checked. */}
        {!blocking && (
          <button type="button" onClick={handleClose} aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-green/40">×</button>
        )}
        <div className="flex w-full flex-col overflow-y-auto md:flex-row">
          <OrderSummary total={labels.total} merchantName={labels.merchantName} lineItems={labels.lineItems} />
          <div className={`flex w-full flex-col p-5 md:w-[55%] md:p-6 ${blocking ? 'pointer-events-none' : ''}`}>
            {/* paymentMethodCreation "manual" lets the confirm screen show the card's last 4 digits before anything is charged */}
            {hasStripeKey ? (
              <Elements key={instance} stripe={getStripe()} options={{ mode: 'payment', amount: labels.total, currency: 'php', appearance, paymentMethodCreation: 'manual' }}>
                <RealCheckoutBody key={instance} {...bodyProps} />
              </Elements>
            ) : (
              <CheckoutBody key={instance} {...bodyProps} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
