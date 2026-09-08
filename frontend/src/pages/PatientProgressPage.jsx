import { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Pie } from 'react-chartjs-2'
import PatientSidebar from '../components/PatientSidebar'
import { useSharedProgress } from '../context/ProgressContext'
import './PatientProgressPage.css'

ChartJS.register(ArcElement, Tooltip)

/* ── Line icons (replace decorative emoji) ── */
const svgBase = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
}
const IconBrain = (p) => (
  <svg {...svgBase} {...p}><path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>
)
const IconActivity = (p) => (
  <svg {...svgBase} {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
)
const IconHand = (p) => (
  <svg {...svgBase} {...p}><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
)
const IconSpeech = (p) => (
  <svg {...svgBase} {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
)
const IconSun = (p) => (
  <svg {...svgBase} {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
)
const IconStar = (p) => (
  <svg {...svgBase} {...p} fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>
)
const IconTrophy = (p) => (
  <svg {...svgBase} {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
)
const IconFlame = (p) => (
  <svg {...svgBase} {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>
)
const IconTrendUp = (p) => (
  <svg {...svgBase} {...p}><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></svg>
)
const IconSparkles = (p) => (
  <svg {...svgBase} {...p}><path d="M9.94 14.06 8 20l-1.94-5.94L1 12l5.06-2.06L8 4l1.94 5.94L15 12Z"/><path d="M18 5v4M20 7h-4"/></svg>
)

const DOMAIN_META = {
  Cognitive:     { color: '#6366f1', icon: <IconBrain width={13} height={13} />,    friendly: 'focus and thinking games' },
  Physical:      { color: '#10b981', icon: <IconActivity width={13} height={13} />, friendly: 'balance and movement games' },
  Occupational:  { color: '#f59e0b', icon: <IconHand width={13} height={13} />,     friendly: 'everyday skills practice' },
  Speech:        { color: '#ec4899', icon: <IconSpeech width={13} height={13} />,   friendly: 'talking and word games' },
}

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 2.2 + Math.random() * 1.4,
    color: ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#a29bfe', '#ff9ff3'][i % 6],
    rotate: Math.random() * 360,
  }))
  return (
    <div className="pp-confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="pp-confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function MilestoneModal({ badge, onClose }) {
  return (
    <div className="pp-modal-backdrop" onClick={onClose}>
      <Confetti />
      <div className="pp-milestone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pp-milestone-icon">{badge.icon}</div>
        <p className="pp-milestone-eyebrow">New Badge Unlocked!</p>
        <h2 className="pp-milestone-name">{badge.label}</h2>
        <p className="pp-milestone-sub">Way to go! Celebrate this win together.</p>
        <button className="pp-milestone-btn" onClick={onClose}>Yay!</button>
      </div>
    </div>
  )
}

function DomainEngagementPie({ domainEngagement }) {
  const entries = Object.entries(domainEngagement).map(([key, value]) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    return { label, value, meta: DOMAIN_META[label] }
  })
  const total = entries.reduce((sum, e) => sum + e.value, 0)

  const data = {
    labels: entries.map((e) => e.label),
    datasets: [{
      data: entries.map((e) => e.value),
      backgroundColor: entries.map((e) => e.meta.color),
      borderColor: '#fff',
      borderWidth: 2,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = total ? Math.round((ctx.parsed / total) * 100) : 0
            return ` ${ctx.label}: ${pct}%`
          },
        },
      },
    },
  }

  return (
    <div className="pp-pie-wrap">
      <div className="pp-pie-chart">
        <Pie data={data} options={options} />
      </div>
      <ul className="pp-pie-legend">
        {entries.map((e) => (
          <li key={e.label} className="pp-pie-legend-item">
            <span className="pp-pie-legend-dot" style={{ background: e.meta.color }} />
            <span className="pp-pie-legend-label">{e.meta.icon} {e.label}</span>
            <span className="pp-pie-legend-pct">{total ? Math.round((e.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StreakTracker({ streak }) {
  return (
    <div className="pp-card pp-streak-card">
      <div className="pp-streak-flame"><IconFlame width={26} height={26} /></div>
      <div>
        <div className="pp-streak-num">{streak.current}-day play streak!</div>
        <div className="pp-streak-days">
          {streak.last7Days.map((played, i) => (
            <span key={i} className={`pp-streak-dot ${played ? 'pp-streak-dot-on' : ''}`} />
          ))}
        </div>
        <p className="pp-streak-sub">
          Best ever: {streak.longest} days in a row <IconTrophy width={13} height={13} />
        </p>
      </div>
    </div>
  )
}

export default function PatientProgressPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [period, setPeriod] = useState('weekly')
  const { progress, dismissNewBadge, markExerciseDone } = useSharedProgress()
  const currentUser = user || { name: progress.patientName, role: 'Patient', avatar: '/therapy-pro-logo.png' }

  const newBadge = progress.badges.find((b) => b.isNew)
  const [showMilestone, setShowMilestone] = useState(false)

  useEffect(() => {
    if (newBadge) {
      const t = setTimeout(() => setShowMilestone(true), 500)
      return () => clearTimeout(t)
    }
  }, [newBadge?.id]) // eslint-disable-line

  const closeMilestone = () => {
    setShowMilestone(false)
    if (newBadge) dismissNewBadge(newBadge.id)
  }

  const topDomain = Object.entries(progress.domainEngagement).sort((a, b) => b[1] - a[1])[0][0]
  const topDomainLabel = topDomain.charAt(0).toUpperCase() + topDomain.slice(1)
  const friendlySummary = `Getting better at ${DOMAIN_META[topDomainLabel]?.friendly || 'their exercises'}!`

  const stats = period === 'weekly' ? progress.weekly : progress.monthly
  const prevGames = period === 'weekly' ? progress.weekly.gamesCompletedPrev : progress.monthly.gamesCompletedPrev
  const gamesDelta = stats.gamesCompleted - prevGames
  const trendUp = gamesDelta > 0
  const trendNote = gamesDelta === 0
    ? `Same number of games as last ${period === 'weekly' ? 'week' : 'month'}.`
    : gamesDelta > 0
      ? `${gamesDelta} more game${gamesDelta === 1 ? '' : 's'} completed than last ${period === 'weekly' ? 'week' : 'month'}!`
      : `${Math.abs(gamesDelta)} fewer games than last ${period === 'weekly' ? 'week' : 'month'} — that's okay, every day is different!`

  const bestDelta = progress.personalBest.current - progress.personalBest.best
  const personalBestNote = bestDelta > 0
    ? `Best week yet! ${progress.personalBest.current} (previous best: ${progress.personalBest.best})`
    : `Working toward their best: ${progress.personalBest.current} of ${progress.personalBest.best}`

  return (
    <div className="page-with-sidebar pp-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <main className="page-content pp-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="pp-header">
          <h1 className="pp-title">
            {progress.patientName}'s Progress Journey
            <IconSun width={22} height={22} className="pp-title-icon" />
          </h1>
          <p className="pp-subtitle">A warm look at how things are going — celebrate every step together!</p>
        </div>

        {/* ── Snapshot ── */}
        <div className="pp-card pp-snapshot-card">
          <div className="pp-snapshot-top">
            <div className="pp-level-badge"><IconStar width={13} height={13} /> Level {progress.level}</div>
            <div className="pp-xp-wrap">
              <span className="pp-xp-label">XP {progress.xp} / {progress.xpNeeded}</span>
              <div className="pp-xp-bar"><div className="pp-xp-fill" style={{ width: `${(progress.xp / progress.xpNeeded) * 100}%` }} /></div>
            </div>
            <div className="pp-badges-count"><IconTrophy width={16} height={16} /> {progress.badges.length} Badges</div>
          </div>
          <p className="pp-snapshot-summary">{friendlySummary}</p>
        </div>

        {/* ── Weekly / Monthly summary ── */}
        <div className="pp-card">
          <div className="pp-section-header">
            <h2 className="pp-section-title">Progress Recap</h2>
            <div className="pp-period-toggle">
              <button className={period === 'weekly' ? 'pp-period-btn active' : 'pp-period-btn'} onClick={() => setPeriod('weekly')}>This Week</button>
              <button className={period === 'monthly' ? 'pp-period-btn active' : 'pp-period-btn'} onClick={() => setPeriod('monthly')}>This Month</button>
            </div>
          </div>
          <div className="pp-recap-grid">
            <div className="pp-recap-item">
              <span className="pp-recap-num">{stats.sessionsCompleted}</span>
              <span className="pp-recap-lbl">Sessions Completed</span>
            </div>
            <div className="pp-recap-item">
              <span className="pp-recap-num">{stats.minutesPlayed}</span>
              <span className="pp-recap-lbl">Minutes Played</span>
            </div>
            <div className="pp-recap-item">
              <span className="pp-recap-num">{stats.gamesCompleted}</span>
              <span className="pp-recap-lbl">Games Completed</span>
            </div>
          </div>
          <div className="pp-domain-chips">
            {stats.domainsPracticed.map((d) => (
              <span key={d} className="pp-domain-chip" style={{ background: `${DOMAIN_META[d]?.color}18`, color: DOMAIN_META[d]?.color }}>
                {DOMAIN_META[d]?.icon} {d}
              </span>
            ))}
          </div>
          <p className="pp-trend-note">
            {trendUp && <IconSparkles width={15} height={15} />}
            {trendNote}
          </p>
        </div>

        {/* ── Streak ── */}
        <StreakTracker streak={progress.streak} />

        {/* ── Domain engagement pie ── */}
        <div className="pp-card">
          <h2 className="pp-section-title">How They're Engaging</h2>
          <DomainEngagementPie domainEngagement={progress.domainEngagement} />
          <p className="pp-domain-note">This chart shows {progress.patientName}'s share of engagement across each area — not a clinical score.</p>
        </div>

        {/* ── Personal best ── */}
        <div className="pp-card pp-personal-best-card">
          <div className="pp-personal-best-icon"><IconTrendUp width={26} height={26} /></div>
          <div>
            <h3 className="pp-personal-best-title">Comparing to {progress.patientName}'s Own Best</h3>
            <p className="pp-personal-best-note">{personalBestNote}</p>
            <p className="pp-personal-best-hint">We only ever compare {progress.patientName} to their own progress — never to other children.</p>
          </div>
        </div>

        {/* ── Upcoming goals ── */}
        <div className="pp-card">
          <h2 className="pp-section-title">Upcoming Goals</h2>
          <ul className="pp-goals-list">
            {progress.goals.map((g) => (
              <li key={g.id} className="pp-goal-item">
                <span className="pp-domain-chip" style={{ background: `${DOMAIN_META[g.domain]?.color}18`, color: DOMAIN_META[g.domain]?.color }}>
                  {DOMAIN_META[g.domain]?.icon} {g.domain}
                </span>
                <span className="pp-goal-text">{g.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Therapist notes (curated) ── */}
        <div className="pp-card">
          <h2 className="pp-section-title">Notes From the Therapist</h2>
          {progress.sharedNotes.length === 0 ? (
            <p className="pp-empty-note">No shared updates yet — check back soon!</p>
          ) : (
            <div className="pp-notes-list">
              {progress.sharedNotes.map((n) => (
                <div key={n.id} className="pp-note-card">
                  <div className="pp-note-top">
                    <span className="pp-domain-chip" style={{ background: `${DOMAIN_META[n.domain]?.color}18`, color: DOMAIN_META[n.domain]?.color }}>
                      {DOMAIN_META[n.domain]?.icon} {n.domain}
                    </span>
                    <span className="pp-note-date">{n.date}</span>
                  </div>
                  <p className="pp-note-summary">{n.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Suggested home activities ── */}
        <div className="pp-card">
          <h2 className="pp-section-title">Suggested Home Activities</h2>
          {progress.exercises.length === 0 ? (
            <p className="pp-empty-note">No home activities assigned right now.</p>
          ) : (
            <div className="pp-activities-list">
              {progress.exercises.map((ex) => (
                <label key={ex.id} className={`pp-activity-item ${ex.status === 'Done' ? 'pp-activity-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ex.status === 'Done'}
                    onChange={() => ex.status !== 'Done' && markExerciseDone(ex.id)}
                    disabled={ex.status === 'Done'}
                  />
                  <div className="pp-activity-body">
                    <div className="pp-activity-top">
                      <span className="pp-activity-title">{ex.title}</span>
                      <span className="pp-domain-chip" style={{ background: `${DOMAIN_META[ex.domain]?.color}18`, color: DOMAIN_META[ex.domain]?.color }}>
                        {DOMAIN_META[ex.domain]?.icon} {ex.domain}
                      </span>
                    </div>
                    <p className="pp-activity-instructions">{ex.instructions}</p>
                    <span className="pp-activity-due">Due {ex.due}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </main>

      {showMilestone && newBadge && <MilestoneModal badge={newBadge} onClose={closeMilestone} />}
    </div>
  )
}
