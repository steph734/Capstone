import { useEffect, useState } from 'react'
import { Archive, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { Dialog } from './ui'
import { patientsApi } from './api'
import { fmtDay } from './format'

// Archive: soft and reversible. Blocked by an upcoming session (the server decides and returns the date).
export function ArchiveModal({ patient, onClose, onArchived }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await patientsApi.archive(patient.id); onArchived(patient) } catch (e) {
      setError(e.code === 'UPCOMING_SESSION' ? `${patient.name} has a session on ${fmtDay(e.data?.upcoming)}. Cancel or reschedule the upcoming session first.` : e.message)
      setBusy(false)
    }
  }
  return (
    <Dialog
      narrow icon={Archive} title={`Archive ${patient.name}?`} subtitle={[patient.age != null && `Age ${patient.age}`, patient.condition].filter(Boolean).join(' · ')} onClose={busy ? () => {} : onClose} locked={busy} labelId="pm-archive-title"
      footer={(
        <>
          <button type="button" className="pm-btn light" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="pm-btn primary" onClick={go} disabled={busy} data-autofocus>{busy ? 'Archiving…' : 'Archive patient'}</button>
        </>
      )}
    >
      <ul className="pm-checks">
        <li><Check size={15} aria-hidden="true" /><span>Hidden from your <b>active roster</b> and moved to the <b>Archived</b> tab</span></li>
        <li><Check size={15} aria-hidden="true" /><span>Sessions, notes and progress are <b>kept</b></span></li>
        <li><Check size={15} aria-hidden="true" /><span>You can <b>unarchive</b> any time</span></li>
      </ul>
      {error && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
    </Dialog>
  )
}

// Delete: permanent. The name is typed here AND re-checked on the server; blockers come from the server too.
export function DeleteModal({ patient, onClose, onDeleted, onArchiveInstead }) {
  const [preview, setPreview] = useState({ loading: true, data: null, error: '' })
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    patientsApi.deletePreview(patient.id)
      .then((d) => live && setPreview({ loading: false, data: d, error: '' }))
      .catch((e) => live && setPreview({ loading: false, data: null, error: e.message }))
    return () => { live = false }
  }, [patient.id])

  const matches = typed.trim().toLowerCase() === patient.name.trim().toLowerCase()
  const blockers = preview.data?.blockers || []
  const canDelete = matches && !busy && !preview.loading && !blockers.length && !preview.error
  const go = async () => {
    if (!canDelete) return
    setBusy(true); setError('')
    try { await patientsApi.remove(patient.id, typed); onDeleted(patient) } catch (e) { setError(e.message); setBusy(false) }
  }
  const c = preview.data?.counts

  return (
    <Dialog
      icon={Trash2} tone="danger" title={`Delete ${patient.name}?`} subtitle="This can’t be undone" onClose={busy ? () => {} : onClose} locked={busy} labelId="pm-delete-title"
      footer={(
        <>
          <button type="button" className="pm-btn light" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="pm-btn danger" onClick={go} disabled={!canDelete}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
        </>
      )}
    >
      <div className="pm-danger-box">
        <p className="pm-danger-title">Permanently removes</p>
        {preview.loading ? <p className="pm-muted">Checking what would be removed…</p> : (
          <ul>
            <li><X size={15} aria-hidden="true" /> The patient profile and guardian details</li>
            <li><X size={15} aria-hidden="true" /> {c ? `${c.notes} session note${c.notes === 1 ? '' : 's'} and ${c.progress} progress record${c.progress === 1 ? '' : 's'}` : 'All notes and progress'}</li>
            {c && c.sessions > 0 && <li><X size={15} aria-hidden="true" /> {c.sessions} session record{c.sessions === 1 ? '' : 's'} (kept without a name, so revenue reports still add up)</li>}
          </ul>
        )}
      </div>
      {preview.error && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {preview.error}</p>}
      {blockers.map((b) => (
        <p key={b.code} className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {b.message}{b.date ? ` (${fmtDay(b.date)})` : ''}</p>
      ))}
      <p className="pm-muted">Not sure? <button type="button" className="pm-inline-link" onClick={onArchiveInstead}>Archive instead</button> keeps all records.</p>
      <label className="pm-label" htmlFor="pm-delete-name">Type <code>{patient.name}</code> to confirm</label>
      <input id="pm-delete-name" className="pm-input" value={typed} onChange={(e) => { setTyped(e.target.value); setError('') }} placeholder="Type the patient’s name" autoComplete="off" data-autofocus />
      {error && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
    </Dialog>
  )
}
