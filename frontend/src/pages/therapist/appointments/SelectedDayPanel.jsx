import { CalendarOff } from 'lucide-react'
import { Skeleton } from './ui'
import { shortDay, timeRange } from './format'

const BAR = { Confirmed: 'amber', Pending: 'amber', Completed: 'blue' }

// The chosen day: its appointments and the slots still open. Read-only on purpose: new bookings are made from "New appointment".
export default function SelectedDayPanel({ date, data, loading, error, onView, onRetry }) {
  const appts = data?.appointments || []
  const slots = data?.openSlots || []
  const bits = [`${appts.length} ${appts.length === 1 ? 'appointment' : 'appointments'}`, `${slots.length} ${slots.length === 1 ? 'slot' : 'slots'} open`]
  return (
    <section className="ap-card ap-day-panel" aria-label="Selected day" aria-live="polite">
      <p className="ap-kicker">Selected day</p>
      <h2>{shortDay(date).replace(',', ',')}</h2>
      {data && <p className="ap-sub">{bits.join(' · ')}{data.closed ? ' · Closed' : ''}</p>}
      {error && <p className="ap-inline-error" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p>}
      {loading && !data ? (
        <div className="ap-day-list"><Skeleton h={56} r={14} /><Skeleton h={56} r={14} /></div>
      ) : data && appts.length === 0 && slots.length === 0 ? (
        <div className="ap-empty small"><CalendarOff size={26} aria-hidden="true" /><p>No appointments on this day</p></div>
      ) : (
        <ul className="ap-day-list">
          {appts.map((a) => (
            <li key={a.id}>
              <button type="button" className={`ap-day-row ${BAR[a.status] || 'amber'}`} onClick={() => onView(a.id)}>
                <span className="bar" aria-hidden="true" />
                <span className="who"><strong>{a.patientName}</strong><em>{a.branch} · {a.service}</em></span>
                <span className="when">{timeRange(a.start, a.end)}</span>
              </button>
            </li>
          ))}
          {slots.map((s) => (
            <li key={s.start}>
              <div className="ap-day-row open"><span className="bar" aria-hidden="true" /><span className="who"><strong>Open slot</strong></span><span className="when">{timeRange(s.start, s.end)}</span></div>
            </li>
          ))}
        </ul>
      )}
      {data && appts.length === 0 && slots.length > 0 && <p className="ap-hint">No appointments on this day</p>}
    </section>
  )
}
