import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'

// Therapist "Gamified Stats" overview. Everything here comes from
// GET /api/therapist/gamified/overview (api/_lib/routes/therapist-gamified-overview.js)
// — a descriptive summary of what already happened, never a prediction or a
// ranking between patients. Range, search and sort live in the URL so a
// refresh or a shared link keeps the same view.
const GREEN_900 = '#1F3D36'
const GREEN_700 = '#234C40'
const BORDER = '#E4EBE8'
const TYPE_COLOR = { Cognitive: '#7C5CE0', Speech: '#1FA58A', Occupational: '#F59E0B', Physical: '#4A90D9' }
const SORT_PILLS = [
  { id: 'level', label: 'Level' }, { id: 'xp', label: 'XP' },
  { id: 'games', label: 'Games' }, { id: 'last', label: 'Last played' },
]
const RANGE_OPTIONS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
]
const PAGE_SIZE = 10

function isoDaysAgo(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function deltaText(d) {
  if (d === null || d === undefined) return null
  if (d === 0) return <span style={{ color: '#5D7770' }}> · no change</span>
  // Never red: a drop is shown in the same neutral grey as "no change", a
  // gain in green — but nothing here is an error state.
  return <span style={{ color: d > 0 ? '#16a34a' : '#5D7770' }}> {d > 0 ? `+${d}` : d}</span>
}

function KpiCard({ icon, bg, iconBg, label, value, delta, suffix }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] p-4" style={{ background: bg }}>
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: iconBg }}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold" style={{ color: '#3a4a45' }}>{label}</p>
        <p className="text-[30px] font-extrabold leading-tight" style={{ color: GREEN_900 }}>
          {value}{suffix ? <span className="ml-1 text-[14px] font-bold" style={{ color: '#5D7770' }}>{suffix}</span> : null}
          {deltaText(delta)}
        </p>
      </div>
    </div>
  )
}

function LineAreaChart({ points }) {
  const w = 280, h = 110, pad = 14
  const max = Math.max(1, ...points.map((p) => p.games))
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => [pad + i * stepX, h - pad - (p.games / max) * (h - pad * 2)])
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${xy[xy.length - 1]?.[0] ?? pad},${h - pad} L${pad},${h - pad} Z`
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Games played per week: ${points.map((p) => `${p.label} ${p.games}`).join(', ')}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="#EEF2F0" strokeWidth="1" />
        ))}
        {points.length > 1 && <path d={area} fill="#DDF1EA" stroke="none" />}
        {points.length > 1 && <path d={line} fill="none" stroke="#1FA58A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#1FA58A" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] font-bold" style={{ color: '#5D7770' }}>
        {points.map((p) => <span key={p.weekStart}>{p.label}</span>)}
      </div>
      <table className="sr-only">
        <caption>Games played per week</caption>
        <thead><tr><th scope="col">Week</th><th scope="col">Games</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.weekStart}><td>{p.label}</td><td>{p.games}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

const BAR_COLORS = ['#1FA58A', '#4A90D9', '#7C5CE0', '#F59E0B', '#EC4899', '#14B8A6']
function BarList({ items }) {
  const max = Math.max(1, ...items.map((g) => g.count))
  return (
    <div className="flex flex-col gap-3">
      {items.map((g, i) => (
        <div key={g.gameId}>
          <div className="mb-1 flex items-center justify-between text-[13px] font-bold" style={{ color: GREEN_900 }}>
            <span className="truncate">{g.name}</span>
            <span>{g.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
            <div className="h-full rounded-full" style={{ width: `${(g.count / max) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-[13px]" style={{ color: '#5D7770' }}>No games completed in this range yet.</p>}
    </div>
  )
}

function DonutChart({ segments, total }) {
  let acc = 0
  const stops = segments.map((s) => {
    const start = acc
    acc += s.share
    return `${TYPE_COLOR[s.type] || '#94A3B8'} ${start}% ${acc}%`
  })
  const bg = segments.length ? `conic-gradient(${stops.join(',')})` : '#F1F5F3'
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[110px] w-[110px] flex-shrink-0 rounded-full" style={{ background: bg }} role="img" aria-label={`Share of games by therapy type: ${segments.map((s) => `${s.type} ${s.share}%`).join(', ')}`}>
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-[18px] font-extrabold" style={{ color: GREEN_900 }}>{total}</span>
          <span className="text-[10px] font-bold" style={{ color: '#5D7770' }}>games</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <li key={s.type} className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: GREEN_900 }}>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: TYPE_COLOR[s.type] || '#94A3B8' }} />
            {s.type} <span style={{ color: '#5D7770' }}>{s.share}%</span>
          </li>
        ))}
        {segments.length === 0 && <li className="text-[12.5px]" style={{ color: '#5D7770' }}>No data yet</li>}
      </ul>
    </div>
  )
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-[#EDF2F0] ${className}`} />
}

export default function TherapistGamifiedStatsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rangeId = RANGE_OPTIONS.some((r) => r.id === params.get('range')) ? params.get('range') : '30'
  const urlQ = params.get('q') || ''
  const sort = SORT_PILLS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'level'
  const [search, setSearch] = useState(urlQ)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Debounce the search box into the URL (and reset to page 1).
  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => { const next = new URLSearchParams(p); if (search) next.set('q', search); else next.delete('q'); return next }, { replace: true })
      setPage(1)
    }, 200)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('range', id); return next })
  const setSort = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('sort', id); return next })

  const load = () => {
    if (!user?.email) return
    setLoading(true)
    setError('')
    const days = RANGE_OPTIONS.find((r) => r.id === rangeId)?.days ?? 30
    const qs = new URLSearchParams({ email: user.email, from: isoDaysAgo(days - 1), to: isoDaysAgo(0) })
    fetch(`/api/therapist/gamified/overview?${qs}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setData(b) : setError(b.error || 'Could not load stats.')))
      .catch(() => setError('Could not load stats.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [rangeId, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSorted = useMemo(() => {
    if (!data) return []
    const q = urlQ.trim().toLowerCase()
    let list = data.patients.filter((p) => !q || p.name.toLowerCase().includes(q))
    list = [...list].sort((a, b) => {
      if (sort === 'xp') return b.xp - a.xp
      if (sort === 'games') return b.games - a.games
      if (sort === 'last') return new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0)
      return b.level - a.level
    })
    return list
  }, [data, urlQ, sort])

  const visible = filteredSorted.slice(0, page * PAGE_SIZE)
  const rangeLabel = RANGE_OPTIONS.find((r) => r.id === rangeId)?.label

  return (
    <TherapistPageShell
      user={user} onLogout={onLogout}
      title="Gamified Stats" subtitle="See how your patients are engaging with gamified exercises"
      menuItems={getTherapistMenuItems(betaTier)} beta
    >
      <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif" }}>
        {/* Range picker */}
        <div className="mb-5 flex justify-end">
          <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm" style={{ border: `1px solid ${BORDER}` }} role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.id} type="button" aria-pressed={rangeId === r.id} onClick={() => setRange(r.id)}
                className="h-9 rounded-full px-4 text-[13px] font-extrabold"
                style={{ background: rangeId === r.id ? GREEN_700 : 'transparent', color: rangeId === r.id ? '#fff' : '#3a4a45' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border-2 p-4 text-[14px] font-bold" style={{ borderColor: '#F3D284', background: '#FFF7E6', color: '#92400E' }}>
            <span>{error}</span>
            <button type="button" onClick={load} className="rounded-full px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: GREEN_700 }}>Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><SkeletonBlock className="h-[88px]" /><SkeletonBlock className="h-[88px]" /><SkeletonBlock className="h-[88px]" /><SkeletonBlock className="h-[88px]" /></div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><SkeletonBlock className="h-[220px]" /><SkeletonBlock className="h-[220px]" /><SkeletonBlock className="h-[220px]" /></div>
            <SkeletonBlock className="h-[420px]" />
          </div>
        )}

        {data && (
          <div className="grid gap-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard icon="🧑‍🤝‍🧑" bg="#E3F0FD" iconBg="#CFE5FB" label="Patients playing" value={data.kpis.patientsPlaying} delta={data.kpis.patientsDelta} />
              <KpiCard icon="⭐" bg="#FFF1D6" iconBg="#FFE1A6" label="Average level" value={data.kpis.avgLevel} delta={data.kpis.avgLevelDelta} />
              <KpiCard icon="🎮" bg="#E3F6EA" iconBg="#C4EBD2" label="Games completed" value={data.kpis.games} delta={data.kpis.gamesDelta} />
              <KpiCard icon="🏆" bg="#FDE3E8" iconBg="#F9C6D2" label="Badges earned" value={data.kpis.badges} delta={data.kpis.badgesDelta} />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr_0.9fr]">
              <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                <h2 className="text-[15px] font-extrabold" style={{ color: GREEN_900 }}>Games played each week</h2>
                <p className="mb-2 text-[12px] font-bold" style={{ color: '#5D7770' }}>All patients</p>
                <LineAreaChart points={data.weekly} />
              </div>
              <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                <h2 className="text-[15px] font-extrabold" style={{ color: GREEN_900 }}>Most played games</h2>
                <p className="mb-2 text-[12px] font-bold" style={{ color: '#5D7770' }}>Times completed</p>
                <BarList items={data.topGames} />
              </div>
              <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                <h2 className="text-[15px] font-extrabold" style={{ color: GREEN_900 }}>By therapy type</h2>
                <p className="mb-2 text-[12px] font-bold" style={{ color: '#5D7770' }}>Share of games played</p>
                <DonutChart segments={data.byType} total={data.kpis.games} />
              </div>
            </div>

            {/* Patients table */}
            <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[18px] font-extrabold" style={{ color: GREEN_900 }}>Patients</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search patients..."
                    aria-label="Search patients"
                    className="h-11 w-[220px] rounded-full px-4 text-[14px]"
                    style={{ border: `1px solid ${BORDER}`, background: '#F8FAF9' }}
                  />
                  <div className="flex gap-1 rounded-full bg-[#F8FAF9] p-1" role="group" aria-label="Sort patients by">
                    {SORT_PILLS.map((s) => (
                      <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}
                        className="h-9 rounded-full px-3.5 text-[12.5px] font-extrabold"
                        style={{ background: sort === s.id ? GREEN_700 : 'transparent', color: sort === s.id ? '#fff' : '#3a4a45' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredSorted.length === 0 ? (
                <p className="py-10 text-center text-[14px] font-bold" style={{ color: '#5D7770' }}>
                  {data.patients.length === 0 ? 'No patients are playing yet. Assign a game to get started.' : 'No patients match your search.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: '#5D7770' }}>
                        <th scope="col" className="pb-2">Patient</th>
                        <th scope="col" className="pb-2">Level</th>
                        <th scope="col" className="pb-2">XP</th>
                        <th scope="col" className="pb-2">Games</th>
                        <th scope="col" className="pb-2">Badges</th>
                        <th scope="col" className="pb-2">Last played</th>
                        <th scope="col" className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id} style={{ borderTop: `1px solid #EDF2F0` }}>
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: GREEN_700 }}>{initials(p.name)}</span>
                              <div>
                                <p className="text-[14px] font-extrabold" style={{ color: GREEN_900 }}>{p.name}</p>
                                {p.age != null && <p className="text-[12px]" style={{ color: '#5D7770' }}>Age {p.age}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3"><span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E' }}>⭐ {p.level}</span></td>
                          <td className="py-3" style={{ minWidth: 120 }}>
                            <p className="text-[12.5px] font-bold" style={{ color: GREEN_900 }}>{p.xp} / {p.xpMax}</p>
                            <div className="mt-1 h-2 w-[100px] overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.xp / p.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#7C5CE0,#4A90D9)' }} />
                            </div>
                          </td>
                          <td className="py-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{p.games}</td>
                          <td className="py-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>🏆 {p.badges}</td>
                          <td className="py-3 text-[13px]" style={{ color: '#5D7770' }}>{fmtDate(p.lastPlayedAt)}</td>
                          <td className="py-3 text-right">
                            <button type="button" onClick={() => navigate(`/therapist/gamified-activities/patients/${p.id}`)}
                              className="whitespace-nowrap rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold text-white" style={{ background: GREEN_700 }}>
                              View Stats →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visible.length < filteredSorted.length && (
                    <div className="mt-4 flex justify-center">
                      <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-full px-5 py-2.5 text-[13px] font-extrabold" style={{ border: `1px solid ${BORDER}`, color: GREEN_900 }}>Show more</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="sr-only">Showing stats for {rangeLabel}.</p>
          </div>
        )}
      </div>
    </TherapistPageShell>
  )
}
