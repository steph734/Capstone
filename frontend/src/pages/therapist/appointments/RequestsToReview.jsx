import { useRef } from 'react'
import { Clock, CalendarDays, MapPin, ChevronRight, ShieldCheck, Lock, Info } from 'lucide-react'
import { Avatar, Skeleton } from './ui'
import { peso, stamp } from './format'

// Requests on the therapist's page. Verified ones can be answered; the others only say they are waiting for the Owner.
export default function RequestsToReview({ data, loading, error, onOpen, onRetry }) {
  const seeAll = useRef(null)
  if (loading && !data) return <section className="ap-reqs" aria-busy="true"><div className="ap-reqs-head"><h2>Requests to review</h2></div><div className="ap-card"><Skeleton h={70} r={12} /></div></section>
  if (error && !data) return <section className="ap-reqs"><p className="ap-inline-error" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p></section>
  if (!data || (data.total === 0 && !data.waitingOwner)) return null // nothing waiting: the whole section stays out of the way
  const ready = data.items.filter((r) => r.phase === 'awaiting_therapist')
  const waiting = data.items.filter((r) => r.phase === 'waiting_owner')
  const row = (r, canReview) => (
    <li key={r.id} className="ap-req">
      <Avatar id={r.id} name={r.patientName} size={46} />
      <div className="ap-req-main">
        <div className="ap-req-line"><strong>{r.patientName}</strong>
          {canReview
            ? <span className="ap-verified"><ShieldCheck size={13} aria-hidden="true" /> {r.payment ? 'Payment verified by Owner' : 'Pay at the clinic'}</span>
            : <span className="ap-waiting"><Lock size={12} aria-hidden="true" /> Waiting for Owner payment check</span>}
        </div>
        <p className="ap-req-sub">{[r.condition, r.guardianName && `Guardian: ${r.guardianName}`].filter(Boolean).join(' · ')}</p>
        <p className="ap-req-meta">
          <span><CalendarDays size={13} aria-hidden="true" /> {r.dateTab}</span>
          <span><Clock size={13} aria-hidden="true" /> {r.timeLabel}</span>
          <span><MapPin size={13} aria-hidden="true" /> {r.clinic}{r.sessionType ? ` · ${r.sessionType}` : ''}</span>
        </p>
      </div>
      <div className="ap-req-side">
        {r.amount != null && <strong className="ap-money">{peso(r.amount)}</strong>}
        <span>Requested {stamp(r.requestedAt)}</span>
      </div>
      {canReview
        ? <button type="button" className="ap-btn primary" onClick={(e) => onOpen(r.id, e.currentTarget)}>Review <ChevronRight size={15} aria-hidden="true" /></button>
        : <button type="button" className="ap-btn light" disabled>Not ready yet</button>}
    </li>
  )
  return (
    <section className="ap-reqs" aria-label="Requests to review">
      <div className="ap-reqs-head">
        <h2>Requests to review</h2>
        <span className="ap-amber-pill"><Clock size={13} aria-hidden="true" /> {data.total} {data.total === 1 ? 'needs' : 'need'} your response</span>
        <span className="ap-waiting">{data.waitingOwner || 0} waiting for Owner</span>
        {data.total > ready.length && <button ref={seeAll} type="button" className="ap-seeall" onClick={(e) => onOpen(null, e.currentTarget)}>See all {data.total} <ChevronRight size={15} aria-hidden="true" /></button>}
      </div>
      {ready.length > 0 && <ul className="ap-card ap-req-list">{ready.map((r) => row(r, true))}</ul>}
      {waiting.length > 0 && (
        <>
          <h3 className="ap-waiting-title">Waiting for Owner payment check</h3>
          <ul className="ap-card ap-req-list">{waiting.map((r) => row(r, false))}</ul>
        </>
      )}
      <p className="ap-flow-note"><Info size={15} aria-hidden="true" /> The Owner checks each payment first. The request then shows up here for you to accept or decline.</p>
    </section>
  )
}
