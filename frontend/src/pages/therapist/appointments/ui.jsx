import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useDialogA11y from '../../../components/payments/useDialogA11y'
import { useModalLock } from '../patients/ui'
import { avatarColors, initials, STATUS_TONE } from './format'

export function Avatar({ id, name, size = 40 }) {
  const [bg, fg] = avatarColors(id || name)
  return <span className="ap-avatar" aria-hidden="true" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.34 }}>{initials(name)}</span>
}

export function StatusPill({ status }) {
  return <span className={`ap-pill ${STATUS_TONE[status] || 'grey'}`}>{status}</span>
}

export const Skeleton = ({ h = 16, w = '100%', r = 8, style }) => <span className="ap-skel" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden="true" />

// Every dialog on this page: rendered into document.body (so no layout ancestor can clip it), one full-screen dim,
// page scroll locked, Escape / X / click outside close it, focus is trapped and goes back to the button that opened it.
export function Modal({ title, titleExtra, subtitle, onClose, locked = false, nested = false, size = 'md', labelId = 'ap-modal-title', footer, children, bodyClass = '' }) {
  const ref = useDialogA11y({ onEscape: onClose, locked })
  useModalLock()
  return createPortal(
    <div className={`ap-backdrop${nested ? ' top' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget && !locked) onClose() }}>
      <div ref={ref} className={`ap-modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>
        <header className="ap-modal-head">
          <div className="ap-modal-titles"><h2 id={labelId}>{title}</h2>{titleExtra}{subtitle && <p>{subtitle}</p>}</div>
          {!locked && <button type="button" className="ap-x" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>}
        </header>
        <div className={`ap-modal-body ${bodyClass}`}>{children}</div>
        {footer && <footer className="ap-modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

// A short message that fades away by itself.
export function Toast({ text }) {
  if (!text) return null
  return createPortal(<div className="ap-toast" role="status" aria-live="polite">{text}</div>, document.body)
}
