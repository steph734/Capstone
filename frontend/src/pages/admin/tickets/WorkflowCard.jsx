import { Check } from 'lucide-react'
import { PRIORITY_META, STATUS_META, WORKFLOW_STATUSES } from './ticketConfig'

// Status / priority / assignee / resolution code and the big Resolve button. Changing the status never
// completes a ticket: "resolved" is not in the menu, only Resolve ticket gets there.
export default function WorkflowCard({ ticket, admins, codes, code, onCodeChange, errors, readOnly, onChange, onResolve, onReopen, busy, resolveRef }) {
  const statusOptions = WORKFLOW_STATUSES.includes(ticket.status) ? WORKFLOW_STATUSES : [ticket.status, ...WORKFLOW_STATUSES]
  return (
    <section className="tk-card-panel">
      <h3>Workflow</h3>
      <label className="tk-label" htmlFor="wf-status">Status (workflow — doesn't complete the ticket)</label>
      <select id="wf-status" disabled={readOnly} value={ticket.status} onChange={(e) => onChange({ status: e.target.value })}>
        {statusOptions.map((s) => <option key={s} value={s} disabled={!WORKFLOW_STATUSES.includes(s)}>{STATUS_META[s]?.label || s}</option>)}
      </select>
      <label className="tk-label" htmlFor="wf-priority">Priority</label>
      <select id="wf-priority" disabled={readOnly} value={ticket.priority} onChange={(e) => onChange({ priority: e.target.value })}>
        {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <label className="tk-label" htmlFor="wf-assign">Assign to</label>
      <select id="wf-assign" disabled={readOnly} value={ticket.assignedTo?.id || ''} onChange={(e) => onChange({ assignedTo: e.target.value || null })}>
        <option value="">Unassigned</option>
        {admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isMe ? ' (you)' : ''}</option>)}
      </select>

      {readOnly ? (
        <>
          <p className="tk-helper">This ticket is resolved{ticket.resolvedBy ? ` by ${ticket.resolvedBy}` : ''}. It is read-only until reopened.</p>
          <button type="button" className="tk-btn tk-btn-outline tk-btn-block" onClick={onReopen} disabled={busy}>Reopen ticket</button>
        </>
      ) : (
        <>
          <p className="tk-helper">Use <strong>Resolve ticket</strong> when work is done — changing the status alone never marks it complete.</p>
          <label className="tk-label" htmlFor="wf-code">Resolution code</label>
          <select id="wf-code" aria-invalid={!!errors?.code} value={code} onChange={(e) => onCodeChange(e.target.value)}>
            <option value="">Select…</option>
            {codes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {errors?.code && <p className="tk-error" role="alert">{errors.code}</p>}
          {errors?.notes && <p className="tk-error" role="alert">{errors.notes}</p>}
          <button ref={resolveRef} type="button" className="tk-btn tk-btn-resolve tk-btn-block" onClick={onResolve} disabled={busy}><Check size={17} aria-hidden="true" /> Resolve ticket</button>
        </>
      )}
    </section>
  )
}
