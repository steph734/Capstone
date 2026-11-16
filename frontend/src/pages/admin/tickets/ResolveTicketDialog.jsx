import { useState } from 'react'
import { useDialogFocus } from './useDialogFocus'
import { FALLBACK_RESOLUTION_CODES } from './ticketConfig'

// Used by Resolve ticket, Mark resolved and Send & resolve. It resolves only when a code and notes are both present.
export default function ResolveTicketDialog({ ticket, codes = FALLBACK_RESOLUTION_CODES, initialCode = '', initialNotes = '', busy, onCancel, onResolve, returnFocusRef }) {
  const [code, setCode] = useState(initialCode)
  const [notes, setNotes] = useState(initialNotes)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const { ref, onKeyDown } = useDialogFocus({ onClose: onCancel, busy, returnFocusRef })

  const submit = async () => {
    const e = {}
    if (!code) e.code = 'Choose a resolution code.'
    if (!notes.trim()) e.notes = 'Add resolution notes. The requester will see them.'
    setErrors(e)
    setServerError('')
    if (Object.keys(e).length) return
    try { await onResolve({ resolutionCode: code, resolutionNotes: notes.trim() }) } catch (err) { setServerError(err.message) }
  }

  return (
    <div className="tk-overlay" onClick={() => { if (!busy) onCancel() }}>
      <div ref={ref} className="tk-dialog" role="dialog" aria-modal="true" aria-labelledby="tk-resolve-title" tabIndex={-1} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}>
        <h3 id="tk-resolve-title">Resolve ticket {ticket.number}?</h3>
        <p className="tk-muted">The requester is notified and sees your resolution notes. The ticket becomes read-only until reopened.</p>
        <label className="tk-label" htmlFor="tk-res-code">Resolution code</label>
        <select id="tk-res-code" data-autofocus aria-invalid={!!errors.code} value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Select…</option>
          {codes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {errors.code && <p className="tk-error" role="alert">{errors.code}</p>}
        <label className="tk-label" htmlFor="tk-res-notes">Resolution notes (visible to requester)</label>
        <textarea id="tk-res-notes" rows={4} maxLength={5000} aria-invalid={!!errors.notes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Summarize the cause, corrective action, and how the issue was confirmed with the requester." />
        {errors.notes && <p className="tk-error" role="alert">{errors.notes}</p>}
        {serverError && <p className="tk-error" role="alert">{serverError}</p>}
        <div className="tk-dialog-actions">
          <button type="button" className="tk-btn tk-btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="tk-btn tk-btn-primary" onClick={submit} disabled={busy}>{busy ? 'Resolving…' : 'Resolve ticket'}</button>
        </div>
      </div>
    </div>
  )
}
