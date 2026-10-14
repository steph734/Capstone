import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Inbox, Lock, Paperclip, Search, Send, Timer } from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import LockScreen from '../therapist/notes/IdleLock'
import { authFetch } from '../../utils/session'
import { CATEGORY_LABEL, STATUS_LABEL, RichText, StatusPill } from '../../components/support/TicketUi'
import '../../components/support/support.css'
import './SupportTickets.css'

// /admin/support-tickets — the Super Admin inbox. Every call is checked on the
// server (Super Admin session). Internal notes exist only here: the requester's
// API never returns them.
const PRIORITY = { urgent: ['Urgent', '#FDE3E8', '#B4233C'], high: ['High', '#FCEBC6', '#92400E'], normal: ['Normal', '#EEF1EF', '#4B5B56'], low: ['Low', '#E8F0FB', '#1E40AF'] }
const ROLE = { owner: 'Owner', therapist: 'Therapist', patient: 'Guardian', guardian: 'Guardian' }
const when = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
const ago = (d) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d` }
const dur = (min) => (min == null ? '—' : min < 60 ? `${min} min` : `${(min / 60).toFixed(1)} h`)

function Priority({ p }) { const [l, bg, fg] = PRIORITY[p] || PRIORITY.normal; return <span className="st-pri" style={{ background: bg, color: fg }}>{l}</span> }

export default function SupportTicketsPage({ user, onLogout }) {
  const [params, setParams] = useSearchParams()
  const type = ['owner_request', 'concern'].includes(params.get('tab')) ? params.get('tab') : ''
  const status = params.get('status') || ''
  const category = params.get('category') || ''
  const priority = params.get('priority') || ''
  const role = params.get('role') || ''
  const q = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const selected = params.get('ticket') || ''

  const [list, setList] = useState(null)
  const [stats, setStats] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [mode, setMode] = useState('reply') // reply | note
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const setParam = (patch) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k) } if (!('page' in patch) && !('ticket' in patch)) n.delete('page'); return n }, { replace: true })
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600) }
  const fail = useCallback((e) => { if (e.code === 'SESSION_LOCKED') setLocked(true); else setError(e.code === 'NO_SESSION' ? 'Please sign in again with your Super Admin account.' : e.message) }, [])

  const loadList = useCallback(() => {
    const qs = {}
    if (type) qs.type = type; if (status) qs.status = status; if (category) qs.category = category; if (priority) qs.priority = priority; if (role) qs.role = role; if (q) qs.q = q; qs.page = page
    return authFetch('/api/admin/support/tickets', { query: qs }).then((b) => { setList(b); setError('') }).catch(fail)
  }, [type, status, category, priority, role, q, page, fail])
  const loadStats = useCallback(() => authFetch('/api/admin/support/stats').then(setStats).catch(() => {}), [])
  const loadDetail = useCallback((id) => authFetch(`/api/admin/support/tickets/${id}`).then((d) => { setDetail(d); loadList(); loadStats() }).catch(fail), [fail, loadList, loadStats])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadStats(); const t = setInterval(() => { loadStats(); loadList() }, 60000); return () => clearInterval(t) }, [loadStats, loadList])
  useEffect(() => { if (selected) loadDetail(selected); else setDetail(null) }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body, msg) => {
    try { await authFetch(`/api/admin/support/tickets/${selected}`, { method: 'PATCH', body }); flash(msg || 'Updated'); loadDetail(selected) } catch (e) { fail(e) }
  }
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await authFetch(`/api/admin/support/tickets/${selected}/messages`, { method: 'POST', body: { body: text.trim(), is_internal: mode === 'note' } })
      setText(''); flash(mode === 'note' ? 'Internal note added' : 'Reply sent'); loadDetail(selected)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const openFile = async (m, a) => { try { const { url } = await authFetch(`/api/admin/support/attachments/${m.id}/${a.index}`); window.open(url, '_blank', 'noopener') } catch (e) { fail(e) } }

  const statCards = stats && [
    { icon: Inbox, c: '#2563eb', bg: '#E3F0FD', v: stats.open, l: 'Open tickets' },
    { icon: AlertTriangle, c: '#B4233C', bg: '#FDE3E8', v: stats.urgent, l: 'Urgent' },
    { icon: Timer, c: '#b45309', bg: '#FCEBC6', v: dur(stats.avgFirstResponseMinutes), l: 'Avg first response' },
    { icon: CheckCircle2, c: '#16a34a', bg: '#D9F2E3', v: stats.resolvedThisWeek, l: 'Resolved this week', sub: stats.avgResolveMinutes != null ? `avg ${dur(stats.avgResolveMinutes)} to resolve` : null },
    { icon: Clock, c: '#7C5CE0', bg: '#E4DDFA', v: stats.openOwnerRequests, l: 'Open owner requests' },
  ]
  const tabs = [['', 'All', list?.counts.all], ['owner_request', 'Owner requests', list?.counts.owner_request], ['concern', 'Concerns', list?.counts.concern]]
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Support Tickets" subtitle="Owner requests and concerns from every branch" menuItems={adminMenuItems}>
      <div className="st-wrap">
        {error && <div role="alert" className="st-alert">{error} <button type="button" className="sup-btn sup-btn-ghost" onClick={loadList}>Retry</button></div>}

        {statCards && (
          <div className="st-stats">
            {statCards.map((c) => { const I = c.icon; return (
              <div key={c.l} className="st-stat"><span style={{ background: c.bg, color: c.c }}><I size={22} aria-hidden="true" /></span><div><strong>{c.v}</strong><em>{c.l}</em>{c.sub && <small>{c.sub}</small>}</div></div>
            ) })}
          </div>
        )}

        <div className="st-bar">
          <div className="st-tabs" role="tablist" aria-label="Ticket type">
            {tabs.map(([id, label, n]) => <button key={id} type="button" role="tab" aria-selected={type === id} className={type === id ? 'on' : ''} onClick={() => setParam({ tab: id })}>{label} <span>{n ?? 0}</span></button>)}
          </div>
          <label className="st-search"><Search size={16} aria-hidden="true" /><input type="search" value={q} placeholder="Search subject or TCK-…" aria-label="Search tickets" onChange={(e) => setParam({ q: e.target.value })} /></label>
          <select aria-label="Status" value={status} onChange={(e) => setParam({ status: e.target.value })}><option value="">All statuses</option><option value="open_all">Needs action</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Category" value={category} onChange={(e) => setParam({ category: e.target.value })}><option value="">All categories</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Priority" value={priority} onChange={(e) => setParam({ priority: e.target.value })}><option value="">All priorities</option>{Object.keys(PRIORITY).map((k) => <option key={k} value={k}>{PRIORITY[k][0]}</option>)}</select>
          <select aria-label="Requester role" value={role} onChange={(e) => setParam({ role: e.target.value })}><option value="">All roles</option><option value="owner">Owner</option><option value="therapist">Therapist</option><option value="guardian">Guardian</option></select>
        </div>

        <div className={`st-split ${selected ? 'has-detail' : ''}`}>
          <section className="st-list" aria-label="Tickets">
            {!list ? <p className="sup-muted">Loading tickets…</p> : list.tickets.length === 0 ? <p className="sup-muted st-empty">No tickets match these filters.</p> : (
              <ul>
                {list.tickets.map((t) => (
                  <li key={t.id}>
                    <button type="button" className={`st-item ${selected === t.id ? 'sel' : ''}`} onClick={() => setParam({ ticket: t.id })} aria-current={selected === t.id}>
                      <div className="st-item-top">
                        {t.unread && <i className="sup-dot" aria-label="Unread" />}
                        <strong>{t.subject}</strong>
                        <time>{ago(t.last_message_at)}</time>
                      </div>
                      <div className="st-item-meta">{t.ticket_no} · {t.requester.name} ({ROLE[t.requester.role]}){t.branch ? ` · ${t.branch}` : ''}</div>
                      <div className="st-item-preview">{t.preview}</div>
                      <div className="st-item-tags"><StatusPill status={t.status} /><Priority p={t.priority} /><span className="st-cat">{CATEGORY_LABEL[t.category]}</span>{t.type === 'owner_request' && <span className="st-cat">Owner request</span>}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list && totalPages > 1 && (
              <div className="st-pager"><button type="button" className="sup-btn sup-btn-ghost" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="sup-btn sup-btn-ghost" disabled={page >= totalPages} onClick={() => setParam({ page: String(page + 1) })}>Next</button></div>
            )}
          </section>

          <section className="st-detail" aria-label="Ticket detail">
            {!selected && <div className="st-placeholder"><Inbox size={36} aria-hidden="true" /><p>Select a ticket to read and reply.</p></div>}
            {selected && !detail && <p className="sup-muted">Loading…</p>}
            {selected && detail && (() => {
              const t = detail.ticket
              return (
                <>
                  <button type="button" className="sup-link st-back" onClick={() => setParam({ ticket: '' })}>← All tickets</button>
                  <div className="st-dhead">
                    <div><h2>{t.subject}</h2><p>{t.ticket_no} · opened {when(t.created_at)} · {CATEGORY_LABEL[t.category]}{t.source ? ` · via ${t.source.replace('_', ' ')}` : ''}</p></div>
                    {t.status !== 'resolved' && t.status !== 'closed' && <button type="button" className="sup-btn" onClick={() => patch({ status: 'resolved' }, 'Marked resolved')}><CheckCircle2 size={16} aria-hidden="true" /> Resolve</button>}
                  </div>
                  <div className="st-who"><strong>{t.requester.name}</strong> · {ROLE[t.requester.role]} · {t.requester.email}{t.branch ? ` · ${t.branch}` : ''}</div>
                  <div className="st-controls">
                    <label>Status<select value={t.status} onChange={(e) => patch({ status: e.target.value })}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                    <label>Priority<select value={t.priority} onChange={(e) => patch({ priority: e.target.value })}>{Object.keys(PRIORITY).map((k) => <option key={k} value={k}>{PRIORITY[k][0]}</option>)}</select></label>
                    <label>Assignee<select value={t.assigned_to || ''} onChange={(e) => patch({ assigned_to: e.target.value || null })}><option value="">Unassigned</option>{list?.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                  </div>
                  {t.context && <p className="sup-context"><strong>Context:</strong> {[t.context.page, t.context.browser, t.context.os, t.context.app_version && `v${t.context.app_version}`].filter(Boolean).join(' · ')}</p>}
                  <div className="st-thread" aria-live="polite">
                    {detail.messages.map((m) => (
                      <div key={m.id} className={`st-msg ${m.sender_role === 'super_admin' ? 'admin' : 'user'} ${m.is_internal ? 'internal' : ''}`}>
                        <span className="st-msg-who">{m.is_internal && <Lock size={12} aria-hidden="true" />} {m.is_internal ? 'Internal note' : m.sender} · {when(m.created_at)}</span>
                        <div className="st-bubble"><RichText text={m.body} />{m.attachments.map((a) => <button key={a.index} type="button" className="sup-attach" onClick={() => openFile(m, a)}><Paperclip size={14} aria-hidden="true" /> {a.file_name}</button>)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="st-compose">
                    <div className="st-modes" role="tablist"><button type="button" role="tab" aria-selected={mode === 'reply'} className={mode === 'reply' ? 'on' : ''} onClick={() => setMode('reply')}>Reply</button><button type="button" role="tab" aria-selected={mode === 'note'} className={mode === 'note' ? 'on note' : ''} onClick={() => setMode('note')}><Lock size={13} aria-hidden="true" /> Internal note</button></div>
                    <textarea aria-label={mode === 'note' ? 'Internal note' : 'Reply'} rows={3} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === 'note' ? 'Only Super Admins can see this note…' : 'Write a reply. The requester is notified (without the message text in email).'} />
                    <button type="button" className="sup-btn" disabled={busy || !text.trim()} onClick={send}><Send size={16} aria-hidden="true" /> {busy ? 'Sending…' : mode === 'note' ? 'Add note' : 'Send reply'}</button>
                  </div>
                </>
              )
            })()}
          </section>
        </div>
      </div>
      {toast && <div role="status" className="st-toast">{toast}</div>}
      {locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => { setLocked(false); loadList() }} onSignOut={onLogout} />}
    </AdminPageShell>
  )
}
