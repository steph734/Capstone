import { STATUS_META, PRIORITY_META, fullDate } from './ticketConfig'

const labelOf = (e, codes) => {
  switch (e.type) {
    case 'opened': return ['Ticket opened', `${fullDate(e.at)} · by ${e.actor}`]
    case 'reply': return ['Reply sent', `${fullDate(e.at)} · by ${e.actor}`]
    case 'requester_reply': return ['Requester replied', `${fullDate(e.at)} · ${e.actor}`]
    case 'note': return ['Internal note added', `${fullDate(e.at)} · by ${e.actor}`]
    case 'assigned': return [e.self ? 'Assigned to themselves' : `Assigned to ${e.to}`, `${fullDate(e.at)} · by ${e.actor}`]
    case 'unassigned': return ['Unassigned', `${fullDate(e.at)} · by ${e.actor}`]
    case 'status': return [`Status: ${STATUS_META[e.from]?.label || e.from} → ${STATUS_META[e.to]?.label || e.to}`, `${fullDate(e.at)} · by ${e.actor}`]
    case 'priority': return [`Priority: ${PRIORITY_META[e.from]?.label || e.from} → ${PRIORITY_META[e.to]?.label || e.to}`, `${fullDate(e.at)} · by ${e.actor}`]
    case 'resolved': return [`Resolved${e.code ? ` · ${codes.find((c) => c.value === e.code)?.label || e.code}` : ''}`, `${fullDate(e.at)} · by ${e.actor}`]
    case 'reopened': return ['Reopened', `${fullDate(e.at)} · by ${e.actor}`]
    default: return [e.type, fullDate(e.at)]
  }
}

// Real events only: nothing is invented. With no replies yet, the last line says we are waiting.
export default function ActivityTimeline({ activity, codes = [] }) {
  const hasReply = activity.some((e) => e.type === 'reply')
  return (
    <section className="tk-card-panel">
      <h3>Activity</h3>
      <ol className="tk-timeline">
        {activity.map((e, i) => {
          const [title, sub] = labelOf(e, codes)
          return <li key={`${e.type}-${i}`}><i className="tk-tl-dot" aria-hidden="true" /><strong>{title}</strong><span>{sub}</span></li>
        })}
        {!hasReply && <li className="tk-tl-wait"><i className="tk-tl-dot" aria-hidden="true" /><strong>No replies yet</strong><span>Waiting for first response</span></li>}
      </ol>
    </section>
  )
}
