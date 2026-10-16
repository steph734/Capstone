import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import CheckoutModal from '../components/CheckoutModal'
import { apiGet, apiPost } from '../utils/api'
import { manilaDateKey } from '../utils/manilaTime'
import './RecommendationBookingPage.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_DAYS_AHEAD = 60
const pad = (n) => String(n).padStart(2, '0')
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const longDate = (k) => new Date(`${k}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`

/**
 * /appointments/recommendation/:id — the parent's side of "Recommend another
 * session". Pick one date and time from the therapist's free slots, pay, and
 * the session is booked. The picked slot is held for 30 minutes while paying.
 */
export default function RecommendationBookingPage({ user, onLogout, betaTier }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [heldUntil, setHeldUntil] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const paidRef = useRef(null)
  const [done, setDone] = useState(null)

  // Load the recommendation (guardian only; the server answers 404 for anyone else).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGet(`/api/recommendations/${id}`)
      .then((d) => { if (!cancelled) setRec(d.recommendation) })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load this recommendation.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const loadSlots = useCallback((d) => {
    setSlots(null)
    setStart(null)
    apiGet(`/api/recommendations/${id}/slots?date=${d}`)
      .then((r) => setSlots(r.slots || []))
      .catch((e) => { setSlots([]); setError(e.message) })
  }, [id])

  useEffect(() => { if (date) { setError(''); setHeldUntil(null); loadSlots(date) } }, [date, loadSlots])

  // Countdown for the slot hold.
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
  const expired = rec && (rec.expired || rec.status === 'Expired')

  const book = async (payment) => {
    setBusy(true)
    setError('')
    try {
      const r = await apiPost(`/api/recommendations/${id}/book`, { date, start, note: note.trim(), payment })
      setDone(r)
    } catch (e) {
      setError(e.message || 'Could not book this session.')
      setHeldUntil(null)
      if (date) loadSlots(date)
    } finally {
      setBusy(false)
      setCheckoutOpen(false)
    }
  }

  // "Continue to payment": hold the slot first, then pay (online) or confirm (cash).
  const proceed = async () => {
    if (!date || !start || busy) return
    setBusy(true)
    setError('')
    try {
      const h = await apiPost(`/api/recommendations/${id}/hold`, { date, start })
      setHeldUntil(h.heldUntil)
      setNow(Date.now())
      setBusy(false)
      if (payMethod === 'cash') { await book({ method: 'cash' }); return }
      paidRef.current = null
      setCheckoutOpen(true)
    } catch (e) {
      setBusy(false)
      setError(e.message || 'Could not hold that time.')
      loadSlots(date)
    }
  }

  const shell = (children) => (
    <div className="rbp-layout">
      <PatientSidebar user={user} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} betaTier={betaTier} profilePath="/patient/profile" />
      <main className="rbp-main">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
        {children}
      </main>
    </div>
  )

  if (loading) return shell(<p className="rbp-muted">Loading…</p>)

  if (loadError || !rec) {
    return shell(
      <div className="rbp-card rbp-center">
        <h1>Recommendation not found</h1>
        <p className="rbp-muted">{loadError || 'This recommendation is not available for your account.'}</p>
        <button className="rbp-btn" onClick={() => navigate('/appointments')}>Go to appointments</button>
      </div>
    )
  }

  if (expired) {
    return shell(
      <div className="rbp-card rbp-center">
        <h1>This recommendation has expired</h1>
        <p className="rbp-muted">This recommendation has expired. Please message your therapist.</p>
        <button className="rbp-btn" onClick={() => navigate('/messages')}>Message your therapist</button>
      </div>
    )
  }

  if (rec.status === 'Booked' && !done) {
    return shell(
      <div className="rbp-card rbp-center">
        <h1>Already booked</h1>
        <p className="rbp-muted">The next session for {rec.patientName} has already been booked.</p>
        <button className="rbp-btn" onClick={() => navigate('/appointments')}>View appointments</button>
      </div>
    )
  }

  if (done) {
    return shell(
      <div className="rbp-card rbp-center">
        <div className="rbp-check" aria-hidden="true">✓</div>
        <h1>Next session booked</h1>
        <p className="rbp-muted">
          {rec.patientName}'s session with {done.therapistName || rec.therapistName} is set for <b>{longDate(done.date)}</b>, <b>{done.label}</b>.
          {done.status === 'Pending' ? ' It will be confirmed once your therapist accepts it; please pay at the clinic.' : ' It is confirmed.'}
        </p>
        {done.paymentRef && <p className="rbp-muted">Reference no. <b>{done.paymentRef}</b></p>}
        <button className="rbp-btn" onClick={() => navigate('/appointments')}>View appointments</button>
      </div>
    )
  }

  return shell(
    <>
      <div className="rbp-head">
        <h1>Set next therapy session</h1>
        <p className="rbp-muted">
          {rec.therapistName} recommends another <b>{rec.sessionType}</b> session for {rec.patientName}. Pick one date and time.
        </p>
        {rec.message && <blockquote className="rbp-quote">{rec.message}</blockquote>}
      </div>

      <div className="rbp-grid">
        <section className="rbp-card" aria-label="Pick a date and time">
          <div className="rbp-cal-nav">
            <button className="rbp-icon" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} aria-label="Previous month">‹</button>
            <strong>{MONTHS[view.m]} {view.y}</strong>
            <button className="rbp-icon" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} aria-label="Next month">›</button>
          </div>
          <div className="rbp-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="rbp-days">
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />
              const k = key(view.y, view.m, d)
              return (
                <button
                  key={k} type="button" disabled={disabledDay(k)}
                  className={`rbp-day${k === date ? ' on' : ''}${k === today ? ' today' : ''}`}
                  onClick={() => setDate(k)}
                  aria-pressed={k === date}
                >{d}</button>
              )
            })}
          </div>

          <h2 className="rbp-sub">{date ? `Available times · ${longDate(date)}` : 'Choose a date to see available times'}</h2>
          {date && slots === null && <p className="rbp-muted">Loading times…</p>}
          {date && slots && slots.length === 0 && <p className="rbp-muted">No free times on this day. Try another date.</p>}
          {date && slots && slots.length > 0 && (
            <div className="rbp-slots" role="radiogroup" aria-label="Available times">
              {slots.map((s) => (
                <button
                  key={s.start} type="button" role="radio" aria-checked={s.start === start}
                  className={`rbp-slot${s.start === start ? ' on' : ''}`}
                  onClick={() => { setStart(s.start); setHeldUntil(null) }}
                >{s.label}</button>
              ))}
            </div>
          )}
        </section>

        <aside className="rbp-card rbp-summary" aria-label="Session summary">
          <h2 className="rbp-sub">Summary</h2>
          <dl>
            <div><dt>Patient</dt><dd>{rec.patientName}</dd></div>
            <div><dt>Therapist</dt><dd>{rec.therapistName}</dd></div>
            <div><dt>Session</dt><dd>{rec.sessionType} · {rec.sessionMode} · {rec.durationMinutes} min</dd></div>
            <div><dt>Date</dt><dd>{date ? longDate(date) : '—'}</dd></div>
            <div><dt>Time</dt><dd>{slot ? slot.label : '—'}</dd></div>
            <div className="rbp-total"><dt>Total</dt><dd>{peso(fee)}</dd></div>
          </dl>

          <label className="rbp-note">
            <span>Note for your therapist (optional)</span>
            <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <fieldset className="rbp-pay">
            <legend>Payment</legend>
            <label><input type="radio" name="pay" checked={payMethod === 'online'} onChange={() => setPayMethod('online')} /> Pay online (card / GCash / Maya)</label>
            <label><input type="radio" name="pay" checked={payMethod === 'cash'} onChange={() => setPayMethod('cash')} /> Pay cash at the clinic</label>
          </fieldset>

          {heldUntil && holdLeft > 0 && <p className="rbp-hold">We're holding this time for you · {holdLabel}</p>}
          {error && <p className="rbp-error" role="alert">{error}</p>}

          <button className="rbp-btn rbp-cta" onClick={proceed} disabled={!date || !start || busy}>
            {busy ? 'Please wait…' : payMethod === 'cash' ? 'Confirm booking' : 'Continue to payment'}
          </button>
          <p className="rbp-fine">One session only. Your time is held for 30 minutes while you pay.</p>
        </aside>
      </div>

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
    </>
  )
}
