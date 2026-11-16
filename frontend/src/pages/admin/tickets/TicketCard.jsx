import { memo } from 'react'
import { AgeBadge, Avatar, CategoryChip, PriorityChip, RoleChip, StatusChip } from './TicketChips'
import { ageMs, displayName, isAttention } from './ticketConfig'

// One row in the list. The whole card is a button: arrow keys move between cards (handled by the list),
// Enter on the selected card opens the full page.
function TicketCard({ ticket, selected, attentionDays, now, onSelect, onOpenFull, tabIndex }) {
  const name = ticket.requester.name
  return (
    <button
      type="button"
      className={`tk-card ${selected ? 'sel' : ''}`}
      aria-current={selected ? 'true' : undefined}
      data-ticket={ticket.number}
      tabIndex={tabIndex}
      onClick={() => onSelect(ticket)}
      onKeyDown={(e) => { if (e.key === 'Enter' && selected) { e.preventDefault(); onOpenFull(ticket) } }}
    >
      <Avatar name={name} />
      <span className="tk-card-main">
        <span className="tk-card-top">
          <span className="tk-card-no">{ticket.number}</span>
          {ticket.unread && <i className="tk-newdot" role="img" aria-label="New reply" />}
          {isAttention(ticket, attentionDays, now) && <AgeBadge ms={ageMs(ticket.createdAt, now)} />}
        </span>
        <span className="tk-card-who"><strong>{displayName(name)}</strong> <RoleChip role={ticket.requester.role} /></span>
        {ticket.requester.branch && <span className="tk-card-branch">{ticket.requester.branch}</span>}
        <span className="tk-card-subject">{ticket.subject}</span>
        <span className="tk-card-chips"><StatusChip status={ticket.status} /><PriorityChip priority={ticket.priority} /><CategoryChip category={ticket.category} /></span>
      </span>
    </button>
  )
}
export default memo(TicketCard)
