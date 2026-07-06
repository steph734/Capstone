import { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Pie } from 'react-chartjs-2'
import PatientSidebar from '../components/PatientSidebar'
import { useSharedProgress } from '../context/ProgressContext'
import './PatientProgressPage.css'

ChartJS.register(ArcElement, Tooltip)

const DOMAIN_META = {
  Cognitive:     { color: '#6366f1', icon: '🧩', friendly: 'focus and thinking games' },
  Physical:      { color: '#10b981', icon: '🤸', friendly: 'balance and movement games' },
  Occupational:  { color: '#f59e0b', icon: '✋', friendly: 'everyday skills practice' },
  Speech:        { color: '#ec4899', icon: '🗣️', friendly: 'talking and word games' },
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
        <p className="pp-milestone-sub">Way to go! Celebrate this win together. 🎉</p>
        <button className="pp-milestone-btn" onClick={onClose}>Yay! ⭐</button>
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
      <div className="pp-streak-flame">🔥</div>
      <div>
        <div className="pp-streak-num">{streak.current}-day play streak!</div>
        <div className="pp-streak-days">
          {streak.last7Days.map((played, i) => (
            <span key={i} className={`pp-streak-dot ${played ? 'pp-streak-dot-on' : ''}`} />
          ))}
        </div>
        <p className="pp-streak-sub">Best ever: {streak.longest} days in a row 🏆</p>
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
  const trendNote = gamesDelta === 0
    ? `Same number of games as last ${period === 'weekly' ? 'week' : 'month'}.`
    : gamesDelta > 0
      ? `🎉 ${gamesDelta} more game${gamesDelta === 1 ? '' : 's'} completed than last ${period === 'weekly' ? 'week' : 'month'}!`
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
          <h1 className="pp-title">{progress.patientName}'s Progress Journey 🌟</h1>
          <p className="pp-subtitle">A warm look at how things are going — celebrate every step together!</p>
        </div>

        {/* ── Snapshot ── */}
        <div className="pp-card pp-snapshot-card">
          <div className="pp-snapshot-top">
            <div className="pp-level-badge">⭐ Level {progress.level}</div>
            <div className="pp-xp-wrap">
              <span className="pp-xp-label">XP {progress.xp} / {progress.xpNeeded}</span>
              <div className="pp-xp-bar"><div className="pp-xp-fill" style={{ width: `${(progress.xp / progress.xpNeeded) * 100}%` }} /></div>
            </div>
            <div className="pp-badges-count">🏆 {progress.badges.length} Badges</div>
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
          <p className="pp-trend-note">{trendNote}</p>
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
          <div className="pp-personal-best-icon">📈</div>
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
