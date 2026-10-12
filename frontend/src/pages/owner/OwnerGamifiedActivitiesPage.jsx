import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import {
  GREEN_900, GREEN_700, MUTED, BORDER, CARD, FONT, LINE_COLORS, RANGE_OPTIONS,
  Avatar, CardTitle, Delta, Donut, ErrorBanner, PrimaryButton, SecondaryButton, SkeletonBlock,
  csvCell, downloadFile, fmtDate,
} from './gamified/shared'

// /owner/gamified-activities — owner overview across all branches. Real data
// from GET /api/owner/gamified/overview (api/_lib/ownerGamified.js), owner
// role checked on the server. A descriptive summary of recorded sessions;
// filters, search and sort live in the URL so a refresh or shared link keeps
// the same view (and the patient page's "Back to overview" restores them).
const PAGE = 5
const SORT_PILLS = [
  { id: 'level', label: 'Level' }, { id: 'xp', label: 'XP' },
  { id: 'games', label: 'Games' }, { id: 'last', label: 'Last played' },
]
const selectStyle = {
  minHeight: 44, borderRadius: 14, border: `1px solid ${BORDER}`, background: '#fff', color: GREEN_900,
  fontFamily: 'inherit', fontSize: 14, fontWeight: 700, padding: '0 12px', maxWidth: '100%',
}

function accuracyChipStyle(acc) {
  if (acc === null || acc === undefined) return { background: '#F1F5F3', color: MUTED }
  if (acc >= 80) return { background: '#D9F2E3', color: '#166534' }
  if (acc >= 70) return { background: '#EEF1EF', color: '#4B5B56' }
  return { background: '#FDE3E8', color: '#B4233C' }
}
const ATTENTION_CHIP = {
  inactive: { background: '#FDE3E8', color: '#B4233C' },
  not_started: { background: '#EEF1EF', color: '#4B5B56' },
  accuracy_drop: { background: '#FDE3E8', color: '#B4233C' },
}

function KpiCard({ icon, bg, iconBg, label, value, delta, caption }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] p-4" style={{ background: bg, minHeight: 104 }}>
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: iconBg }} aria-hidden="true">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold" style={{ color: '#3a4a45', margin: 0 }}>{label}</p>
        <p className="text-[30px] font-extrabold leading-tight" style={{ color: GREEN_900, margin: 0 }}>{value}<Delta value={delta} /></p>
        {caption && <p className="text-[12px]" style={{ color: MUTED, margin: '2px 0 0' }}>{caption}</p>}
      </div>
    </div>
  )
}

function WeeklyChart({ weekly }) {
  const { weeks, lines } = weekly
  const w = 420, h = 190, padL = 30, padR = 10, padT = 10, padB = 24
  const innerW = w - padL - padR, innerH = h - padT - padB
  const max = Math.max(5, ...lines.flatMap((l) => l.points))
  const niceMax = Math.ceil(max / 5) * 5
  const stepX = weeks.length > 1 ? innerW / (weeks.length - 1) : 0
  const yFor = (v) => padT + innerH - (v / niceMax) * innerH
  const total = lines.reduce((a, l) => a + l.points.reduce((x, y) => x + y, 0), 0)
  if (lines.length === 0 || total === 0) {
    return <p className="py-10 text-center text-[13px]" style={{ color: MUTED }}>No games completed in this range yet.</p>
  }
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img"
        aria-label={`Games played per week. ${lines.map((l) => `${l.name}: ${l.points.join(', ')}`).join('. ')}`}>
        {[0, 0.5, 1].map((f) => {
          const v = Math.round(niceMax * f)
          return (
            <g key={f}>
              <line x1={padL} x2={w - padR} y1={yFor(v)} y2={yFor(v)} stroke="#EEF2F0" />
              <text x={padL - 6} y={yFor(v) + 3} fontSize="10" textAnchor="end" fill={MUTED}>{v}</text>
            </g>
          )
        })}
        {lines.map((l, li) => {
          const color = LINE_COLORS[li % LINE_COLORS.length]
          const pts = l.points.map((v, i) => [padL + i * stepX, yFor(v)])
          const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
          return (
            <g key={l.key}>
              {li === 0 && pts.length > 1 && <path d={`${d} L${pts[pts.length - 1][0]},${padT + innerH} L${pts[0][0]},${padT + innerH} Z`} fill={color} opacity="0.1" />}
              <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={color}><title>{`${l.name} · ${weeks[i].label}: ${l.points[i]} games`}</title></circle>)}
            </g>
          )
        })}
        {weeks.map((wk, i) => <text key={wk.weekStart} x={padL + i * stepX} y={h - 6} fontSize="10" textAnchor="middle" fill={MUTED}>{wk.label}</text>)}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((l, li) => (
          <li key={l.key} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: GREEN_900 }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[li % LINE_COLORS.length] }} />{l.name}
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Games played per week</caption>
        <thead><tr><th scope="col">{weekly.by === 'therapist' ? 'Therapist' : 'Branch'}</th>{weeks.map((wk) => <th key={wk.weekStart} scope="col">{wk.label}</th>)}</tr></thead>
        <tbody>{lines.map((l) => <tr key={l.key}><th scope="row">{l.name}</th>{l.points.map((p, i) => <td key={i}>{p}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function OwnerGamifiedActivitiesPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rangeId = RANGE_OPTIONS.some((r) => r.id === params.get('range')) ? params.get('range') : '30'
  const branch = params.get('branch') || ''
  const therapist = params.get('therapist') || ''
  const q = params.get('q') || ''
  const sort = SORT_PILLS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'level'

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const [showAllNeeds, setShowAllNeeds] = useState(false)
  const [showAllEngagement, setShowAllEngagement] = useState(false)
  const [notify, setNotify] = useState({ state: 'idle', msg: '' })
  const tableTop = useRef(null)

  const setParam = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    return next
  }, { replace: true })

  const load = (signal) => {
    if (!user?.email) return
    setLoading(true); setError('')
    const qs = new URLSearchParams({ email: user.email, range: rangeId })
    if (branch) qs.set('branch', branch)
    if (therapist) qs.set('therapist', therapist)
    fetch(`/api/owner/gamified/overview?${qs}`, { signal })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setData(b) : setError(b.error || 'Could not load stats.')))
      .catch((e) => { if (e.name !== 'AbortError') setError('Could not load stats.') })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [rangeId, branch, therapist, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // A new filter / search / sort starts the patient list over at 5.
  useEffect(() => { setShown(PAGE) }, [rangeId, branch, therapist, q, sort])

  const therapistOptions = useMemo(
    () => (data?.options.therapists || []).filter((t) => !branch || t.branchId === branch),
    [data, branch],
  )

  const patients = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    const list = data.patients.filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.therapist.toLowerCase().includes(needle))
    return list.sort((a, b) => {
      if (sort === 'xp') return b.xp - a.xp
      if (sort === 'games') return b.games - a.games
      if (sort === 'last') return new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0)
      return b.level - a.level || b.xp - a.xp
    })
  }, [data, q, sort])
  const visible = patients.slice(0, shown)
  const allShown = shown >= patients.length

  const onBranch = (id) => setParam({ branch: id, therapist: '' })
  const toggleMore = () => {
    if (!allShown) { setShown((n) => n + PAGE); return }
    setShown(PAGE)
    tableTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const exportCsv = () => {
    const head = ['Patient', 'Age', 'Branch', 'Therapist', 'Level', 'XP', 'XP to next level', 'Games', 'Accuracy %', 'Badges', 'Last played']
    const rows = patients.map((p) => [p.name, p.age ?? '', p.branch, p.therapist, p.level, p.xp, p.xpMax, p.games, p.accuracy ?? '', p.badges, p.lastPlayedAt ? p.lastPlayedAt.slice(0, 10) : ''])
    downloadFile(`gamified-activities-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
  }

  const notifyTherapists = async () => {
    const n = new Set(data.needsAttention.filter((x) => x.therapistEmail).map((x) => x.therapistId)).size
    if (!window.confirm(`Email ${n} therapist${n === 1 ? '' : 's'} their needs-attention patients?`)) return
    setNotify({ state: 'sending', msg: '' })
    try {
      const r = await fetch('/api/owner/gamified/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, branch, therapist, range: rangeId }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || 'Could not send.')
      setNotify({ state: 'done', msg: b.sent ? `Sent to ${b.sent} therapist${b.sent === 1 ? '' : 's'}${b.skipped ? ` (${b.skipped} without an email on file)` : ''}.` : (b.message || 'Nothing to send.') })
    } catch (e) {
      setNotify({ state: 'error', msg: e.message })
    }
  }

  const k = data?.kpis
  const focus = data?.focusBranch
  const backParams = params.toString()

  return (
    <OwnerPageShell
      user={user} onLogout={onLogout}
      title="Gamified Activities"
      subtitle="Track patient engagement with gamified exercises across all branches"
      menuItems={getOwnerMenuItems(betaTier)} beta
    >
      <div style={{ fontFamily: FONT }}>
        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] font-bold" style={{ color: MUTED }}>
            Branch
            <select value={branch} onChange={(e) => onBranch(e.target.value)} style={selectStyle} aria-label="Branch">
              <option value="">All branches</option>
              {(data?.options.branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12px] font-bold" style={{ color: MUTED }}>
            Therapist
            <select value={therapist} onChange={(e) => setParam({ therapist: e.target.value })} style={selectStyle} aria-label="Therapist">
              <option value="">All</option>
              {therapistOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="flex gap-1 rounded-full bg-white p-1 sm:ml-auto" style={{ border: `1px solid ${BORDER}` }} role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.id} type="button" aria-pressed={rangeId === r.id} onClick={() => setParam({ range: r.id === '30' ? '' : r.id })}
                style={{ minHeight: 40, borderRadius: 999, border: 'none', padding: '0 14px', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: rangeId === r.id ? GREEN_700 : 'transparent', color: rangeId === r.id ? '#fff' : '#3a4a45' }}>
                {r.label}
              </button>
            ))}
          </div>
          <PrimaryButton onClick={exportCsv} disabled={!data || patients.length === 0}>⬇ Export CSV</PrimaryButton>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => load()} />}

        {loading && !data && (
          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} style={{ height: 104 }} />)}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} style={{ height: 260 }} />)}</div>
            <SkeletonBlock style={{ height: 380 }} />
          </div>
        )}

        {data && (
          <div className="grid gap-5" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon="🧒" bg="#E3F0FD" iconBg="#CFE5FB" label="Patients playing" value={k.patientsPlaying} delta={k.patientsDelta}
                caption={`of ${k.enrolled} enrolled · ${k.playingPct}%`} />
              <KpiCard icon="⭐" bg="#FFF1D6" iconBg="#FFE1A6" label="Average level" value={k.avgLevel} delta={k.avgLevelDelta}
                caption={k.highest ? `highest: ${k.highest.name} · Lvl ${k.highest.level}` : 'no patients'} />
              <KpiCard icon="🎮" bg="#E3F6EA" iconBg="#C4EBD2" label="Games completed" value={k.games} delta={k.gamesDelta}
                caption={k.avgAccuracy !== null ? `avg accuracy ${k.avgAccuracy}%` : 'no accuracy data yet'} />
              <KpiCard icon="🏆" bg="#FDE3E8" iconBg="#F9C6D2" label="Badges earned" value={k.badges} delta={k.badgesDelta}
                caption={`across ${k.badgeTypes} badge type${k.badgeTypes === 1 ? '' : 's'}`} />
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.9fr]">
              <div style={CARD}>
                <CardTitle sub={data.weekly.by === 'therapist' ? 'By therapist' : 'By branch'}>Games played each week</CardTitle>
                <WeeklyChart weekly={data.weekly} />
              </div>

              <div style={CARD}>
                <CardTitle sub="Games completed · avg accuracy">Branch comparison</CardTitle>
                {data.branchComparison.length === 0 ? (
                  <p className="text-[13px]" style={{ color: MUTED }}>No patients match these filters.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const max = Math.max(1, ...data.branchComparison.map((b) => b.games))
                      return data.branchComparison.map((b, i) => (
                        <div key={b.id}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[13px] font-bold" style={{ color: GREEN_900 }}>
                            <span className="truncate">{b.name}</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{b.games} games · {b.accuracy !== null ? `${b.accuracy}%` : '—'}</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                            <div className="h-full rounded-full" style={{ width: `${(b.games / max) * 100}%`, background: LINE_COLORS[i % LINE_COLORS.length] }} />
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl px-3 py-2" style={{ background: '#F5F8F6' }}>
                    <p className="text-[10.5px] font-extrabold uppercase" style={{ color: MUTED, margin: 0 }}>Most active</p>
                    <p className="text-[14px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{data.mostActive ? data.mostActive.name : '—'}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ background: data.needsSupport ? '#FFF1F3' : '#F5F8F6' }}>
                    <p className="text-[10.5px] font-extrabold uppercase" style={{ color: MUTED, margin: 0 }}>Needs support</p>
                    <p className="text-[14px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{data.needsSupport ? `${data.needsSupport.name} · ${data.needsSupport.accuracy}%` : '—'}</p>
                  </div>
                </div>
              </div>

              <div style={CARD} className="md:col-span-2 lg:col-span-1">
                <CardTitle sub="Share of games played">By therapy type</CardTitle>
                <Donut segments={data.byType} total={k.games} unit="games" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div style={CARD}>
                <CardTitle sub="Times completed · avg accuracy">Most played games</CardTitle>
                {data.topGames.length === 0 ? <p className="text-[13px]" style={{ color: MUTED }}>No games completed in this range yet.</p> : (
                  <div className="flex flex-col gap-3">
                    {data.topGames.map((g, i) => (
                      <div key={g.gameId}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[13px] font-bold" style={{ color: GREEN_900 }}>
                          <span className="truncate">{g.name}</span>
                          <span style={{ whiteSpace: 'nowrap' }}>{g.count} · {g.accuracy !== null ? `${g.accuracy}%` : '—'}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                          <div className="h-full rounded-full" style={{ width: `${(g.count / data.topGames[0].count) * 100}%`, background: LINE_COLORS[i % LINE_COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={CARD}>
                <CardTitle sub="How each therapist's patients are playing"
                  right={data.therapistEngagement.length > 4 && <SecondaryButton onClick={() => setShowAllEngagement((v) => !v)} style={{ minHeight: 44 }}>{showAllEngagement ? 'Show less' : 'View all'}</SecondaryButton>}>
                  Therapist engagement
                </CardTitle>
                {data.therapistEngagement.length === 0 ? <p className="text-[13px]" style={{ color: MUTED }}>No therapists match these filters.</p> : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {(showAllEngagement ? data.therapistEngagement : data.therapistEngagement.slice(0, 4)).map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5" style={{ borderTop: '1px solid #EDF2F0' }}>
                        <Avatar id={t.id} name={t.name} size={34} />
                        <div className="min-w-0 flex-1" style={{ minWidth: 110 }}>
                          <p className="truncate text-[13.5px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{t.name}</p>
                          <p className="truncate text-[11.5px]" style={{ color: MUTED, margin: 0 }}>{t.branch}</p>
                        </div>
                        <span className="text-[12.5px] font-bold" style={{ color: GREEN_900 }} title="Patients playing / assigned">{t.playing} / {t.assigned}</span>
                        <span className="text-[12.5px] font-bold" style={{ color: GREEN_900, minWidth: 28, textAlign: 'right' }} title="Games">{t.games}</span>
                        <span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ ...accuracyChipStyle(t.accuracy), minWidth: 44, textAlign: 'center' }}>{t.accuracy !== null ? `${t.accuracy}%` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px]" style={{ color: MUTED }}>Columns: patients playing / assigned · games · accuracy</p>
              </div>

              <div style={CARD} className="md:col-span-2 lg:col-span-1">
                <CardTitle sub="Inactive 7+ days, never played, or accuracy down 15+ pts"
                  right={<span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: data.needsAttention.length ? '#FDE3E8' : '#F1F5F3', color: data.needsAttention.length ? '#B4233C' : MUTED }}>{data.needsAttention.length}</span>}>
                  Needs attention
                </CardTitle>
                {data.needsAttention.length === 0 ? <p className="text-[13px]" style={{ color: MUTED }}>Everyone is on track.</p> : (
                  <>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {(showAllNeeds ? data.needsAttention : data.needsAttention.slice(0, 4)).map((n) => (
                        <li key={n.patientId} className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid #EDF2F0' }}>
                          <Avatar id={n.patientId} name={n.name} size={34} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{n.name}</p>
                            <p className="text-[11.5px]" style={{ color: MUTED, margin: 0 }}>{n.branch} · {n.detail}</p>
                          </div>
                          <span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ ...ATTENTION_CHIP[n.type], whiteSpace: 'nowrap' }}>{n.chip}</span>
                        </li>
                      ))}
                    </ul>
                    {data.needsAttention.length > 4 && (
                      <SecondaryButton onClick={() => setShowAllNeeds((v) => !v)} style={{ marginTop: 8 }}>{showAllNeeds ? 'Show less' : `View all ${data.needsAttention.length}`}</SecondaryButton>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Pao's summary */}
            <div style={{ ...CARD, background: 'linear-gradient(135deg,#E3F0FD,#E3F6EA)' }}>
              <div className="flex flex-wrap items-start gap-4">
                <img src="/pao/png/pao-hooray.png" alt="" className="h-16 w-16 flex-shrink-0 object-contain" />
                <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUTED, margin: 0 }}>Pao's summary</p>
                  <p className="mt-1" style={{ fontSize: 15, fontWeight: 600, color: GREEN_900, lineHeight: 1.45, margin: '4px 0 0' }}>{data.paoSummary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <PrimaryButton onClick={notifyTherapists} disabled={data.needsAttention.length === 0 || notify.state === 'sending'}>
                      {notify.state === 'sending' ? 'Sending…' : 'Notify therapists'}
                    </PrimaryButton>
                    {focus && branch !== focus.id && (
                      <SecondaryButton onClick={() => onBranch(focus.id)}>View {focus.name} branch</SecondaryButton>
                    )}
                    {notify.msg && <span role="status" className="text-[12.5px] font-bold" style={{ color: notify.state === 'error' ? '#B4233C' : '#166534' }}>{notify.msg}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Patients */}
            <div style={CARD} ref={tableTop}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 style={{ fontSize: 18, fontWeight: 700, color: GREEN_900, margin: 0 }}>Patients</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={q} onChange={(e) => setParam({ q: e.target.value })} placeholder="Search patients…" aria-label="Search patients"
                    style={{ minHeight: 44, width: 220, maxWidth: '100%', borderRadius: 999, border: `1px solid ${BORDER}`, background: '#F8FAF9', padding: '0 16px', fontSize: 14, fontFamily: 'inherit' }} />
                  <div className="flex flex-wrap gap-1 rounded-full bg-[#F8FAF9] p-1" role="group" aria-label="Sort patients by">
                    {SORT_PILLS.map((s) => (
                      <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setParam({ sort: s.id === 'level' ? '' : s.id })}
                        style={{ minHeight: 40, borderRadius: 999, border: 'none', padding: '0 14px', fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', background: sort === s.id ? GREEN_700 : 'transparent', color: sort === s.id ? '#fff' : '#3a4a45' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {patients.length === 0 ? (
                <p className="py-10 text-center text-[14px] font-bold" style={{ color: MUTED }}>
                  {data.patients.length === 0 ? 'No patients match these filters.' : 'No patients match your search.'}
                </p>
              ) : (
                <>
                  {/* Tablet / desktop: table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[860px] border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: MUTED }}>
                          {['Patient', 'Branch', 'Therapist', 'Level', 'XP', 'Games', 'Accuracy', 'Badges', 'Last played'].map((h) => <th key={h} scope="col" className="pb-2 pr-3">{h}</th>)}
                          <th scope="col" className="pb-2"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((p) => (
                          <tr key={p.id} style={{ borderTop: '1px solid #EDF2F0' }}>
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2.5">
                                <Avatar id={p.id} name={p.name} />
                                <div>
                                  <p className="text-[14px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{p.name}</p>
                                  {p.age != null && <p className="text-[12px]" style={{ color: MUTED, margin: 0 }}>Age {p.age}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3"><span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: '#EEF1EF', color: '#4B5B56', whiteSpace: 'nowrap' }}>{p.branch}</span></td>
                            <td className="py-3 pr-3 text-[13.5px]" style={{ color: GREEN_900 }}>{p.therapist}</td>
                            <td className="py-3 pr-3"><span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E', whiteSpace: 'nowrap' }}>⭐ {p.level}</span></td>
                            <td className="py-3 pr-3" style={{ minWidth: 120 }}>
                              <p className="text-[12.5px] font-bold" style={{ color: GREEN_900, margin: 0 }}>{p.xp}/{p.xpMax}</p>
                              <div className="mt-1 h-2 w-[100px] overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.xp / p.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#7C5CE0,#4A90D9)' }} />
                              </div>
                            </td>
                            <td className="py-3 pr-3 text-[13.5px] font-bold" style={{ color: GREEN_900 }}>{p.games}</td>
                            <td className="py-3 pr-3 text-[13.5px] font-bold" style={{ color: GREEN_900, whiteSpace: 'nowrap' }}>
                              {p.accuracy !== null ? `${p.accuracy}%` : '—'}{p.accuracyFalling && <span title="Accuracy is falling" aria-label="falling" style={{ color: '#B4233C', marginLeft: 4 }}>↓</span>}
                            </td>
                            <td className="py-3 pr-3 text-[13.5px] font-bold" style={{ color: GREEN_900, whiteSpace: 'nowrap' }}>🏆 {p.badges}</td>
                            <td className="py-3 pr-3 text-[13px]" style={{ color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(p.lastPlayedAt)}</td>
                            <td className="py-3 text-right">
                              <PrimaryButton onClick={() => navigate(`/owner/gamified-activities/patients/${p.id}?${backParams}`)} aria-label={`View stats for ${p.name}`} style={{ borderRadius: 12, whiteSpace: 'nowrap' }}>View Stats →</PrimaryButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Phone: cards */}
                  <ul className="flex flex-col gap-3 md:hidden" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {visible.map((p) => (
                      <li key={p.id} className="rounded-2xl p-4" style={{ border: `1px solid ${BORDER}` }}>
                        <div className="flex items-center gap-3">
                          <Avatar id={p.id} name={p.name} size={42} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-extrabold" style={{ color: GREEN_900, margin: 0 }}>{p.name}</p>
                            <p className="truncate text-[12px]" style={{ color: MUTED, margin: 0 }}>{p.age != null ? `Age ${p.age} · ` : ''}{p.branch} · {p.therapist}</p>
                          </div>
                          <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E' }}>⭐ {p.level}</span>
                        </div>
                        <div className="mt-3">
                          <p className="text-[12px] font-bold" style={{ color: GREEN_900, margin: 0 }}>XP {p.xp}/{p.xpMax}</p>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (p.xp / p.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#7C5CE0,#4A90D9)' }} />
                          </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]" style={{ margin: '12px 0 0' }}>
                          <div><dt style={{ color: MUTED, display: 'inline' }}>Games </dt><dd style={{ display: 'inline', margin: 0, fontWeight: 700, color: GREEN_900 }}>{p.games}</dd></div>
                          <div><dt style={{ color: MUTED, display: 'inline' }}>Accuracy </dt><dd style={{ display: 'inline', margin: 0, fontWeight: 700, color: GREEN_900 }}>{p.accuracy !== null ? `${p.accuracy}%` : '—'}{p.accuracyFalling && <span style={{ color: '#B4233C' }}> ↓</span>}</dd></div>
                          <div><dt style={{ color: MUTED, display: 'inline' }}>Badges </dt><dd style={{ display: 'inline', margin: 0, fontWeight: 700, color: GREEN_900 }}>🏆 {p.badges}</dd></div>
                          <div><dt style={{ color: MUTED, display: 'inline' }}>Last </dt><dd style={{ display: 'inline', margin: 0, fontWeight: 700, color: GREEN_900 }}>{fmtDate(p.lastPlayedAt)}</dd></div>
                        </dl>
                        <PrimaryButton onClick={() => navigate(`/owner/gamified-activities/patients/${p.id}?${backParams}`)} aria-label={`View stats for ${p.name}`} style={{ width: '100%', marginTop: 12, borderRadius: 12 }}>View Stats →</PrimaryButton>
                      </li>
                    ))}
                  </ul>

                  {patients.length > PAGE && (
                    <div className="mt-4 flex flex-col items-center rounded-xl py-2" style={{ border: '1.5px dashed #CFE0D8' }}>
                      <button type="button" onClick={toggleMore}
                        style={{ minHeight: 44, border: 'none', background: 'transparent', padding: '0 16px', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: '#3F6B5A', cursor: 'pointer' }}>
                        {allShown ? 'Show less ▴' : 'See more ▾'}
                      </button>
                      <span className="text-[12px]" style={{ color: MUTED }}>Showing {Math.min(shown, patients.length)} of {patients.length} patients</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-center text-[11.5px]" style={{ color: MUTED }}>Descriptive summary of recorded sessions. It does not diagnose or predict.</p>
          </div>
        )}
      </div>
    </OwnerPageShell>
  )
}
