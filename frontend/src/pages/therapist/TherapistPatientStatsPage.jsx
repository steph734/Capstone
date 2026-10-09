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
const BORDER = '#E4EBE8'
const TYPE_COLOR = { Cognitive: '#7C5CE0', Speech: '#1FA58A', Occupational: '#F59E0B', Physical: '#4A90D9' }
const RANGE_OPTIONS = [{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '3 months' }]
const TABS = ['Cognitive', 'Occupational', 'Physical', 'Speech']
const PAGE_SIZE = 10
const TREND_LABEL = { improving: 'Improving', steady: 'Steady', 'needs more practice': 'Needs more practice', not_enough_data: 'Not enough data yet' }

function initials(name) { return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?' }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
function changeText(change, unit = '') {
  if (change === null || change === undefined) return <span style={{ color: '#5D7770' }}> · no previous data</span>
  if (change === 0) return <span style={{ color: '#5D7770' }}> · no change</span>
  const sign = change > 0 ? '+' : ''
  return <span style={{ color: change > 0 ? '#16a34a' : '#5D7770' }}> {sign}{change}{unit} vs previous period</span>
}

function SkeletonBlock({ className = '' }) { return <div className={`animate-pulse rounded-2xl bg-[#EDF2F0] ${className}`} /> }

function SmallLine({ points, color = '#1FA58A', valueKey = 'value' }) {
  const w = 260, h = 90, pad = 10
  if (points.length === 0) return <p className="py-6 text-center text-[12.5px]" style={{ color: '#5D7770' }}>Not enough data yet</p>
  const max = Math.max(1, ...points.map((p) => p[valueKey]))
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => [pad + i * stepX, h - pad - (p[valueKey] / max) * (h - pad * 2)])
  // 3-point moving average for display, per the analytics rules.
  const smoothed = xy.map((_, i) => {
    const win = xy.slice(Math.max(0, i - 1), i + 2)
    return [xy[i][0], win.reduce((s, p) => s + p[1], 0) / win.length]
  })
  const line = smoothed.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Trend: ${points.map((p) => `${p.date} ${p[valueKey]}`).join(', ')}`}>
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
          <span className="text-[9px] font-bold" style={{ color: '#5D7770' }}>{unit}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {segments.map((s) => (
          <li key={s.type} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: GREEN_900 }}>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: TYPE_COLOR[s.type] || '#94A3B8' }} />
            {s.type} <span style={{ color: '#5D7770' }}>{s.share}%</span>
          </li>
        ))}
        {segments.length === 0 && <li className="text-[12px]" style={{ color: '#5D7770' }}>No data yet</li>}
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

  // The table forwards its sort/range/q into this page's URL when it
  // navigates here; passing the same params straight back restores them.
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

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Patient Stats" subtitle="Descriptive summary of recorded sessions" menuItems={getTherapistMenuItems(betaTier)}>
      <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif" }}>
        <button type="button" onClick={() => navigate(backHref)} className="mb-4 text-[14px] font-extrabold" style={{ color: GREEN_700 }}>← All patients</button>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border-2 p-4 text-[14px] font-bold" style={{ borderColor: '#F3D284', background: '#FFF7E6', color: '#92400E' }}>
            <span>{error}</span>
            <button type="button" onClick={load} className="rounded-full px-4 py-2 text-[13px] font-extrabold text-white" style={{ background: GREEN_700 }}>Retry</button>
          </div>
        )}

        {loading && !data && (
          <div className="grid gap-5">
            <SkeletonBlock className="h-[90px]" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><SkeletonBlock className="h-[90px]" /><SkeletonBlock className="h-[90px]" /><SkeletonBlock className="h-[90px]" /><SkeletonBlock className="h-[90px]" /></div>
            <SkeletonBlock className="h-[300px]" />
          </div>
        )}

        {data && (
          <div className="grid gap-5">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
              <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 text-[18px] font-extrabold" style={{ borderColor: GREEN_700, color: GREEN_700 }}>{initials(data.profile.name)}</span>
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] font-extrabold" style={{ color: GREEN_900 }}>{data.profile.name}</h1>
                <p className="text-[13px]" style={{ color: '#5D7770' }}>
                  {data.profile.age != null ? `Age ${data.profile.age}` : ''}{data.profile.favoriteGame ? ` · Favorite game: ${data.profile.favoriteGame}` : ''}{data.profile.lastPlayedAt ? ` · Last played ${fmtDate(data.profile.lastPlayedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-2.5" style={{ background: '#FFF1D6' }}>
                <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: '#FFE1A6', color: '#92400E' }}>⭐ LVL {data.profile.level}</span>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: GREEN_900 }}>XP {data.profile.xp} / {data.profile.xpMax} <span style={{ color: '#5D7770' }}>({Math.max(0, data.profile.xpMax - data.profile.xp)} to go)</span></p>
                  <div className="mt-1 h-1.5 w-[140px] overflow-hidden rounded-full" style={{ background: '#FFFFFF80' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.profile.xp / data.profile.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#FFC933)' }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-1 rounded-full bg-[#F8FAF9] p-1" role="group" aria-label="Date range">
                {RANGE_OPTIONS.map((r) => (
                  <button key={r.id} type="button" aria-pressed={rangeId === r.id} onClick={() => setRange(r.id)} className="h-9 rounded-full px-3.5 text-[12.5px] font-extrabold" style={{ background: rangeId === r.id ? GREEN_700 : 'transparent', color: rangeId === r.id ? '#fff' : '#3a4a45' }}>{r.label}</button>
                ))}
              </div>
            </div>

            {data.kpis.games.value === 0 ? (
              <div className="rounded-[22px] bg-white p-10 text-center" style={{ border: `1px solid ${BORDER}` }}>
                <p className="text-[16px] font-bold" style={{ color: GREEN_900 }}>No games played yet.</p>
                <p className="mt-1 text-[13px]" style={{ color: '#5D7770' }}>Stats will appear after the first session.</p>
                <button type="button" onClick={() => navigate('/therapist/assign-exercises')} className="mt-4 rounded-full px-5 py-2.5 text-[13px] font-extrabold text-white" style={{ background: GREEN_700 }}>Assign a game</button>
              </div>
            ) : (
              <>
                {/* KPI tiles */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-[22px] p-4" style={{ background: '#E3F0FD' }}>
                    <p className="text-[13px] font-bold" style={{ color: '#3a4a45' }}>Games played</p>
                    <p className="text-[28px] font-extrabold" style={{ color: GREEN_900 }}>{data.kpis.games.value}{changeText(data.kpis.games.change)}</p>
                  </div>
                  <div className="rounded-[22px] p-4" style={{ background: '#E3F6EA' }}>
                    <p className="text-[13px] font-bold" style={{ color: '#3a4a45' }}>Accuracy</p>
                    <p className="text-[28px] font-extrabold" style={{ color: GREEN_900 }}>{data.kpis.accuracy.value !== null ? `${Math.round(data.kpis.accuracy.value)}%` : '—'}{changeText(data.kpis.accuracy.change, ' pts')}</p>
                  </div>
                  <div className="rounded-[22px] p-4" style={{ background: '#FDE3E8' }}>
                    <p className="text-[13px] font-bold" style={{ color: '#3a4a45' }}>Active days</p>
                    <p className="text-[28px] font-extrabold" style={{ color: GREEN_900 }}>{data.kpis.activeDays.value}<span className="text-[14px] font-bold" style={{ color: '#5D7770' }}> / {data.kpis.activeDays.daysInRange} days</span></p>
                  </div>
                  <div className="rounded-[22px] p-4" style={{ background: '#FFF1D6' }}>
                    <p className="text-[13px] font-bold" style={{ color: '#3a4a45' }}>Current streak</p>
                    <p className="text-[28px] font-extrabold" style={{ color: GREEN_900 }}>{data.kpis.currentStreak.value} <span className="text-[14px] font-bold" style={{ color: '#5D7770' }}>days</span></p>
                  </div>
                </div>

                {/* Progress over time */}
                <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[16px] font-extrabold" style={{ color: GREEN_900 }}>Progress over time</h2>
                    <span className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: '#F1F5F3', color: '#3a4a45' }}>{TREND_LABEL[data.trend]}</span>
                  </div>
                  <SmallLine points={data.series} color="#7C5CE0" />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                    <h2 className="mb-2 text-[15px] font-extrabold" style={{ color: GREEN_900 }}>Games per week</h2>
                    <div className="flex h-[90px] items-end justify-between gap-1">
                      {data.weekly.slice(-8).map((w) => {
                        const max = Math.max(1, ...data.weekly.map((x) => x.completed))
                        return <div key={w.weekStart} className="flex-1 rounded-t" style={{ height: `${Math.max(3, (w.completed / max) * 90)}px`, background: '#1FA58A' }} title={`${w.label}: ${w.completed}`} />
                      })}
                    </div>
                  </div>
                  <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                    <h2 className="mb-2 text-[15px] font-extrabold" style={{ color: GREEN_900 }}>Top games</h2>
                    <div className="flex flex-col gap-1.5">
                      {data.topGames.map((g) => (
                        <div key={g.gameId} className="flex justify-between text-[13px] font-bold" style={{ color: GREEN_900 }}><span className="truncate">{g.name}</span><span>{g.count}</span></div>
                      ))}
                      {data.topGames.length === 0 && <p className="text-[12.5px]" style={{ color: '#5D7770' }}>No games yet.</p>}
                    </div>
                  </div>
                  <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                    <h2 className="mb-2 text-[15px] font-extrabold" style={{ color: GREEN_900 }}>Share by therapy type</h2>
                    <Donut segments={data.shareByType} total={data.totalMinutes} unit="minutes" />
                  </div>
                </div>

                {/* Session analytics tabs */}
                <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                  <h2 className="mb-3 text-[16px] font-extrabold" style={{ color: GREEN_900 }}>Session analytics</h2>
                  <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Therapy type">
                    {TABS.map((t) => (
                      <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                        className="h-9 rounded-full px-4 text-[12.5px] font-extrabold"
                        style={{ background: tab === t ? GREEN_700 : '#F8FAF9', color: tab === t ? '#fff' : '#3a4a45' }}>{t}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[12.5px] font-bold" style={{ color: '#5D7770' }}>Accuracy over time (%)</p>
                      <SmallLine points={data.analytics[tab.toLowerCase()]?.accuracy || []} color={TYPE_COLOR[tab] || '#1FA58A'} />
                    </div>
                    <div>
                      <p className="mb-1 text-[12.5px] font-bold" style={{ color: '#5D7770' }}>Last 3 sessions</p>
                      <div className="flex flex-col divide-y" style={{ borderColor: '#EDF2F0' }}>
                        {(data.analytics[tab.toLowerCase()]?.sessions || []).map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-2 text-[13px]" style={{ color: GREEN_900 }}>
                            <span>{fmtDate(s.date)}</span><span className="font-bold">{s.name}</span>
                            <span style={{ color: '#5D7770' }}>{s.accuracy !== null ? `${s.accuracy}%` : '—'} · {s.minutes} min</span>
                          </div>
                        ))}
                        {(data.analytics[tab.toLowerCase()]?.sessions || []).length === 0 && <p className="py-2 text-[12.5px]" style={{ color: '#5D7770' }}>No {tab.toLowerCase()} sessions in this range.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* Character stats */}
                  <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-[16px] font-extrabold" style={{ color: GREEN_900 }}>Character stats</h2>
                      <span className="text-[11.5px] font-bold" style={{ color: '#5D7770' }}>vs. last month</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {data.characterStats.map((s) => (
                        <div key={s.key}>
                          <div className="flex items-center justify-between text-[13px] font-bold" style={{ color: GREEN_900 }}>
                            <span>{s.label}</span>
                            <span>{s.value} {s.change ? <span style={{ color: '#16a34a' }}>↑ +{s.change}</span> : null}</span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: '#F1F5F3' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.value)}%`, background: 'linear-gradient(90deg,#7C5CE0,#4A90D9)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-[16px] font-extrabold" style={{ color: GREEN_900 }}>Badges earned</h2>
                      <span className="text-[13px] font-bold" style={{ color: '#5D7770' }}>{data.badges.filter((b) => b.earned).length} of {data.badges.length}{data.newThisRange ? ` · ${data.newThisRange} new` : ''}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                      {data.badges.slice(0, 12).map((b) => (
                        <div key={b.code} className="flex flex-col items-center gap-1">
                          <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={48} muted={!b.earned} />
                          <span className="text-center text-[9.5px] font-bold" style={{ color: '#5D7770' }}>{b.name}</span>
                        </div>
                      ))}
                    </div>
                    {data.nextBadge && <p className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-bold" style={{ background: '#FFF1D6', color: '#92400E' }}>Next: {data.nextBadge.name}</p>}
                  </div>
                </div>

                {/* Recent sessions table */}
                <div className="rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
                  <h2 className="mb-3 text-[16px] font-extrabold" style={{ color: GREEN_900 }}>Recent sessions</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] font-extrabold uppercase tracking-wide" style={{ color: '#5D7770' }}>
                          <th scope="col" className="pb-2">Date</th><th scope="col" className="pb-2">Game</th><th scope="col" className="pb-2">Accuracy</th><th scope="col" className="pb-2">Hints</th><th scope="col" className="pb-2">Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsPage.map((s, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
                            <td className="py-2.5 text-[13px]" style={{ color: '#5D7770' }}>{fmtDate(s.date)}</td>
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
                      <button type="button" onClick={() => setPage((p) => p + 1)} className="rounded-full px-5 py-2 text-[13px] font-extrabold" style={{ border: `1px solid ${BORDER}`, color: GREEN_900 }}>Show more</button>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="text-center text-[11.5px]" style={{ color: '#5D7770' }}>Descriptive summary of recorded sessions. It does not diagnose or predict.</p>
          </div>
        )}
      </div>
    </TherapistPageShell>
  )
}
