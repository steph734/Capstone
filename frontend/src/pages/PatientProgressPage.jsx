import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'
import BadgeMedal from '../components/BadgeMedal'
import { speakPao, stopPaoVoice } from '../utils/paoVoice'

// Patient-facing "My Progress" page. Real data only (GET /api/patient/progress
// — see api/_lib/routes/patient-progress.js), never the browser. Keeps to
// the patient-facing rules throughout: no accuracy percentages, no response
// times, no hints chart, no red, no timers, no negative comparisons.
const TYPE_COLOR = { Cognitive: '#6366f1', Speech: '#ec4899', Occupational: '#f59e0b', Physical: '#10b981' }
const DAYS_SUN_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-[#EDE9E0] ${className}`} />
}

function PaoFace({ size = 56 }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span style={{ fontSize: size * 0.7 }} aria-hidden="true">🐼</span>
  return <img src="/pao/svg/pao-great.svg" alt="" draggable={false} style={{ width: size, height: size, objectFit: 'contain' }} onError={() => setBroken(true)} />
}

export default function PatientProgressPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [range, setRange] = useState('week')
  const [data, setData] = useState(null)
  // The sidebar shows the logged-in account's own name (user.name). The
  // title must match it, rather than trusting the backend's resolved
  // `patients` record in isolation — the two can disagree if that email is
  // linked to more than one patient document.
  const displayName = user?.name || data?.name || 'Your'
  const [error, setError] = useState('')
  const readAloud = user?.read_aloud !== false

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    const params = new URLSearchParams({ range })
    if (user?.email) params.set('patientEmail', user.email)
    fetch(`/api/patient/progress?${params}`)
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!cancelled) (ok ? setData(b) : setError(b.error || 'Could not load progress.')) })
      .catch(() => { if (!cancelled) setError('Could not load progress.') })
    return () => { cancelled = true }
  }, [range, user?.email])

  const speakPaoMessage = () => {
    if (!data?.paoMessage) return
    speakPao(data.paoMessage, { rate: 0.9 })
  }
  useEffect(() => () => stopPaoVoice(), [])

  return (
    <div className="page-with-sidebar" style={{ fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif", background: '#FFF8EC' }}>
      <PatientSidebar user={user} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} betaTier={betaTier} profilePath="/patient/profile" />

      {/* .page-content carries the fixed sidebar's offset (margin-left) —
          centering must happen on an inner wrapper, never on this element
          itself, or an inline/competing margin silently cancels the offset
          and the content slides back under the sidebar. */}
      <main className="page-content" style={{ padding: '24px 28px 60px' }}>
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="mx-auto w-full max-w-[1160px] min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[30px] font-extrabold text-[#2B2366]">
              {displayName}'s Progress Journey <span aria-hidden="true">☀️</span>
            </h1>
            <p className="mt-1 text-[15px] text-[#5A5670]">A warm look at how things are going — celebrate every step together!</p>
          </div>
          <div className="flex gap-2 rounded-full bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setRange('week')} className={`h-11 rounded-full px-5 text-[14px] font-extrabold ${range === 'week' ? 'bg-[#234C40] text-white' : 'text-[#5A5670]'}`}>This Week</button>
            <button type="button" onClick={() => setRange('month')} className={`h-11 rounded-full px-5 text-[14px] font-extrabold ${range === 'month' ? 'bg-[#234C40] text-white' : 'text-[#5A5670]'}`}>This Month</button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-2xl border-2 border-[#F3D284] bg-[#FFF0CC] p-4 text-[15px] font-bold text-[#92400E]">{error}</div>}

        {!data && !error && (
          <div className="grid gap-5">
            <Skeleton className="h-[140px]" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Skeleton className="h-[110px]" /><Skeleton className="h-[110px]" /><Skeleton className="h-[110px]" /></div>
            <Skeleton className="h-[220px]" />
          </div>
        )}

        {data && (
          <div className="grid gap-5">
            {/* Level + streak */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.6fr_1fr]">
              <div className="flex items-center gap-4 rounded-[28px] p-5" style={{ background: 'linear-gradient(135deg,#FDE3E8,#FFF1D6)' }}>
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-md"><PaoFace size={64} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#FFC933] px-3 py-1 text-[13px] font-extrabold text-[#5A3E00]">⭐ Level {data.level}</span>
                    <span className="text-[13px] font-bold text-[#5A5670]">XP {data.xp} / {data.xpMax}</span>
                    <span className="ml-auto text-[13px] font-extrabold text-[#C97A00]">🏆 {data.badgeCount} Badges</span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FFC933]" style={{ width: `${Math.min(100, (data.xp / data.xpMax) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[15px] font-bold text-[#2B2366]">{data.headline}</p>
                  <p className="text-[13px] text-[#5A5670]">Only {Math.max(0, data.xpMax - data.xp)} XP to reach Level {data.level + 1} — you can do it!</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[28px] p-5" style={{ background: 'linear-gradient(135deg,#FFEAD2,#FFE0CC)' }}>
                <span className="text-[28px]" aria-hidden="true">🔥</span>
                <div>
                  <p className="text-[16px] font-extrabold text-[#2B2366]">{data.streak.current}-day play streak!</p>
                  <div className="mt-1.5 flex gap-1.5">
                    {data.streak.days.map((on, i) => (
                      <span key={i} className={`h-6 w-6 rounded-full text-center text-[11px] font-extrabold leading-6 ${on ? 'bg-[#F59E0B] text-white' : 'bg-white/70 text-[#C9A063]'}`}>{DAYS_SUN_FIRST[i]}</span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-bold text-[#92400E]">Best ever: {data.streak.best} days in a row 🏆</p>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-[22px] p-5" style={{ background: '#E3F0FD' }}>
                <p className="text-[32px] font-extrabold text-[#1D4ED8]">{data.kpis.sessions}</p>
                <p className="text-[13px] font-bold text-[#334155]">Sessions completed</p>
              </div>
              <div className="rounded-[22px] p-5" style={{ background: '#FFF1D6' }}>
                <p className="text-[32px] font-extrabold text-[#C97A00]">{data.kpis.minutes}</p>
                <p className="text-[13px] font-bold text-[#334155]">Minutes played</p>
              </div>
              <div className="rounded-[22px] p-5" style={{ background: '#E3F6EA' }}>
                <p className="text-[32px] font-extrabold text-[#166534]">{data.kpis.games}</p>
                <p className="text-[13px] font-bold text-[#334155]">Games completed</p>
              </div>
            </div>

            {/* Types + comparison (never negative) */}
            <div className="flex flex-wrap items-center gap-2">
              {data.types.map((t) => (
                <span key={t} className="rounded-full px-3 py-1.5 text-[13px] font-extrabold" style={{ background: `${TYPE_COLOR[t] || '#64748B'}18`, color: TYPE_COLOR[t] || '#64748B' }}>{t}</span>
              ))}
              <span className="rounded-2xl bg-[#E3F6EA] px-4 py-2.5 text-[14px] font-extrabold text-[#166534]">
                {data.moreThanBefore > 0 ? `✨ ${data.moreThanBefore} more game${data.moreThanBefore === 1 ? '' : 's'} than last ${range === 'week' ? 'week' : 'month'}!` : 'Every game counts!'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Skills */}
              <div className="rounded-[26px] bg-white p-5 shadow-sm">
                <h2 className="text-[18px] font-extrabold text-[#2B2366]">My skills are growing 🌱</h2>
                <p className="text-[13px] text-[#5A5670]">Every game helps a different skill grow</p>
                <div className="mt-3 flex flex-col gap-3">
                  {data.skills.map((s) => (
                    <div key={s.key}>
                      <div className="flex items-center justify-between text-[13.5px] font-bold text-[#2B2366]">
                        <span>{s.label}</span>
                        {s.deltaMonth > 0 && <span className="text-[#16a34a]">↑ +{s.deltaMonth} this month</span>}
                      </div>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#F1EFE6]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#6D4AE0] to-[#9B7BF0]" style={{ width: `${Math.min(100, s.value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="rounded-[26px] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-[18px] font-extrabold text-[#2B2366]">My badges 🏆</h2>
                  <span className="text-[13px] font-bold text-[#5A5670]">{data.badgeCount} of {data.badges.length}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {data.badges.slice(0, 8).map((b) => (
                    <div key={b.code} className="flex flex-col items-center gap-1">
                      <BadgeMedal shape={b.shape} colour={b.colour} symbol={b.symbol} size={56} muted={!b.earned} />
                      <span className="text-center text-[10.5px] font-bold text-[#5A5670]">{b.name}</span>
                    </div>
                  ))}
                </div>
                {data.nextBadge && <p className="mt-3 rounded-xl bg-[#FFF0CC] px-3 py-2 text-[13px] font-bold text-[#92400E]">Next badge: {data.nextBadge.name} — keep playing!</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Recent games */}
              <div className="rounded-[26px] bg-white p-5 shadow-sm">
                <h2 className="text-[18px] font-extrabold text-[#2B2366]">Games I played 🎮</h2>
                {data.recent.length === 0 ? (
                  <p className="mt-2 text-[14px] text-[#5A5670]">No games played yet — let's start one!</p>
                ) : (
                  <div className="mt-3 flex flex-col divide-y divide-[#F1EFE6]">
                    {data.recent.map((g, i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-[14.5px] font-extrabold text-[#2B2366]">{g.name}</p>
                          <p className="text-[12px] text-[#5A5670]">{new Date(g.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span aria-label={`${g.stars} of 3 stars`}>{'⭐'.repeat(g.stars)}{'☆'.repeat(3 - g.stars)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My week */}
              <div className="rounded-[26px] bg-white p-5 shadow-sm">
                <h2 className="text-[18px] font-extrabold text-[#2B2366]">My week 📅</h2>
                <p className="text-[13px] text-[#5A5670]">Games I finished each day</p>
                <div className="mt-4 flex h-[140px] items-end justify-between gap-2">
                  {data.week.map((d, i) => {
                    const max = Math.max(1, ...data.week.map((w) => w.games))
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[12px] font-extrabold text-[#2B2366]">{d.games || ''}</span>
                        <div className="w-full rounded-t-lg bg-gradient-to-t from-[#16a34a] to-[#34d399]" style={{ height: `${Math.max(4, (d.games / max) * 100)}px` }} />
                        <span className="text-[11px] font-bold text-[#5A5670]">{d.day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Pao strip */}
            <div className="flex flex-wrap items-center gap-4 rounded-[26px] bg-[#E3F0FD] p-5">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white shadow"><PaoFace size={44} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#1D4ED8]">Pao says</p>
                <p className="text-[15px] font-bold text-[#2B2366]">{data.paoMessage}</p>
              </div>
              {readAloud && (
                <button type="button" onClick={speakPaoMessage} aria-label="Read Pao's message aloud" className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-[18px] shadow">🔊</button>
              )}
              <button type="button" onClick={() => navigate('/patient/gamified-activities')} className="h-11 flex-shrink-0 rounded-full bg-[#234C40] px-5 text-[14px] font-extrabold text-white">Play now 🎮</button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
