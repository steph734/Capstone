import { ArrowUpRight, Check, Timer } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgeChip, CategoryChip, PriorityChip, StatusChip } from './TicketChips'
import TicketThread from './TicketThread'
import ReplyComposer from './ReplyComposer'
import ResolveTicketDialog from './ResolveTicketDialog'
import { useTicketActions, useTicketDetail } from './ticketStore'
import { PRIORITY_META, STATUS_META, TYPE_LABEL, WORKFLOW_STATUSES, ageMs, displayName, isAttention, FALLBACK_RESOLUTION_CODES } from './ticketConfig'

// Quick read-and-reply pane next to the list (Image A).
export default function TicketReadingPane({ number, now, onToast }) {
  const { data, error, loading, reload } = useTicketDetail(number)
  const actions = useTicketActions(number, { onToast })
  const [resolveFor, setResolveFor] = useState(null) // { notes }
  const markRef = useRef(null)
  const [threadError, setThreadError] = useState('')

  if (loading) return <PaneSkeleton />
  if (!data) {
    return (
      <div className="tk-pane tk-pane-state">
        <p role="alert">{error || 'Could not load this ticket.'}</p>
        <button type="button" className="tk-btn tk-btn-outline" onClick={() => reload({ silent: false })}>Retry</button>
      </div>
    )
  }
  const { ticket, messages, admins, config } = data
  const done = ['resolved', 'closed'].includes(ticket.status)
  const codes = config?.resolutionCodes || FALLBACK_RESOLUTION_CODES
  const attentionDays = config?.attentionAfterDays
  const statusOptions = WORKFLOW_STATUSES.includes(ticket.status) ? WORKFLOW_STATUSES : [ticket.status, ...WORKFLOW_STATUSES]

  return (
    <div className="tk-pane">
      <header className="tk-pane-head">
        <div>
          <p className="tk-eyebrow">
            {ticket.number} · {TYPE_LABEL[ticket.type] || 'Ticket'}
            <Link className="tk-open-full" to={`/admin/support-tickets/${ticket.number}`}>Open full ticket <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </p>
          <h2>{ticket.subject}</h2>
          <div className="tk-chips">
            <StatusChip status={ticket.status} /><PriorityChip priority={ticket.priority} /><CategoryChip category={ticket.category} />
            {isAttention(ticket, attentionDays, now) ? <span className="tk-chip tk-age"><Timer size={12} aria-hidden="true" /> {Math.floor(ageMs(ticket.createdAt, now) / 86400000)}d old</span> : <AgeChip ms={ageMs(ticket.createdAt, now)} />}
          </div>
        </div>
        {!done && <button ref={markRef} type="button" className="tk-btn tk-btn-resolve-soft" onClick={() => setResolveFor({ notes: ticket.resolutionDraft || '' })}><Check size={16} aria-hidden="true" /> Mark resolved</button>}
      </header>

      {actions.conflict && (
        <div className="tk-banner tk-banner-warn" role="alert">
          This ticket was updated by someone else. <button type="button" className="tk-link" onClick={async () => { await reload(); actions.clearConflict() }}>Reload to see it</button>
        </div>
      )}
      {done && (
        <div className="tk-banner tk-banner-done">
          <span><Check size={14} aria-hidden="true" /> Resolved{ticket.resolvedBy ? ` by ${ticket.resolvedBy}` : ''}. This thread is read-only.</span>
          <button type="button" className="tk-btn tk-btn-outline" disabled={actions.busy} onClick={() => actions.reopen().catch(() => {})}>Reopen</button>
        </div>
      )}

      <div className="tk-controls">
        <label>Status: <select aria-label="Status" disabled={done} value={ticket.status} onChange={(e) => actions.change({ status: e.target.value }).catch(() => {})}>
          {statusOptions.map((s) => <option key={s} value={s} disabled={!WORKFLOW_STATUSES.includes(s)}>{STATUS_META[s]?.label || s}</option>)}
        </select></label>
        <label>Priority: <select aria-label="Priority" disabled={done} value={ticket.priority} onChange={(e) => actions.change({ priority: e.target.value }).catch(() => {})}>
          {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></label>
        <label>Assign: <select aria-label="Assign" disabled={done} value={ticket.assignedTo?.id || ''} onChange={(e) => actions.change({ assignedTo: e.target.value || null }).catch(() => {})}>
          <option value="">Unassigned</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
      </div>

      <div className="tk-pane-scroll">
        <p className="tk-section-label">Conversation</p>
        <TicketThread messages={messages} requesterName={ticket.requester.name} onError={setThreadError} />
        {threadError && <p className="tk-error" role="alert">{threadError}</p>}
      </div>

      <ReplyComposer
        requesterName={displayName(ticket.requester.name)}
        disabled={done}
        onSend={actions.reply}
        onSendAndResolve={(body) => setResolveFor({ notes: ticket.resolutionDraft || body })}
      />

      {resolveFor && (
        <ResolveTicketDialog
          ticket={ticket}
          codes={codes}
          initialNotes={resolveFor.notes}
          busy={actions.busy}
          returnFocusRef={markRef}
          onCancel={() => setResolveFor(null)}
          onResolve={async (v) => { await actions.resolve(v); setResolveFor(null) }}
        />
      )}
    </div>
  )
}

function PaneSkeleton() {
  return (
    <div className="tk-pane" aria-busy="true" aria-label="Loading ticket">
      <span className="tk-skel tk-skel-line w40" /><span className="tk-skel tk-skel-title" /><span className="tk-skel tk-skel-line w60" />
      <span className="tk-skel tk-skel-block" /><span className="tk-skel tk-skel-block" />
    </div>
  )
}
