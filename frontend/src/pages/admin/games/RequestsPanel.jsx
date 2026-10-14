import { useEffect, useRef, useState } from 'react'
import { Building2, Calendar, CheckCircle2, Inbox, X, XCircle } from 'lucide-react'
import { REQUEST_SKILL, skillOf } from './gameIcons'

// Owner requests: the section at the top of the Games page (pending only, max 3),
// the Decline dialog (a reason is required and the owner is notified) and the
// "All requests" drawer.
const GREEN = '#234C40'
const AGES = (r) => `Ages ${r.ageMin}–${r.ageMax}`
const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const PRIORITY = { high: { label: 'High priority', bg: '#FDE3E8', fg: '#B4233C' }, medium: { label: 'Medium priority', bg: '#FCEBC6', fg: '#92400E' }, low: { label: 'Low priority', bg: '#EEF1EF', fg: '#4B5B56' } }
const STATUS = { pending: ['Pending', '#FCEBC6', '#92400E'], approved: ['Approved', '#D9F2E3', '#166534'], dev: ['In development', '#DCEBFC', '#1E40AF'], live: ['Live', '#D3F0EA', '#0F766E'], declined: ['Declined', '#FDE3E8', '#B4233C'] }
const btn = (primary, disabled) => ({ minHeight: 44, borderRadius: 12, padding: '0 14px', fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, border: primary ? 'none' : '1px solid #dbe3df', background: primary ? GREEN : '#fff', color: primary ? '#fff' : '#1f3d36', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 })

function RequestCard({ r, onApprove, onDecline, busy, compact }) {
  const s = skillOf(REQUEST_SKILL[r.skill])
  const Icon = s.icon
  const p = PRIORITY[r.priority] || PRIORITY.medium
  return (
    <article style={{ background: '#fff', border: '1px solid #e3e8e4', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: s.tint, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} aria-hidden="true" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f3d36', overflowWrap: 'anywhere' }}>{r.name}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#5d7770' }}>{r.skillLabel} · {AGES(r)}</p>
        </div>
        <span style={{ borderRadius: 999, padding: '3px 10px', fontSize: 11.5, fontWeight: 800, background: p.bg, color: p.fg, whiteSpace: 'nowrap' }}>{p.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: '#3a4a45', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: compact ? 2 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.reason}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: '#5d7770', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Building2 size={14} aria-hidden="true" /> Requested by {r.ownerName || 'the owner'} <span aria-hidden="true">·</span> <Calendar size={14} aria-hidden="true" /> {fmt(r.submittedAt)}
      </p>
      {r.status === 'pending' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginTop: 'auto' }}>
          <button type="button" style={btn(false, busy)} disabled={busy} onClick={() => onDecline(r)}><XCircle size={16} aria-hidden="true" /> Decline</button>
          <button type="button" style={btn(true, busy)} disabled={busy} onClick={() => onApprove(r)}><CheckCircle2 size={16} aria-hidden="true" /> {busy ? 'Creating…' : 'Approve & build'}</button>
        </div>
      ) : (
        <span style={{ alignSelf: 'flex-start', borderRadius: 999, padding: '4px 12px', fontSize: 12.5, fontWeight: 800, background: STATUS[r.status]?.[1], color: STATUS[r.status]?.[2] }}>{STATUS[r.status]?.[0] || r.status}</span>
      )}
    </article>
  )
}

export function OwnerRequests({ requests, onApprove, onDecline, onViewAll, busyId, sectionRef }) {
  const pending = requests.filter((r) => r.status === 'pending')
  if (pending.length === 0) return null
  return (
    <section ref={sectionRef} id="owner-requests" aria-label="Owner requests" style={{ background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Inbox size={20} color={GREEN} aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f3d36' }}>Owner requests</h2>
        <span style={{ borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 800, background: '#FDE3E8', color: '#B4233C' }}>{pending.length} new</span>
        <button type="button" onClick={onViewAll} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: GREEN, fontWeight: 800, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>{pending.length > 3 ? `View all ${pending.length}` : 'View all'} ›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
        {pending.slice(0, 3).map((r) => <RequestCard key={r.id} r={r} compact onApprove={onApprove} onDecline={onDecline} busy={busyId === r.id} />)}
      </div>
    </section>
  )
}

export function DeclineDialog({ request, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); const k = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const submit = async () => {
    if (reason.trim().length < 3) { setError('Tell the owner why (a few words is fine).'); return }
    setBusy(true); setError('')
    try { await onConfirm(request, reason.trim()) } catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="decline-title" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(440px, 100%)' }}>
        <h3 id="decline-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f3d36' }}>Decline “{request.name}”?</h3>
        <p style={{ fontSize: 13.5, color: '#5d7770', lineHeight: 1.5 }}>The owner is told, in the app and by email, with the reason below.</p>
        <label htmlFor="decline-reason" style={{ fontWeight: 800, fontSize: 13, color: '#1f3d36' }}>Reason</label>
        <textarea id="decline-reason" ref={ref} rows={3} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, borderRadius: 10, border: `1px solid ${error ? '#dc2626' : '#dbe3df'}`, padding: 10, fontFamily: 'inherit', fontSize: 14 }} />
        {error && <span role="alert" style={{ color: '#b91c1c', fontSize: 12.5 }}>{error}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" style={btn(false)} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...btn(true, busy), background: '#B4233C' }} disabled={busy} onClick={submit}>{busy ? 'Declining…' : 'Decline request'}</button>
        </div>
      </div>
    </div>
  )
}

export function RequestsDrawer({ requests, onClose, onApprove, onDecline, busyId }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); const k = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label="All owner requests" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', height: '100%', overflowY: 'auto', background: '#f5f8f6', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1f3d36' }}>All requests</h2>
          <button ref={ref} type="button" onClick={onClose} aria-label="Close" style={{ ...btn(false), marginLeft: 'auto', width: 44, padding: 0 }}><X size={18} aria-hidden="true" /></button>
        </div>
        {requests.length === 0 ? <p style={{ color: '#5d7770' }}>No owner requests yet.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>{requests.map((r) => <RequestCard key={r.id} r={r} onApprove={onApprove} onDecline={onDecline} busy={busyId === r.id} />)}</div>
        )}
      </aside>
    </div>
  )
}
