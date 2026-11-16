import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import LockScreen from '../therapist/notes/IdleLock'
import TicketStatsRow from './tickets/TicketStatsRow'
import TicketFilters from './tickets/TicketFilters'
import TicketCard from './tickets/TicketCard'
import TicketReadingPane from './tickets/TicketReadingPane'
import { LIST_SEARCH_KEY } from './tickets/TicketDetailPage'
import { getStats, listTickets } from './tickets/ticketsApi'
import { onDeskChange } from './tickets/ticketStore'
import { useToast } from './tickets/useToast'
import { DEFAULT_ATTENTION_DAYS } from './tickets/ticketConfig'
import './tickets/tickets.css'

const FILTER_KEYS = ['tab', 'q', 'status', 'category', 'priority', 'role', 'sort']
const WIDE = '(min-width: 1100px)'

// /admin/support-tickets — list on the left, reading pane on the right. Filters, sort and the selected ticket
// all live in the URL (?ticket=TCK-1001), so refresh, back/forward and shared links work.
export default function SupportTicketsPage({ user, onLogout }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [toastNode, flash] = useToast()
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches)
  const [items, setItems] = useState(null)
  const [counts, setCounts] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const itemsRef = useRef(0)
  const selected = (params.get('ticket') || '').toUpperCase()

  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  // The full page's "← Back to tickets" restores exactly this view.
  useEffect(() => { try { sessionStorage.setItem(LIST_SEARCH_KEY, params.toString() ? `?${params.toString()}` : '') } catch { /* optional */ } }, [params])

  const patch = useCallback((changes) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(changes)) { if (v) n.set(k, v); else n.delete(k) }
    return n
  }, { replace: !('ticket' in changes) }), [setParams])
  const clearFilters = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); FILTER_KEYS.forEach((k) => n.delete(k)); return n }, { replace: true }), [setParams])

  const filterQuery = FILTER_KEYS.reduce((q, k) => (params.get(k) ? { ...q, [k]: params.get(k) } : q), {})
  const filterKey = JSON.stringify(filterQuery)

  const fail = useCallback((e) => { if (e.code === 'SESSION_LOCKED') setLocked(true); else setError(e.code === 'NO_SESSION' ? 'Please sign in again with your Super Admin account.' : e.message) }, [])

  const load = useCallback(async ({ more = false, keep = false } = {}) => {
    try {
      const query = { ...JSON.parse(filterKey) }
      if (more) query.cursor = cursor
      else if (keep && itemsRef.current > 20) query.limit = String(itemsRef.current)
      if (more) setLoadingMore(true)
      const d = await listTickets(query)
      setItems((prev) => (more && prev ? [...prev, ...d.tickets] : d.tickets))
      itemsRef.current = (more ? itemsRef.current : 0) + d.tickets.length
      setCounts(d.counts); setCursor(d.nextCursor); setError('')
    } catch (e) { fail(e) } finally { setLoadingMore(false) }
  }, [filterKey, cursor, fail])

  const loadStats = useCallback(() => getStats().then(setStats).catch(() => {}), [])

  // New filters: start again from page 1.
  useEffect(() => { setItems(null); itemsRef.current = 0; load() }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats() }, [loadStats])

  // Anything that changes a ticket (here or on the full page) refreshes the list, tab counts and summary cards.
  const refresh = useCallback(() => { load({ keep: true }); loadStats() }, [load, loadStats])
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh }, [refresh])
  useEffect(() => onDeskChange(() => refreshRef.current()), [])
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState !== 'hidden') refreshRef.current() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const t = setInterval(onFocus, 60000)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); clearInterval(t) }
  }, [])

  const openFull = (t) => navigate(`/admin/support-tickets/${t.number}`)
  const select = (t) => { if (wide) patch({ ticket: t.number }); else openFull(t) }

  const onListKeys = (e) => {
    if (!items?.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return
    e.preventDefault()
    const i = items.findIndex((t) => t.number === selected)
    const next = items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (!next) return
    if (wide) patch({ ticket: next.number })
    requestAnimationFrame(() => document.querySelector(`[data-ticket="${next.number}"]`)?.focus())
  }

  const attentionDays = stats?.attentionDays ?? DEFAULT_ATTENTION_DAYS
  const filtered = Object.keys(filterQuery).length > 0
  const focusIndex = Math.max(0, items?.findIndex((t) => t.number === selected) ?? 0)

  const listBody = () => {
    if (error && !items) return <div className="tk-state" role="alert"><p>{error}</p><button type="button" className="tk-btn tk-btn-outline" onClick={() => load()}>Retry</button></div>
    if (!items) return [0, 1, 2].map((i) => <div key={i} className="tk-card tk-card-skel" aria-hidden="true"><span className="tk-skel tk-skel-avatar" /><span className="tk-skel tk-skel-block" /></div>)
    if (!items.length) {
      return filtered
        ? <div className="tk-state"><h3>No tickets match your filters</h3><button type="button" className="tk-btn tk-btn-outline" onClick={clearFilters}>Clear filters</button></div>
        : <div className="tk-state"><h3>No support tickets yet</h3><p>Requests and concerns sent from every branch will show up here.</p></div>
    }
    return (
      <>
        <div role="list" onKeyDown={onListKeys} className="tk-cards">
          {items.map((t, i) => (
            <div role="listitem" key={t.id}>
              <TicketCard ticket={t} selected={t.number === selected} attentionDays={attentionDays} now={now} tabIndex={i === focusIndex ? 0 : -1} onSelect={select} onOpenFull={openFull} />
            </div>
          ))}
        </div>
        {cursor && <button type="button" className="tk-btn tk-btn-outline tk-more" disabled={loadingMore} onClick={() => load({ more: true })}>{loadingMore ? 'Loading…' : 'Load more'}</button>}
      </>
    )
  }

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Support Tickets" subtitle="Owner requests and concerns from every branch" menuItems={adminMenuItems} bare>
      <div className="tk-root">
        {error && items && <div className="tk-banner tk-banner-warn" role="alert">{error} <button type="button" className="tk-link" onClick={() => load()}>Retry</button></div>}
        <TicketStatsRow stats={stats} />
        <TicketFilters params={params} counts={counts} onChange={patch} onClear={clearFilters} />
        <div className="tk-split">
          <section className="tk-list" aria-label="Tickets">{listBody()}</section>
          {wide && (
            <section className="tk-pane-wrap" aria-label="Ticket reading pane">
              {selected ? <TicketReadingPane key={selected} number={selected} now={now} onToast={flash} /> : (
                <div className="tk-pane tk-pane-empty">
                  <img src="/pao/pao-game-poses/pao-game-read.png" alt="" width="150" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <h3>Select a ticket to read and reply</h3>
                  <p>Oldest tickets are listed first so nothing waits too long.</p>
                  {stats?.waitingPastThreshold > 0 && <span className="tk-chip tk-age tk-pill">{stats.waitingPastThreshold} ticket{stats.waitingPastThreshold === 1 ? '' : 's'} waiting {attentionDays}+ days</span>}
                </div>
              )}
            </section>
          )}
        </div>
        {toastNode}
      </div>
      {locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => { setLocked(false); load() }} onSignOut={onLogout} />}
    </AdminPageShell>
  )
}
