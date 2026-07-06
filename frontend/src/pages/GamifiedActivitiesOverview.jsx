import { useState } from 'react'
import { useAnalytics } from '../context/AnalyticsContext'
import { useSharedProgress } from '../context/ProgressContext'
import { Sparkline } from './owner/ReportCharts'
import './GamifiedActivitiesPage.css'

const ANALYTICS_DOMAINS = ['Cognitive', 'Occupational', 'Physical', 'Speech']
const FRUSTRATION_FLAG_THRESHOLD = 50
const FATIGUE_FLAG_THRESHOLD = 15

function sessionFlags(obs) {
  const flags = []
  if (obs.frustrationScore > FRUSTRATION_FLAG_THRESHOLD) flags.push({ icon: '😤', label: 'Frustration' })
  if (obs.fatigueDropoffScore > FATIGUE_FLAG_THRESHOLD) flags.push({ icon: '🪫', label: 'Fatigue' })
  return flags
}

export const CHARACTER_STATS_META = [
  { key: 'intelligence', label: 'Intelligence', icon: '📚', color: '#6366f1' },
  { key: 'focus',        label: 'Focus',        icon: '🎯', color: '#f59e0b' },
  { key: 'resistance',   label: 'Resistance',   icon: '🛡️', color: '#10b981' },
  { key: 'creativity',   label: 'Creativity',   icon: '🎨', color: '#ec4899' },
  { key: 'speed',        label: 'Speed',        icon: '💨', color: '#06b6d4' },
  { key: 'memory',       label: 'Memory',       icon: '🧠', color: '#8b5cf6' },
]

function SearchIcon() {
  return (
    <svg className="ga-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function DomainAnalyticsPanel({ patient }) {
  const { analytics } = useAnalytics()
  const [activeDomain, setActiveDomain] = useState(ANALYTICS_DOMAINS[0])
  const [expandedId, setExpandedId] = useState(null)

  const patientKey = patient.name.toLowerCase()
  const domainObservations = analytics.observations
    .filter((o) => o.patientId === patientKey && o.domain === activeDomain)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const timeline = [...domainObservations].reverse()

  return (
    <>
      <h4 className="ga-modal-section-title">Session Analytics</h4>
      <div className="ga-domain-tabs">
        {ANALYTICS_DOMAINS.map((d) => (
          <button
            key={d}
            className={`ga-domain-tab ${activeDomain === d ? 'active' : ''}`}
            onClick={() => { setActiveDomain(d); setExpandedId(null) }}
          >
            {d}
          </button>
        ))}
      </div>

      {domainObservations.length === 0 ? (
        <p className="ga-empty-note">No {activeDomain.toLowerCase()} sessions recorded yet for this patient.</p>
      ) : (
        <>
          <div className="ga-sparkline-row">
            <div className="ga-sparkline-card">
              <span className="ga-sparkline-lbl">Accuracy over time</span>
              <Sparkline trend={domainObservations.map((o) => o.accuracy)} color="#10b981" height={40} />
            </div>
            <div className="ga-sparkline-card">
              <span className="ga-sparkline-lbl">Response time over time (ms)</span>
              <Sparkline trend={domainObservations.map((o) => o.avgResponseTimeMs)} color="#6366f1" height={40} />
            </div>
          </div>

          <div className="ga-session-timeline">
            {timeline.map((obs) => {
              const flags = sessionFlags(obs)
              const isOpen = expandedId === obs.id
              return (
                <div key={obs.id} className="ga-session-row">
                  <button className="ga-session-row-head" onClick={() => setExpandedId(isOpen ? null : obs.id)}>
                    <span className="ga-session-date">{new Date(obs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="ga-session-accuracy">{obs.accuracy}% accuracy</span>
                    <span className="ga-session-flags">
                      {flags.map((f) => (
                        <span key={f.label} className="ga-flag-badge" title={f.label}>{f.icon} {f.label}</span>
                      ))}
                    </span>
                    <span className="ga-session-chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="ga-session-detail">
                      <p className="ga-session-summary">{obs.autoSummaryText}</p>
                      <div className="ga-session-metrics">
                        <span>Avg response time: {obs.avgResponseTimeMs}ms</span>
                        <span>Responses: {obs.totalResponses}</span>
                        <span>Duration: {obs.durationMinutes} min</span>
                        {obs.baselineAccuracy !== null && <span>Baseline accuracy: {obs.baselineAccuracy}%</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function StatsModal({ patient, onClose }) {
  const { progress } = useSharedProgress()
  // The shared demo patient (Alvrin) shows live level/XP/stats driven by
  // actual played sessions; every other mock patient keeps its static data.
  const isDemoPatient = patient.name.toLowerCase() === progress.patientName.toLowerCase()
  const level = isDemoPatient ? progress.level : patient.level
  const xp = isDemoPatient ? progress.xp : patient.xp
  const xpNeeded = isDemoPatient ? progress.xpNeeded : patient.xpNeeded
  const characterStats = isDemoPatient ? progress.characterStats : patient.stats

  return (
    <div className="ga-modal-backdrop" onClick={onClose}>
      <div className="ga-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ga-modal-hero">
          <button className="ga-modal-close" onClick={onClose} aria-label="Close">✕</button>
          <img src={patient.avatar} alt={patient.name} className="ga-modal-avatar" />
          <div>
            <h3 className="ga-modal-name">{patient.name}</h3>
            <p className="ga-modal-meta">
              {patient.branch ? `${patient.branch} · ` : ''}
              {patient.therapist ? `${patient.therapist} · ` : ''}
              Favorite game: {patient.favoriteGame}
            </p>
          </div>
        </div>

        <div className="ga-modal-body">
          <div className="ga-modal-xp-row">
            <span className="ga-level-badge">⭐ LVL {level}</span>
            <div className="ga-xp-wrap" style={{ flex: 1, marginLeft: 14 }}>
              <span className="ga-xp-label">XP {xp}/{xpNeeded}</span>
              <div className="ga-xp-bar">
                <div className="ga-xp-fill" style={{ width: `${(xp / xpNeeded) * 100}%` }} />
              </div>
            </div>
          </div>

          <h4 className="ga-modal-section-title">Character Stats</h4>
          <div className="ga-stat-grid">
            {CHARACTER_STATS_META.map((meta) => {
              const value = characterStats[meta.key]
              return (
                <div key={meta.key} className="ga-stat-row">
                  <div className="ga-stat-row-top">
                    <span>{meta.icon} {meta.label}</span>
                    <span style={{ color: meta.color }}>{value}</span>
                  </div>
                  <div className="ga-stat-track">
                    <div className="ga-stat-fill" style={{ width: `${value}%`, background: meta.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          <h4 className="ga-modal-section-title">Activity</h4>
          <div className="ga-modal-info-grid">
            <div className="ga-modal-info-item">
              <span className="ga-modal-info-lbl">Games Completed</span>
              <span className="ga-modal-info-val">{patient.gamesCompleted}</span>
            </div>
            <div className="ga-modal-info-item">
              <span className="ga-modal-info-lbl">Badges Earned</span>
              <span className="ga-modal-info-val">🏆 {patient.badges}</span>
            </div>
            <div className="ga-modal-info-item">
              <span className="ga-modal-info-lbl">Last Played</span>
              <span className="ga-modal-info-val">{patient.lastPlayed}</span>
            </div>
            <div className="ga-modal-info-item">
              <span className="ga-modal-info-lbl">Favorite Game</span>
              <span className="ga-modal-info-val">{patient.favoriteGame}</span>
            </div>
          </div>

          <DomainAnalyticsPanel patient={patient} />
        </div>
      </div>
    </div>
  )
}

const SORT_OPTIONS = [
  { id: 'level',  label: 'Sort by Level' },
  { id: 'games',  label: 'Sort by Games Completed' },
  { id: 'badges', label: 'Sort by Badges' },
  { id: 'name',   label: 'Sort by Name' },
]

export default function GamifiedActivitiesOverview({ Shell, shellProps, patients, showBranchColumn }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('level')
  const [viewPatient, setViewPatient] = useState(null)

  const filtered = patients
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'games') return b.gamesCompleted - a.gamesCompleted
      if (sortBy === 'badges') return b.badges - a.badges
      return b.level - a.level
    })

  const totals = {
    playing: patients.length,
    avgLevel: patients.length ? Math.round(patients.reduce((sum, p) => sum + p.level, 0) / patients.length) : 0,
    games: patients.reduce((sum, p) => sum + p.gamesCompleted, 0),
    badges: patients.reduce((sum, p) => sum + p.badges, 0),
  }

  return (
    <Shell {...shellProps}>
      <div className="ga-stats-strip">
        <div className="ga-stat-item">
          <span className="ga-stat-num">{totals.playing}</span>
          <span className="ga-stat-lbl">Patients Playing</span>
        </div>
        <div className="ga-stat-sep" />
        <div className="ga-stat-item">
          <span className="ga-stat-num">{totals.avgLevel}</span>
          <span className="ga-stat-lbl">Average Level</span>
        </div>
        <div className="ga-stat-sep" />
        <div className="ga-stat-item">
          <span className="ga-stat-num">{totals.games}</span>
          <span className="ga-stat-lbl">Games Completed</span>
        </div>
        <div className="ga-stat-sep" />
        <div className="ga-stat-item">
          <span className="ga-stat-num">{totals.badges}</span>
          <span className="ga-stat-lbl">Badges Earned</span>
        </div>
      </div>

      <div className="ga-toolbar">
        <div className="ga-search-wrap">
          <SearchIcon />
          <input
            className="ga-search"
            placeholder="Search patients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="ga-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="ga-table-card">
        <div className="ga-table-scroll">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Patient</th>
                {showBranchColumn && <th>Branch</th>}
                {showBranchColumn && <th>Therapist</th>}
                <th>Level</th>
                <th>XP</th>
                <th>Games Completed</th>
                <th>Badges</th>
                <th>Last Played</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={showBranchColumn ? 9 : 7} className="ga-table-empty">No patients match your search.</td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="ga-patient-cell">
                      <img src={p.avatar} alt={p.name} className="ga-avatar" />
                      <div>
                        <div className="ga-patient-name">{p.name}</div>
                        <div className="ga-patient-sub">Age {p.age}</div>
                      </div>
                    </div>
                  </td>
                  {showBranchColumn && <td><span className="ga-branch-badge">{p.branch}</span></td>}
                  {showBranchColumn && <td>{p.therapist}</td>}
                  <td><span className="ga-level-badge">⭐ {p.level}</span></td>
                  <td>
                    <div className="ga-xp-wrap">
                      <span className="ga-xp-label">{p.xp}/{p.xpNeeded}</span>
                      <div className="ga-xp-bar">
                        <div className="ga-xp-fill" style={{ width: `${(p.xp / p.xpNeeded) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>{p.gamesCompleted}</td>
                  <td><span className="ga-badge-count">🏆 {p.badges}</span></td>
                  <td>{p.lastPlayed}</td>
                  <td>
                    <button className="ga-view-btn" onClick={() => setViewPatient(p)}>View Stats</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewPatient && <StatsModal patient={viewPatient} onClose={() => setViewPatient(null)} />}
    </Shell>
  )
}
