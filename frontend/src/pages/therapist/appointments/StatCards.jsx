import { CalendarDays, ClipboardList, Hourglass, CheckCircle2, Archive } from 'lucide-react'
import { Skeleton } from './ui'

const CARDS = [
  { key: 'today', label: 'Today', Icon: CalendarDays, tone: 'violet' },
  { key: 'scheduled', label: 'Scheduled', Icon: ClipboardList, tone: 'blue' },
  { key: 'needsResponse', label: 'Needs response', Icon: Hourglass, tone: 'amber' },
  { key: 'completed', label: 'Completed', Icon: CheckCircle2, tone: 'green' },
  { key: 'archived', label: 'Archived', Icon: Archive, tone: 'red' },
]

export default function StatCards({ summary, error, onRetry }) {
  return (
    <section className="ap-stats" aria-label="Appointment totals">
      {CARDS.map(({ key, label, Icon, tone }) => (
        <div className="ap-stat" key={key}>
          <span className={`ap-stat-ico ${tone}`}><Icon size={20} aria-hidden="true" /></span>
          <div className="ap-stat-body">
            {summary ? <strong>{summary[key]}</strong> : <Skeleton h={26} w={36} />}
            <span className="ap-stat-label">{label}</span>
          </div>
        </div>
      ))}
      {error && !summary && <p className="ap-inline-error" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p>}
    </section>
  )
}
