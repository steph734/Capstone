import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CheckoutModal from './CheckoutModal'
import { apiGet, apiPost } from '../utils/api'
import { manilaDateKey } from '../utils/manilaTime'
import './RecommendationBookingModal.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MAX_DAYS_AHEAD = 60
const pad = (n) => String(n).padStart(2, '0')
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const longDate = (k) => new Date(`${k}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`

const Icon = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const CloseIcon = () => <Icon><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>
const CheckIcon = ({ size }) => <Icon size={size}><polyline points="20 6 9 17 4 12" /></Icon>
const CardIcon = () => <Icon size={16}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></Icon>
const CashIcon = () => <Icon size={16}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Icon>

/**
 * "Set next therapy session" popup — the parent's side of "Recommend another
 * session". Pick one date and time from the therapist's free slots, pay, and the
 * session is booked. The picked time is held for 30 minutes while paying.
 *
 * props: recommendationId, onClose(), onBooked?(result)
 */
export default function RecommendationBookingModal({ recommendationId: id, onClose, onBooked }) {
  const [rec, setRec] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const today = manilaDateKey()
  const [view, setView] = useState(() => { const [y, m] = today.split('-').map(Number); return { y, m: m - 1 } })
  const [date, setDate] = useState(null)
  const [slots, setSlots] = useState(null) // null = loading
  const [start, setStart] = useState(null)
  const [note, setNote] = useState('')
  const [payMethod, setPayMethod] = useState('online') // online | cash
  const [cashOpen, setCashOpen] = useState(true)
  const [received, setReceived] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [heldUntil, setHeldUntil] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const paidRef = useRef(null)
  const [done, setDone] = useState(null)
  const closeRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGet(`/api/recommendations/${id}`)
      .then((d) => { if (!cancelled) setRec(d.recommendation) })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load this recommendation.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  // Esc closes (not while paying), the page behind doesn't scroll, focus moves into the dialog.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy && !checkoutOpen) onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [busy, checkoutOpen, onClose])

  const loadSlots = useCallback((d) => {
    setSlots(null)
    setStart(null)
    apiGet(`/api/recommendations/${id}/slots?date=${d}`)
      .then((r) => setSlots(r.slots || []))
      .catch((e) => { setSlots([]); setError(e.message) })
  }, [id])

  useEffect(() => { if (date) { setError(''); setHeldUntil(null); loadSlots(date) } }, [date, loadSlots])

  useEffect(() => {
    if (!heldUntil) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [heldUntil])
  const holdLeft = heldUntil ? Math.max(0, new Date(heldUntil).getTime() - now) : 0
  const holdLabel = `${Math.floor(holdLeft / 60000)}:${pad(Math.floor((holdLeft % 60000) / 1000))}`

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay()
    const days = new Date(view.y, view.m + 1, 0).getDate()
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  }, [view])
  const lastDay = manilaDateKey(new Date(Date.now() + MAX_DAYS_AHEAD * 86400000))
  const disabledDay = (k) => k < today || k > lastDay

  const slot = slots?.find((s) => s.start === start) || null
  const fee = rec?.sessionFee || 0
  const receivedNum = parseFloat(received) || 0
  const cashShort = payMethod === 'cash' && receivedNum < fee
  const change = receivedNum > fee ? receivedNum - fee : 0
  const expired = rec && (rec.expired || rec.status === 'Expired')

  const book = async (payment) => {
    setBusy(true)
    setError('')
    try {
      const r = await apiPost(`/api/recommendations/${id}/book`, { date, start, note: note.trim(), payment })
      setDone(r)
      onBooked?.(r)
    } catch (e) {
      setError(e.message || 'Could not book this session.')
      setHeldUntil(null)
      if (date) loadSlots(date)
    } finally {
      setBusy(false)
      setCheckoutOpen(false)
    }
  }

  // "Continue to payment": hold the time first, then pay (online) or confirm (cash).
  const proceed = async () => {
    if (!date || !start || busy || cashShort) return
    setBusy(true)
    setError('')
    try {
      const h = await apiPost(`/api/recommendations/${id}/hold`, { date, start })
      setHeldUntil(h.heldUntil)
      setNow(Date.now())
      setBusy(false)
      if (payMethod === 'cash') { await book({ method: 'cash', amountReceived: receivedNum, amountChange: change }); return }
      paidRef.current = null
      setCheckoutOpen(true)
    } catch (e) {
      setBusy(false)
      setError(e.message || 'Could not hold that time.')
      loadSlots(date)
    }
  }

  // A message-only state (not found / expired / already booked / success).
  const notice = (title, text, action) => (
    <div className="rbm-body rbm-notice">
      {action?.icon && <div className="rbm-check" aria-hidden="true"><CheckIcon size={26} /></div>}
      <h2 id="rbm-title">{title}</h2>
      <p className="rbm-muted">{text}</p>
      <button className="rbm-btn rbm-btn-primary" onClick={action?.onClick || onClose}>{action?.label || 'Close'}</button>
    </div>
  )

  let content
  if (loading) {
    content = <div className="rbm-body"><p className="rbm-muted">Loading…</p></div>
  } else if (loadError || !rec) {
    content = notice('Recommendation not found', loadError || 'This recommendation is not available for your account.')
  } else if (expired) {
    content = notice('This recommendation has expired', 'This recommendation has expired. Please message your therapist.')
  } else if (done) {
    content = notice(
      'Next session booked',
      `${rec.patientName}'s session with ${done.therapistName || rec.therapistName} is set for ${longDate(done.date)}, ${done.label}. ${done.status === 'Pending' ? 'It will be confirmed once your therapist accepts it. Please pay at the clinic.' : 'It is confirmed.'}${done.paymentRef ? ` Reference no. ${done.paymentRef}.` : ''}`,
      { label: 'Done', icon: true }
    )
  } else if (rec.status === 'Booked') {
    content = notice('Already booked', `The next session for ${rec.patientName} has already been booked.`)
  } else {
    content = (
      <>
        <div className="rbm-body">
          {rec.message && <blockquote className="rbm-quote">{rec.message}</blockquote>}
          <div className="rbm-grid">
            <section aria-label="Pick a date and time">
              <div className="rbm-cal-nav">
                <button className="rbm-icon" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} aria-label="Previous month">‹</button>
                <strong>{MONTHS[view.m]} {view.y}</strong>
                <button className="rbm-icon" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} aria-label="Next month">›</button>
              </div>
              <div className="rbm-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
              <div className="rbm-days">
                {cells.map((d, i) => {
                  if (!d) return <span key={`b${i}`} />
                  const k = key(view.y, view.m, d)
                  return (
                    <button key={k} type="button" disabled={disabledDay(k)} aria-pressed={k === date}
                      className={`rbm-day${k === date ? ' on' : ''}${k === today ? ' today' : ''}`} onClick={() => setDate(k)}>{d}</button>
                  )
                })}
              </div>

              <h3 className="rbm-sub">{date ? `Available times · ${longDate(date)}` : 'Choose a date to see available times'}</h3>
              {date && slots === null && <p className="rbm-muted">Loading times…</p>}
              {date && slots && slots.length === 0 && <p className="rbm-muted">No free times on this day. Try another date.</p>}
              {date && slots && slots.length > 0 && (
                <div className="rbm-slots" role="radiogroup" aria-label="Available times">
                  {slots.map((s) => (
                    <button key={s.start} type="button" role="radio" aria-checked={s.start === start}
                      className={`rbm-slot${s.start === start ? ' on' : ''}`} onClick={() => { setStart(s.start); setHeldUntil(null) }}>{s.label}</button>
                  ))}
                </div>
              )}
            </section>

            <aside aria-label="Session summary">
              <h3 className="rbm-sub rbm-sub-first">Summary</h3>
              <dl className="rbm-summary">
                <div><dt>Patient</dt><dd>{rec.patientName}</dd></div>
                <div><dt>Therapist</dt><dd>{rec.therapistName}</dd></div>
                <div><dt>Session</dt><dd>{rec.sessionType} · {rec.sessionMode} · {rec.durationMinutes} min</dd></div>
                <div><dt>Date</dt><dd>{date ? longDate(date) : '—'}</dd></div>
                <div><dt>Time</dt><dd>{slot ? slot.label : '—'}</dd></div>
                <div className="rbm-total"><dt>Total</dt><dd>{peso(fee)}</dd></div>
              </dl>

              <label className="rbm-label" htmlFor="rbm-note">Note for your therapist <span>(optional)</span></label>
              <textarea id="rbm-note" className="rbm-text" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

              <div className="rbm-label" id="rbm-pay-label">Payment</div>
              <div className="rbm-pay" role="radiogroup" aria-labelledby="rbm-pay-label">
                <button type="button" role="radio" aria-checked={payMethod === 'online'} className={`rbm-pay-opt${payMethod === 'online' ? ' on' : ''}`} onClick={() => setPayMethod('online')}>
                  <CardIcon /><span>Pay online<small>Card, GCash or Maya</small></span>
                </button>
                <button type="button" role="radio" aria-checked={payMethod === 'cash'} className={`rbm-pay-opt${payMethod === 'cash' ? ' on' : ''}`} onClick={() => setPayMethod('cash')}>
                  <CashIcon /><span>Pay at the clinic<small>Cash</small></span>
                </button>
              </div>

              {payMethod === 'cash' && (
                <div className="rbm-cash">
                  <button type="button" className="rbm-cash-head" aria-expanded={cashOpen} onClick={() => setCashOpen((o) => !o)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cashOpen ? 'open' : ''}><polyline points="6 9 12 15 18 9" /></svg>
                    Cash payment details
                  </button>
                  {cashOpen && (
                    <div className="rbm-cash-body">
                      <label className="rbm-label" htmlFor="rbm-received">Amount received <em>*</em></label>
                      <input id="rbm-received" className="rbm-text rbm-input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                        value={received} onChange={(e) => setReceived(e.target.value)} />
                      {received !== '' && cashShort && <p className="rbm-error rbm-cash-err">Must be at least {peso(fee)}</p>}
                      <dl className="rbm-cash-calc">
                        <div><dt>Amount received</dt><dd>₱{receivedNum.toFixed(2)}</dd></div>
                        <div><dt>Less: Rate per Session</dt><dd>− ₱{Number(fee).toFixed(2)}</dd></div>
                        <div className="rbm-cash-total"><dt>Amount change</dt><dd>₱{change.toFixed(2)}</dd></div>
                      </dl>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className="rbm-foot">
          <div className="rbm-foot-msg">
            {heldUntil && holdLeft > 0 && <p className="rbm-hold">Holding this time for you · {holdLabel}</p>}
            {error && <p className="rbm-error" role="alert">{error}</p>}
            {!error && !(heldUntil && holdLeft > 0) && <p className="rbm-fine">One session only. Your time is held for 30 minutes while you pay.</p>}
          </div>
          <button className="rbm-btn rbm-btn-primary rbm-cta" onClick={proceed} disabled={!date || !start || busy || cashShort}>
            {busy ? 'Please wait…' : payMethod === 'cash' ? 'Confirm booking' : 'Continue to payment'}
          </button>
        </div>
      </>
    )
  }

  return createPortal(
    <div className="rbm-overlay" onClick={(e) => e.target === e.currentTarget && !busy && !checkoutOpen && onClose()}>
      <div className="rbm-modal" role="dialog" aria-modal="true" aria-labelledby="rbm-title">
        <div className="rbm-head">
          <div>
            <h2 id={rec && !done && !expired && rec.status !== 'Booked' ? 'rbm-title' : undefined}>Set next therapy session</h2>
            {rec && !done && !expired && rec.status !== 'Booked' && (
              <p>{rec.therapistName} recommends another <b>{rec.sessionType}</b> session for {rec.patientName}. Pick one date and time.</p>
            )}
          </div>
          <button ref={closeRef} className="rbm-close" onClick={onClose} disabled={busy} aria-label="Close"><CloseIcon /></button>
        </div>
        {content}
      </div>

      {rec && (
        <CheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          merchantName={`TherapyPro · ${rec.sessionType} session with ${rec.therapistName}`}
          amountCentavos={Math.round(fee * 100)}
          lineItems={[{ name: `Therapy Session (${rec.sessionType})`, qty: 1, unitCentavos: Math.round(fee * 100) }]}
          metadata={{
            booking_type: 'recommendation', recommendation_id: id, patient: rec.patientName, therapist: rec.therapistName,
            appointment_date: date || '', appointment_time: slot?.label || '',
          }}
          redirectSeconds={3}
          onSuccess={(meta) => { paidRef.current = meta }}
          onRedirect={() => book({ method: 'stripe', onlineMethod: paidRef.current?.method })}
        />
      )}
    </div>,
    document.body
  )
}
