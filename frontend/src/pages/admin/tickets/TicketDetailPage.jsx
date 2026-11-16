import { ArrowLeft, Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminPageShell from '../AdminPageShell'
import { adminMenuItems } from '../adminSidebarConfig'
import { StatusChip } from './TicketChips'
import TicketThread from './TicketThread'
import ReplyComposer from './ReplyComposer'
import RequesterCard from './RequesterCard'
import ActivityTimeline from './ActivityTimeline'
import WorkflowCard from './WorkflowCard'
import ResolveTicketDialog from './ResolveTicketDialog'
import { useTicketActions, useTicketDetail } from './ticketStore'
import { useToast } from './useToast'
import { CANNED_CLOSING, CATEGORY_LABEL, FALLBACK_RESOLUTION_CODES, TYPE_LABEL, ageMs, displayName, fillCanned, firstNameOf, formatAge, fullDate, isAttention, relativeTime } from './ticketConfig'
import './tickets.css'

export const LIST_SEARCH_KEY = 'tk-list-search'

// /admin/support-tickets/:ticketId — everything needed to work a ticket and resolve it (Image C).
export default function TicketDetailPage({ user, onLogout }) {
  const { ticketId } = useParams()
  const number = String(ticketId || '').toUpperCase()
  const navigate = useNavigate()
  const [toastNode, flash] = useToast()
  const { data, error, loading, reload } = useTicketDetail(number)
  const actions = useTicketActions(number, { onToast: flash })
  const [now, setNow] = useState(() => Date.now())
  const [notes, setNotes] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [dialog, setDialog] = useState(false)
  const [cannedClose, setCannedClose] = useState(false)
  const [threadError, setThreadError] = useState('')
  const resolveRef = useRef(null)
  const seeded = useRef('')

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  // Seed the notes box from the saved draft once per ticket (and again after the draft is saved).
  const draft = data?.ticket.resolutionDraft ?? null
  useEffect(() => {
    if (data && seeded.current !== number) { seeded.current = number; setNotes(data.ticket.resolutionDraft || ''); setCode(data.ticket.resolutionCode || '') }
  }, [data, number])

  const back = () => {
    let search = ''
    try { search = sessionStorage.getItem(LIST_SEARCH_KEY) || '' } catch { /* none saved */ }
    navigate(`/admin/support-tickets${search}`)
  }

  const shell = (body) => (
    <AdminPageShell user={user} onLogout={onLogout} title="Support Tickets" subtitle="" menuItems={adminMenuItems} bare>
      <div className="tk-root tk-detail-page">{body}{toastNode}</div>
    </AdminPageShell>
  )

  if (loading) return shell(<div aria-busy="true" aria-label="Loading ticket"><span className="tk-skel tk-skel-title" /><span className="tk-skel tk-skel-block" /><span className="tk-skel tk-skel-block" /></div>)
  if (!data) {
    return shell(
      <div className="tk-card-panel tk-empty">
        <h3>{error || 'Could not load this ticket.'}</h3>
        <button type="button" className="tk-btn tk-btn-outline" onClick={() => reload({ silent: false })}>Retry</button>
        <button type="button" className="tk-btn tk-btn-ghost" onClick={back}><ArrowLeft size={15} aria-hidden="true" /> Back to tickets</button>
      </div>
    )
  }

  const { ticket, messages, activity, admins, config } = data
  const codes = config?.resolutionCodes || FALLBACK_RESOLUTION_CODES
  const done = ['resolved', 'closed'].includes(ticket.status)
  const me = admins.find((a) => a.isMe)
  const assignedToMe = !!(me && ticket.assignedTo?.id === me.id)
  const first = firstNameOf(ticket.requester.name)
  const dirty = notes !== (draft || '')
  const original = messages[0]
  const thread = messages.slice(1)
  const old = isAttention(ticket, config?.attentionAfterDays, now)
  const ageText = formatAge(ageMs(ticket.createdAt, now))
  const run = (p) => p.catch(() => {})

  const tryResolve = () => {
    const e = {}
    if (!code) e.code = 'Choose a resolution code before resolving.'
    if (!notes.trim()) e.notes = 'Add resolution notes before resolving. The requester will see them.'
    setErrors(e)
    if (!Object.keys(e).length) setDialog(true)
  }

  return shell(
    <>
      <header className="tk-topbar">
        <div>
          <h1>{ticket.number} — {ticket.subject}</h1>
          <p>Support Tickets › {ticket.type === 'owner_request' ? 'Owner requests' : 'Concerns'} › {CATEGORY_LABEL[ticket.category] || ticket.category} · Opened {relativeTime(ticket.createdAt, now)}</p>
        </div>
        <div className="tk-topbar-actions">
          {assignedToMe && <span className="tk-chip tk-mine">Assigned to you</span>}
          {ticket.assignedTo && !done && <button type="button" className="tk-btn tk-btn-outline" onClick={() => run(actions.change({ assignedTo: null }))}>Unassign</button>}
          <button type="button" className="tk-btn tk-btn-soft" onClick={back}><ArrowLeft size={15} aria-hidden="true" /> Back to tickets</button>
        </div>
      </header>

      {actions.conflict && (
        <div className="tk-banner tk-banner-warn" role="alert">
          This ticket was updated by someone else. <button type="button" className="tk-link" onClick={async () => { await reload(); actions.clearConflict() }}>Reload to see it</button>
        </div>
      )}
      {done && <div className="tk-banner tk-banner-done"><span><Check size={14} aria-hidden="true" /> Resolved{ticket.resolvedBy ? ` by ${ticket.resolvedBy}` : ''} on {fullDate(ticket.resolvedAt)}. Read-only until reopened.</span></div>}

      <div className="tk-detail-grid">
        <div className="tk-col">
          <section className="tk-card-panel">
            <h3>Ticket details</h3>
            <dl className="tk-kv tk-kv-2">
              <div><dt>Number</dt><dd>{ticket.number}</dd></div>
              <div><dt>Priority</dt><dd>{ticket.priority[0].toUpperCase() + ticket.priority.slice(1)}</dd></div>
              <div><dt>Status</dt><dd><StatusChip status={ticket.status} /></dd></div>
              <div><dt>Type</dt><dd>{TYPE_LABEL[ticket.type] || ticket.type}</dd></div>
              <div><dt>Category</dt><dd>{CATEGORY_LABEL[ticket.category] || ticket.category}</dd></div>
              <div><dt>Assigned to</dt><dd>{ticket.assignedTo?.name || <span className="tk-dim">Unassigned</span>}</dd></div>
              <div><dt>Opened</dt><dd>{fullDate(ticket.createdAt)}</dd></div>
              <div><dt>Age</dt><dd className={old ? 'tk-red' : ''}>{ageText === '—' ? '—' : ageMs(ticket.createdAt, now) < 86400000 ? ageText : `${Math.floor(ageMs(ticket.createdAt, now) / 86400000)} days`}</dd></div>
            </dl>
            {original && (
              <div className="tk-original">
                <p className="tk-original-label">Message (requester)</p>
                <p className="tk-original-text">{original.body}</p>
                {original.attachments.length > 0 && <p className="tk-dim">{original.attachments.length} attachment(s) in the thread below.</p>}
              </div>
            )}
          </section>

          <section className="tk-card-panel">
            <h3>Reply to {displayName(ticket.requester.name) === 'Unknown' ? 'requester' : first}</h3>
            {thread.length > 0 && <TicketThread messages={thread} requesterName={ticket.requester.name} onError={setThreadError} />}
            {threadError && <p className="tk-error" role="alert">{threadError}</p>}
            {done ? <p className="tk-muted">This ticket is resolved. Reopen it to reply.</p> : (
              <ReplyComposer variant="page" requesterName={ticket.requester.name} onSend={actions.reply} />
            )}
          </section>

          <section className="tk-card-panel">
            <h3>Resolution notes <small>(visible to requester on close)</small></h3>
            {done ? (
              <p className="tk-original-text">{ticket.resolutionNotes || 'No resolution notes were saved.'}</p>
            ) : (
              <>
                <textarea
                  aria-label="Resolution notes"
                  rows={3}
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setErrors((x) => ({ ...x, notes: undefined })) }}
                  placeholder="Summarize the cause, corrective action, and how the issue was confirmed with the requester."
                />
                <div className="tk-composer-actions">
                  <div className="tk-menu-wrap">
                    <button type="button" className="tk-btn tk-btn-ghost" aria-haspopup="menu" aria-expanded={cannedClose} onClick={() => setCannedClose((o) => !o)}>Canned closing <ChevronDown size={14} aria-hidden="true" /></button>
                    {cannedClose && (
                      <div className="tk-menu" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setCannedClose(false) }}>
                        {CANNED_CLOSING.map((c) => <button key={c.id} type="button" role="menuitem" onClick={() => { setNotes((n) => (n.trim() ? `${n.trimEnd()}\n${fillCanned(c.text, first)}` : fillCanned(c.text, first))); setCannedClose(false) }}>{c.label}</button>)}
                      </div>
                    )}
                  </div>
                  <span className="tk-spacer" />
                  <button type="button" className="tk-btn tk-btn-outline" disabled={!dirty} onClick={() => run(actions.saveNotes(notes))}>Save resolution notes</button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="tk-col">
          <RequesterCard ticket={ticket} />
          <ActivityTimeline activity={activity} codes={codes} />
          <WorkflowCard
            ticket={ticket}
            admins={admins}
            codes={codes}
            code={code}
            onCodeChange={(v) => { setCode(v); setErrors((x) => ({ ...x, code: undefined })) }}
            errors={errors}
            readOnly={done}
            busy={actions.busy}
            resolveRef={resolveRef}
            onChange={(patch) => run(actions.change(patch))}
            onResolve={tryResolve}
            onReopen={() => run(actions.reopen())}
          />
        </aside>
      </div>

      {dialog && (
        <ResolveTicketDialog
          ticket={ticket}
          codes={codes}
          initialCode={code}
          initialNotes={notes}
          busy={actions.busy}
          returnFocusRef={resolveRef}
          onCancel={() => setDialog(false)}
          onResolve={async (v) => { await actions.resolve(v); setDialog(false); setNotes(''); seeded.current = '' }}
        />
      )}
    </>
  )
}
