import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, X, ShieldCheck, PartyPopper } from 'lucide-react'
import useIdleBusy from '../../../hooks/useIdleBusy'
import { flowApi } from '../../../utils/bookingFlowApi'
import { apptApi } from './api'
import { Avatar, Modal, Skeleton } from './ui'
import { ConfirmDialog, DoneDialog } from './ReviewDialogs'
import { peso, stamp, fmt12 } from './format'

// The therapist's day for the requested date, so a clash is easy to see.
function DaySchedule({ request }) {
  const [state, setState] = useState({ day: null, error: false })
  useEffect(() => {
    let live = true
    setState({ day: null, error: false })
    apptApi.day(request.date).then((day) => { if (live) setState({ day, error: false }) }).catch(() => { if (live) setState({ day: null, error: true }) })
    return () => { live = false }
  }, [request.date, request.id])
  const others = state.day?.appointments.filter((a) => a.id !== request.id) || []
  const clash = others.some((a) => a.start === request.start && a.status === 'Confirmed')
  return (
    <div>
      <h4 className="ap-schedule-title">Your schedule on {request.dateTab}</h4>
      {state.error ? <p className="ap-muted">Could not load your schedule.</p> : !state.day ? <Skeleton h={28} w="60%" /> : (
        <ul className="ap-schedule">
          <li className={clash ? 'busy' : 'free'}>{fmt12(request.start)} {clash ? 'already booked' : 'free'}</li>
          {others.map((a) => <li key={a.id}>{fmt12(a.start)} {a.patientName}{a.status === 'Pending' ? ' (request)' : ''}</li>)}
        </ul>
      )}
    </div>
  )
}

// "Request to review": the Owner already confirmed the payment, so the therapist only accepts or declines the time.
export default function RequestsModal({ initialId, onClose, onChanged }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(initialId)
  const [flow, setFlow] = useState(null) // { kind: 'accept'|'decline', stage: 'confirm'|'done' }
  const [busy, setBusy] = useState(false)
  const [flowError, setFlowError] = useState('')
  const [reason, setReason] = useState('')
  useIdleBusy('review', busy) // never time the session out while a decision is being saved

  const load = useCallback(async () => {
    try { const d = await apptApi.requests(); setItems(d.items.filter((r) => r.phase === 'awaiting_therapist')); setError('') } catch (e) { setError(e.message || 'Could not load the requests.') }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (items?.length && !items.some((r) => r.id === selected)) setSelected(items[0].id) }, [items, selected])
  useEffect(() => { setFlow(null); setReason(''); setFlowError('') }, [selected])
  useEffect(() => { // nothing left: say so, then close
    if (items && items.length === 0) { const t = setTimeout(onClose, 1500); return () => clearTimeout(t) }
    return undefined
  }, [items, onClose])

  const current = useMemo(() => items?.find((r) => r.id === selected) || null, [items, selected])
  const pay = current?.payment
  const open = (kind) => { setFlowError(''); setFlow({ kind, stage: 'confirm' }) }
  const cancel = () => { if (!busy) { setFlow(null); setFlowError('') } }
  const run = async (kind) => {
    setBusy(true); setFlowError('')
    try {
      const out = await flowApi.respond(current.id, kind, kind === 'decline' ? reason.trim() : undefined)
      setFlow({ kind, stage: 'done', out })
    } catch (e) {
      setFlowError(e.message || 'That did not work. Please try again.')
      if (e.status === 409) load() // already decided (maybe in another tab): show the fresh list
    } finally { setBusy(false) }
  }
  const finish = () => {
    const idx = items.findIndex((r) => r.id === selected)
    const rest = items.filter((r) => r.id !== selected)
    setFlow(null); setItems(rest); setSelected(rest[Math.min(idx, rest.length - 1)]?.id); onChanged()
  }

  const pill = items?.length ? <span className="ap-amber-pill"><Clock size={13} aria-hidden="true" /> {items.length} {items.length === 1 ? 'needs' : 'need'} your response</span> : null
  const kind = flow?.kind; const stage = flow?.stage

  return (
    <>
      <Modal title="Request to review" titleExtra={pill} onClose={onClose} locked={busy} size="xl" labelId="ap-reqs-title" bodyClass="flush">
        {items === null && !error ? (
          <div className="ap-reqm"><div className="ap-reqm-list"><Skeleton h={64} r={14} /></div><div className="ap-reqm-detail"><Skeleton h={200} r={14} /></div></div>
        ) : error && !items ? (
          <p className="ap-inline-error pad" role="alert">{error} <button type="button" className="ap-link" onClick={load}>Retry</button></p>
        ) : items.length === 0 ? (
          <div className="ap-empty"><PartyPopper size={34} aria-hidden="true" /><h3>All caught up</h3><p>No requests need your response right now.</p></div>
        ) : (
          <div className="ap-reqm">
            <ul className="ap-reqm-list" aria-label="Requests waiting for you">
              {items.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`ap-reqm-item${r.id === selected ? ' on' : ''}`} onClick={() => setSelected(r.id)} aria-current={r.id === selected}>
                    <Avatar id={r.id} name={r.patientName} size={38} />
                    <span className="t"><strong>{r.patientName}</strong><em>{r.dateTab} · {r.timeLabel}</em></span>
                    {r.amount != null && <b className="ap-money">{peso(r.amount)}</b>}
                  </button>
                </li>
              ))}
            </ul>
            {current && (
              <div className="ap-reqm-detail">
                <div className="ap-reqm-who"><Avatar id={current.id} name={current.patientName} size={52} /><div><h3>{current.patientName}</h3><p>{[current.condition, current.guardianName && `Guardian: ${current.guardianName}`].filter(Boolean).join(' · ')}</p></div>{pay && <span className="ap-verified"><ShieldCheck size={14} aria-hidden="true" /> Payment verified by Owner</span>}</div>
                <dl className="ap-facts">
                  <div><dt>Service</dt><dd>{current.sessionType || 'Session'}</dd></div>
                  <div><dt>Date</dt><dd>{current.dateLong}</dd></div>
                  <div><dt>Time</dt><dd>{current.timeLabel}</dd></div>
                  <div><dt>Branch</dt><dd>{current.clinic}</dd></div>
                  <div><dt>Fee</dt><dd>{current.amount != null ? peso(current.amount) : 'Pay at the clinic'}</dd></div>
                  <div><dt>Requested</dt><dd>{stamp(current.requestedAt)}</dd></div>
                </dl>
                {pay ? (
                  <div className="ap-paid-box">
                    <ShieldCheck size={26} aria-hidden="true" />
                    <div>
                      <strong>{pay.verifiedBy ? 'Owner confirmed this payment' : 'Payment confirmed'}</strong>
                      <span>{peso(pay.amount)} via {pay.methodLabel}{pay.referenceDisplay ? ` · Ref ${pay.referenceDisplay}` : ''}</span>
                      {pay.verifiedAt && <span>Verified {stamp(pay.verifiedAt)}{pay.verifiedBy ? ` by ${pay.verifiedBy}` : ''}</span>}
                    </div>
                    <em>Read only</em>
                  </div>
                ) : <p className="ap-muted">No online payment on this request (payment at the clinic).</p>}
                <DaySchedule request={current} />
                <div className="ap-answer">
                  <button type="button" className="ap-btn soft-orange" onClick={() => open('decline')}><X size={15} aria-hidden="true" /> Decline</button>
                  <span className="ap-muted">The guardian is notified when you accept</span>
                  <button type="button" className="ap-btn primary" onClick={() => open('accept')}><Check size={15} aria-hidden="true" /> Accept appointment</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {current && kind === 'accept' && stage === 'confirm' && (
        <ConfirmDialog title="Accept this appointment?" subtitle="The guardian is emailed the confirmation." tone="primary" confirmLabel="Yes, accept" busy={busy} error={flowError} onConfirm={() => run('accept')} onCancel={cancel}>
          <div className="ap-summary"><div><span>Patient</span><strong>{current.patientName}</strong></div><div><span>Date</span><strong>{current.dateLong}</strong></div><div><span>Time</span><strong>{current.timeLabel}</strong></div><div><span>Service</span><strong>{current.sessionType || 'Session'}</strong></div></div>
        </ConfirmDialog>
      )}
      {current && kind === 'accept' && stage === 'done' && (
        <DoneDialog tone="ok" title="Appointment accepted" message={`${current.patientName} is confirmed for ${current.dateTab}, ${current.timeLabel}.`} warning={flow.out?.warning?.message} primary={{ label: 'Done', onClick: finish }} onClose={finish} />
      )}
      {current && kind === 'decline' && stage === 'confirm' && (
        <ConfirmDialog title="Decline this appointment?" subtitle={pay ? 'The payment is marked for refund. The guardian and the Owner are told.' : 'The guardian and the Owner are told.'} tone="danger" confirmLabel="Yes, decline" busy={busy} error={flowError} onConfirm={() => run('decline')} onCancel={cancel}>
          <label className="ap-label" htmlFor="ap-dec-msg">Reason <span className="ap-muted">(optional)</span></label>
          <textarea id="ap-dec-msg" className="ap-input" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </ConfirmDialog>
      )}
      {current && kind === 'decline' && stage === 'done' && (
        <DoneDialog tone="bad" title="Appointment declined" message={`${current.patientName}'s request was declined.`} warning={flow.out?.warning?.message} primary={{ label: 'Done', onClick: finish }} onClose={finish} />
      )}
    </>
  )
}
