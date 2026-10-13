import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { AREA_BY_ID, REQUEST_SKILLS, SKILL_BY_ID, areaOf } from './gamified/areas'
import {
  GREEN_900, GREEN_700, MUTED, BORDER, CARD, FONT,
  CardTitle, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, fmtDate,
} from './gamified/shared'

// /owner/gamified-activities/request — the owner's game requests, backed by
// GET/POST /api/owner/game-requests (owner role checked on the server). The
// Super Admin answers from the admin Games page; every status change or reply
// notifies the owner in-app (bell in the header) and by email.
const STATUS = {
  pending: { label: 'Pending review', bg: '#FDEBC8', fg: '#92400E' },
  approved: { label: 'Approved', bg: '#D9F2E3', fg: '#166534' },
  dev: { label: 'In development', bg: '#DCEBFC', fg: '#1E40AF' },
  live: { label: 'Live', bg: '#D3F0EA', fg: '#0F766E' },
  declined: { label: 'Declined', bg: '#FDE3E8', fg: '#B4233C' },
}
const TABS = [
  { id: 'all', label: 'All' }, { id: 'pending', label: 'Pending' }, { id: 'approved', label: 'Approved' },
  { id: 'dev', label: 'In development' }, { id: 'live', label: 'Live' }, { id: 'declined', label: 'Declined' },
]
const STEPS = ['Submitted', 'Reviewed', 'In development', 'Live']
// Index of the step that is "current" for each status (earlier steps are done).
const CURRENT_STEP = { pending: 1, approved: 2, dev: 2, live: 4 }
const TEAL = '#1FA58A'
const EMPTY_FORM = { name: '', skill: 'speech', ageMin: '', ageMax: '', priority: 'medium', reason: '', referenceUrl: '' }
const MAX_FILE = 5 * 1024 * 1024
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

const inputStyle = (bad) => ({
  width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 12, border: `1.5px solid ${bad ? '#DC2626' : BORDER}`,
  background: '#F8FAF9', padding: '0 14px', fontSize: 14, fontFamily: 'inherit', color: GREEN_900,
})
const labelStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: GREEN_900, marginBottom: 6 }
const errStyle = { color: '#B4233C', fontSize: 12, marginTop: 4, display: 'block' }

const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)

// Library games that look like what the owner is typing: same / overlapping
// name, or the same skill area with a shared keyword.
function findSimilar(games, name, skillId) {
  const q = name.trim().toLowerCase()
  if (q.length < 3) return []
  const qt = new Set(tokens(q))
  const area = SKILL_BY_ID[skillId]?.area
  return games
    .filter((g) => g.status !== 'archived')
    .map((g) => {
      const n = g.name.toLowerCase()
      const nt = tokens(n)
      const shared = nt.filter((t) => qt.has(t)).length
      let score = 0
      if (n === q) score = 100
      else if (n.includes(q) || q.includes(n)) score = 80
      else if (shared > 0) score = 50 + shared * 10
      else if (area && areaOf(g) === area && tokens(g.description).some((t) => qt.has(t))) score = 30
      return { g, score }
    })
    .filter((x) => x.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.g)
}

function Pill({ status }) {
  const s = STATUS[status]
  return <span className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>{s.label}</span>
}

function Tracker({ status }) {
  if (status === 'declined') {
    return (
      <ol aria-label="Request progress" className="flex items-center" style={{ listStyle: 'none', margin: '14px 0 4px', padding: 0 }}>
        <Step label="Submitted" state="done" />
        <Line done />
        <Step label="Declined" state="declined" />
      </ol>
    )
  }
  const current = CURRENT_STEP[status]
  return (
    <ol aria-label="Request progress" className="flex items-center" style={{ listStyle: 'none', margin: '14px 0 4px', padding: 0 }}>
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={label} style={{ display: 'contents' }}>
            <Step label={label} state={state} />
            {i < STEPS.length - 1 && <Line done={i < current} />}
          </li>
        )
      })}
    </ol>
  )
}
function Step({ label, state }) {
  const base = { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0, fontSize: 12, fontWeight: 900 }
  const styles = {
    done: { ...base, background: TEAL, color: '#fff' },
    current: { ...base, border: `3px solid ${TEAL}`, background: '#fff' },
    todo: { ...base, background: '#E8EEEA' },
    declined: { ...base, background: '#DC2626', color: '#fff' },
  }
  return (
    <span className="flex flex-col items-center gap-1" style={{ minWidth: 64 }}>
      <span style={styles[state]} aria-hidden="true">{state === 'done' ? '✓' : state === 'declined' ? '×' : ''}</span>
      <span className="text-center text-[11px] font-bold" style={{ color: state === 'todo' ? '#94A39D' : state === 'declined' ? '#B4233C' : GREEN_900 }}>
        {label}<span className="sr-only"> ({state === 'done' ? 'done' : state === 'current' ? 'current' : state === 'declined' ? 'declined' : 'upcoming'})</span>
      </span>
    </span>
  )
}
function Line({ done }) {
  return <span aria-hidden="true" style={{ flex: 1, height: 3, borderRadius: 2, background: done ? TEAL : '#E8EEEA', marginBottom: 18 }} />
}

function ReplyBox({ reply }) {
  return (
    <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: '#F5F8F6' }}>
      <p className="text-[12.5px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{reply.name || 'Super Admin'} · {fmtDate(reply.at, false)}</p>
      <p className="text-[13px]" style={{ color: '#3a4a45', lineHeight: 1.45, margin: '2px 0 0' }}>{reply.message}</p>
    </div>
  )
}

function RequestDrawer({ r, email, onClose }) {
  const closeRef = useRef(null)
  const skill = SKILL_BY_ID[r.skill]
  useEffect(() => {
    const prev = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])
  const fileHref = r.attachment ? `/api/owner/game-requests/${r.id}/file?${new URLSearchParams({ email })}` : null
  const Field = ({ label, children }) => (
    <div className="py-2.5" style={{ borderTop: '1px solid #EDF2F0' }}>
      <p className="text-[11px] font-extrabold uppercase" style={{ color: MUTED, margin: 0 }}>{label}</p>
      <div className="text-[14px]" style={{ color: GREEN_900, margin: '2px 0 0', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label={`${r.name} request`} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(480px, 100%)', height: '100%', overflowY: 'auto', background: '#fff', padding: 20, fontFamily: FONT }}>
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-[24px]" style={{ background: skill.tint }} aria-hidden="true">{skill.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 style={{ fontSize: 19, fontWeight: 800, color: GREEN_900, margin: 0, overflowWrap: 'anywhere' }}>{r.name}</h2>
            <div className="mt-1.5"><Pill status={r.status} /></div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close request"
            style={{ width: 44, height: 44, border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff', fontSize: 20, cursor: 'pointer', color: GREEN_900 }}>×</button>
        </div>
        <Tracker status={r.status} />
        <div className="mt-3">
          <Field label="Skill focus">{skill.label}</Field>
          <Field label="Age range">{r.ageMin}–{r.ageMax} years old</Field>
          <Field label="Priority">{r.priority[0].toUpperCase() + r.priority.slice(1)}</Field>
          <Field label="Submitted">{fmtDate(r.submittedAt)}</Field>
          <Field label="Why this would help your patients">{r.reason}</Field>
          {r.referenceUrl && <Field label="Reference link"><a href={r.referenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: GREEN_700, fontWeight: 700 }}>{r.referenceUrl}</a></Field>}
          {r.attachment && <Field label="Attachment"><a href={fileHref} target="_blank" rel="noopener noreferrer" style={{ color: GREEN_700, fontWeight: 700 }}>{r.attachment.name}</a> <span style={{ color: MUTED }}>({Math.max(1, Math.round(r.attachment.size / 1024))} KB)</span></Field>}
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, margin: '18px 0 0' }}>Replies</h3>
        {r.replies.length === 0 ? <p className="text-[13px]" style={{ color: MUTED }}>No replies yet. You’ll be notified when the Super Admin responds.</p>
          : [...r.replies].reverse().map((rep, i) => <ReplyBox key={i} reply={rep} />)}
      </aside>
    </div>
  )
}

export default function OwnerRequestGamePage({ user, onLogout, betaTier }) {
  const email = user?.email
  const [requests, setRequests] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [libraryGames, setLibraryGames] = useState([])
  const [statusTab, setStatusTab] = useState('all')
  const [mobileTab, setMobileTab] = useState('form')
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [resubmitOf, setResubmitOf] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [withdrawing, setWithdrawing] = useState(null)
  const [toast, setToast] = useState('')
  const [similar, setSimilar] = useState([])
  const fileRef = useRef(null)
  const nameRef = useRef(null)

  const load = useCallback(() => {
    if (!email) return
    setLoadError('')
    fetch(`/api/owner/game-requests?${new URLSearchParams({ email })}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setRequests(b.requests) : setLoadError(b.error || 'Could not load your requests.')))
      .catch(() => setLoadError('Could not load your requests.'))
  }, [email])
  useEffect(load, [load])

  // The Activity Library, for the "similar activity" check.
  useEffect(() => {
    if (!email) return
    fetch(`/api/owner/gamified/library?${new URLSearchParams({ email })}`)
      .then((r) => r.json()).then((b) => setLibraryGames(b.games || [])).catch(() => {})
  }, [email])

  // Debounced similar-activity search while typing the name / changing skill.
  useEffect(() => {
    const t = setTimeout(() => setSimilar(findSimilar(libraryGames, form.name, form.skill)), 350)
    return () => clearTimeout(t)
  }, [form.name, form.skill, libraryGames])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const setField = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setErrors((e) => ({ ...e, [key]: '' })); setSent(false) }

  const stats = useMemo(() => {
    const list = requests || []
    const now = new Date()
    return {
      pending: list.filter((r) => r.status === 'pending').length,
      dev: list.filter((r) => r.status === 'dev').length,
      approvedThisMonth: list.filter((r) => r.approvedAt && new Date(r.approvedAt).getMonth() === now.getMonth() && new Date(r.approvedAt).getFullYear() === now.getFullYear()).length,
      live: list.filter((r) => r.status === 'live').length,
    }
  }, [requests])
  const counts = useMemo(() => {
    const list = requests || []
    return Object.fromEntries(TABS.map((t) => [t.id, t.id === 'all' ? list.length : list.filter((r) => r.status === t.id).length]))
  }, [requests])
  const visible = (requests || []).filter((r) => statusTab === 'all' || r.status === statusTab)

  const validate = () => {
    const e = {}
    const name = form.name.trim()
    if (!name) e.name = 'Give the game a name or a short idea.'
    const from = Number(form.ageMin), to = Number(form.ageMax)
    if (!Number.isInteger(from) || from < 2 || from > 18) e.ageMin = 'Enter a start age from 2 to 18.'
    if (!Number.isInteger(to) || to < 2 || to > 18) e.ageMax = 'Enter an end age from 2 to 18.'
    if (!e.ageMin && !e.ageMax && from > to) e.ageMax = 'End age must be the same as or after the start age.'
    if (!form.reason.trim()) e.reason = 'Tell the Super Admin how this helps your patients.'
    if (form.referenceUrl.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(form.referenceUrl.trim()).protocol)) throw new Error('x') } catch { e.referenceUrl = 'Enter a full link starting with https://' }
    }
    return e
  }

  const pickFile = (f) => {
    if (!f) return
    if (!FILE_TYPES.includes(f.type)) { setErrors((e) => ({ ...e, file: 'Attach a PNG, JPG, WebP or PDF.' })); return }
    if (f.size > MAX_FILE) { setErrors((e) => ({ ...e, file: 'The file is too large (max 5 MB).' })); return }
    setErrors((e) => ({ ...e, file: '' }))
    setFile(f)
  }

  const resetForm = () => {
    setForm(EMPTY_FORM); setErrors({}); setFile(null); setEditingId(null); setResubmitOf(null); setFormError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const startEdit = (r) => {
    setEditingId(r.id); setResubmitOf(null); setFile(null); setErrors({}); setFormError(''); setSent(false)
    setForm({ name: r.name, skill: r.skill, ageMin: String(r.ageMin), ageMax: String(r.ageMax), priority: r.priority, reason: r.reason, referenceUrl: r.referenceUrl || '' })
    setMobileTab('form'); nameRef.current?.focus()
  }
  const startResubmit = (r) => {
    startEdit(r)
    setEditingId(null); setResubmitOf(r.id)
  }

  const handleSubmit = async (evt) => {
    evt.preventDefault()
    const e = validate()
    if (Object.keys(e).length || errors.file) { setErrors({ ...e, file: errors.file }); setFormError('Please fix the highlighted fields.'); return }
    setSubmitting(true); setFormError('')
    try {
      let res
      if (editingId) {
        res = await fetch(`/api/owner/game-requests/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, ...form, name: form.name.trim(), reason: form.reason.trim() }),
        })
      } else {
        const fd = new FormData()
        fd.append('email', email)
        Object.entries({ ...form, name: form.name.trim(), reason: form.reason.trim() }).forEach(([k, v]) => fd.append(k, v))
        if (resubmitOf) fd.append('resubmitOf', resubmitOf)
        if (file) fd.append('file', file)
        res = await fetch('/api/owner/game-requests', { method: 'POST', body: fd })
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body.fields) setErrors(body.fields)
        throw new Error(body.error || 'Could not send your request.')
      }
      const saved = body.request
      setRequests((list) => (editingId ? list.map((r) => (r.id === editingId ? saved : r)) : [saved, ...(list || [])]))
      logActivity({
        role: 'Owner', user: user?.name || 'Owner', email: email || '—', actionIcon: '🎮', action: 'Game Request',
        description: `${editingId ? 'Edited' : 'Requested'} a gamified activity: "${saved.name}" (${saved.skillLabel}, ages ${saved.ageMin}–${saved.ageMax})`,
        entity: 'Gamified Activities', status: 'Success',
      })
      showToast(editingId ? 'Request updated' : 'Request sent to the Super Admin')
      resetForm(); setSent(true); setStatusTab('all'); setMobileTab('list')
      setTimeout(() => setSent(false), 2600)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmWithdraw = async () => {
    const r = withdrawing
    try {
      const res = await fetch(`/api/owner/game-requests/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, action: 'withdraw' }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not withdraw the request.')
      setRequests((list) => list.filter((x) => x.id !== r.id))
      if (editingId === r.id) resetForm()
      showToast('Request withdrawn')
    } catch (err) {
      showToast(err.message)
    }
    setWithdrawing(null)
  }

  const closeViewing = useCallback(() => setViewing(null), [])
  const submitLabel = submitting ? 'Sending…' : sent ? '✓ Sent to the Super Admin' : editingId ? 'Save changes' : resubmitOf ? 'Resubmit to Super Admin →' : 'Send to Super Admin →'

  const summary = [
    { icon: '⏳', bg: '#FFF1D6', ib: '#FFE1A6', label: 'Pending review', value: stats.pending },
    { icon: '🛠️', bg: '#E3F0FD', ib: '#CFE5FB', label: 'In development', value: stats.dev },
    { icon: '✅', bg: '#E3F6EA', ib: '#C4EBD2', label: 'Approved this month', value: stats.approvedThisMonth },
    { icon: '🎮', bg: '#D9F2EC', ib: '#BFE8DD', label: 'Live games from requests', value: stats.live },
  ]

  return (
    <OwnerPageShell user={user} onLogout={onLogout} title="Request a Game" subtitle="Ask the Super Admin to build a new gamified activity for your clinic"
      menuItems={getOwnerMenuItems(betaTier)} beta>
      <div style={{ fontFamily: FONT }}>
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        <div className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((c) => (
              <div key={c.label} className="flex items-center gap-3 rounded-[22px] p-4" style={{ background: c.bg, minHeight: 88 }}>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: c.ib }} aria-hidden="true">{c.icon}</div>
                <div className="min-w-0">
                  <p className="text-[28px] font-extrabold leading-tight" style={{ color: GREEN_900, margin: 0 }}>{requests ? c.value : '–'}</p>
                  <p className="text-[13px] font-bold" style={{ color: '#3a4a45', margin: 0 }}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet / phone: switch between the form and the list */}
          <div className="flex gap-1 rounded-full bg-white p-1 lg:hidden" style={{ border: `1px solid ${BORDER}` }} role="tablist" aria-label="Request a game">
            {[['form', editingId ? 'Edit request' : 'New request'], ['list', `My requests${requests ? ` (${requests.length})` : ''}`]].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mobileTab === id} onClick={() => setMobileTab(id)}
                style={{ flex: 1, minHeight: 44, borderRadius: 999, border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: mobileTab === id ? GREEN_700 : 'transparent', color: mobileTab === id ? '#fff' : '#3a4a45' }}>{label}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Form (first on small screens; right column on desktop) */}
            <section className={`${mobileTab === 'form' ? 'block' : 'hidden'} lg:order-2 lg:block lg:sticky lg:top-4 lg:self-start`} style={CARD} aria-label="New request">
              <CardTitle sub="Reviewed within 3–5 business days">{editingId ? 'Edit request' : resubmitOf ? 'Resubmit request' : 'New request'}</CardTitle>
              {(editingId || resubmitOf) && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-bold" style={{ background: '#F5F8F6', color: GREEN_900 }}>
                  <span>{editingId ? 'You’re editing a pending request.' : 'Pre-filled from your declined request.'}</span>
                  <button type="button" onClick={resetForm} style={{ border: 'none', background: 'transparent', color: GREEN_700, fontWeight: 800, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>Cancel</button>
                </div>
              )}
              <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="rq-name" style={labelStyle}><span>Game name or idea</span><span style={{ color: MUTED, fontWeight: 600 }}>{form.name.length}/80</span></label>
                  <input id="rq-name" ref={nameRef} value={form.name} maxLength={80} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Underwater Word Hunt"
                    style={inputStyle(errors.name)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'rq-name-err' : undefined} />
                  {errors.name && <span id="rq-name-err" role="alert" style={errStyle}>{errors.name}</span>}
                  {similar.length > 0 && (
                    <div role="status" className="mt-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ background: '#FFF7E0', border: '1px solid #F3D284', color: '#7A4B06', lineHeight: 1.45 }}>
                      <strong>🔎 Similar activity found:</strong>{' '}
                      {similar.map((g, i) => (
                        <span key={g.id}>{i > 0 && ', '}{g.name} ({AREA_BY_ID[areaOf(g)].label}{g.ageRange ? `, ages ${g.ageRange.min ?? '?'}–${g.ageRange.max ?? '?'}` : ''})</span>
                      ))}
                      . <Link to={`/owner/gamified-activities/library?game=${similar[0].id}`} style={{ color: '#7A4B06', fontWeight: 800 }}>Open it in the Library</Link> to check it first.
                    </div>
                  )}
                </div>

                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend style={{ ...labelStyle, padding: 0 }}>Skill focus</legend>
                  <div className="flex flex-wrap gap-2">
                    {REQUEST_SKILLS.map((s) => {
                      const on = form.skill === s.id
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => setField('skill', s.id)}
                          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${on ? s.color : BORDER}`, background: on ? `${s.color}1a` : '#fff', color: GREEN_900 }}>
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div>
                  <span style={labelStyle}>Age range</span>
                  <div className="flex items-center gap-2">
                    <input aria-label="Age from" type="number" inputMode="numeric" min={2} max={18} value={form.ageMin} onChange={(e) => setField('ageMin', e.target.value)} placeholder="6" style={inputStyle(errors.ageMin)} aria-invalid={!!errors.ageMin} />
                    <span style={{ color: MUTED, fontWeight: 700 }}>to</span>
                    <input aria-label="Age to" type="number" inputMode="numeric" min={2} max={18} value={form.ageMax} onChange={(e) => setField('ageMax', e.target.value)} placeholder="10" style={inputStyle(errors.ageMax)} aria-invalid={!!errors.ageMax} />
                    <span className="text-[13px]" style={{ color: MUTED, whiteSpace: 'nowrap' }}>years old</span>
                  </div>
                  {(errors.ageMin || errors.ageMax) && <span role="alert" style={errStyle}>{errors.ageMin || errors.ageMax}</span>}
                </div>

                <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                  <legend style={{ ...labelStyle, padding: 0 }}>Priority</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((p) => {
                      const on = form.priority === p
                      return (
                        <button key={p} type="button" aria-pressed={on} onClick={() => setField('priority', p)}
                          style={{ minHeight: 44, borderRadius: 12, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', border: `1.5px solid ${on ? '#F3D284' : BORDER}`, background: on ? '#FFF1D6' : '#fff', color: on ? '#92400E' : GREEN_900 }}>
                          {p[0].toUpperCase() + p.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="rq-reason" style={labelStyle}><span>Why this would help your patients</span><span style={{ color: form.reason.length > 480 ? '#B4233C' : MUTED, fontWeight: 600 }}>{form.reason.length} / 500</span></label>
                  <textarea id="rq-reason" value={form.reason} maxLength={500} rows={4} onChange={(e) => setField('reason', e.target.value)}
                    placeholder="What problem does this game solve, and which patients is it for?"
                    style={{ ...inputStyle(errors.reason), padding: 12, minHeight: 100, resize: 'vertical' }} aria-invalid={!!errors.reason} />
                  {errors.reason && <span role="alert" style={errStyle}>{errors.reason}</span>}
                </div>

                <div>
                  <label htmlFor="rq-ref" style={labelStyle}><span>Reference link</span><span style={{ color: MUTED, fontWeight: 600 }}>optional</span></label>
                  <input id="rq-ref" type="url" value={form.referenceUrl} onChange={(e) => setField('referenceUrl', e.target.value)} placeholder="https://…" style={inputStyle(errors.referenceUrl)} aria-invalid={!!errors.referenceUrl} />
                  {errors.referenceUrl && <span role="alert" style={errStyle}>{errors.referenceUrl}</span>}
                </div>

                {!editingId && (
                  <div>
                    <span style={labelStyle}><span>Sketch or example</span><span style={{ color: MUTED, fontWeight: 600 }}>optional · image or PDF, max 5 MB</span></span>
                    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]) }}
                      className="rounded-xl px-3 py-3 text-center text-[13px]" style={{ border: `1.5px dashed ${errors.file ? '#DC2626' : '#CFE0D8'}`, color: MUTED }}>
                      {file ? (
                        <span style={{ color: GREEN_900, fontWeight: 700 }}>📎 {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB){' '}
                          <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} style={{ border: 'none', background: 'transparent', color: '#B4233C', fontWeight: 800, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>Remove</button></span>
                      ) : (
                        <>📎 Drop an image or PDF here, or{' '}
                          <button type="button" onClick={() => fileRef.current?.click()} style={{ border: 'none', background: 'transparent', color: GREEN_700, fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', minHeight: 44, fontFamily: 'inherit', fontSize: 13 }}>browse</button></>
                      )}
                      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={(e) => pickFile(e.target.files?.[0])} style={{ display: 'none' }} aria-label="Attach an image or PDF" />
                    </div>
                    {errors.file && <span role="alert" style={errStyle}>{errors.file}</span>}
                  </div>
                )}

                {formError && <p role="alert" style={{ ...errStyle, margin: 0, fontSize: 13, fontWeight: 700 }}>{formError}</p>}
                <PrimaryButton type="submit" onClick={undefined} disabled={submitting} style={{ width: '100%', minHeight: 48, borderRadius: 14, fontSize: 15, background: sent ? '#16a34a' : GREEN_700 }}>{submitLabel}</PrimaryButton>
                <p className="text-center text-[12px]" style={{ color: MUTED, margin: 0 }}>You’ll get an email and a notification when the status changes.</p>
              </form>
            </section>

            {/* My requests */}
            <section className={`${mobileTab === 'list' ? 'block' : 'hidden'} lg:order-1 lg:block`} style={CARD} aria-label="My requests">
              <CardTitle sub="Track what you’ve asked for and what the Super Admin says back">My requests</CardTitle>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status" style={{ flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
                {TABS.map((t) => {
                  const on = statusTab === t.id
                  return (
                    <button key={t.id} type="button" aria-pressed={on} onClick={() => setStatusTab(t.id)}
                      style={{ flex: '0 0 auto', minHeight: 44, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', border: on ? 'none' : `1px solid ${BORDER}`, background: on ? GREEN_700 : '#fff', color: on ? '#fff' : GREEN_900 }}>
                      {t.label} <span style={{ opacity: 0.75 }}>{counts[t.id]}</span>
                    </button>
                  )
                })}
              </div>

              {requests === null && !loadError && <div className="grid grid-cols-1 gap-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} style={{ height: 140 }} />)}</div>}
              {requests && visible.length === 0 && (
                <p className="py-8 text-center text-[14px] font-bold" style={{ color: MUTED }}>
                  {requests.length === 0 ? 'You haven’t requested a game yet. Use the form to send your first idea.' : 'No requests with this status.'}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3">
                {visible.map((r) => {
                  const skill = SKILL_BY_ID[r.skill]
                  const latest = r.replies[r.replies.length - 1]
                  return (
                    <article key={r.id} className="rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[22px]" style={{ background: skill.tint }} aria-hidden="true">{skill.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <h3 style={{ fontSize: 16, fontWeight: 800, color: GREEN_900, margin: 0, overflowWrap: 'anywhere' }}>{r.name}</h3>
                          <p className="text-[12.5px]" style={{ color: MUTED, margin: '2px 0 0' }}>{skill.label} · Ages {r.ageMin}–{r.ageMax} · Submitted {fmtDate(r.submittedAt)}</p>
                        </div>
                        <Pill status={r.status} />
                      </div>
                      <Tracker status={r.status} />
                      {latest && <ReplyBox reply={latest} />}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status === 'live' && (
                          <Link to={r.linkedGameId ? `/owner/gamified-activities/library?game=${r.linkedGameId}` : `/owner/gamified-activities/library?q=${encodeURIComponent(r.name)}`}
                            style={{ background: GREEN_700, color: '#fff', borderRadius: 999, padding: '0 16px', minHeight: 44, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>▶ Open in Library</Link>
                        )}
                        <SecondaryButton onClick={() => setViewing(r)}>View</SecondaryButton>
                        {r.status === 'pending' && <SecondaryButton onClick={() => startEdit(r)}>Edit</SecondaryButton>}
                        {r.status === 'pending' && <SecondaryButton onClick={() => setWithdrawing(r)} style={{ color: '#B4233C' }}>Withdraw</SecondaryButton>}
                        {r.status === 'declined' && <PrimaryButton onClick={() => startResubmit(r)}>↻ Resubmit</PrimaryButton>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      {viewing && <RequestDrawer r={viewing} email={email} onClose={closeViewing} />}

      {withdrawing && (
        <div onClick={() => setWithdrawing(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="wd-title" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(400px, 100%)', fontFamily: FONT }}>
            <h3 id="wd-title" style={{ fontSize: 18, fontWeight: 800, color: GREEN_900, margin: 0 }}>Withdraw this request?</h3>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>“{withdrawing.name}” will be removed and the Super Admin won’t review it.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setWithdrawing(null)}>Keep it</SecondaryButton>
              <PrimaryButton onClick={confirmWithdraw} style={{ background: '#B4233C' }}>Withdraw</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: GREEN_900, color: '#fff', borderRadius: 999, padding: '10px 18px', fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{toast}</div>}
    </OwnerPageShell>
  )
}
