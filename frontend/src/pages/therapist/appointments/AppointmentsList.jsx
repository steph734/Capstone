import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, Filter, Eye, MoreVertical, CalendarClock, CheckCircle2, MessageSquare, Archive, ArchiveRestore, CalendarX2 } from 'lucide-react'
import { Avatar, StatusPill, Skeleton } from './ui'
import { fmt12, longDate, weekday3, dayNum, month3 } from './format'

const CHIPS = ['All', 'Confirmed', 'Completed', 'Cancelled']

/* ───────── the single "More" menu on a row ───────── */
let openMenuClose = null // only one menu open at a time

function RowMoreMenu({ appt, onAction }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const close = (refocus = false) => { setOpen(false); if (refocus) btn.current?.focus() }

  const items = [
    appt.can.reschedule && { key: 'reschedule', label: 'Reschedule', Icon: CalendarClock },
    appt.can.complete && { key: 'complete', label: 'Mark as completed', Icon: CheckCircle2 },
    appt.can.message && { key: 'message', label: 'Message guardian', Icon: MessageSquare },
    appt.can.archive && { key: 'archive', label: 'Archive appointment', Icon: Archive, tone: 'amber', divider: true },
    appt.can.restore && { key: 'restore', label: 'Restore appointment', Icon: ArchiveRestore, divider: true },
  ].filter(Boolean)

  useLayoutEffect(() => { // below the button, or above it when there is no room
    if (!open || !btn.current || !menu.current) return
    const r = btn.current.getBoundingClientRect()
    const h = menu.current.offsetHeight; const w = menu.current.offsetWidth
    const up = window.innerHeight - r.bottom < h + 12 && r.top > h + 12
    setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left: Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8) })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    openMenuClose?.()
    openMenuClose = () => setOpen(false)
    const out = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close() }
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true) }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = [...menu.current.querySelectorAll('[role="menuitem"]')]; const i = els.indexOf(document.activeElement)
        els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
      }
    }
    const scroll = () => close()
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key); window.addEventListener('scroll', scroll, true); window.addEventListener('resize', scroll)
    menu.current?.querySelector('[role="menuitem"]')?.focus()
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', scroll); if (openMenuClose) openMenuClose = null }
  }, [open])

  if (!items.length) return null
  return (
    <>
      <button ref={btn} type="button" className="ap-btn light sm" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${appt.patientName}`} onClick={() => { setPos(null); setOpen((o) => !o) }}>
        <MoreVertical size={15} aria-hidden="true" /> More
      </button>
      {open && createPortal(
        <div ref={menu} className="ap-menu" role="menu" aria-label={`More actions for ${appt.patientName}`} style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}>
          {items.map(({ key, label, Icon, tone, divider }) => (
            <div key={key} role="none">
              {divider && <hr />}
              <button type="button" role="menuitem" className={tone || ''} onClick={() => { close(); onAction(key, appt) }}><Icon size={16} aria-hidden="true" /> {label}</button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function Row({ appt, onView, onAction }) {
  return (
    <li className="ap-row">
      <span className="ap-row-time">{fmt12(appt.start)}</span>
      <Avatar id={appt.patientId || appt.id} name={appt.patientName} size={38} />
      <span className="ap-row-who"><strong>{appt.patientName}</strong><em>{appt.service} session · {appt.minutes} min</em></span>
      <StatusPill status={appt.status} />
      <span className="ap-row-btns">
        <button type="button" className="ap-btn light sm" onClick={() => onView(appt)}><Eye size={15} aria-hidden="true" /> View</button>
        <RowMoreMenu appt={appt} onAction={onAction} />
      </span>
    </li>
  )
}

export default function AppointmentsList({ today, state, list, onTab, onStatus, onSearch, search, onMore, onNew, onView, onAction, onRetry }) {
  const { tab, status } = state
  const groups = []
  for (const a of list?.items || []) { const g = groups[groups.length - 1]; if (g && g.date === a.date) g.rows.push(a); else groups.push({ date: a.date, past: a.past, rows: [a] }) }
  const firstPastAt = groups.findIndex((g) => g.past)
  const filtered = Boolean(search || status !== 'All')

  return (
    <section className="ap-all" aria-label="All appointments">
      <div className="ap-all-head"><h2>All appointments</h2><p>{longDate(today)}</p></div>
      <div className="ap-toolbar">
        <div className="ap-seg" role="group" aria-label="Show">
          {['active', 'archived'].map((t) => <button key={t} type="button" aria-pressed={tab === t} className={tab === t ? 'on' : ''} onClick={() => onTab(t)}>{t === 'active' ? 'Active' : 'Archived'}</button>)}
        </div>
        <label className="ap-search"><Search size={16} aria-hidden="true" /><span className="ap-sr">Search patient</span><input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search patient..." /></label>
        <button type="button" className="ap-btn primary ap-new" onClick={onNew}><Plus size={16} aria-hidden="true" /> New appointment</button>
      </div>
      <div className="ap-chips" role="group" aria-label="Status"><span className="ap-chips-label"><Filter size={13} aria-hidden="true" /> STATUS</span>
        {CHIPS.map((c) => <button key={c} type="button" aria-pressed={status === c} className={status === c ? 'on' : ''} onClick={() => onStatus(c)}>{c}</button>)}
      </div>

      {list === null ? (
        <div className="ap-groups">{[0, 1, 2].map((i) => <Skeleton key={i} h={64} r={16} style={{ marginBottom: 12 }} />)}</div>
      ) : list.error ? (
        <p className="ap-inline-error" role="alert">{list.error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></p>
      ) : groups.length === 0 ? (
        <div className="ap-empty"><CalendarX2 size={30} aria-hidden="true" /><h3>{filtered ? 'No appointments match' : tab === 'archived' ? 'Nothing archived' : 'No appointments yet'}</h3><p>{filtered ? 'Try another search or status.' : tab === 'archived' ? 'Archived appointments show up here.' : 'New appointments appear here.'}</p></div>
      ) : (
        <div className="ap-groups" aria-busy={list.loading}>
          {groups.map((g, i) => (
            <div key={g.date}>
              {i === firstPastAt && firstPastAt > 0 && <p className="ap-past-label">Past</p>}
              <div className="ap-group">
                <div className="ap-date" aria-label={longDate(g.date)}><span>{weekday3(g.date)}</span><strong>{dayNum(g.date)}</strong><span>{month3(g.date)}</span></div>
                <ul className="ap-rows">{g.rows.map((a) => <Row key={a.id} appt={a} onView={onView} onAction={onAction} />)}</ul>
              </div>
            </div>
          ))}
          <div className="ap-more">
            {list.hasMore && <button type="button" className="ap-btn light" disabled={list.loading} onClick={onMore}>Show more</button>}
            <p>Showing {list.items.length} of {list.total} {list.total === 1 ? 'appointment' : 'appointments'}</p>
          </div>
        </div>
      )}
    </section>
  )
}
