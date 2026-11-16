import { formatAge } from './ticketConfig'

// The four summary cards. Computed on the server over every ticket, so filters never change them.
export default function TicketStatsRow({ stats }) {
  const cards = [
    { icon: '📬', tone: 'amber', value: stats?.openCount, label: 'Open tickets' },
    { icon: '⏳', tone: 'rose', value: stats && formatAge(stats.oldestOpenMs), label: 'Oldest open' },
    { icon: '✓', tone: 'green', value: stats?.resolvedCount, label: 'Resolved' },
    { icon: '🕒', tone: 'blue', value: stats && formatAge(stats.averageAgeMs, { decimals: 1 }), label: 'Average age' },
  ]
  return (
    <div className="tk-stats" aria-label="Ticket summary">
      {cards.map((c) => (
        <div key={c.label} className="tk-stat">
          <span className={`tk-stat-icon tk-tone-${c.tone}`} aria-hidden="true">{c.icon}</span>
          <div>
            {stats ? <strong>{c.value}</strong> : <span className="tk-skel tk-skel-num" />}
            <em>{c.label}</em>
          </div>
        </div>
      ))}
    </div>
  )
}
