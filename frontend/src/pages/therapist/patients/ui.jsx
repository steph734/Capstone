import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import useDialogA11y from '../../../components/payments/useDialogA11y'
import { palette, initials } from './format'

// Centered dialog: dimmed backdrop, focus trapped, Esc / X / backdrop close it, focus returns to the opener.
export function Dialog({ title, subtitle, icon: Icon, tone = 'default', onClose, locked = false, wide = false, narrow = false, footer, children, labelId = 'pm-dlg-title' }) {
  const ref = useDialogA11y({ onEscape: onClose, locked })
  return createPortal(
    <div className="pm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose() }}>
      <div className={`pm-dialog${wide ? ' wide' : ''}${narrow ? ' narrow' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1} ref={ref}>
        <header className="pm-dlg-head">
          {Icon && <span className={`pm-dlg-icon ${tone}`} aria-hidden="true"><Icon size={22} /></span>}
          <div className="pm-dlg-titles">
            <h2 id={labelId}>{title}</h2>
            {subtitle && <p className={tone === 'danger' ? 'pm-danger-text' : ''}>{subtitle}</p>}
          </div>
          {!locked && <button type="button" className="pm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="pm-dlg-body">{children}</div>
        {footer && <footer className="pm-dlg-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function Avatar({ id, name, photoUrl, size = 44 }) {
  const [bg, fg] = palette(id)
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.34, background: bg, color: fg }
  if (photoUrl && !failed) return <img className="pm-avatar" style={style} src={photoUrl} alt="" onError={() => setFailed(true)} />
  return <span className="pm-avatar" style={style} aria-hidden="true">{initials(name)}</span>
}

export function StatusBadge({ status }) {
  const label = { active: 'Active', inactive: 'Inactive', archived: 'Archived' }[status] || status
  return <span className={`pm-badge ${status}`}>{status === 'active' && <i className="pm-dot" aria-hidden="true" />}{label}</span>
}

// Bottom toast with an optional action (Undo).
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, action) => {
    setToast({ message, action }); clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), action ? 7000 : 2600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const el = toast ? (
    <div className="pm-toast" role="status" aria-live="polite">
      <span><Check size={15} aria-hidden="true" /> {toast.message}</span>
      {toast.action && <button type="button" onClick={() => { toast.action.run(); setToast(null) }}>{toast.action.label}</button>}
    </div>
  ) : null
  return [el, show]
}
