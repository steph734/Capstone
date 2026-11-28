import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Info, RefreshCw, ShieldCheck, X } from 'lucide-react'
import ReceiptThumb from '../../components/requests/ReceiptThumb'
import useDialogA11y from '../../components/payments/useDialogA11y'
import { flowApi } from '../../utils/bookingFlowApi'
import { OWNER_REJECT_REASONS, REJECT_HOLD_HOURS, REJECT_MESSAGE_MAX, pesoFromCentavos, validateOwnerReject } from '../../../api/_lib/bookingFlowRules'
import './PaymentCheck.css'

const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) : '')
const fmt12 = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) ? `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` : '' }
const stamp = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not given')
const clock = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '')
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const Face = ({ name }) => <span className="pcq-face" aria-hidden="true">{initials(name)}</span>

// The "Payments to verify" panel above the appointments table.
export function PaymentQueuePanel({ items, onReview }) {
  if (!items.length) return null
  return (
    <section className="pcq-panel" aria-label="Payments to verify">
      <header>
        <ShieldCheck size={20} aria-hidden="true" />
        <h2>Payments to verify</h2>
        <span className="pcq-count">{items.length} {items.length === 1 ? 'needs' : 'need'} your check</span>
        <p>After you confirm a payment, the therapist is asked to accept the booking.</p>
      </header>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <Face name={r.patientName} />
            <span className="pcq-who"><strong>{r.patientName}</strong><em>{day(r.date)} · {fmt12(r.start)}</em></span>
            <span className="pcq-service">{r.service}</span>
            <span className="pcq-who"><strong>{r.proof.methodLabel}</strong><em>Paid {clock(r.proof.paidAt)}</em></span>
            <b className="pcq-money">{pesoFromCentavos(r.proof.amountCentavos)}</b>
            <span className="pcq-flag">● Check payment</span>
            <button type="button" className="pcq-btn primary" onClick={() => onReview(r.id)}>Review payment <ChevronRight size={16} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Dialog({ labelId, onClose, locked, size = '', children }) {
  const ref = useDialogA11y({ onEscape: onClose, locked })
  return createPortal(
    <div className="pcq-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose() }}>
      <div ref={ref} className={`pcq-modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>{children}</div>
    </div>,
    document.body,
  )
}

// "Payment is not correct": reason chips and the message the guardian will read.
function RejectForm({ item, busy, error, onBack, onSend }) {
  const fee = pesoFromCentavos(item.feeCentavos)
  const [reason, setReason] = useState(item.proof.amountCentavos < item.feeCentavos ? 'amount_less' : 'receipt_unclear')
  const [message, setMessage] = useState(() => OWNER_REJECT_REASONS.find((r) => r.code === reason).message(fee))
  const valid = validateOwnerReject({ reason, message })
  const pick = (r) => { setReason(r.code); setMessage(r.message(fee)) }
  return (
    <div className="pcq-reject">
      <div className="pcq-reject-head">
        <span className="pcq-ico"><Info size={22} aria-hidden="true" /></span>
        <div><h2 id="pcq-title">Payment is not correct</h2><p>{item.patientName} · {day(item.date)} · {pesoFromCentavos(item.proof.amountCentavos)} · {item.proof.methodLabel}</p></div>
      </div>
      <span className="pcq-label" id="pcq-reason">Reason</span>
      <div className="pcq-chips" role="radiogroup" aria-labelledby="pcq-reason">
        {OWNER_REJECT_REASONS.map((r) => <button key={r.code} type="button" role="radio" aria-checked={reason === r.code} className={reason === r.code ? 'on' : ''} onClick={() => pick(r)}>{r.label}</button>)}
      </div>
      <label className="pcq-label" htmlFor="pcq-msg">Message to the guardian</label>
      <textarea id="pcq-msg" rows={4} maxLength={REJECT_MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} />
      <p className="pcq-note"><RefreshCw size={15} aria-hidden="true" /> <span>The guardian is notified and can upload a new receipt. The time slot is held for <b>{REJECT_HOLD_HOURS} hours</b>. The therapist is not asked to respond while payment is being fixed.</span></p>
      {(error || (!valid.ok && reason === 'other')) && <p className="pcq-error" role="alert">{error || valid.error}</p>}
      <div className="pcq-actions end">
        <button type="button" className="pcq-btn" onClick={onBack} disabled={busy}>Back</button>
        <button type="button" className="pcq-btn soft" onClick={() => onSend(reason, message)} disabled={busy || !valid.ok}>{busy ? 'Sending…' : 'Send back to guardian'}</button>
      </div>
    </div>
  )
}

// "Verify payment": every pending payment on the left, the selected one on the right.
export function VerifyPaymentModal({ items, initialId, onClose, onDone, showToast }) {
  const [selected, setSelected] = useState(initialId)
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const item = items.find((r) => r.id === selected) || items[0]

  const act = async (fn, toast) => {
    setBusy(true); setError('')
    try {
      await fn()
      const i = items.findIndex((r) => r.id === item.id)
      const rest = items.filter((r) => r.id !== item.id)
      setRejecting(false); setSelected(rest[Math.min(i, rest.length - 1)]?.id)
      showToast(toast)
      onDone(item.id, rest.length)
    } catch (e) {
      setError(e.message || 'That did not work. Please try again.')
      if (e.code === 'ALREADY_DECIDED') onDone(null, items.length)
    } finally { setBusy(false) }
  }

  if (!item) return null
  if (rejecting) {
    return (
      <Dialog labelId="pcq-title" onClose={() => setRejecting(false)} locked={busy}>
        <RejectForm key={item.id} item={item} busy={busy} error={error} onBack={() => { setRejecting(false); setError('') }}
          onSend={(reason, message) => act(() => flowApi.reject(item.id, reason, message), `Sent back to ${item.patientName}'s guardian.`)} />
      </Dialog>
    )
  }
  return (
    <Dialog labelId="pcq-title" onClose={onClose} locked={busy} size="wide">
      <header className="pcq-head"><h2 id="pcq-title">Verify payment</h2><button type="button" className="pcq-x" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} aria-hidden="true" /></button></header>
      <div className="pcq-body">
        <ul className="pcq-list" aria-label="Pending payments">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" className={r.id === item.id ? 'on' : ''} aria-current={r.id === item.id} onClick={() => { setSelected(r.id); setError('') }}>
                <Face name={r.patientName} />
                <span className="pcq-who"><strong>{r.patientName}</strong><em>{day(r.date)} · {fmt12(r.start)}</em></span>
                <b className="pcq-money">{pesoFromCentavos(r.proof.amountCentavos)}</b>
              </button>
            </li>
          ))}
        </ul>
        <div className="pcq-detail">
          <dl className="pcq-facts">
            {[['Patient', item.patientName], ['Guardian', item.guardianName || '—'], ['Service', item.service], ['Therapist', item.therapistName || '—'], ['Branch', item.branch], ['Date', day(item.date)], ['Time', `${fmt12(item.start)} – ${fmt12(item.end)}`], ['Requested', stamp(item.requestedAt)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className="pcq-proof">
            <ReceiptThumb key={item.proof.attemptId} url={item.proof.receiptUrl} title={`${item.patientName} receipt`} />
            <dl className="pcq-facts">
              {[['Method', item.proof.methodLabel], ['Reference', item.proof.referenceNo || 'Not given'], ['Amount sent', pesoFromCentavos(item.proof.amountCentavos)], ['Paid', stamp(item.proof.paidAt)]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
          <h3 className="pcq-label">Owner checklist</h3>
          <ul className="pcq-checks">
            {item.checks.map((c) => <li key={c.id} className={c.ok ? 'ok' : 'warn'}>{c.ok ? <Check size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}<span>{c.label}<span className="pcq-sr">{c.ok ? ' (passed)' : ' (please check)'}</span></span></li>)}
          </ul>
          {error && <p className="pcq-error" role="alert">{error}</p>}
          <div className="pcq-actions">
            <button type="button" className="pcq-btn soft" onClick={() => { setRejecting(true); setError('') }} disabled={busy}>Payment is not correct</button>
            <button type="button" className="pcq-btn primary" disabled={busy} onClick={() => act(() => flowApi.verify(item.id), `Payment confirmed. ${item.therapistName || 'The therapist'} was asked to accept.`)}>{busy ? 'Saving…' : 'Payment is correct, send to therapist'}</button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
