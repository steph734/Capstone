import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, CalendarPlus, Mail, Archive, ArchiveRestore, Trash2 } from 'lucide-react'

// The ONE "More actions" menu of a row: Book session, Message guardian, divider, Archive / Unarchive, Delete.
// Keyboard: Enter/Space/ArrowDown opens, arrows move, Esc closes and gives focus back. Outside click closes.
// On phones the same menu is a bottom sheet (CSS).
export default function MoreActionsMenu({ patient, onBook, onMessage, onArchive, onUnarchive, onDelete }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const archived = patient.status === 'archived'

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const h = 250
    const below = window.innerHeight - r.bottom >= h + 12
    setPos({ right: Math.max(8, window.innerWidth - r.right), top: below ? r.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 6 })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus()
    const down = (e) => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btnRef.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
      const i = items.indexOf(document.activeElement)
      e.preventDefault()
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  const run = (fn) => () => { setOpen(false); fn(patient) }
  return (
    <>
      <button
        ref={btnRef} type="button" className="pm-kebab" aria-label={`More actions for ${patient.name}`} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open && createPortal(
        <>
          <div className="pm-sheet-dim" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          <div ref={menuRef} className="pm-menu" role="menu" aria-label={`More actions for ${patient.name}`} style={pos || undefined}>
            <p className="pm-menu-title" aria-hidden="true">More actions</p>
            <button type="button" role="menuitem" disabled={archived} title={archived ? 'Unarchive this patient to book a session' : undefined} onClick={run(onBook)}><CalendarPlus size={16} aria-hidden="true" /> Book session</button>
            <button type="button" role="menuitem" onClick={run(onMessage)}><Mail size={16} aria-hidden="true" /> Message guardian</button>
            <hr />
            {archived
              ? <button type="button" role="menuitem" className="warn" onClick={run(onUnarchive)}><ArchiveRestore size={16} aria-hidden="true" /> Unarchive</button>
              : <button type="button" role="menuitem" className="warn" onClick={run(onArchive)}><Archive size={16} aria-hidden="true" /> Archive</button>}
            <button type="button" role="menuitem" className="danger" onClick={run(onDelete)}><Trash2 size={16} aria-hidden="true" /> Delete…</button>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
