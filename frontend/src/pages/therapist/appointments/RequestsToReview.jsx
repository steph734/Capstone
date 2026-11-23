import { useRef } from 'react'
import { Clock, CalendarDays, MapPin, ChevronRight } from 'lucide-react'
import { Avatar, Skeleton } from './ui'
import { peso, stamp } from './format'

// The first two requests as compact rows. "See all" and "Review" open the same modal (RequestsModal).
export default function RequestsToReview({ data, loading, error, onOpen, onRetry }) {
  const seeAll = useRef(null)
  if (loading && !data) return <section className="ap-reqs" aria-busy="true"><div className="ap-reqs-head"><h2>Requests to review</h2></div><div className="ap-card"><Skeleton h={70} r={12} /></div></section>
  if (error && !data) return <section className="ap-reqs"><p className="ap-inline-error" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p></section>
  if (!data || data.total === 0) return null // nothing waiting: the whole section stays out of the way
  return (
    <section className="ap-reqs" aria-label="Requests to review">
      <div className="ap-reqs-head">
        <h2>Requests to review</h2>
        <span className="ap-amber-pill"><Clock size={13} aria-hidden="true" /> {data.total} {data.total === 1 ? 'needs' : 'need'} your response</span>
        <button ref={seeAll} type="button" className="ap-seeall" onClick={(e) => onOpen(null, e.currentTarget)}>See all {data.total} <ChevronRight size={15} aria-hidden="true" /></button>
      </div>
      <ul className="ap-card ap-req-list">
        {data.items.map((r) => (
          <li key={r.id} className="ap-req">
            <Avatar id={r.id} name={r.patientName} size={46} />
            <div className="ap-req-main">
              <div className="ap-req-line"><strong>{r.patientName}</strong><span className="ap-amber-pill soft"><i aria-hidden="true" /> Needs your response</span>
                {r.phase === 'check_payment' && <span className="ap-step"><Clock size={12} aria-hidden="true" /> Check payment</span>}
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
            <button type="button" className="ap-btn primary" onClick={(e) => onOpen(r.id, e.currentTarget)}>Review <ChevronRight size={15} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
