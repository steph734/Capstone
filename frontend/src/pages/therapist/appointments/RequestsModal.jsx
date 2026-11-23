import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, Lock, X, AlertTriangle, Loader2, PartyPopper } from 'lucide-react'
import ReceiptThumb from '../../../components/requests/ReceiptThumb'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { DECLINE_REASONS } from '../../../../api/_lib/requestReviewRules'
import { apptApi } from './api'
import { Avatar, Modal, Skeleton } from './ui'
import { peso, stamp } from './format'

const MIN_MESSAGE = 5

// "Requests to review": the list on the left, the selected request on the right.
//   Step 1  Check payment   (Payment received needs BOTH boxes ticked; Payment not received is always possible)
//   Step 2  Accept or decline (locked until step 1 is answered; Accept stays locked after "Payment not received")
// Every decision is made by the SERVER (it re-checks the payment and the status); this screen only reflects what it said.
export default function RequestsModal({ initialId, onClose, onChanged, showToast }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(initialId)
  const [ticks, setTicks] = useState({}) // id -> { amount, reference }
  const [notReceived, setNotReceived] = useState({}) // id -> true (the therapist said the money did not arrive)
  const [busy, setBusy] = useState('') // '' | 'verify' | 'accept' | 'decline'
  const [confirm, setConfirm] = useState('') // '' | 'accept' | 'decline'
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  useIdleBusy('review', Boolean(busy)) // never time the session out while a decision is being saved

  const load = useCallback(async () => {
    try { const d = await apptApi.requests(); setItems(d.items); setError('') } catch (e) { setError(e.message || 'Could not load the requests.') }
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => { // keep a valid selection
    if (!items || !items.length) return
    if (!items.some((r) => r.id === selected)) setSelected(items[0].id)
  }, [items, selected])
  useEffect(() => { setConfirm(''); setReason(''); setMessage(''); setActionError('') }, [selected])
  useEffect(() => { // nothing left: say so, then close
    if (items && items.length === 0) { const t = setTimeout(onClose, 1500); return () => clearTimeout(t) }
    return undefined
  }, [items, onClose])

  const current = useMemo(() => items?.find((r) => r.id === selected) || null, [items, selected])
  const pay = current?.payment
  const verified = current ? (current.phase === 'decide' || pay?.state === 'verified') : false
  const declinedPay = current ? (notReceived[current.id] || current.phase === 'waiting_proof') && !verified : false
  const needsCheck = current ? current.phase === 'check_payment' && !verified && !declinedPay : false
  const t = ticks[selected] || {}

  const removeCurrent = (text) => {
    const idx = items.findIndex((r) => r.id === selected)
    const next = items.filter((r) => r.id !== selected)
    setItems(next)
    setSelected(next[Math.min(idx, next.length - 1)]?.id)
    showToast(text)
    onChanged()
  }
  const run = async (name, fn) => {
    setBusy(name); setActionError('')
    try { await fn() } catch (e) {
      setActionError(e.message || 'That did not work. Please try again.')
      if (e.status === 409) load() // somebody (or another tab) already decided: show the fresh list
    } finally { setBusy('') }
  }

  const received = () => run('verify', async () => {
    await apptApi.verifyPayment(current.id)
    setItems((list) => list.map((r) => (r.id === current.id ? { ...r, phase: 'decide', payment: r.payment ? { ...r.payment, state: 'verified' } : r.payment } : r)))
    setNotReceived((n) => ({ ...n, [current.id]: false }))
    onChanged()
  })
  const accept = () => run('accept', async () => {
    const out = await apptApi.accept(current.id)
    setConfirm(''); removeCurrent(out.warning ? "Appointment accepted, but the email couldn't be sent." : 'Appointment accepted. The guardian was emailed.')
  })
  const msgOk = message.trim().length >= MIN_MESSAGE
  const decline = () => run('decline', async () => {
    const out = await apptApi.decline(current.id, { reason, message: message.trim() })
    setConfirm(''); removeCurrent(out.warning ? "Appointment declined, but the email couldn't be sent." : 'Appointment declined. The guardian was emailed.')
  })

  const pill = items?.length ? <span className="ap-amber-pill"><Clock size={13} aria-hidden="true" /> {items.length} {items.length === 1 ? 'needs' : 'need'} your response</span> : null
  return (
    <Modal title="Requests to review" titleExtra={pill} onClose={onClose} locked={Boolean(busy)} size="xl" labelId="ap-reqs-title" bodyClass="flush">
      {items === null && !error ? (
        <div className="ap-reqm"><div className="ap-reqm-list"><Skeleton h={64} r={14} /><Skeleton h={64} r={14} /></div><div className="ap-reqm-detail"><Skeleton h={200} r={14} /></div></div>
      ) : error && !items ? (
        <p className="ap-inline-error pad" role="alert">{error} <button type="button" className="ap-link" onClick={load}>Retry</button></p>
      ) : items.length === 0 ? (
        <div className="ap-empty"><PartyPopper size={34} aria-hidden="true" /><h3>All caught up</h3><p>No requests need your response right now.</p></div>
      ) : (
        <div className="ap-reqm">
          <ul className="ap-reqm-list" aria-label="Pending requests">
            {items.map((r) => (
              <li key={r.id}>
                <button type="button" className={`ap-reqm-item${r.id === selected ? ' on' : ''}`} onClick={() => setSelected(r.id)} aria-current={r.id === selected}>
                  <Avatar id={r.id} name={r.patientName} size={38} />
                  <span className="t"><strong>{r.patientName}</strong><em>{r.dateTab} · {r.timeLabel}</em><em>{r.clinic}{r.sessionType ? ` · ${r.sessionType}` : ''}</em></span>
                  {r.amount != null && <b className="ap-money">{peso(r.amount)}</b>}
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <div className="ap-reqm-detail">
              <div className="ap-reqm-who"><Avatar id={current.id} name={current.patientName} size={52} /><div><h3>{current.patientName}</h3><p>{[current.condition, current.guardianName && `Guardian: ${current.guardianName}`].filter(Boolean).join(' · ')}</p></div>{current.amount != null && <strong className="ap-money big">{peso(current.amount)}</strong>}</div>
              <dl className="ap-facts">
                <div><dt>Service</dt><dd>{current.sessionType || 'Session'}</dd></div>
                <div><dt>Date</dt><dd>{current.dateLong}</dd></div>
                <div><dt>Time</dt><dd>{current.timeLabel}</dd></div>
                <div><dt>Branch</dt><dd>{current.clinic}</dd></div>
                <div><dt>Fee</dt><dd>{current.amount != null ? peso(current.amount) : 'Pay at the clinic'}</dd></div>
                <div><dt>Requested</dt><dd>{stamp(current.requestedAt)}</dd></div>
              </dl>

              <div className="ap-proof">
                <h4>Payment proof</h4>
                {pay ? (
                  <div className="ap-proof-row">
                    <ReceiptThumb url={pay.receiptUrl} title={`${current.patientName} receipt`} />
                    <dl className="ap-facts tight">
                      <div><dt>Method</dt><dd>{pay.methodLabel}</dd></div>
                      <div><dt>Reference</dt><dd>{pay.referenceDisplay || 'Not given'}</dd></div>
                      <div><dt>Amount</dt><dd>{peso(pay.amount)}</dd></div>
                      <div><dt>Paid</dt><dd>{stamp(pay.submittedAt) || 'Not given'}</dd></div>
                    </dl>
                  </div>
                ) : <p className="ap-muted">No online payment on this request (payment at the clinic).</p>}
                {pay?.referenceReused && <p className="ap-warn"><AlertTriangle size={14} aria-hidden="true" /> This reference number was used on another booking.</p>}
              </div>

              <section className={`ap-step-card${verified ? ' ok' : declinedPay ? ' bad' : ''}`} aria-labelledby="ap-step1">
                <h4 id="ap-step1"><span className="n">{verified ? <Check size={14} aria-hidden="true" /> : declinedPay ? <X size={14} aria-hidden="true" /> : 1}</span> {verified ? 'Payment confirmed' : declinedPay ? 'Payment not received' : 'Check payment'}</h4>
                {needsCheck && (
                  <>
                    <label className="ap-check"><input type="checkbox" checked={Boolean(t.amount)} onChange={(e) => setTicks((s) => ({ ...s, [selected]: { ...t, amount: e.target.checked } }))} /> Amount matches {peso(pay?.amount ?? current.amount)}</label>
                    <label className="ap-check"><input type="checkbox" checked={Boolean(t.reference)} onChange={(e) => setTicks((s) => ({ ...s, [selected]: { ...t, reference: e.target.checked } }))} /> Reference number matches the proof</label>
                    <div className="ap-row-btns">
                      <button type="button" className="ap-btn green" disabled={!(t.amount && t.reference) || busy === 'verify'} onClick={received}>{busy === 'verify' ? <Loader2 size={15} className="ap-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Payment received</button>
                      <button type="button" className="ap-btn danger-light" disabled={Boolean(busy)} onClick={() => setNotReceived((n) => ({ ...n, [current.id]: true }))}><X size={15} aria-hidden="true" /> Payment not received</button>
                    </div>
                    {!(t.amount && t.reference) && <p className="ap-hint">Tick both boxes to enable “Payment received”.</p>}
                  </>
                )}
                {verified && <p className="ap-ok-text">{pay ? 'You confirmed this payment.' : 'There is no online payment to check.'}</p>}
                {declinedPay && <p className="ap-bad-text">{current.phase === 'waiting_proof' ? 'You asked for new proof and are waiting for the guardian.' : 'You can decline this request below.'}</p>}
              </section>

              <section className={`ap-step-card${!verified && !declinedPay ? ' locked' : ''}`} aria-labelledby="ap-step2">
                <h4 id="ap-step2"><span className="n">{!verified && !declinedPay ? <Lock size={13} aria-hidden="true" /> : 2}</span> Accept or decline</h4>
                {!verified && !declinedPay && <p className="ap-hint">Check the payment first. These buttons unlock afterwards.</p>}
                {confirm === '' && (
                  <div className="ap-row-btns">
                    <button type="button" className="ap-btn primary" disabled={!verified || Boolean(busy)} onClick={() => setConfirm('accept')}>Accept</button>
                    <button type="button" className="ap-btn danger-light" disabled={(!verified && !declinedPay) || Boolean(busy)} onClick={() => { setConfirm('decline'); if (declinedPay) setReason('payment_unverified') }}>Decline</button>
                  </div>
                )}
                {confirm === 'accept' && (
                  <div className="ap-confirm">
                    <p><strong>Accept this appointment?</strong> {current.patientName} will be confirmed for {current.dateTab}, {current.timeLabel}, and the guardian is emailed.</p>
                    <div className="ap-row-btns"><button type="button" className="ap-btn light" disabled={busy === 'accept'} onClick={() => setConfirm('')}>Back</button><button type="button" className="ap-btn primary" disabled={busy === 'accept'} onClick={accept}>{busy === 'accept' && <Loader2 size={15} className="ap-spin" aria-hidden="true" />} Yes, accept</button></div>
                  </div>
                )}
                {confirm === 'decline' && (
                  <div className="ap-confirm">
                    <p><strong>Decline this appointment?</strong> The guardian is emailed with your reason.</p>
                    <label className="ap-label" htmlFor="ap-dec-reason">Reason <span className="req">*</span></label>
                    <select id="ap-dec-reason" className="ap-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">Choose a reason</option>
                      {DECLINE_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                    <label className="ap-label" htmlFor="ap-dec-msg">Message to the guardian <span className="req">*</span></label>
                    <textarea id="ap-dec-msg" className="ap-input" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="At least 5 characters" />
                    {message.length > 0 && !msgOk && <p className="ap-field-error" role="alert">Write at least {MIN_MESSAGE} characters.</p>}
                    <div className="ap-row-btns"><button type="button" className="ap-btn light" disabled={busy === 'decline'} onClick={() => setConfirm('')}>Back</button><button type="button" className="ap-btn danger" disabled={!reason || !msgOk || busy === 'decline'} onClick={decline}>{busy === 'decline' && <Loader2 size={15} className="ap-spin" aria-hidden="true" />} Yes, decline</button></div>
                  </div>
                )}
              </section>
              {actionError && <p className="ap-inline-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {actionError}</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
