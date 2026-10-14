import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2, Copy, EyeOff, Gamepad2, Inbox, LayoutGrid, List, MoreVertical, Pencil, PencilLine, Plus, Search, Send, Star, Trash2, X,
} from 'lucide-react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'
import { GameIcon, SKILLS, skillOf } from './games/gameIcons'
import { DeclineDialog, OwnerRequests, RequestsDrawer } from './games/RequestsPanel'
import LockScreen from '../therapist/notes/IdleLock'
import { authFetch } from '../../utils/session'
import { publishGame, unpublishGame } from './builder/builderApi'

// /admin/games-library/games — every game, its last-30-days usage, and the
// owner requests waiting for a decision. Super Admin only (checked on the
// server); publish / unpublish / delete / approve / decline all land in
// audit_logs. Status, search, skill, difficulty, sort and view live in the URL.
const GREEN = '#234C40'
const BUILDER = '/admin/games-library/builder'
const STATE = {
  published: { label: 'Published', icon: CheckCircle2, bg: '#fff', fg: '#166534' },
  unpublished: { label: 'Unpublished', icon: EyeOff, bg: '#fff', fg: '#9f1239' },
  draft: { label: 'Draft', icon: PencilLine, bg: '#fff', fg: '#92400E' },
}
const TABS = [['all', 'All'], ['published', 'Published'], ['draft', 'Draft'], ['unpublished', 'Unpublished']]
const SORTS = [['plays', 'Most played', 'desc'], ['newest', 'Newest', 'desc'], ['az', 'A–Z', 'asc'], ['accuracy', 'Highest accuracy', 'desc']]
const SORT_VALUE = {
  plays: (g) => g.usage.plays, newest: (g) => (g.createdAt ? new Date(g.createdAt).getTime() : 0), az: (g) => g.name.toLowerCase(),
  accuracy: (g) => g.usage.accuracy ?? -1, name: (g) => g.name.toLowerCase(), skill: (g) => skillOf(g.skill).long, difficulty: (g) => ['easy', 'medium', 'hard'].indexOf(g.difficulty),
  ages: (g) => g.ageRange?.min ?? -1, points: (g) => g.points, state: (g) => g.state, patients: (g) => g.usage.patients,
}
const ageText = (g) => (g.ageRange && g.ageRange.min != null ? `Ages ${g.ageRange.min}–${g.ageRange.max}` : null)
const selectBox = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: 12, border: '1px solid #dbe3df', background: '#fff', padding: '0 12px', fontSize: 13, color: '#5d7770', fontWeight: 700 }
const selectIn = { border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: '#1f3d36', cursor: 'pointer', minHeight: 40 }
const btn = (primary, disabled) => ({ minHeight: 44, borderRadius: 12, padding: '0 14px', fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, border: primary ? 'none' : '1px solid #dbe3df', background: primary ? GREEN : '#fff', color: primary ? '#fff' : '#1f3d36', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' })

function StatusPill({ state, style }) {
  const s = STATE[state]
  const Icon = s.icon
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 10px', background: s.bg, color: s.fg, fontSize: 12, fontWeight: 800, boxShadow: '0 1px 3px rgba(0,0,0,.1)', ...style }}><Icon size={13} aria-hidden="true" />{s.label}</span>
}
function Tag({ children, color, bg }) {
  return <span style={{ borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 800, color: color || '#4B5B56', background: bg || '#F1F5F3', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}</span>
}

function GameMenu({ game, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const item = (disabled) => ({ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, border: 'none', background: 'transparent', padding: '0 14px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, textAlign: 'left', color: '#1f3d36' })
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" aria-label={`More actions for ${game.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ width: 44, height: 44, border: 'none', background: 'rgba(255,255,255,.7)', borderRadius: 12, cursor: 'pointer', color: '#1f3d36', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MoreVertical size={18} aria-hidden="true" /></button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: 46, zIndex: 30, minWidth: 200, background: '#fff', borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,.18)', border: '1px solid #e3e8e4', padding: 4 }}>
          <button type="button" role="menuitem" style={item(game.builtIn)} disabled={game.builtIn} title={game.builtIn ? 'Built-in games have no layout to copy' : undefined} onClick={() => { setOpen(false); onDuplicate(game) }}><Copy size={16} aria-hidden="true" /> Duplicate</button>
          <button type="button" role="menuitem" style={{ ...item(false), color: '#b91c1c' }} onClick={() => { setOpen(false); onDelete(game) }}><Trash2 size={16} aria-hidden="true" /> Delete…</button>
        </div>
      )}
    </div>
  )
}

export function GameCard({ g, busy, onPublish, onUnpublish, onEdit, onDuplicate, onDelete }) {
  const s = skillOf(g.skill)
  return (
    <article style={{ display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, overflow: 'visible', minWidth: 0 }}>
      <div style={{ position: 'relative', height: 84, background: s.tint, borderRadius: '20px 20px 0 0' }}>
        <StatusPill state={g.state} style={{ position: 'absolute', top: 12, left: 12 }} />
        <div style={{ position: 'absolute', top: 4, right: 6 }}><GameMenu game={g} onDuplicate={onDuplicate} onDelete={onDelete} /></div>
        <span style={{ position: 'absolute', left: 16, bottom: -24, width: 58, height: 58, borderRadius: 16, background: '#fff', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,0,0,.12)' }}><GameIcon name={g.icon} size={28} /></span>
      </div>
      <div style={{ padding: '36px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1f3d36', overflowWrap: 'anywhere' }}>{g.name}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5d7770', lineHeight: 1.45, minHeight: 38, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description || 'No description yet.'}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag color={s.color} bg={s.tint}>{s.label}</Tag>
          <Tag color={g.difficulty === 'hard' ? '#B4233C' : g.difficulty === 'medium' ? '#92400E' : '#166534'} bg={g.difficulty === 'hard' ? '#FDE3E8' : g.difficulty === 'medium' ? '#FCEBC6' : '#D9F2E3'}>{g.difficulty[0].toUpperCase() + g.difficulty.slice(1)}</Tag>
          {ageText(g) && <Tag>{ageText(g)}</Tag>}
          <Tag><Star size={12} aria-hidden="true" /> +{g.points} pts</Tag>
        </div>
        <div style={{ background: '#F5F8F6', borderRadius: 14, padding: '10px 6px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', marginTop: 'auto' }} aria-label="Last 30 days">
          {[[g.usage.plays || '—', 'plays / mo'], [g.usage.accuracy != null ? `${g.usage.accuracy}%` : '—', 'accuracy'], [g.usage.patients || '—', 'patients']].map(([v, l]) => (
            <div key={l}><div style={{ fontSize: 17, fontWeight: 800, color: '#1f3d36' }}>{v}</div><div style={{ fontSize: 11, color: '#6b7c75', fontWeight: 600 }}>{l}</div></div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" style={btn(false)} onClick={() => onEdit(g)}><Pencil size={15} aria-hidden="true" /> Edit</button>
          {g.state === 'published'
            ? <button type="button" style={btn(false, busy)} disabled={busy} onClick={() => onUnpublish(g)}><EyeOff size={15} aria-hidden="true" /> {busy ? 'Working…' : 'Unpublish'}</button>
            : <button type="button" style={btn(true, busy)} disabled={busy} onClick={() => onPublish(g)}><Send size={15} aria-hidden="true" /> {busy ? 'Checking…' : 'Publish'}</button>}
        </div>
      </div>
    </article>
  )
}

export default function GamesLibraryPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = TABS.some(([id]) => id === params.get('status')) ? params.get('status') : 'all'
  const q = params.get('q') || ''
  const skill = SKILLS[params.get('skill')] ? params.get('skill') : 'all'
  const difficulty = ['easy', 'medium', 'hard'].includes(params.get('difficulty')) ? params.get('difficulty') : 'all'
  const sortKey = SORT_VALUE[params.get('sort')] ? params.get('sort') : 'plays'
  const dir = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : (SORTS.find(([id]) => id === sortKey)?.[2] || 'desc')
  const view = params.get('view') === 'list' ? 'list' : 'grid'

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [toast, setToast] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [declineTarget, setDeclineTarget] = useState(null)
  const [drawer, setDrawer] = useState(false)
  const [blocked, setBlocked] = useState(null) // { game, checklist }
  const requestsRef = useRef(null)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }
  const setParam = (patch) => setParams((p) => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k) } return n }, { replace: true })

  const load = useCallback(() => {
    authFetch('/api/admin/games/overview').then((b) => { setData(b); setError('') }).catch((e) => {
      if (e.code === 'SESSION_LOCKED') setLocked(true)
      else setError(e.code === 'NO_SESSION' ? 'Please sign in again with your Super Admin account to manage games.' : e.message)
    })
  }, [])
  useEffect(load, [load])

  const games = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    const get = SORT_VALUE[sortKey]
    return data.games.filter((g) => (status === 'all' || g.state === status)
      && (skill === 'all' || g.skill === skill) && (difficulty === 'all' || g.difficulty === difficulty)
      && (!needle || g.name.toLowerCase().includes(needle) || g.description.toLowerCase().includes(needle)))
      .sort((a, b) => { const x = get(a), y = get(b); const c = typeof x === 'string' ? x.localeCompare(y) : x - y; return (dir === 'asc' ? c : -c) || a.name.localeCompare(b.name) })
  }, [data, q, status, skill, difficulty, sortKey, dir])
  const counts = useMemo(() => { const c = { all: data?.games.length || 0, published: 0, draft: 0, unpublished: 0 }; (data?.games || []).forEach((g) => { c[g.state] += 1 }); return c }, [data])
  const pendingCount = (data?.requests || []).filter((r) => r.status === 'pending').length

  const act = async (id, fn) => {
    setBusyId(id)
    try { await fn() } catch (e) {
      if (e.code === 'SESSION_LOCKED') setLocked(true)
      else flash(e.message)
    } finally { setBusyId('') }
  }
  const publish = (g) => act(g.id, async () => {
    try { await publishGame(g.id); flash(`“${g.name}” is published`); load() } catch (e) {
      if (e.data?.checklist) setBlocked({ game: g, checklist: e.data.checklist }); else throw e
    }
  })
  const unpublish = (g) => {
    if (!window.confirm(`Unpublish “${g.name}”? Patients and therapists stop seeing it. Scores and history are kept.`)) return
    act(g.id, async () => { await unpublishGame(g.id); flash(`“${g.name}” is unpublished`); load() })
  }
  const duplicate = (g) => act(g.id, async () => { const r = await authFetch(`/api/admin/games/${g.id}/duplicate`, { method: 'POST', body: {} }); flash(`Created the draft “${r.name}”`); load() })
  const approve = (r) => act(r.id, async () => { const b = await authFetch(`/api/admin/game-requests/${r.id}/approve-build`, { method: 'POST', body: {} }); navigate(`${BUILDER}/${b.gameId}`) })
  const decline = async (r, reason) => {
    await authFetch(`/api/admin/game-requests/${r.id}`, { method: 'PATCH', body: { status: 'declined', message: reason } })
    setDeclineTarget(null); flash(`Declined “${r.name}” — the owner has been told`); load()
  }

  const sortBy = (key) => setParam({ sort: key === 'plays' ? '' : key, dir: sortKey === key ? (dir === 'asc' ? 'desc' : 'asc') : (['name', 'skill', 'difficulty', 'state'].includes(key) ? 'asc' : 'desc') })
  const presetValue = SORTS.some(([id, , d]) => id === sortKey && d === dir) ? sortKey : 'custom'

  const headerActions = (
    <>
      <button type="button" style={btn(false)} onClick={() => setDrawer(true)}><Inbox size={16} aria-hidden="true" /> All requests</button>
      <button type="button" style={btn(true)} onClick={() => navigate(`${BUILDER}/new`)}><Plus size={16} aria-hidden="true" /> Add game</button>
    </>
  )
  const statCards = data && [
    { icon: Gamepad2, bg: '#E3F0FD', fg: '#2563eb', value: data.stats.total, label: 'Total games', sub: `${data.stats.addedThisMonth} added this month` },
    { icon: CheckCircle2, bg: '#D9F2E3', fg: '#16a34a', value: data.stats.published, label: 'Published', sub: 'Visible to all branches' },
    { icon: PencilLine, bg: '#FCEBC6', fg: '#b45309', value: data.stats.notPublished, label: 'Draft or unpublished', sub: 'Hidden from patients' },
  ]

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="Games" subtitle="Review owner requests and manage every therapy game" menuItems={adminMenuItems} headerActions={headerActions}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", color: '#1f3d36' }}>
        {error && <div role="alert" style={{ background: '#FFF7E6', border: '2px solid #F3D284', borderRadius: 14, padding: 14, color: '#92400E', fontWeight: 700 }}>{error} <button type="button" style={btn(false)} onClick={load}>Retry</button></div>}
        {!data && !error && <p style={{ color: '#5d7770' }}>Loading games…</p>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              {statCards.map((c) => { const Icon = c.icon; return (
                <div key={c.label} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, padding: 16 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={24} aria-hidden="true" /></span>
                  <div><div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05 }}>{c.value} <span style={{ fontSize: 14, fontWeight: 700, color: '#3a4a45' }}>{c.label}</span></div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#1FA58A' }}>{c.sub}</div></div>
                </div>
              ) })}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: pendingCount ? '#FEF2F4' : '#fff', border: `1px solid ${pendingCount ? '#F9C6D2' : '#e3e8e4'}`, borderRadius: 20, padding: 16 }}>
                <span style={{ width: 48, height: 48, borderRadius: 14, background: '#FDE3E8', color: '#B4233C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Inbox size={24} aria-hidden="true" /></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, color: pendingCount ? '#B4233C' : '#1f3d36' }}>{pendingCount}</div><div style={{ fontSize: 13, fontWeight: 700, color: '#3a4a45' }}>Owner requests waiting</div></div>
                {pendingCount > 0 && <button type="button" onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ border: 'none', background: 'transparent', color: '#B4233C', fontWeight: 800, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>Review</button>}
              </div>
            </div>

            <OwnerRequests requests={data.requests} sectionRef={requestsRef} onApprove={approve} onDecline={setDeclineTarget} onViewAll={() => setDrawer(true)} busyId={busyId} />

            {/* Filter row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, padding: 12 }}>
              <div role="group" aria-label="Status" style={{ display: 'flex', gap: 4, background: '#F1F5F3', borderRadius: 14, padding: 4, flexWrap: 'wrap' }}>
                {TABS.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={status === id} onClick={() => setParam({ status: id === 'all' ? '' : id })}
                    style={{ minHeight: 40, borderRadius: 10, border: 'none', padding: '0 14px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', background: status === id ? GREEN : 'transparent', color: status === id ? '#fff' : '#3a4a45' }}>
                    {label} <span style={{ opacity: 0.7, fontSize: 12 }}>{counts[id]}</span>
                  </button>
                ))}
              </div>
              <label style={{ ...selectBox, flex: '1 1 200px' }}><Search size={16} aria-hidden="true" /><input type="search" value={q} onChange={(e) => setParam({ q: e.target.value })} placeholder="Search games…" aria-label="Search games" style={{ ...selectIn, flex: 1, minWidth: 0, fontWeight: 600, cursor: 'text' }} /></label>
              <label style={selectBox}>Skill<select style={selectIn} value={skill} onChange={(e) => setParam({ skill: e.target.value === 'all' ? '' : e.target.value })}><option value="all">All</option>{Object.values(SKILLS).map((s) => <option key={s.id} value={s.id}>{s.long}</option>)}</select></label>
              <label style={selectBox}>Difficulty<select style={selectIn} value={difficulty} onChange={(e) => setParam({ difficulty: e.target.value === 'all' ? '' : e.target.value })}><option value="all">All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
              <label style={selectBox}>Sort<select style={selectIn} value={presetValue} onChange={(e) => { const x = SORTS.find(([id]) => id === e.target.value); if (x) setParam({ sort: x[0] === 'plays' ? '' : x[0], dir: '' }) }}>{presetValue === 'custom' && <option value="custom" disabled>By column</option>}{SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
              <div role="group" aria-label="View" style={{ display: 'flex', gap: 2, background: '#F1F5F3', borderRadius: 12, padding: 3 }}>
                {[['grid', LayoutGrid, 'Grid view'], ['list', List, 'List view']].map(([id, Icon, name]) => (
                  <button key={id} type="button" aria-label={name} aria-pressed={view === id} onClick={() => setParam({ view: id === 'grid' ? '' : id })}
                    style={{ width: 44, height: 40, borderRadius: 9, border: 'none', cursor: 'pointer', background: view === id ? GREEN : 'transparent', color: view === id ? '#fff' : '#3a4a45', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} aria-hidden="true" /></button>
                ))}
              </div>
            </div>

            {games.length === 0 && data.games.length > 0 && <p style={{ textAlign: 'center', color: '#5d7770', fontWeight: 700, padding: 24 }}>No games match these filters.</p>}

            {view === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
                {games.map((g) => <GameCard key={g.id} g={g} busy={busyId === g.id} onPublish={publish} onUnpublish={unpublish} onEdit={(x) => navigate(`${BUILDER}/${x.id}`)} onDuplicate={duplicate} onDelete={setDeleteTarget} />)}
                <button type="button" onClick={() => navigate(`${BUILDER}/new`)} style={{ minHeight: 280, borderRadius: 20, border: '2px dashed #cfe0d8', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: '#1f3d36', fontFamily: 'inherit', padding: 20 }}>
                  <span style={{ width: 64, height: 64, borderRadius: 20, background: '#E4F2EC', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={30} aria-hidden="true" /></span>
                  <strong style={{ fontSize: 17 }}>Create a new game</strong>
                  <span style={{ fontSize: 13, color: '#5d7770', maxWidth: 200, textAlign: 'center' }}>Open the game builder with a template</span>
                </button>
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e3e8e4', borderRadius: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 800, color: '#6b7c75', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {[['name', 'Game'], ['skill', 'Skill'], ['difficulty', 'Difficulty'], ['ages', 'Ages'], ['points', 'Points'], ['state', 'Status'], ['plays', 'Plays / mo'], ['accuracy', 'Accuracy'], ['patients', 'Patients']].map(([key, label]) => (
                        <th key={key} scope="col" aria-sort={sortKey === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '4px 12px' }}>
                          <button type="button" onClick={() => sortBy(key)} style={{ border: 'none', background: 'transparent', font: 'inherit', color: sortKey === key ? '#1f3d36' : '#6b7c75', cursor: 'pointer', minHeight: 44, textTransform: 'inherit', letterSpacing: 'inherit', padding: 0 }}>{label}{sortKey === key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                        </th>
                      ))}
                      <th scope="col" style={{ padding: '4px 12px' }}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g) => { const s = skillOf(g.skill); return (
                      <tr key={g.id} style={{ borderTop: '1px solid #eef2f0' }}>
                        <td style={{ padding: '10px 12px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 38, height: 38, borderRadius: 11, background: s.tint, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GameIcon name={g.icon} size={20} /></span><strong style={{ fontSize: 14 }}>{g.name}</strong></div></td>
                        <td style={{ padding: '10px 12px' }}><Tag color={s.color} bg={s.tint}>{s.label}</Tag></td>
                        <td style={{ padding: '10px 12px', fontSize: 13.5, textTransform: 'capitalize' }}>{g.difficulty}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13.5, whiteSpace: 'nowrap' }}>{g.ageRange?.min != null ? `${g.ageRange.min}–${g.ageRange.max}` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13.5 }}>+{g.points}</td>
                        <td style={{ padding: '10px 12px' }}><StatusPill state={g.state} style={{ boxShadow: 'none', border: '1px solid #e3e8e4' }} /></td>
                        <td style={{ padding: '10px 12px', fontWeight: 800 }}>{g.usage.plays || '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800 }}>{g.usage.accuracy != null ? `${g.usage.accuracy}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800 }}>{g.usage.patients || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button type="button" style={btn(false)} onClick={() => navigate(`${BUILDER}/${g.id}`)}>Edit</button>
                            {g.state === 'published' ? <button type="button" style={btn(false, busyId === g.id)} disabled={busyId === g.id} onClick={() => unpublish(g)}>Unpublish</button> : <button type="button" style={btn(true, busyId === g.id)} disabled={busyId === g.id} onClick={() => publish(g)}>Publish</button>}
                            <GameMenu game={g} onDuplicate={duplicate} onDelete={setDeleteTarget} />
                          </div>
                        </td>
                      </tr>
                    ) })}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#6b7c75', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={14} aria-hidden="true" /> Unpublishing hides a game from patients but keeps their scores and history.</p>
          </>
        )}
      </div>

      {drawer && data && <RequestsDrawer requests={data.requests} onClose={() => setDrawer(false)} onApprove={approve} onDecline={(r) => { setDrawer(false); setDeclineTarget(r) }} busyId={busyId} />}
      {declineTarget && <DeclineDialog request={declineTarget} onClose={() => setDeclineTarget(null)} onConfirm={decline} />}
      {deleteTarget && <DeleteDialog game={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={(g) => { setDeleteTarget(null); flash(`Deleted “${g.name}”`); load() }} onUnpublish={(g) => { setDeleteTarget(null); unpublish(g) }} />}
      {blocked && (
        <div onClick={() => setBlocked(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="blk-title" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(460px, 100%)' }}>
            <h3 id="blk-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>“{blocked.game.name}” isn’t ready to publish</h3>
            <p style={{ fontSize: 13.5, color: '#5d7770' }}>These checks have to pass first ({blocked.checklist.done} of {blocked.checklist.total} done):</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13.5 }}>
              {blocked.checklist.items.map((i) => <li key={i.id} style={{ display: 'flex', gap: 8, padding: '4px 0', color: i.ok ? '#166534' : '#9a3412' }}>{i.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}<span>{i.label}{!i.ok && <span style={{ display: 'block', color: '#6b7c75' }}>{i.hint}</span>}</span></li>)}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" style={btn(false)} onClick={() => setBlocked(null)}>Close</button>
              <button type="button" style={btn(true)} onClick={() => navigate(`${BUILDER}/${blocked.game.id}`)}>Open in builder</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 3500, background: GREEN, color: '#fff', borderRadius: 999, padding: '10px 20px', fontWeight: 700, fontSize: 14, maxWidth: '90vw' }}>{toast}</div>}
      {locked && <LockScreen reason="Your session was locked after a period of inactivity." userName={user?.name} onUnlocked={() => { setLocked(false); load() }} onSignOut={onLogout} />}
    </AdminPageShell>
  )
}

// Delete needs the game's exact name typed. A game that has ever been played
// can't be deleted (the server refuses); the dialog points at Unpublish.
export function DeleteDialog({ game, onClose, onDeleted, onUnpublish }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(game.builtIn ? { code: 'BUILT_IN', message: 'Built-in games can be unpublished but not deleted.' } : game.everPlayed > 0 ? { code: 'PLAYED', message: `This game has been played ${game.everPlayed} time${game.everPlayed === 1 ? '' : 's'}. Unpublish it instead so patients keep their scores and history.` } : null)
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus(); const k = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const submit = async () => {
    setBusy(true)
    try { await authFetch(`/api/admin/games/${game.id}`, { method: 'DELETE', body: { confirmName: typed } }); onDeleted(game) } catch (e) {
      if (e.data?.code === 'PLAYED' || e.data?.code === 'BUILT_IN') setProblem({ code: e.data.code, message: e.message })
      else setProblem({ code: 'ERR', message: e.message })
      setBusy(false)
    }
  }
  const blockedForever = problem && problem.code !== 'ERR'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(440px, 100%)' }}>
        <h3 id="del-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Delete “{game.name}”?</h3>
        {blockedForever ? <p role="alert" style={{ fontSize: 14, color: '#9a3412', lineHeight: 1.5 }}>{problem.message}</p> : (
          <>
            <p style={{ fontSize: 13.5, color: '#5d7770', lineHeight: 1.5 }}>This game has never been played, so it can be deleted. This cannot be undone. Type <strong>{game.name}</strong> to confirm.</p>
            <input ref={ref} value={typed} onChange={(e) => { setTyped(e.target.value); setProblem(null) }} aria-label="Type the game name to confirm" style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10, border: '1px solid #dbe3df', padding: '0 12px', fontFamily: 'inherit', fontSize: 14 }} />
            {problem && <span role="alert" style={{ color: '#b91c1c', fontSize: 12.5 }}>{problem.message}</span>}
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" style={btn(false)} onClick={onClose}>Cancel</button>
          {blockedForever && game.state === 'published' && <button type="button" style={btn(true)} onClick={() => onUnpublish(game)}>Unpublish instead</button>}
          {!blockedForever && <button type="button" style={{ ...btn(true, busy || typed !== game.name), background: '#B4233C' }} disabled={busy || typed !== game.name} onClick={submit}>{busy ? 'Deleting…' : 'Delete game'}</button>}
        </div>
      </div>
    </div>
  )
}
