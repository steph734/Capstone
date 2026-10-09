import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import BadgeMedal from '../../components/BadgeMedal'

// /therapist/gamified-activities/patients/:patientId — the full per-patient
// Gamified Stats dashboard. Real data from
// GET /api/therapist/gamified/patients/:patientId (therapist-gamified-patient.js).
// Descriptive summary only: no prediction, no diagnosis, no red for a lower
// number — a drop is shown in the same neutral grey as "no change".
const GREEN_900 = '#1F3D36'
const GREEN_700 = '#234C40'
const MUTED = '#5D7770'
const BORDER = '#E3E8E4'
const CARD = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20 }
const TYPE_COLOR = { Cognitive: '#7C5CE0', Speech: '#1FA58A', Occupational: '#F59E0B', Physical: '#4A90D9' }
const RANGE_OPTIONS = [{ id: '7', label: 'Last 7 days', days: 7 }, { id: '30', label: 'Last 30 days', days: 30 }, { id: '90', label: 'Last 3 months', days: 90 }]
const TABS = ['Cognitive', 'Occupational', 'Physical', 'Speech']
const PAGE_SIZE = 10
const TREND_LABEL = { improving: 'Improving', steady: 'Steady', 'needs more practice': 'Needs more practice', not_enough_data: 'Not enough data yet' }
const STAT_ICON = { intelligence: '🧠', focus: '🎯', resistance: '🛡️', creativity: '🎨', speed: '⚡', memory: '💭' }
const STAT_COLOR = { intelligence: '#7C5CE0', focus: '#F59E0B', resistance: '#1FA58A', creativity: '#EC4899', speed: '#14B8A6', memory: '#4A90D9' }
const GAME_ICON = { Cognitive: '🧩', Speech: '🗣️', Occupational: '🧶', Physical: '🏃' }

function initials(name) { return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?' }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
function fmtRangeLabel(days) {
  const to = new Date(); to.setHours(0, 0, 0, 0)
  const from = new Date(to); from.setDate(from.getDate() - (days - 1))
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}, ${to.getFullYear()}`
}
function changeText(change, unit = '') {
  if (change === null || change === undefined) return <span style={{ color: MUTED, fontWeight: 400 }}>No previous period to compare</span>
  if (change === 0) return <span style={{ color: MUTED, fontWeight: 400 }}>No change vs previous period</span>
  const sign = change > 0 ? '+' : ''
  return <span style={{ color: change > 0 ? '#16a34a' : MUTED, fontWeight: 400 }}>{sign}{change}{unit} vs previous period</span>
}

// ── Reusable pieces ──────────────────────────────────────────────────────
function SecondaryButton({ children, onClick, active, style, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className="tp-secondary-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: active ? '#F1F5F3' : '#fff',
        border: `1px solid ${BORDER}`,
        color: GREEN_900,
        borderRadius: 999,
        padding: '10px 16px',
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer',
        ...style,
      }}
    >{children}</button>
  )
}

function PrimaryButton({ children, onClick, style }) {
  return (
    <button type="button" onClick={onClick} className="tp-primary-btn"
      style={{ background: GREEN_700, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...style }}>
      {children}
    </button>
  )
}

function CardTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: GREEN_900, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
      {right}
    </div>
  )
}

function SkeletonBlock({ className = '', style }) { return <div className={`animate-pulse rounded-2xl bg-[#EDF2F0] ${className}`} style={style} /> }

function KpiTile({ icon, bg, label, value, caption }) {
  return (
    <div style={{ ...CARD, display: 'flex', gap: 12, minHeight: 128 }}>
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: bg }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 14, fontWeight: 500, color: MUTED, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 700, color: GREEN_900, margin: '2px 0 0', lineHeight: 1.1 }}>{value}</p>
        {caption && <p style={{ fontSize: 12, fontWeight: 400, color: MUTED, margin: '4px 0 0' }}>{caption}</p>}
      </div>
    </div>
  )
}

// Accuracy-over-time line chart with axes, gridlines, hover tooltip and a
// "View as table" toggle. Smoothing: 3-point moving average, per the
// analytics rules (plotted as a dashed trend line alongside the real series).
function ProgressChart({ points, trend }) {
  const [hover, setHover] = useState(null)
  const [asTable, setAsTable] = useState(false)
  const w = 760, h = 200, padL = 36, padR = 10, padT = 10, padB = 26
  const innerW = w - padL - padR, innerH = h - padT - padB

  if (points.length === 0) {
    return <p className="py-10 text-center text-[13px]" style={{ color: MUTED }}>Not enough data yet.</p>
  }

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0
  const yFor = (v) => padT + innerH - (Math.min(100, Math.max(0, v)) / 100) * innerH
  const xy = points.map((p, i) => [padL + i * stepX, yFor(p.value)])
  const smoothed = xy.map((_, i) => {
    const win = xy.slice(Math.max(0, i - 1), i + 2)
    return [xy[i][0], win.reduce((s, p) => s + p[1], 0) / win.length]
  })
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const dashLine = smoothed.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${xy[xy.length - 1][0]},${padT + innerH} L${xy[0][0]},${padT + innerH} Z`

  // Thin x-axis down to ~6 labels so dates stay legible.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  if (asTable) {
    return (
      <div>
        <button type="button" onClick={() => setAsTable(false)} className="mb-2 text-[12.5px] font-bold" style={{ color: GREEN_700 }}>← Back to chart</button>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr style={{ color: MUTED, textAlign: 'left' }}><th className="pb-1 pr-4">Date</th><th className="pb-1">Accuracy</th></tr></thead>
            <tbody>{points.map((p, i) => <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}><td className="py-1 pr-4" style={{ color: GREEN_900 }}>{fmtDate(p.date)}</td><td className="py-1" style={{ color: GREEN_900 }}>{p.value}%</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="relative" style={{ height: h }}>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img"
          aria-label={`Accuracy per session: ${points.map((p) => `${p.date} ${p.value}%`).join(', ')}`}>
          {[0, 25, 50, 75, 100].map((t) => {
            const y = yFor(t)
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#EEF2F0" strokeWidth="1" />
                <text x={padL - 8} y={y + 3} fontSize="10" textAnchor="end" fill={MUTED}>{t}%</text>
              </g>
            )
          })}
          <path d={area} fill="#7C5CE0" opacity="0.12" />
          <path d={dashLine} fill="none" stroke="#1FA58A" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
          <path d={line} fill="none" stroke="#7C5CE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {xy.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={hover === i ? 6 : 4} fill="#7C5CE0" stroke="#fff" strokeWidth="1.5"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              tabIndex={0} style={{ cursor: 'pointer', outline: 'none' }} />
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={i} x={xy[i][0]} y={h - 6} fontSize="10" textAnchor="middle" fill={MUTED}>{fmtDate(p.date)}</text>
          ))}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white shadow"
            style={{ background: GREEN_900, left: `${(xy[hover][0] / w) * 100}%`, top: `${(xy[hover][1] / h) * 100}%`, transform: 'translate(-50%,-130%)', whiteSpace: 'nowrap' }}>
            {fmtDate(points[hover].date)} · {points[hover].value}%
          </div>
        )}
      </div>
      <button type="button" onClick={() => setAsTable(true)} className="mt-1 text-[12px] font-bold" style={{ color: GREEN_700 }}>View as table</button>
    </div>
  )
}

function SmallLine({ points, color = '#1FA58A', valueKey = 'value', height = 110 }) {
  const w = 260, h = height, pad = 10
  if (points.length === 0) return <p className="py-6 text-center text-[12.5px]" style={{ color: MUTED }}>Not enough data yet</p>
  const max = Math.max(1, ...points.map((p) => p[valueKey]))
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => [pad + i * stepX, h - pad - (p[valueKey] / max) * (h - pad * 2)])
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Trend: ${points.map((p) => `${p.date || p.label} ${p[valueKey]}`).join(', ')}`}>
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={color} />)}
    </svg>
  )
}

function Donut({ segments, total, unit }) {
  let acc = 0
  const stops = segments.map((s) => { const start = acc; acc += s.share; return `${TYPE_COLOR[s.type] || '#94A3B8'} ${start}% ${acc}%` })
  const bg = segments.length ? `conic-gradient(${stops.join(',')})` : '#F1F5F3'
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[100px] w-[100px] flex-shrink-0 rounded-full" style={{ background: bg }} role="img" aria-label={`Share by therapy type: ${segments.map((s) => `${s.type} ${s.share}%`).join(', ')}`}>
        <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-[15px] font-extrabold" style={{ color: GREEN_900 }}>{total}</span>
          <span className="text-[9px] font-bold" style={{ color: MUTED }}>{unit}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {segments.map((s) => (
          <li key={s.type} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: GREEN_900 }}>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: TYPE_COLOR[s.type] || '#94A3B8' }} />
            {s.type} <span style={{ color: MUTED, fontWeight: 400 }}>{s.share}%</span>
          </li>
        ))}
        {segments.length === 0 && <li className="text-[12px]" style={{ color: MUTED }}>No data yet</li>}
      </ul>
    </div>
  )
}

export default function TherapistPatientStatsPage({ user, onLogout, betaTier }) {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rangeId = RANGE_OPTIONS.some((r) => r.id === params.get('range')) ? params.get('range') : '30'
  const [tab, setTab] = useState('Cognitive')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [showAllGames, setShowAllGames] = useState(false)

  const backHref = `/therapist/gamified-activities?${params.toString()}`

  const load = () => {
    if (!user?.email) return
    setLoading(true); setError('')
    fetch(`/api/therapist/gamified/patients/${patientId}?${new URLSearchParams({ email: user.email, range: rangeId })}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setData(b) : setError(b.error || 'Could not load this patient’s stats.')))
      .catch(() => setError('Could not load this patient’s stats.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [rangeId, patientId, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('range', id); return next })

  const sessionsPage = useMemo(() => data?.recentSessions.slice(0, page * PAGE_SIZE) || [], [data, page])

  const activeTabSessions = data?.analytics[tab.toLowerCase()]?.sessions?.length || 0
  const tabCounts = Object.fromEntries(TABS.map((t) => [t, data?.analytics[t.toLowerCase()]?.sessions?.length ? data.analytics[t.toLowerCase()].sessions.length : (data?.analytics[t.toLowerCase()]?.accuracy?.length || 0)]))

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Patient Stats" subtitle="Descriptive summary of recorded sessions" menuItems={getTherapistMenuItems(betaTier)} bare>
      <style>{`
        .tp-secondary-btn:hover { background: #F1F5F3 !important; }
        .tp-primary-btn:hover { background: #1b3a30 !important; }
      `}</style>
      <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", letterSpacing: 'normal' }}>
        <SecondaryButton onClick={() => navigate(backHref)} style={{ marginBottom: 16, padding: '8px 14px' }}>← All patients</SecondaryButton>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border-2 p-4 text-[14px] font-bold" style={{ borderColor: '#F3D284', background: '#FFF7E6', color: '#92400E' }}>
            <span>{error}</span>
            <PrimaryButton onClick={load}>Retry</PrimaryButton>
          </div>
        )}

        {loading && !data && (
          <div className="grid gap-6">
            <SkeletonBlock style={{ height: 130 }} />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><SkeletonBlock style={{ height: 128 }} /><SkeletonBlock style={{ height: 128 }} /><SkeletonBlock style={{ height: 128 }} /><SkeletonBlock style={{ height: 128 }} /></div>
            <SkeletonBlock style={{ height: 280 }} />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><SkeletonBlock style={{ height: 260 }} /><SkeletonBlock style={{ height: 260 }} /><SkeletonBlock style={{ height: 260 }} /></div>
          </div>
        )}

        {data && (
          <div className="grid gap-6">
            {/* Header — single baseline row, ~130px tall */}
            <div className="flex flex-wrap items-center gap-4" style={{ ...CARD, minHeight: 130 }}>
              <span className="flex flex-shrink-0 items-center justify-center rounded-full text-[20px] font-extrabold"
                style={{ width: 72, height: 72, background: '#E3F6EA', border: `3px solid ${GREEN_700}`, color: GREEN_700 }}>{initials(data.profile.name)}</span>
              <div className="min-w-0 flex-1">
                <h1 style={{ fontSize: 28, fontWeight: 700, color: GREEN_900, margin: 0, letterSpacing: 'normal', lineHeight: 1.15 }}>{data.profile.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {data.profile.age != null && <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>Age {data.profile.age}</span>}
                  {data.profile.favoriteGame && <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>Favorite: {data.profile.favoriteGame}</span>}
                  {data.profile.lastPlayedAt && <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>Last played {fmtDate(data.profile.lastPlayedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: '#FFF1D6' }}>
                <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E' }}>⭐ LVL {data.profile.level}</span>
                <div>
                  <p className="text-[12.5px] font-bold" style={{ color: GREEN_900 }}>
                    XP {data.profile.xp} / {data.profile.xpMax}
                    <span style={{ color: MUTED, fontWeight: 400 }}> · {Math.max(0, data.profile.xpMax - data.profile.xp)} to go</span>
                  </p>
                  <div className="mt-1.5 h-2 w-[150px] overflow-hidden rounded-full" style={{ background: '#FFFFFF90' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.profile.xp / data.profile.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#FFC933)' }} />
                  </div>
                </div>
              </div>
              <div className="relative">
                <SecondaryButton onClick={() => setRangeOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={rangeOpen}>
                  🗓️ {fmtRangeLabel(RANGE_OPTIONS.find((r) => r.id === rangeId)?.days)} <span style={{ color: MUTED }}>▾</span>
                </SecondaryButton>
                {rangeOpen && (
                  <ul role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-10 w-40 overflow-hidden rounded-xl bg-white py-1 shadow-lg" style={{ border: `1px solid ${BORDER}` }}>
                    {RANGE_OPTIONS.map((r) => (
                      <li key={r.id}>
                        <button type="button" role="option" aria-selected={rangeId === r.id} onClick={() => { setRange(r.id); setRangeOpen(false) }}
                          className="block w-full px-3.5 py-2 text-left text-[12.5px] font-bold" style={{ background: rangeId === r.id ? '#F1F5F3' : 'transparent', color: GREEN_900 }}>{r.label}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {data.kpis.games.value === 0 ? (
              <div className="text-center" style={{ ...CARD, padding: 48 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: GREEN_900 }}>No games played yet.</p>
                <p className="mt-1" style={{ fontSize: 13, color: MUTED }}>Stats will appear after the first session.</p>
                <PrimaryButton onClick={() => navigate('/therapist/assign-exercises')} style={{ marginTop: 16 }}>Assign a game</PrimaryButton>
              </div>
            ) : (
              <>
                {/* KPI tiles */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <KpiTile icon="🎮" bg="#DCEBFC"
                    label="Games completed"
                    value={data.kpis.games.assigned ? `${data.kpis.games.value} / ${data.kpis.games.assigned}` : data.kpis.games.value}
                    caption={data.kpis.games.completionRate !== null ? `${data.kpis.games.completionRate}% of assigned` : 'recorded sessions'} />
                  <KpiTile icon="🎯" bg="#D9F2E3"
                    label="Average accuracy"
                    value={data.kpis.accuracy.value !== null ? `${Math.round(data.kpis.accuracy.value)}%` : '—'}
                    caption={changeText(data.kpis.accuracy.change, ' pts')} />
                  <KpiTile icon="🏆" bg="#FDEBC8"
                    label="Badges earned"
                    value={`${data.kpis.badges.value} / ${data.kpis.badges.total}`}
                    caption={data.kpis.badges.newThisRange > 0 ? `${data.kpis.badges.newThisRange} new this period` : 'No new badges this period'} />
                  <div style={{ ...CARD, display: 'flex', gap: 12, minHeight: 128 }}>
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: '#FBDCE5' }}>💗</span>
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 14, fontWeight: 500, color: MUTED, margin: 0 }}>Active days</p>
                      <p style={{ fontSize: 36, fontWeight: 700, color: GREEN_900, margin: '2px 0 0', lineHeight: 1.1 }}>
                        {data.kpis.activeDays.value}<span style={{ fontSize: 16 }}> / {data.kpis.activeDays.daysInRange}</span>
                      </p>
                      {data.kpis.activeDays.dayFlags && (
                        <div className="mt-1.5 grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(15, 8px)' }} role="img" aria-label={`${data.kpis.activeDays.value} active days out of ${data.kpis.activeDays.daysInRange}`}>
                          {data.kpis.activeDays.dayFlags.map((played, i) => (
                            <span key={i} title={`Day ${i + 1}: ${played ? 'active' : 'inactive'}`} className="rounded-sm" style={{ width: 8, height: 8, background: played ? '#1FA58A' : '#E3E8E4' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress over time — full width, 240px */}
                <div style={CARD}>
                  <div className="mb-1 flex items-center justify-between">
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: GREEN_900, margin: 0, letterSpacing: 'normal' }}>Progress over time</h2>
                      <p style={{ fontSize: 12.5, fontWeight: 400, color: MUTED, margin: '2px 0 0' }}>Accuracy per session · dashed line = 3-point average</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={{
                      background: data.trend === 'improving' ? '#D9F2E3' : '#F1F5F3',
                      color: data.trend === 'improving' ? '#16a34a' : MUTED,
                    }}>{TREND_LABEL[data.trend]}</span>
                  </div>
                  <ProgressChart points={data.series} trend={data.trend} />
                </div>

                {/* Character stats | Session analytics | Time by therapy type */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div style={CARD}>
                    <CardTitle right={<span style={{ fontSize: 12, color: MUTED }}>vs. last month</span>}>Character stats</CardTitle>
                    <div className="flex flex-col gap-3">
                      {data.characterStats.map((s) => (
                        <div key={s.key} className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[16px]" style={{ background: '#F1F5F3' }}>{STAT_ICON[s.key] || '⭐'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[13px]" style={{ color: GREEN_900 }}>
                              <span style={{ fontWeight: 500 }}>{s.label}</span>
                              <span style={{ fontWeight: 700 }}>{s.value} / 100 {s.change ? <span className="ml-1 rounded-full px-1.5 py-0.5" style={{ background: '#D9F2E3', color: '#16a34a', fontSize: 11 }}>↑ +{s.change}</span> : null}</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.value)}%`, background: STAT_COLOR[s.key] || GREEN_700 }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={CARD}>
                    <CardTitle>Session analytics</CardTitle>
                    <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Therapy type">
                      {TABS.map((t) => {
                        const count = tabCounts[t] || 0
                        return (
                          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                            className="h-8 rounded-full px-3 text-[12px] font-bold"
                            style={{ background: tab === t ? GREEN_700 : '#fff', border: tab === t ? 'none' : `1px solid ${BORDER}`, color: tab === t ? '#fff' : (count === 0 ? MUTED : GREEN_900), opacity: count === 0 && tab !== t ? 0.6 : 1 }}>
                            {t} <span style={{ opacity: 0.8 }}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                    {activeTabSessions < 2 ? (
                      <div className="flex flex-col items-center py-6 text-center">
                        <img src="/pao/png/pao-think.png" alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
                        <p className="mt-2 text-[12.5px]" style={{ color: MUTED, maxWidth: '28ch' }}>
                          {activeTabSessions === 0 ? `No ${tab.toLowerCase()} sessions yet.` : `Only ${activeTabSessions} session so far.`} A trend will appear after a few more games.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 text-[12px] font-bold" style={{ color: MUTED }}>Accuracy over time (%)</p>
                        <SmallLine points={data.analytics[tab.toLowerCase()]?.accuracy || []} color={TYPE_COLOR[tab] || '#1FA58A'} height={140} />
                      </div>
                    )}
                    <p className="mb-1 mt-3 text-[12px] font-bold" style={{ color: MUTED }}>Last 3 sessions</p>
                    <div className="flex flex-col divide-y" style={{ borderColor: '#EDF2F0' }}>
                      {(data.analytics[tab.toLowerCase()]?.sessions || []).map((s, i) => (
                        <div key={i} className="grid grid-cols-[56px_1fr_auto] items-center gap-2 py-2 text-[12.5px]" style={{ color: GREEN_900 }}>
                          <span style={{ color: MUTED }}>{fmtDate(s.date)}</span><span className="truncate font-bold">{s.name}</span>
                          <span style={{ color: MUTED }}>{s.accuracy !== null ? `${s.accuracy}%` : '—'} · {s.minutes} min</span>
                        </div>
                      ))}
                      {(data.analytics[tab.toLowerCase()]?.sessions || []).length === 0 && <p className="py-2 text-[12.5px]" style={{ color: MUTED }}>No {tab.toLowerCase()} sessions in this range.</p>}
                    </div>
                  </div>

                  <div style={CARD}>
                    <CardTitle>Time by therapy type</CardTitle>
                    <Donut segments={data.shareByType} total={data.totalMinutes} unit="minutes" />
                    {data.typeNote && <p className="mt-3 text-[13px]" style={{ color: MUTED, maxWidth: '28ch', lineHeight: 1.4 }}>💡 {data.typeNote}</p>}
                  </div>
                </div>

                {/* Recent games | Weekly completion | Badges */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div style={CARD}>
                    <CardTitle right={data.recentGames.length > 0 ? (
                      <button type="button" onClick={() => setShowAllGames((v) => !v)} className="text-[12px] font-extrabold" style={{ color: GREEN_700 }}>{showAllGames ? 'Show less' : 'View all →'}</button>
                    ) : null}>Recent games</CardTitle>
                    <div className="flex flex-col gap-2.5">
                      {(showAllGames ? data.recentSessions : data.recentGames).slice(0, showAllGames ? 100 : 5).map((g, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: GREEN_900 }}>
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[14px]" style={{ background: '#F1F5F3' }}>{GAME_ICON[g.therapyType] || '🎮'}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate" style={{ fontWeight: 700 }}>{g.name || g.game}</p>
                            <p style={{ fontSize: 11, color: MUTED }}>{g.therapyType || ''}{g.therapyType ? ' · ' : ''}{fmtDate(g.date)}</p>
                          </div>
                          {'stars' in g && <span style={{ color: '#F59E0B', fontSize: 11 }}>{'★'.repeat(g.stars)}{'☆'.repeat(5 - g.stars)}</span>}
                          <span style={{ color: MUTED, fontWeight: 700 }}>{g.accuracy !== null ? `${g.accuracy}%` : '—'}</span>
                        </div>
                      ))}
                      {data.recentGames.length === 0 && <p className="text-[12.5px]" style={{ color: MUTED }}>No games yet.</p>}
                    </div>
                  </div>

                  <div style={CARD}>
                    <CardTitle>Weekly completion</CardTitle>
                    <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
                      {data.weekly.slice(-5).map((w) => {
                        const max = Math.max(1, ...data.weekly.map((x) => x.assigned || x.completed || 1))
                        const total = Math.max(w.assigned || 0, w.completed || 0)
                        const totalH = Math.max(4, (total / max) * 130)
                        const doneH = total > 0 ? (w.completed / total) * totalH : 0
                        return (
                          <div key={w.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN_900 }}>{w.completed}</span>
                            <div className="relative overflow-hidden rounded-t" style={{ width: 28, height: totalH, background: '#F1F5F3' }} title={`${w.label}: ${w.completed} of ${w.assigned || w.completed}`}>
                              <div className="absolute bottom-0 w-full rounded-t" style={{ height: doneH, background: '#1FA58A' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-2 flex justify-between text-[10.5px] font-bold" style={{ color: MUTED }}>
                      {data.weekly.slice(-5).map((w) => <span key={w.weekStart}>{w.label}</span>)}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[11.5px] font-bold" style={{ color: MUTED }}>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#1FA58A' }} /> Completed</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F1F5F3' }} /> Assigned</span>
                    </div>
                  </div>

                  <div style={CARD}>
                    <CardTitle right={
                      <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: '#F1F5F3', color: MUTED }}>
                        {data.badges.filter((b) => b.earned).length} of {data.badges.length}{data.newThisRange ? ` · ${data.newThisRange} new` : ''}
                      </span>
                    }>Badges earned</CardTitle>
                    <div className="grid grid-cols-3 gap-3">
                      {data.badges.slice(0, showAllBadges ? data.badges.length : 6).map((b) => (
                        <div key={b.code} className="flex flex-col items-center gap-1">
                          <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={44} muted={!b.earned} />
                          <span className="text-center text-[9.5px] font-bold" style={{ color: MUTED }}>{b.name}</span>
                        </div>
                      ))}
                    </div>
                    {data.badges.length > 6 && (
                      <button type="button" onClick={() => setShowAllBadges((v) => !v)} className="mt-2 text-[12px] font-extrabold" style={{ color: GREEN_700 }}>{showAllBadges ? 'Show less' : 'View all →'}</button>
                    )}
                    {data.nextBadge && <p className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: '#FFF1D6', color: '#92400E' }}>Next badge: {data.nextBadge.name}</p>}
                  </div>
                </div>

                {/* Independence | Pao's summary */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div style={CARD}>
                    <CardTitle>Independence</CardTitle>
                    <p className="mb-2 -mt-2" style={{ fontSize: 12.5, fontWeight: 400, color: MUTED }}>Hints used per game — fewer means {data.profile.name.split(' ')[0]} needs less help</p>
                    <SmallLine points={data.hintsWeekly} color="#EC4899" valueKey="value" />
                  </div>
                  <div className="flex flex-col justify-between" style={{ ...CARD, background: 'linear-gradient(135deg,#E3F0FD,#E3F6EA)' }}>
                    <div className="flex items-start gap-3">
                      <img src="/pao/png/pao-hooray.png" alt="" className="h-16 w-16 flex-shrink-0 object-contain" />
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, margin: 0 }}>Pao's summary</p>
                        <p className="mt-1" style={{ fontSize: 14, fontWeight: 500, color: GREEN_900, lineHeight: 1.45 }}>{data.paoSummary}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <PrimaryButton onClick={() => navigate(`/therapist/assign-exercises?patientId=${data.profile.id}&patientName=${encodeURIComponent(data.profile.name)}`)}>Assign exercises</PrimaryButton>
                      <SecondaryButton onClick={() => navigate(`/therapist/notes-progress?patientId=${data.profile.id}&patientName=${encodeURIComponent(data.profile.name)}`)}>Add a note</SecondaryButton>
                    </div>
                  </div>
                </div>

                {/* Recent sessions table */}
                <div style={CARD}>
                  <CardTitle>Recent sessions</CardTitle>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MUTED }}>
                          <th scope="col" className="pb-2">Date</th><th scope="col" className="pb-2">Game</th><th scope="col" className="pb-2">Accuracy</th><th scope="col" className="pb-2">Hints</th><th scope="col" className="pb-2">Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsPage.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
                            <td className="py-2.5 text-[13px]" style={{ color: MUTED }}>{fmtDate(s.date)}</td>
                            <td className="py-2.5 text-[13px] font-bold" style={{ color: GREEN_900 }}>{s.game}</td>
                            <td className="py-2.5 text-[13px]" style={{ color: GREEN_900 }}>{s.accuracy !== null ? `${s.accuracy}%` : '—'}</td>
                            <td className="py-2.5 text-[13px]" style={{ color: GREEN_900 }}>{s.hints}</td>
                            <td className="py-2.5 text-[13px]" style={{ color: GREEN_900 }}>{s.minutes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sessionsPage.length < data.recentSessions.length && (
                    <div className="mt-3 flex justify-center">
                      <SecondaryButton onClick={() => setPage((p) => p + 1)}>Show more</SecondaryButton>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="text-center text-[11.5px]" style={{ color: MUTED }}>Descriptive summary of recorded sessions. It does not diagnose or predict.</p>
          </div>
        )}
      </div>
    </TherapistPageShell>
  )
}
