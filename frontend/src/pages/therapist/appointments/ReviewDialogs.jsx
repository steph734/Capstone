import { AlertTriangle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Modal } from './ui'

// The two kinds of small dialogs the review flow uses, one on top of the other:
//   ConfirmDialog  "Are you sure?" with the details, and the buttons that actually save
//   DoneDialog     what happened, after the server said yes
const ICONS = { ok: CheckCircle2, bad: XCircle, ask: Clock }

export function ConfirmDialog({ title, subtitle, children, confirmLabel, tone = 'primary', busy = false, disabled = false, error = '', onConfirm, onCancel }) {
  return (
    <Modal nested size="sm" title={title} subtitle={subtitle} onClose={onCancel} locked={busy} labelId="ap-confirm-title"
      footer={(
        <>
          <button type="button" className="ap-btn light" onClick={onCancel} disabled={busy}>Go back</button>
          <button type="button" className={`ap-btn ${tone}`} onClick={onConfirm} disabled={busy || disabled} data-autofocus>
            {busy && <Loader2 size={15} className="ap-spin" aria-hidden="true" />} {confirmLabel}
          </button>
        </>
      )}
    >
      {children}
      {error && <p className="ap-inline-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {error}</p>}
    </Modal>
  )
}

export function DoneDialog({ tone = 'ok', title, message, warning, primary, secondary, onClose }) {
  const Icon = ICONS[tone] || CheckCircle2
  return (
    <Modal nested size="sm" title="Done" onClose={onClose} labelId="ap-done-title"
      footer={(
        <>
          {secondary && <button type="button" className="ap-btn light" onClick={secondary.onClick}>{secondary.label}</button>}
          <button type="button" className="ap-btn primary" onClick={primary.onClick} data-autofocus>{primary.label}</button>
        </>
      )}
    >
      <div className="ap-center">
        <span className={`ap-ico-badge ${tone}`}><Icon size={32} aria-hidden="true" /></span>
        <h3>{title}</h3>
        <p>{message}</p>
        {warning && <p className="ap-warn center"><AlertTriangle size={14} aria-hidden="true" /> {warning}</p>}
      </div>
    </Modal>
  )
}
