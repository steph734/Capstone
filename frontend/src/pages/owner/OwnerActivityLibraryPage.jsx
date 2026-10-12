import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { GAMES } from '../GamifiedFullPage'
import { INITIAL_REQUESTS } from './OwnerRequestGamePage'
import {
  GREEN_900, GREEN_700, MUTED, BORDER, CARD, FONT,
  ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock, fmtDate,
} from './gamified/shared'

// /owner/gamified-activities/library — every game in the `games` collection,
// with this month's usage (GET /api/owner/gamified/library, owner role checked
// on the server). All filters, sort and view live in the URL.
const AREAS = [
  { id: 'speech', label: 'Speech & language', color: '#1FA58A', tint: '#D9F2EC' },
  { id: 'cognitive', label: 'Cognitive', color: '#7C5CE0', tint: '#E6DFFB' },
  { id: 'sel', label: 'Attention / SEL', color: '#EC4899', tint: '#FBDDEB' },
  { id: 'motor', label: 'Physical / motor', color: '#F59E0B', tint: '#FDEBC8' },
]
const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]))
function areaOf(game) {
  const t = String(game.therapyType || '').toLowerCase()
  if (t === 'speech') return 'speech'
  if (t === 'cognitive') return 'cognitive'
  if (t === 'physical' || t === 'occupational') return 'motor'
  return 'sel'
}
// DB status -> the three buckets the owner sees. A draft that has been
// test-played is "Beta"; an untested draft is "Coming soon".
function statusOf(game) {
  if (game.status === 'published') return 'live'
  if (game.status === 'archived') return 'archived'
  return game.testPlayed ? 'beta' : 'soon'
}
const STATUS = {
  live: { label: 'Live', bg: '#D9F2E3', fg: '#166534' },
  beta: { label: 'Beta', bg: '#E0E7FF', fg: '#3730A3' },
  soon: { label: 'Coming soon', bg: '#FDEBC8', fg: '#92400E' },
  archived: { label: 'Archived', bg: '#EEF1EF', fg: '#4B5B56' },
}
const AGE_BANDS = [
  { id: '3-5', label: 'Ages 3–5', lo: 3, hi: 5 },
  { id: '6-8', label: 'Ages 6–8', lo: 6, hi: 8 },
  { id: '9-12', label: 'Ages 9–12', lo: 9, hi: 12 },
  { id: '13+', label: 'Ages 13+', lo: 13, hi: 99 },
]
const SORTS = [
  { id: 'plays', label: 'Most played', dir: 'desc' },
  { id: 'accuracy', label: 'Highest accuracy', dir: 'desc' },
  { id: 'newest', label: 'Newest', dir: 'desc' },
  { id: 'name', label: 'A–Z', dir: 'asc' },
]
const FALLBACK_EMOJI = { speech: '🗣️', cognitive: '🧩', sel: '🎯', motor: '🤸' }
const SORT_VALUE = {
  name: (g) => g.name.toLowerCase(),
  area: (g) => AREA_BY_ID[g.area].label,
  ages: (g) => g.ageRange?.min ?? -1,
  status: (g) => g.statusKey,
  plays: (g) => g.usage.plays,
  patients: (g) => g.usage.patients,
  accuracy: (g) => g.usage.accuracy ?? -1,
  last: (g) => (g.usage.lastPlayedAt ? new Date(g.usage.lastPlayedAt).getTime() : 0),
  newest: (g) => (g.createdAt ? new Date(g.createdAt).getTime() : 0),
}
const NOTIFY_KEY = 'ownerLibraryNotify'

const ageText = (g) => (g.ageRange ? `${g.ageRange.min ?? '?'}–${g.ageRange.max ?? '?'}` : null)
const dash = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`)
const selectStyle = { minHeight: 44, borderRadius: 14, border: `1px solid ${BORDER}`, background: '#fff', color: GREEN_900, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '0 12px', maxWidth: '100%' }

function StatusBadge({ statusKey, style }) {
  const s = STATUS[statusKey]
  return <span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: s.bg, color: s.fg, whiteSpace: 'nowrap', ...style }}>{s.label}</span>
}
function Tag({ children, color }) {
  return <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: color ? `${color}1f` : '#F1F5F3', color: color || '#4B5B56', whiteSpace: 'nowrap' }}>{children}</span>
}
function Stat({ label, value }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-[15px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{value}</p>
      <p className="text-[10.5px] font-bold uppercase" style={{ color: MUTED, margin: 0 }}>{label}</p>
    </div>
  )
}

function ActivityCard({ g, notified, onNotify, onPreview, onDetails }) {
  const area = AREA_BY_ID[g.area]
  const soon = g.statusKey === 'soon'
  const canPreview = !soon && g.statusKey !== 'archived' && g.previewKey
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] bg-white" style={{ border: `1px solid ${BORDER}` }}>
      <div className="relative" style={{ height: 76, background: `linear-gradient(135deg, ${area.tint}, ${area.color}55)` }}>
        <StatusBadge statusKey={g.statusKey} style={{ position: 'absolute', top: 10, right: 10 }} />
        <span className="absolute flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-white text-[26px]"
          style={{ left: 16, bottom: -22, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }} aria-hidden="true">{g.emoji}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4" style={{ paddingTop: 32 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: GREEN_900, margin: 0 }}>{g.name}</h3>
          <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.45, margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>
            {g.description || 'No description yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Tag color={area.color}>{area.label}</Tag>
          {ageText(g) && <Tag>Ages {ageText(g)}</Tag>}
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: '#F5F8F6' }}>
          <p className="text-[10.5px] font-extrabold uppercase" style={{ color: MUTED, margin: '0 0 6px' }}>This month</p>
          <div className="flex gap-2">
            <Stat label="Plays" value={g.usage.plays || '—'} />
            <Stat label="Avg accuracy" value={dash(g.usage.accuracy, '%')} />
            <Stat label="Patients" value={g.usage.patients || '—'} />
          </div>
        </div>
        <div className="mt-auto flex gap-2">
          {soon ? (
            <PrimaryButton onClick={() => onNotify(g.id)} style={{ flex: 1, borderRadius: 12 }} aria-pressed={notified}>{notified ? '✓ We’ll let you know' : '🔔 Notify me'}</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => onPreview(g)} disabled={!canPreview} style={{ flex: 1, borderRadius: 12 }}
              title={canPreview ? undefined : 'A preview isn’t available for this activity yet'}>▶ Preview</PrimaryButton>
          )}
          <SecondaryButton onClick={() => onDetails(g)} style={{ flex: 1, borderRadius: 12 }}>Details</SecondaryButton>
        </div>
      </div>
    </article>
  )
}

function Drawer({ g, onClose, onPreview }) {
  const closeRef = useRef(null)
  const area = AREA_BY_ID[g.area]
  useEffect(() => {
    const prev = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])
  const Row = ({ label, children }) => (
    <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderTop: '1px solid #EDF2F0' }}>
      <span className="text-[13px]" style={{ color: MUTED }}>{label}</span>
      <span className="text-right text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{children}</span>
    </div>
  )
  const Section = ({ title, children }) => (
    <section className="mb-5"><h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, margin: '0 0 8px' }}>{title}</h3>{children}</section>
  )
  const soon = g.statusKey === 'soon'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,30,26,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label={`${g.name} details`} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(460px, 100%)', height: '100%', overflowY: 'auto', background: '#fff', padding: 20, fontFamily: FONT }}>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-[28px]" style={{ background: area.tint }} aria-hidden="true">{g.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 style={{ fontSize: 20, fontWeight: 800, color: GREEN_900, margin: 0 }}>{g.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5"><StatusBadge statusKey={g.statusKey} /><Tag color={area.color}>{area.label}</Tag>{ageText(g) && <Tag>Ages {ageText(g)}</Tag>}</div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details"
            style={{ width: 44, height: 44, border: `1px solid ${BORDER}`, borderRadius: 12, background: '#fff', fontSize: 20, cursor: 'pointer', color: GREEN_900 }}>×</button>
        </div>

        <Section title="About"><p style={{ fontSize: 14, color: GREEN_900, lineHeight: 1.55, margin: 0 }}>{g.description || 'No description yet.'}</p></Section>

        <Section title="Skills targeted">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Tag color={area.color}>{area.label}</Tag>
            {g.statGains.map((s) => <Tag key={s.key}>{s.label} +{s.value}</Tag>)}
          </div>
          {g.therapistNote && <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: 0 }}>{g.therapistNote}</p>}
        </Section>

        <Section title="Scoring">
          <Row label="XP per play">{g.pointsPerPlay || '—'}</Row>
          <Row label="Difficulty">{g.difficulty ? g.difficulty[0].toUpperCase() + g.difficulty.slice(1) : '—'}</Row>
          <Row label="Unlocks at Pao level">{g.unlockLevel}</Row>
          {g.levelCount > 0 && <Row label="Game levels">{g.levelCount}</Row>}
          <Row label="Accuracy">Correct answers ÷ attempts</Row>
        </Section>

        <Section title="This month">
          <Row label="Plays">{g.usage.plays || '—'}</Row>
          <Row label="Average accuracy">{dash(g.usage.accuracy, '%')}</Row>
          <Row label="Patients">{g.usage.patients || '—'}</Row>
          <Row label="Average session length">{g.usage.avgMinutes != null ? `${g.usage.avgMinutes} min` : '—'}</Row>
          <Row label="Last played">{fmtDate(g.usage.lastPlayedAt)}</Row>
        </Section>

        <Section title="Top patients this month">
          {g.usage.topPatients.length === 0 ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No one has played this in the last 30 days.</p> : (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {g.usage.topPatients.map((p, i) => <li key={i} className="py-1 text-[13.5px]" style={{ color: GREEN_900 }}><strong>{p.name}</strong> <span style={{ color: MUTED }}>· {p.plays} play{p.plays === 1 ? '' : 's'}</span></li>)}
            </ol>
          )}
        </Section>

        {!soon && g.statusKey !== 'archived' && g.previewKey && <PrimaryButton onClick={() => onPreview(g)} style={{ width: '100%', borderRadius: 12 }}>▶ Preview this activity</PrimaryButton>}
      </aside>
    </div>
  )
}

export default function OwnerActivityLibraryPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const skill = AREA_BY_ID[params.get('skill')] ? params.get('skill') : 'all'
  const age = AGE_BANDS.some((a) => a.id === params.get('age')) ? params.get('age') : ''
  const status = ['live', 'beta', 'soon', 'archived'].includes(params.get('status')) ? params.get('status') : ''
  const sortKey = SORT_VALUE[params.get('sort')] ? params.get('sort') : 'plays'
  const dir = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : (SORTS.find((s) => s.id === sortKey)?.dir || 'desc')
  const view = params.get('view') === 'list' ? 'list' : 'grid'

  const [games, setGames] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [notify, setNotify] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFY_KEY) || '[]') } catch { return [] }
  })

  const setParam = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    return next
  }, { replace: true })

  const load = (signal) => {
    if (!user?.email) return
    setLoading(true); setError('')
    fetch(`/api/owner/gamified/library?${new URLSearchParams({ email: user.email })}`, { signal })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setGames(b.games) : setError(b.error || 'Could not load the activity library.')))
      .catch((e) => { if (e.name !== 'AbortError') setError('Could not load the activity library.') })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Attach the derived fields + the local game-hub entry used for the icon and Preview.
  const items = useMemo(() => (games || []).map((g) => {
    const hub = GAMES.find((h) => h.title.trim().toLowerCase() === g.name.trim().toLowerCase())
    const area = areaOf(g)
    return { ...g, area, statusKey: statusOf(g), emoji: hub?.emoji || FALLBACK_EMOJI[area], previewKey: hub?.id || null }
  }), [games])

  const counts = useMemo(() => {
    const c = { all: items.length }
    for (const a of AREAS) c[a.id] = items.filter((g) => g.area === a.id).length
    return c
  }, [items])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const band = AGE_BANDS.find((a) => a.id === age)
    const get = SORT_VALUE[sortKey]
    const list = items.filter((g) => {
      if (needle && !g.name.toLowerCase().includes(needle) && !g.description.toLowerCase().includes(needle)) return false
      if (skill !== 'all' && g.area !== skill) return false
      if (status && g.statusKey !== status) return false
      // Games with no age range on file fit every age band.
      if (band && g.ageRange && ((g.ageRange.min ?? 0) > band.hi || (g.ageRange.max ?? 99) < band.lo)) return false
      return true
    })
    return list.sort((a, b) => {
      const x = get(a), y = get(b)
      const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y
      return (dir === 'asc' ? cmp : -cmp) || a.name.localeCompare(b.name)
    })
  }, [items, q, skill, age, status, sortKey, dir])

  const summary = useMemo(() => {
    const live = items.filter((g) => g.statusKey === 'live').length
    const beta = items.filter((g) => g.statusKey === 'beta').length
    const soon = items.filter((g) => g.statusKey === 'soon').length
    const top = [...items].sort((a, b) => b.usage.plays - a.usage.plays)[0]
    return { live, beta, soon, top: top && top.usage.plays > 0 ? top : null }
  }, [items])
  const pendingRequests = INITIAL_REQUESTS.filter((r) => r.status === 'pending').length

  const toggleNotify = (id) => {
    setNotify((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }
  const closeDetail = useCallback(() => setDetail(null), [])
  const preview = (g) => navigate(`/owner/gamified-activities/preview/${g.previewKey}`)
  const sortBy = (key) => {
    const nextDir = sortKey === key ? (dir === 'asc' ? 'desc' : 'asc') : (key === 'name' || key === 'area' || key === 'status' ? 'asc' : 'desc')
    setParam({ sort: key === 'plays' ? '' : key, dir: nextDir })
  }
  const presetValue = SORTS.some((s) => s.id === sortKey && s.dir === dir) ? sortKey : 'custom'
  const filtersActive = q || skill !== 'all' || age || status

  return (
    <OwnerPageShell user={user} onLogout={onLogout} title="Activity Library" subtitle="Every gamified activity available to therapists across your clinic"
      menuItems={getOwnerMenuItems(betaTier)} beta>
      <div style={{ fontFamily: FONT }}>
        {error && <ErrorBanner message={error} onRetry={() => load()} />}

        {loading && !games && (
          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ height: 96 }} />)}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ height: 330 }} />)}</div>
          </div>
        )}

        {games && (
          <div className="grid gap-5">
            {/* Summary strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: '🎮', bg: '#E3F0FD', ib: '#CFE5FB', label: 'Total activities', value: items.length, cap: 'in the games library' },
                { icon: '✅', bg: '#E3F6EA', ib: '#C4EBD2', label: 'Live', value: summary.live, cap: `${summary.beta} beta · ${summary.soon} coming soon` },
                { icon: '🔥', bg: '#FFF1D6', ib: '#FFE1A6', label: 'Most played this month', value: summary.top ? summary.top.name : '—', small: true,
                  cap: summary.top ? `${summary.top.usage.plays} play${summary.top.usage.plays === 1 ? '' : 's'}${summary.top.usage.accuracy != null ? ` · ${summary.top.usage.accuracy}% accuracy` : ''}` : 'no plays in the last 30 days' },
                { icon: '📬', bg: '#FDE3E8', ib: '#F9C6D2', label: 'Pending game requests', value: pendingRequests, cap: 'awaiting review' },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-[22px] p-4" style={{ background: c.bg, minHeight: 96 }}>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: c.ib }} aria-hidden="true">{c.icon}</div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold" style={{ color: '#3a4a45', margin: 0 }}>{c.label}</p>
                    <p className={`${c.small ? 'text-[18px]' : 'text-[30px]'} truncate font-extrabold leading-tight`} style={{ color: GREEN_900, margin: 0 }}>{c.value}</p>
                    <p className="text-[12px]" style={{ color: MUTED, margin: '2px 0 0' }}>{c.cap}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={CARD}>
              <div className="flex flex-wrap items-center gap-3">
                <input value={q} onChange={(e) => setParam({ q: e.target.value })} placeholder="Search activities…" aria-label="Search activities"
                  style={{ ...selectStyle, flex: '1 1 220px', fontWeight: 500, borderRadius: 999, padding: '0 16px', background: '#F8FAF9' }} />
                <select value={age} onChange={(e) => setParam({ age: e.target.value })} style={selectStyle} aria-label="Ages">
                  <option value="">All ages</option>
                  {AGE_BANDS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <select value={status} onChange={(e) => setParam({ status: e.target.value })} style={selectStyle} aria-label="Status">
                  <option value="">All statuses</option>
                  <option value="live">Live</option><option value="beta">Beta</option><option value="soon">Coming soon</option>
                  {items.some((g) => g.statusKey === 'archived') && <option value="archived">Archived</option>}
                </select>
                <select value={presetValue} onChange={(e) => { const s = SORTS.find((x) => x.id === e.target.value); if (s) setParam({ sort: s.id === 'plays' ? '' : s.id, dir: '' }) }} style={selectStyle} aria-label="Sort">
                  {presetValue === 'custom' && <option value="custom" disabled>Sorted by column</option>}
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <div className="flex gap-1 rounded-full p-1" style={{ background: '#F8FAF9', border: `1px solid ${BORDER}` }} role="group" aria-label="View">
                  {[['grid', '▦ Grid'], ['list', '☰ List']].map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={view === id} onClick={() => setParam({ view: id === 'grid' ? '' : id })}
                      style={{ minHeight: 40, borderRadius: 999, border: 'none', padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: view === id ? GREEN_700 : 'transparent', color: view === id ? '#fff' : '#3a4a45' }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Skill-area chips (scroll sideways on phones) */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Skill area" style={{ flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
                {[{ id: 'all', label: 'All', color: GREEN_700 }, ...AREAS].map((a) => {
                  const on = skill === a.id
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => setParam({ skill: a.id === 'all' ? '' : a.id })}
                      style={{ flex: '0 0 auto', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                        border: `1.5px solid ${on ? a.color : BORDER}`, background: on ? `${a.color}1a` : '#fff', color: GREEN_900 }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                      {a.label} <span style={{ color: MUTED, fontWeight: 700 }}>{counts[a.id]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
              <div className="text-center" style={{ ...CARD, padding: 40 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: GREEN_900, margin: 0 }}>{items.length === 0 ? 'There are no activities in the library yet.' : 'No activities match these filters.'}</p>
                {filtersActive && <SecondaryButton onClick={() => setParams(new URLSearchParams(), { replace: true })} style={{ marginTop: 12 }}>Clear filters</SecondaryButton>}
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((g) => (
                  <ActivityCard key={g.id} g={g} notified={notify.includes(g.id)} onNotify={toggleNotify} onPreview={preview} onDetails={setDetail} />
                ))}
              </div>
            ) : (
              <div style={{ ...CARD, padding: 0 }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse">
                    <thead>
                      <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MUTED }}>
                        {[['name', 'Activity'], ['area', 'Skill area'], ['ages', 'Ages'], ['status', 'Status'], ['plays', 'Plays'], ['accuracy', 'Accuracy'], ['patients', 'Patients'], ['last', 'Last played']].map(([key, label]) => (
                          <th key={key} scope="col" aria-sort={sortKey === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-4 py-3">
                            <button type="button" onClick={() => sortBy(key)} style={{ border: 'none', background: 'transparent', font: 'inherit', color: sortKey === key ? GREEN_900 : MUTED, cursor: 'pointer', minHeight: 44, padding: 0, textTransform: 'inherit', letterSpacing: 'inherit' }}>
                              {label}{sortKey === key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                        ))}
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((g) => {
                        const area = AREA_BY_ID[g.area]
                        return (
                          <tr key={g.id} style={{ borderTop: '1px solid #EDF2F0' }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[20px]" style={{ background: area.tint }} aria-hidden="true">{g.emoji}</span>
                                <span className="text-[14px] font-extrabold" style={{ color: GREEN_900 }}>{g.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Tag color={area.color}>{area.label}</Tag></td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: GREEN_900, whiteSpace: 'nowrap' }}>{ageText(g) || '—'}</td>
                            <td className="px-4 py-3"><StatusBadge statusKey={g.statusKey} /></td>
                            <td className="px-4 py-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{g.usage.plays || '—'}</td>
                            <td className="px-4 py-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{dash(g.usage.accuracy, '%')}</td>
                            <td className="px-4 py-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{g.usage.patients || '—'}</td>
                            <td className="px-4 py-3 text-[13px]" style={{ color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(g.usage.lastPlayedAt)}</td>
                            <td className="px-4 py-3 text-right" style={{ whiteSpace: 'nowrap' }}>
                              {g.statusKey === 'soon'
                                ? <SecondaryButton onClick={() => toggleNotify(g.id)} style={{ borderRadius: 12 }}>{notify.includes(g.id) ? '✓ Notified' : '🔔 Notify me'}</SecondaryButton>
                                : g.previewKey && g.statusKey !== 'archived' && <SecondaryButton onClick={() => preview(g)} style={{ borderRadius: 12, marginRight: 6 }}>▶ Preview</SecondaryButton>}
                              <SecondaryButton onClick={() => setDetail(g)} style={{ borderRadius: 12 }}>Details</SecondaryButton>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Request banner */}
            <div className="flex flex-wrap items-center justify-between gap-4" style={{ ...CARD, background: 'linear-gradient(135deg,#E3F0FD,#E3F6EA)' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: GREEN_900, margin: 0 }}>Need an activity that isn't here?</h2>
                <p style={{ fontSize: 13.5, color: MUTED, margin: '4px 0 0' }}>Tell us what your therapists need and we'll look into building it.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/owner/gamified-activities/request" style={{ background: GREEN_700, color: '#fff', borderRadius: 999, padding: '0 18px', minHeight: 44, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Request a game</Link>
                <Link to="/owner/gamified-activities/request" style={{ background: '#fff', color: GREEN_900, border: `1px solid ${BORDER}`, borderRadius: 999, padding: '0 18px', minHeight: 44, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>View requests ({INITIAL_REQUESTS.length})</Link>
              </div>
            </div>

            <p className="text-center text-[11.5px]" style={{ color: MUTED }}>Usage covers completed sessions in the last 30 days across all branches.</p>
          </div>
        )}
      </div>

      {detail && <Drawer g={detail} onClose={closeDetail} onPreview={preview} />}
    </OwnerPageShell>
  )
}
