import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, Lock, X, AlertTriangle, PartyPopper } from 'lucide-react'
import ReceiptThumb from '../../../components/requests/ReceiptThumb'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { DECLINE_REASONS, PROBLEM_REASONS, NOTE_MAX, validateReject } from '../../../../api/_lib/requestReviewRules'
import { apptApi } from './api'
import { Avatar, Modal, Skeleton } from './ui'
import { ConfirmDialog, DoneDialog } from './ReviewDialogs'
import { peso, stamp } from './format'

const MIN_MESSAGE = 5
const sent = (out) => (out?.warning ? "The guardian's email could not be sent. You can resend it from the request." : 'The guardian was emailed.')

// "Requests to review": the list on the left, the selected request on the right.
//   Step 1  Check payment      Payment received (needs BOTH boxes ticked) | Payment not received
//   Step 2  Accept or decline  locked until step 1 is answered; Accept stays locked after "Payment not received"
// Every button first asks "are you sure?", saves on the SERVER (which re-checks the payment and the status), then says what happened.
export default function RequestsModal({ initialId, onClose, onChanged }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(initialId)
  const [ticks, setTicks] = useState({}) // id -> { amount, reference }
  const [flow, setFlow] = useState(null) // { kind: 'received'|'notReceived'|'accept'|'decline', stage: 'confirm'|'done', out? }
  const [busy, setBusy] = useState(false)
  const [flowError, setFlowError] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [probReason, setProbReason] = useState('amount_missing')
  const [probNote, setProbNote] = useState('')
  const [next, setNext] = useState('request_new_proof')
  useIdleBusy('review', busy) // never time the session out while a decision is being saved

  const load = useCallback(async () => {
    try { const d = await apptApi.requests(); setItems(d.items); setError('') } catch (e) { setError(e.message || 'Could not load the requests.') }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (items?.length && !items.some((r) => r.id === selected)) setSelected(items[0].id) }, [items, selected])
  useEffect(() => { setFlow(null); setReason(''); setMessage(''); setProbNote(''); setProbReason('amount_missing'); setNext('request_new_proof'); setFlowError('') }, [selected])
  useEffect(() => { // nothing left: say so, then close
    if (items && items.length === 0) { const t = setTimeout(onClose, 1500); return () => clearTimeout(t) }
    return undefined
  }, [items, onClose])

  const current = useMemo(() => items?.find((r) => r.id === selected) || null, [items, selected])
  const pay = current?.payment
  const verified = current ? (current.phase === 'decide' || pay?.state === 'verified') : false
  const waitingProof = current ? current.phase === 'waiting_proof' && !verified : false
  const needsCheck = current ? current.phase === 'check_payment' && !verified : false
  const t = ticks[selected] || {}

  const open = (kind) => { setFlowError(''); setFlow({ kind, stage: 'confirm' }) }
  const cancel = () => { if (!busy) { setFlow(null); setFlowError('') } }
  const run = async (kind, fn) => {
    setBusy(true); setFlowError('')
    try { const out = await fn(); setFlow({ kind, stage: 'done', out }) } catch (e) {
      setFlowError(e.message || 'That did not work. Please try again.')
      if (e.status === 409) load() // already decided (maybe in another tab): show the fresh list
    } finally { setBusy(false) }
  }
  // After the "done" dialog: take the finished request off the list and open the next one.
  const finish = () => {
    const idx = items.findIndex((r) => r.id === selected)
    const rest = items.filter((r) => r.id !== selected)
    setFlow(null); setItems(rest); setSelected(rest[Math.min(idx, rest.length - 1)]?.id); onChanged()
  }

  const confirmReceived = () => run('received', async () => {
    const out = await apptApi.verifyPayment(current.id)
    setItems((list) => list.map((r) => (r.id === current.id ? { ...r, phase: 'decide', payment: r.payment ? { ...r.payment, state: 'verified' } : r.payment } : r)))
    onChanged(); return out
  })
  const reject = validateReject({ reason: probReason, note: probNote, nextAction: next })
  const confirmNotReceived = () => run('notReceived', async () => {
    const out = await apptApi.rejectPayment(current.id, reject.value)
    if (out.nextAction !== 'decline_request') setItems((list) => list.map((r) => (r.id === current.id ? { ...r, phase: 'waiting_proof' } : r)))
    onChanged(); return out
  })
  const confirmAccept = () => run('accept', () => apptApi.accept(current.id))
  const msgOk = message.trim().length >= MIN_MESSAGE
  const confirmDecline = () => run('decline', () => apptApi.decline(current.id, { reason, message: message.trim() }))

  const pill = items?.length ? <span className="ap-amber-pill"><Clock size={13} aria-hidden="true" /> {items.length} {items.length === 1 ? 'needs' : 'need'} your response</span> : null
  const kind = flow?.kind; const stage = flow?.stage
  const peso$ = current ? peso(pay?.amount ?? current.amount) : ''

  return (
    <>
      <Modal title="Requests to review" titleExtra={pill} onClose={onClose} locked={busy} size="xl" labelId="ap-reqs-title" bodyClass="flush">
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

                <section className={`ap-step-card${verified ? ' ok' : waitingProof ? ' bad' : ''}`} aria-labelledby="ap-step1">
                  <h4 id="ap-step1"><span className="n">{verified ? <Check size={14} aria-hidden="true" /> : waitingProof ? <X size={14} aria-hidden="true" /> : 1}</span> {verified ? 'Payment confirmed' : waitingProof ? 'Payment not received' : 'Check payment'}</h4>
                  {needsCheck && (
                    <>
                      <label className="ap-check"><input type="checkbox" checked={Boolean(t.amount)} onChange={(e) => setTicks((s) => ({ ...s, [selected]: { ...t, amount: e.target.checked } }))} /> <span>Amount matches {peso$}</span></label>
                      <label className="ap-check"><input type="checkbox" checked={Boolean(t.reference)} onChange={(e) => setTicks((s) => ({ ...s, [selected]: { ...t, reference: e.target.checked } }))} /> <span>Reference number matches the proof</span></label>
                      <div className="ap-row-btns">
                        <button type="button" className="ap-btn green" disabled={!(t.amount && t.reference)} onClick={() => open('received')}><Check size={15} aria-hidden="true" /> Payment received</button>
                        <button type="button" className="ap-btn danger-light" onClick={() => open('notReceived')}><X size={15} aria-hidden="true" /> Payment not received</button>
                      </div>
                      {!(t.amount && t.reference) && <p className="ap-hint">Tick both boxes to enable “Payment received”.</p>}
                    </>
                  )}
                  {verified && <p className="ap-ok-text">{pay ? 'You confirmed this payment.' : 'There is no online payment to check.'}</p>}
                  {waitingProof && <p className="ap-bad-text">You asked the guardian for new proof. You can decline this request below.</p>}
                </section>

                <section className={`ap-step-card${!verified && !waitingProof ? ' locked' : ''}`} aria-labelledby="ap-step2">
                  <h4 id="ap-step2"><span className="n">{!verified && !waitingProof ? <Lock size={13} aria-hidden="true" /> : 2}</span> Accept or decline</h4>
                  {!verified && !waitingProof && <p className="ap-hint">Check the payment first. These buttons unlock afterwards.</p>}
                  <div className="ap-row-btns">
                    <button type="button" className="ap-btn primary" disabled={!verified} onClick={() => open('accept')}>Accept</button>
                    <button type="button" className="ap-btn danger-light" disabled={!verified && !waitingProof} onClick={() => { setReason(waitingProof ? 'payment_unverified' : ''); open('decline') }}>Decline</button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Payment received ── */}
      {current && kind === 'received' && stage === 'confirm' && (
        <ConfirmDialog title="Confirm payment received?" subtitle="Check these before you confirm." tone="green" confirmLabel="Yes, payment received" busy={busy} error={flowError} onConfirm={confirmReceived} onCancel={cancel}>
          <div className="ap-summary"><div><span>Patient</span><strong>{current.patientName}</strong></div><div><span>Method</span><strong>{pay?.methodLabel}</strong></div><div><span>Amount</span><strong>{peso$}</strong></div><div><span>Reference</span><strong>{pay?.referenceDisplay || 'Not given'}</strong></div></div>
          <p className="ap-check-done"><Check size={14} aria-hidden="true" /> Amount matches {peso$}</p>
          <p className="ap-check-done"><Check size={14} aria-hidden="true" /> Reference number matches the proof</p>
        </ConfirmDialog>
      )}
      {current && kind === 'received' && stage === 'done' && (
        <DoneDialog tone="ok" title="Payment confirmed" message={`You confirmed ${peso$} from ${current.patientName}. You can accept or decline the appointment now.`}
          primary={{ label: 'Accept appointment', onClick: () => { setFlow(null); open('accept') } }} secondary={{ label: 'Decide later', onClick: () => setFlow(null) }} onClose={() => setFlow(null)} />
      )}

      {/* ── Payment not received ── */}
      {current && kind === 'notReceived' && stage === 'confirm' && (
        <ConfirmDialog title="Payment not received?" subtitle="The guardian is told by email." tone="danger" confirmLabel="Yes, not received" busy={busy} disabled={!reject.ok} error={flowError} onConfirm={confirmNotReceived} onCancel={cancel}>
          <p className="ap-label">What went wrong?</p>
          {PROBLEM_REASONS.map((r) => <label key={r.code} className="ap-radio"><input type="radio" name="ap-prob" checked={probReason === r.code} onChange={() => setProbReason(r.code)} /> {r.label}</label>)}
          <label className="ap-label" htmlFor="ap-prob-note">Note for the guardian {probReason === 'other' ? <span className="req">*</span> : <span className="ap-muted">(optional)</span>}</label>
          <textarea id="ap-prob-note" className="ap-input" rows={2} maxLength={NOTE_MAX} value={probNote} onChange={(e) => setProbNote(e.target.value)} />
          {!reject.ok && reject.field === 'note' && <p className="ap-field-error" role="alert">{reject.message}</p>}
          <p className="ap-label">What should happen next?</p>
          <label className="ap-radio"><input type="radio" name="ap-next" checked={next === 'request_new_proof'} onChange={() => setNext('request_new_proof')} /> Ask the guardian for new proof</label>
          <label className="ap-radio"><input type="radio" name="ap-next" checked={next === 'decline_request'} onChange={() => setNext('decline_request')} /> Decline this request</label>
        </ConfirmDialog>
      )}
      {current && kind === 'notReceived' && stage === 'done' && (
        <DoneDialog tone={flow.out?.nextAction === 'decline_request' ? 'bad' : 'ask'} title="Payment not received"
          message={flow.out?.nextAction === 'decline_request' ? `${current.patientName}'s request was declined. ${sent(flow.out)}` : `The guardian was asked to send new proof. ${sent(flow.out)}`}
          warning={flow.out?.warning ? flow.out.warning.message || undefined : undefined}
          primary={{ label: 'Done', onClick: flow.out?.nextAction === 'decline_request' ? finish : () => setFlow(null) }} onClose={flow.out?.nextAction === 'decline_request' ? finish : () => setFlow(null)} />
      )}

      {/* ── Accept ── */}
      {current && kind === 'accept' && stage === 'confirm' && (
        <ConfirmDialog title="Accept this appointment?" subtitle="The guardian is emailed the confirmation." tone="primary" confirmLabel="Yes, accept" busy={busy} error={flowError} onConfirm={confirmAccept} onCancel={cancel}>
          <div className="ap-summary"><div><span>Patient</span><strong>{current.patientName}</strong></div><div><span>Date</span><strong>{current.dateLong}</strong></div><div><span>Time</span><strong>{current.timeLabel}</strong></div><div><span>Service</span><strong>{current.sessionType || 'Session'}</strong></div></div>
        </ConfirmDialog>
      )}
      {current && kind === 'accept' && stage === 'done' && (
        <DoneDialog tone="ok" title="Appointment accepted" message={`${current.patientName} is confirmed for ${current.dateTab}, ${current.timeLabel}. ${sent(flow.out)}`} primary={{ label: 'Done', onClick: finish }} onClose={finish} />
      )}

      {/* ── Decline ── */}
      {current && kind === 'decline' && stage === 'confirm' && (
        <ConfirmDialog title="Decline this appointment?" subtitle="The guardian is emailed with your reason." tone="danger" confirmLabel="Yes, decline" busy={busy} disabled={!reason || !msgOk} error={flowError} onConfirm={confirmDecline} onCancel={cancel}>
          <label className="ap-label" htmlFor="ap-dec-reason">Reason <span className="req">*</span></label>
          <select id="ap-dec-reason" className="ap-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {DECLINE_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <label className="ap-label" htmlFor="ap-dec-msg">Message to the guardian <span className="req">*</span></label>
          <textarea id="ap-dec-msg" className="ap-input" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="At least 5 characters" />
          {message.length > 0 && !msgOk && <p className="ap-field-error" role="alert">Write at least {MIN_MESSAGE} characters.</p>}
        </ConfirmDialog>
      )}
      {current && kind === 'decline' && stage === 'done' && (
        <DoneDialog tone="bad" title="Appointment declined" message={`${current.patientName}'s request was declined. ${sent(flow.out)}`} primary={{ label: 'Done', onClick: finish }} onClose={finish} />
      )}
    </>
  )
}
