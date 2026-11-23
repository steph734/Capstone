import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from './ui'
import { monthTitle, longDate } from './format'

const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const STATE_WORD = { available: 'available', booked: 'booked', closed: 'closed' }

// Always visible (no show / hide toggle). Dots: green = available, amber = booked, red = closed.
export default function SessionCalendar({ month, days, loading, error, selected, today, onSelect, onMonth, onToday, onRetry }) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <section className="ap-card ap-cal" aria-label="Session calendar">
      <div className="ap-cal-top">
        <div><h2>Session Calendar</h2><p>Tap a day to view appointments</p></div>
        <ul className="ap-legend" aria-label="Legend">
          <li><i className="dot available" aria-hidden="true" /> Available</li>
          <li><i className="dot booked" aria-hidden="true" /> Booked</li>
          <li><i className="dot closed" aria-hidden="true" /> Closed</li>
        </ul>
      </div>
      <div className="ap-cal-nav">
        <button type="button" className="ap-round" onClick={() => onMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /></button>
        <button type="button" className="ap-round" onClick={() => onMonth(1)} aria-label="Next month"><ChevronRight size={16} aria-hidden="true" /></button>
        <h3 aria-live="polite">{monthTitle(month)}</h3>
        <button type="button" className="ap-btn light sm" onClick={onToday}>Today</button>
      </div>
      {error && <p className="ap-inline-error" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p>}
      <div className="ap-grid" role="grid" aria-label={monthTitle(month)}>
        {WEEK.map((w) => <span key={w} className="ap-wd" role="columnheader">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const key = `${month}-${String(d).padStart(2, '0')}`
          const info = days?.[key]
          const state = info?.state || 'available'
          const count = info?.count || 0
          const label = `${longDate(key).replace(/, \d{4}$/, '')}, ${count} ${count === 1 ? 'appointment' : 'appointments'}, ${STATE_WORD[state]}`
          return (
            <button
              key={key} type="button" role="gridcell" aria-label={label} aria-pressed={selected === key} aria-current={today === key ? 'date' : undefined}
              className={`ap-day${selected === key ? ' sel' : ''}${today === key ? ' today' : ''}${key < today ? ' past' : ''}`} onClick={() => onSelect(key)}
            >
              <span className="n">{d}</span>
              {loading && !days ? <Skeleton h={6} w={6} r={3} /> : <i className={`dot ${state}`} aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
