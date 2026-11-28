import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PaymentProofStep from './payments/PaymentProofStep'
import useDialogA11y from './payments/useDialogA11y'
import { flowApi } from '../utils/bookingFlowApi'
import { newKey } from '../utils/bookingPayments'
import { prepareForUpload } from '../utils/receiptImage'
import { validateReference } from '../../api/_lib/paymentProofRules'
import './GuardianBookings.css'

const day = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const fmt12 = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) ? `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` : '' }
const TONE = { confirmed: 'ok', completed: 'ok', payment_rejected: 'warn', declined: 'warn', cancelled: 'off' }
const left = (until, now) => {
  const ms = new Date(until).getTime() - now
  if (ms <= 0) return 'The hold has ended'
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000)
  return `Your slot is held for ${h ? `${h} h ` : ''}${m} min more`
}

function Upload({ booking, onClose, onSent }) {
  const [reference, setReference] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = useRef(newKey())
  const ref = useDialogA11y({ onEscape: onClose, locked: busy })
  const ready = validateReference(reference, booking.method).ok && file
  const send = async () => {
    setBusy(true); setError('')
    try { await flowApi.resubmit(booking.id, { reference, file: await prepareForUpload(file), key: key.current }); onSent() } catch (e) { setError(e.message); setBusy(false) }
  }
  const change = (set) => (v) => { set(v); setError(''); key.current = newKey() }
  return createPortal(
    <div className="gb-backdrop">
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Upload new receipt" tabIndex={-1} className="gb-modal [color-scheme:light]">
        <PaymentProofStep method={booking.method} reference={reference} onReference={change(setReference)} file={file} onFile={change(setFile)} error={error} />
        <div className="gb-actions">
          <button type="button" className="gb-btn light" onClick={onClose} disabled={busy}>Back</button>
          <button type="button" className="gb-btn" onClick={send} disabled={!ready || busy}>{busy ? 'Sending…' : 'Send new receipt'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// The guardian's bookings and where each one is in the approval flow.
export default function GuardianBookings() {
  const [items, setItems] = useState([])
  const [fixing, setFixing] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const load = useCallback(() => { flowApi.guardianBookings().then((d) => setItems(d.items)).catch((e) => console.warn('bookings:', e.message)) }, [])
  useEffect(() => {
    load()
    const id = setInterval(() => { setNow(Date.now()); load() }, 60000)
    window.addEventListener('focus', load)
    return () => { clearInterval(id); window.removeEventListener('focus', load) }
  }, [load])
  if (!items.length) return null
  return (
    <section className="gb" aria-label="My bookings">
      <h2>My bookings</h2>
      <ul>
        {items.map((b) => (
          <li key={b.id}>
            <div className="gb-main">
              <strong>{b.patientName} · {day(b.date)}, {fmt12(b.start)}</strong>
              <span>{b.therapistName}</span>
              {b.message && <p>{b.message}</p>}
              {b.holdUntil && <em>{left(b.holdUntil, now)}</em>}
            </div>
            <span className={`gb-pill ${TONE[b.stage] || 'wait'}`}>{b.label}</span>
            {b.stage === 'payment_rejected' && <button type="button" className="gb-btn" onClick={() => setFixing(b)}>Upload new receipt</button>}
          </li>
        ))}
      </ul>
      {fixing && <Upload booking={fixing} onClose={() => setFixing(null)} onSent={() => { setFixing(null); load() }} />}
    </section>
  )
}
