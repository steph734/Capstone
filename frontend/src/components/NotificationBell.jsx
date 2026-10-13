import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// In-app notifications for the signed-in user (GET/POST /api/notifications,
// scoped to their own email). Polls once a minute and when the tab regains
// focus; opening the menu marks everything as read.
const GREEN = '#234C40'

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell({ email }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const load = useCallback(() => {
    if (!email) return
    fetch(`/api/notifications?${new URLSearchParams({ email })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (b) { setItems(b.notifications || []); setUnread(b.unread || 0) } })
      .catch(() => {})
  }, [email])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    window.addEventListener('focus', load)
    return () => { clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
        .then(() => setUnread(0))
        .catch(() => {})
    }
  }

  if (!email) return null
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="true" aria-expanded={open}
        style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', border: '1px solid #E3E8E4', background: '#fff', cursor: 'pointer', fontSize: 18 }}>
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: '#DC2626', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 'min(340px, 86vw)', maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #E3E8E4', borderRadius: 16, boxShadow: '0 8px 28px rgba(0,0,0,.14)' }}>
          <p style={{ margin: 0, padding: '12px 14px', fontSize: 14, fontWeight: 800, color: GREEN, borderBottom: '1px solid #EDF2F0' }}>Notifications</p>
          {items.length === 0 ? (
            <p style={{ margin: 0, padding: 18, fontSize: 13, color: '#5D7770' }}>You’re all caught up.</p>
          ) : items.map((n) => (
            <button key={n.id} type="button" role="menuitem" onClick={() => { setOpen(false); if (n.link) navigate(n.link) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #EDF2F0', background: n.read ? '#fff' : '#F2F8F5', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: GREEN }}>{n.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#3a4a45', marginTop: 2, lineHeight: 1.4 }}>{n.body}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#5D7770', marginTop: 4 }}>{timeAgo(n.createdAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
