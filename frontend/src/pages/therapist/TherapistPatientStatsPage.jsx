import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import BadgeMedal from '../../components/BadgeMedal'
import HomePracticeStats, { HOME_TABS } from './HomePracticeStats'
import { SessionLine, SessionTable, WeeklyBars } from './stats/charts'
import { AMBER_BG, AMBER_FG, BORDER, Btn, CARD, ChartCard, Chip, GREEN_700, GREEN_900, HOME, MUTED, SectionLabel, THERAPY } from './stats/ui'
import { apiPost } from '../../utils/api'

// /therapist/gamified-activities/patients/:patientId — the per-patient Gamified Stats page.
// Real data from GET /api/therapist/gamified/patients/:patientId (therapist-gamified-patient.js).
// Descriptive summary only: no prediction, no diagnosis, no red for a lower number.
// Layout: header · patient card · 4 number cards · progress + Pao's summary · HOME PRACTICE (3 tabs) · SKILLS & ACTIVITY.
// The selected home-practice tab is kept in the URL (?tab=overview|by-game|trends) and the date range in ?range=.
const RANGE_OPTIONS = [{ id: '7', label: 'Last 7 days', days: 7 }, { id: '30', label: 'Last 30 days', days: 30 }, { id: '90', label: 'Last 3 months', days: 90 }]
const TYPES = ['Cognitive', 'Occupational', 'Physical', 'Speech']
const TYPE_COLOR = { Cognitive: THERAPY, Speech: HOME, Occupational: '#F59E0B', Physical: '#4A90D9' }
const STAT_ICON = { intelligence: '🧠', focus: '🎯', resistance: '🛡️', creativity: '🎨', speed: '⚡', memory: '💭' }
const STAT_COLOR = { intelligence: THERAPY, focus: '#F59E0B', resistance: HOME, creativity: '#EC4899', speed: '#14B8A6', memory: '#4A90D9' }
const PAGE_SIZE = 5
const PAO_THUMBS_UP = '/games/pao-money-match-poses/pao-thumbs-up.png'

const initials = (name) => (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const joinNames = (labels) => labels.join(' & ')
function fmtRangeLabel(days) {
  const to = new Date(); to.setHours(0, 0, 0, 0)
  const from = new Date(to); from.setDate(from.getDate() - (days - 1))
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}, ${to.getFullYear()}`
}
const accColor = (v) => (v == null ? MUTED : v >= 80 ? '#17803D' : '#D63A73') // green at 80%+, pink below (pink, not red: a low score is not an alarm)

function KpiCard({ icon, bg, label, children, note }) {
  return (
    <div style={{ ...CARD, display: 'flex', gap: 14, minHeight: 150, padding: 22 }}>
      <span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[22px]" style={{ background: bg }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 16, fontWeight: 600, color: MUTED, margin: 0, lineHeight: 1.2 }}>{label}</p>
        <p style={{ fontSize: 44, fontWeight: 800, color: GREEN_900, margin: '4px 0 0', lineHeight: 1.05, whiteSpace: 'nowrap' }}>{children}</p>
        {note}
      </div>
    </div>
  )
}
const KpiNote = ({ children }) => <p style={{ fontSize: 14, color: MUTED, margin: '6px 0 0', lineHeight: 1.35 }}>{children}</p>

function Skeleton({ h }) { return <div className="animate-pulse rounded-[22px]" style={{ background: '#E6EEEA', height: h }} /> }

function Donut({ segments, total }) {
  const by = Object.fromEntries(segments.map((s) => [s.type, s]))
  const list = TYPES.map((t) => ({ type: t, share: by[t]?.share || 0, games: by[t]?.games || 0 }))
  let acc = 0
  const stops = list.filter((s) => s.share > 0).map((s) => { const a = acc; acc += s.share; return `${TYPE_COLOR[s.type]} ${a}% ${acc}%` })
  return (
    <div>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative flex-shrink-0 rounded-full" style={{ width: 150, height: 150, background: stops.length ? `conic-gradient(${stops.join(',')})` : '#E8EFEC' }} role="img"
          aria-label={`Time by therapy type, ${total} minutes: ${list.map((s) => `${s.type} ${s.share}%`).join(', ')}`}>
          <div className="absolute flex flex-col items-center justify-center rounded-full bg-white" style={{ inset: 20 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: GREEN_900, lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 14, color: MUTED }}>minutes</span>
          </div>
        </div>
        <ul className="grid gap-2" style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 140px' }}>
          {list.map((s) => (
            <li key={s.type} className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color: s.share ? GREEN_900 : '#9AB0A8' }}>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 99, background: s.share ? TYPE_COLOR[s.type] : '#D5E0DB' }} />{s.type} {s.share}%
            </li>
          ))}
        </ul>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: GREEN_900, margin: '18px 0 8px' }}>Sessions by type</p>
      <div className="flex flex-wrap gap-2">
        {list.map((s) => <Chip key={s.type} bg={s.games ? GREEN_700 : 'transparent'} fg={s.games ? '#fff' : MUTED} style={s.games ? null : { border: `1px solid ${BORDER}` }}>{s.type} {s.games}</Chip>)}
      </div>
    </div>
  )
}

export default function TherapistPatientStatsPage({ user, onLogout, betaTier }) {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rangeId = RANGE_OPTIONS.some((r) => r.id === params.get('range')) ? params.get('range') : '30'
  const homeTab = HOME_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview'
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [showAllBadges, setShowAllBadges] = useState(false)

  const backHref = `/therapist/gamified-activities?${new URLSearchParams([...params].filter(([k]) => k !== 'tab')).toString()}`

  const load = () => {
    if (!user?.email) return
    setLoading(true); setError(''); setData(null) // every section reloads together when the range changes
    fetch(`/api/therapist/gamified/patients/${patientId}?${new URLSearchParams({ email: user.email, range: rangeId })}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => (ok ? setData(b) : setError(b.error || 'Could not load this patient’s stats.')))
      .catch(() => setError('Could not load this patient’s stats.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [rangeId, patientId, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('range', id); return next }, { replace: true })
  const setTab = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('tab', id); return next }, { replace: true })
  const sessionsPage = useMemo(() => data?.recentSessions.slice(0, page * PAGE_SIZE) || [], [data, page])

  const first = data?.profile.name.split(' ')[0] || ''
  // Weekly completion starts at the first week with a finished game (Wk 1), not at empty weeks before it.
  const weeklyAll = data?.weekly || []
  const firstData = Math.max(0, weeklyAll.findIndex((w) => w.completed > 0 || w.assigned > 0))
  const weeklyShown = weeklyAll.slice(firstData).slice(0, 8).map((w, i) => ({ ...w, label: `Wk ${i + 1}` }))
  const assignHref = data ? `/therapist/assign-games?patientId=${data.profile.id}&patientName=${encodeURIComponent(data.profile.name)}` : ''
  const planAppt = data?.homePractice?.plan?.appointmentId
  const editPlan = () => navigate(planAppt ? `/therapist/assign-games/${planAppt}/home` : assignHref)
  const remind = async () => (await apiPost(`/api/patients/${data.profile.id}/home-practice/remind`, {})).message || 'Reminder sent.'
  const canRemind = Boolean(data?.homePractice?.hasPlan)

  const lowestKey = data ? [...data.characterStats].sort((a, b) => a.value - b.value)[0]?.key : null
  const allSame = data ? new Set(data.characterStats.map((c) => c.value)).size === 1 : false
  const badgesEarned = data?.kpis.badges.value ?? 0
  const ins = data?.insights

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Patient Stats" subtitle="Descriptive summary of recorded sessions" menuItems={getTherapistMenuItems(betaTier)} bare>
      <div style={{ fontFamily: "'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif", letterSpacing: 'normal', paddingBottom: 96 /* keeps the floating Pao button off the last rows */ }}>
        <div className="mb-4"><Btn onClick={() => navigate(backHref)} style={{ minHeight: 40, padding: '0 16px', fontSize: 14 }}>← All patients</Btn></div>

        {error && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ border: '2px solid #F3D284', background: '#FFF7E6', color: '#92400E', fontSize: 15, fontWeight: 700 }}>
            <span>{error}</span>
            <Btn primary onClick={load}>Retry</Btn>
          </div>
        )}

        {loading && !data && !error && (
          <div className="grid grid-cols-1 gap-5" aria-busy="true" aria-label="Loading patient stats">
            <Skeleton h={140} />
            <div className="grid grid-cols-2 gap-5 min-[1100px]:grid-cols-4"><Skeleton h={150} /><Skeleton h={150} /><Skeleton h={150} /><Skeleton h={150} /></div>
            <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-3"><div className="min-[1100px]:col-span-2"><Skeleton h={380} /></div><Skeleton h={380} /></div>
            <Skeleton h={420} />
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-5">
            {/* Patient card */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4" style={{ ...CARD, padding: 24 }}>
              <span aria-hidden="true" className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: 80, height: 80, background: '#fff', border: `4px solid ${GREEN_700}`, color: GREEN_700, fontSize: 28, fontWeight: 800 }}>{initials(data.profile.name)}</span>
              <div className="min-w-0" style={{ flex: '1 1 260px' }}>
                <h2 style={{ fontSize: 32, fontWeight: 800, color: GREEN_900, margin: 0, lineHeight: 1.15 }}>{data.profile.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.profile.age != null && <Chip>Age {data.profile.age}</Chip>}
                  {data.profile.favoriteGame && <Chip>Favorite: {data.profile.favoriteGame}</Chip>}
                  {data.profile.lastPlayedAt && <Chip>Last played {fmtDate(data.profile.lastPlayedAt)}</Chip>}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: '#FFF1D6' }}>
                <Chip bg="#FFE1A6" fg="#7A4A06" style={{ fontWeight: 800 }}>★ LVL {data.profile.level}</Chip>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: GREEN_900, margin: 0, whiteSpace: 'nowrap' }}>XP {data.profile.xp} / {data.profile.xpMax} <span style={{ color: MUTED, fontWeight: 500 }}>· {Math.max(0, data.profile.xpMax - data.profile.xp)} to go</span></p>
                  <div role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={data.profile.xpMax} aria-valuenow={data.profile.xp} className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: '#fff9', width: 200, maxWidth: '100%' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (data.profile.xp / data.profile.xpMax) * 100)}%`, background: 'linear-gradient(90deg,#F59E0B,#FFC933)' }} />
                  </div>
                </div>
              </div>
              <div className="relative">
                <Btn onClick={() => setRangeOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={rangeOpen}>📅 {fmtRangeLabel(RANGE_OPTIONS.find((r) => r.id === rangeId)?.days)} ▾</Btn>
                {rangeOpen && (
                  <ul role="listbox" aria-label="Date range" className="absolute right-0 top-[calc(100%+6px)] z-10 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-lg" style={{ border: `1px solid ${BORDER}`, listStyle: 'none', margin: 0, padding: '4px 0' }}>
                    {RANGE_OPTIONS.map((r) => (
                      <li key={r.id}><button type="button" role="option" aria-selected={rangeId === r.id} onClick={() => { setRange(r.id); setRangeOpen(false) }}
                        className="block w-full px-4 py-2.5 text-left" style={{ background: rangeId === r.id ? '#F1F5F3' : 'transparent', color: GREEN_900, fontSize: 15, fontWeight: 700 }}>{r.label}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {data.kpis.games.value === 0 && !(data.homePractice?.totals.home.plays > 0) ? (
              <div className="text-center" style={{ ...CARD, padding: 48 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: GREEN_900, margin: 0 }}>No games played yet.</p>
                <p style={{ fontSize: 15, color: MUTED, margin: '4px 0 16px' }}>Stats will appear after the first session.</p>
                <Btn primary onClick={() => navigate('/therapist/assign-games')}>Assign a game</Btn>
              </div>
            ) : (
              <>
                {/* Number cards: 4 across, 2 x 2 below 1100px */}
                <div className="grid grid-cols-2 gap-5 min-[1100px]:grid-cols-4">
                  <KpiCard icon="🎮" bg="#E3EAFB" label="Games completed" note={<KpiNote>{data.kpis.games.completionRate !== null ? `${data.kpis.games.completionRate}% of assigned` : 'recorded sessions'}</KpiNote>}>
                    {data.kpis.games.assigned ? `${data.kpis.games.value}` : data.kpis.games.value}{data.kpis.games.assigned ? <span style={{ fontSize: 20, color: MUTED }}> / {data.kpis.games.assigned}</span> : null}
                  </KpiCard>
                  <KpiCard icon="🎯" bg="#D9F2E3" label="Average accuracy"
                    note={<KpiNote>{data.kpis.accuracy.change == null ? 'First period · nothing to compare yet' : data.kpis.accuracy.change === 0 ? 'No change vs previous period' : `${data.kpis.accuracy.change > 0 ? '+' : ''}${data.kpis.accuracy.change} pts vs previous period`}</KpiNote>}>
                    {data.kpis.accuracy.value !== null ? <>{Math.round(data.kpis.accuracy.value)}<span style={{ fontSize: 24 }}>%</span></> : '—'}
                  </KpiCard>
                  <KpiCard icon="🏆" bg="#FDEBC8" label="Badges earned" note={<KpiNote>{data.kpis.badges.newThisRange > 0 ? `${data.kpis.badges.newThisRange} new this period` : 'No new badges this period'}</KpiNote>}>
                    {badgesEarned}<span style={{ fontSize: 24, color: MUTED }}> / {data.kpis.badges.total}</span>
                  </KpiCard>
                  <KpiCard icon="💗" bg="#FBDCE5" label="Active days"
                    note={data.kpis.activeDays.dayFlags ? (
                      <div className="mt-3 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.min(30, data.kpis.activeDays.dayFlags.length)}, minmax(0, 1fr))` }} role="img" aria-label={`${data.kpis.activeDays.value} active days out of ${data.kpis.activeDays.daysInRange}`}>
                        {data.kpis.activeDays.dayFlags.slice(-30).map((on, i) => <span key={i} className="rounded-sm" style={{ height: 9, background: on ? HOME : '#E3EAE6' }} />)}
                      </div>
                    ) : null}>
                    {data.kpis.activeDays.value}<span style={{ fontSize: 24, color: MUTED }}> / {data.kpis.activeDays.daysInRange}</span>
                  </KpiCard>
                </div>

                {/* Progress over time (2/3) + Pao's summary (1/3) */}
                <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-12">
                  <div className="min-w-0 min-[1100px]:col-span-8">
                    <ChartCard title="Progress over time" subtitle="Accuracy for each recorded session"
                      legend={(
                        <>
                          <Chip bg="#EEE9FC" fg={THERAPY}>● Accuracy</Chip>
                          <Chip bg="#DDF3EE" fg="#157A68">- - 3-session average</Chip>
                          {data.series.length < 5 && <Chip bg={AMBER_BG} fg={AMBER_FG}>Only {data.series.length} session{data.series.length === 1 ? '' : 's'} so far</Chip>}
                        </>
                      )}
                      chart={<SessionLine points={data.series} />} table={<SessionTable points={data.series} />} style={{ height: '100%' }} />
                  </div>
                  <section className="flex min-w-0 flex-col justify-between min-[1100px]:col-span-4" style={{ ...CARD, background: 'linear-gradient(160deg,#E3F0FD,#E6F5EE)' }} aria-label="Pao's summary">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2F6F9F', margin: 0 }}>Pao's summary</p>
                          <p style={{ fontSize: 22, fontWeight: 800, color: GREEN_900, lineHeight: 1.3, margin: '8px 0 0' }}>{data.paoLine || data.paoSummary}</p>
                        </div>
                        <img src={PAO_THUMBS_UP} alt="" width="96" height="96" style={{ width: 96, height: 96, objectFit: 'contain', flexShrink: 0 }} />
                      </div>
                      <ul className="mt-5 grid gap-2.5" style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
                        {ins?.strongest && !allSame && <li style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', fontSize: 15, fontWeight: 700, color: GREEN_900 }}><span aria-hidden="true" style={{ color: '#17803D' }}>✔ </span>Strongest: {joinNames(ins.strongest.labels)} ({ins.strongest.value})</li>}
                        {ins?.needsPractice && !allSame && <li style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', fontSize: 15, fontWeight: 700, color: GREEN_900 }}><span aria-hidden="true" style={{ color: '#D98A06' }}>▲ </span>Needs practice: {joinNames(ins.needsPractice.labels)} ({ins.needsPractice.value})</li>}
                        {ins?.lowGames?.map((g) => <li key={g.name} style={{ background: '#fff', borderRadius: 14, padding: '10px 14px', fontSize: 15, fontWeight: 700, color: GREEN_900 }}><span aria-hidden="true" style={{ color: '#D63A73' }}>! </span>{g.name}: {g.accuracy}% accuracy</li>)}
                      </ul>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Btn primary onClick={() => navigate(assignHref)}>Assign exercises</Btn>
                      <Btn onClick={() => navigate(`/therapist/notes-progress?patientId=${data.profile.id}&patientName=${encodeURIComponent(data.profile.name)}`)}>Add a note</Btn>
                    </div>
                  </section>
                </div>

                <SectionLabel>Home practice</SectionLabel>
                <HomePracticeStats data={data.homePractice} firstName={first} tab={homeTab} onTabChange={setTab} onRemind={canRemind ? remind : undefined} onEditPlan={editPlan} />

                <SectionLabel>Skills &amp; activity</SectionLabel>
                <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[repeat(3,minmax(0,1fr))]">
                  <section style={{ ...CARD, minWidth: 0 }} aria-label="Character stats">
                    <div className="flex items-baseline justify-between gap-2"><h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Character stats</h3><span style={{ fontSize: 14, color: MUTED, whiteSpace: 'nowrap' }}>vs. last month</span></div>
                    <ul className="mt-4 grid gap-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {data.characterStats.map((s) => (
                        <li key={s.key} className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[20px]" style={{ background: '#F1F5F3' }}>{STAT_ICON[s.key] || '⭐'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontSize: 16, color: GREEN_900 }}>
                              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>
                              {s.key === lowestKey && !allSame && <Chip bg={AMBER_BG} fg={AMBER_FG} style={{ padding: '2px 10px', fontSize: 13 }}>Focus area</Chip>}
                              <span className="ml-auto flex items-center gap-1.5" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{s.value} / 100{s.change ? <Chip bg="#D9F2E3" fg="#17803D" style={{ padding: '2px 8px', fontSize: 13 }}>↑ +{s.change}</Chip> : null}</span>
                            </div>
                            <div role="progressbar" aria-label={s.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.value} className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: '#EAF0ED' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, s.value))}%`, background: STAT_COLOR[s.key] || GREEN_700 }} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section style={CARD} aria-label="Time by therapy type">
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: '0 0 16px' }}>Time by therapy type</h3>
                    <Donut segments={data.shareByType} total={data.totalMinutes} />
                  </section>

                  <section style={CARD} aria-label="Weekly completion">
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Weekly completion</h3>
                    <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 12px' }}>Games finished each week</p>
                    <WeeklyBars weeks={weeklyShown} />
                    <div className="mt-2 flex flex-wrap gap-4"><span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700 }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 99, background: HOME }} />Completed</span><span className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 700, color: MUTED }}><span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 99, background: '#E3EAE6' }} />Assigned</span></div>
                    <p style={{ background: '#E6F5EE', color: '#17613A', borderRadius: 14, padding: '10px 14px', fontSize: 15, fontWeight: 700, margin: '14px 0 0' }}>
                      <span aria-hidden="true">💡 </span>Hints used: {data.hintsTotal ?? 0}{(data.hintsTotal ?? 0) === 0 ? ` — ${first} plays without help` : ''}
                    </p>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-12">
                  <section className="min-w-0 min-[1100px]:col-span-7" style={CARD} aria-label="Recent sessions">
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Recent sessions</h3>
                    <p style={{ fontSize: 14, color: MUTED, margin: '2px 0 10px' }}>Latest finished plays</p>
                    {sessionsPage.length === 0 ? <p style={{ fontSize: 15, color: MUTED }}>No finished plays in this period.</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse" style={{ minWidth: 420, fontSize: 15 }}>
                          <thead><tr style={{ color: MUTED, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
                            {['Date', 'Game', 'Accuracy', 'Hints', 'Min'].map((h) => <th key={h} scope="col" className="pb-2 pr-3" style={{ whiteSpace: 'nowrap' }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {sessionsPage.map((s, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #EDF2F0' }}>
                                <td className="py-3 pr-3" style={{ color: MUTED, whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                                <td className="py-3 pr-3" style={{ fontWeight: 800, color: GREEN_900 }}>{s.game}{s.atHome && <Chip bg="#DDF3EE" fg="#157A68" style={{ marginLeft: 8, padding: '1px 8px', fontSize: 13 }}>At home</Chip>}</td>
                                <td className="py-3 pr-3" style={{ fontWeight: 800, color: accColor(s.accuracy) }}>{s.accuracy !== null ? `${s.accuracy}%` : '—'}</td>
                                <td className="py-3 pr-3" style={{ color: GREEN_900 }}>{s.hints}</td>
                                <td className="py-3" style={{ color: GREEN_900 }}>{s.minutes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {sessionsPage.length < data.recentSessions.length && <div className="mt-3"><Btn onClick={() => setPage((p) => p + 1)}>Show more</Btn></div>}
                  </section>

                  <section className="min-w-0 min-[1100px]:col-span-5" style={CARD} aria-label="Badges earned">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 style={{ fontSize: 20, fontWeight: 700, color: GREEN_900, margin: 0 }}>Badges earned</h3>
                      <Chip>{badgesEarned} of {data.kpis.badges.total}{data.kpis.badges.newThisRange ? ` · ${data.kpis.badges.newThisRange} new` : ''}</Chip>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5">
                      {data.badges.slice(0, showAllBadges ? data.badges.length : 6).map((b) => (
                        <div key={b.code} className="flex flex-col items-center gap-1.5" style={{ minWidth: 0 }}>
                          <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={64} muted={!b.earned} />
                          <span className="text-center" style={{ fontSize: 14, fontWeight: 700, color: b.earned ? GREEN_900 : MUTED, lineHeight: 1.2 }}>{b.name}{b.earned ? '' : <span className="sr-only"> (locked)</span>}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3" style={{ background: '#FFF1D6' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#7A4A06' }}>{data.nextBadge ? `Next badge: ${data.nextBadge.name}` : 'Every badge earned'}</span>
                      {data.badges.length > 6 && <button type="button" onClick={() => setShowAllBadges((v) => !v)} style={{ fontSize: 15, fontWeight: 800, color: GREEN_700, minHeight: 44 }}>{showAllBadges ? 'Show less' : 'View all →'}</button>}
                    </div>
                  </section>
                </div>
              </>
            )}

            <p className="text-center" style={{ fontSize: 14, color: MUTED, margin: '8px 0 0' }}>Descriptive summary of recorded sessions. It does not diagnose or predict.</p>
          </div>
        )}
      </div>
    </TherapistPageShell>
  )
}
