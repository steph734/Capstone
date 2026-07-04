import { useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import './TherapistDashboard.css'

// ── Icons ──────────────────────────────────────────────
function PatientIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function NoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}
function ExerciseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </svg>
  )
}
function TrendUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
function TrendDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ── Data ───────────────────────────────────────────────
const KPI_DATA = [
  {
    label: 'Patients Assigned',
    value: '24',
    meta: '5 active today',
    trend: '+2 this week',
    trendUp: true,
    color: 'teal',
    Icon: PatientIcon,
  },
  {
    label: 'Appointments Today',
    value: '8',
    meta: '6 confirmed · 2 pending',
    trend: '+1 added',
    trendUp: true,
    color: 'blue',
    Icon: CalendarIcon,
  },
  {
    label: 'Notes Completed',
    value: '18',
    meta: '4 remaining today',
    trend: '+5 vs yesterday',
    trendUp: true,
    color: 'purple',
    Icon: NoteIcon,
  },
  {
    label: 'Avg. Completion',
    value: '85%',
    meta: 'Exercises this week',
    trend: '-3% vs last week',
    trendUp: false,
    color: 'amber',
    Icon: ExerciseIcon,
  },
]

// Real "today" anchor
const REAL_TODAY = { year: 2026, month: 6, day: 4 } // July 4 2026

// Sessions by "year-month" key → { day: count }
const ALL_SESSIONS = {
  '2026-4': { 4:3, 7:5, 8:6, 12:4, 13:7, 19:5, 20:8, 26:4, 27:6 },
  '2026-5': { 1:4, 2:6, 8:5, 9:7, 15:8, 16:5, 22:6, 23:4, 29:7, 30:5 },
  '2026-6': {
    1:3, 2:5, 3:4, 4:5,
    7:6, 8:5, 9:8, 10:6,
    14:7, 15:5, 16:9, 17:6,
    21:5, 22:8, 23:7, 24:6,
    28:4, 29:6, 30:7, 31:5,
  },
  '2026-7': { 3:5, 4:7, 5:6, 6:4, 10:8, 11:6, 12:5, 13:3, 17:9, 18:7, 19:5, 20:4, 24:6, 25:8, 26:5, 27:4, 31:3 },
  '2026-8': { 1:4, 2:6, 8:7, 9:5, 14:8, 15:6, 21:5, 22:7, 28:4, 29:6 },
}

// Appointments by "year-month" key → { day: [strings] }
const ALL_APPTS = {
  '2026-6': {
    4:  ['9:00 AM – Aira Lopez', '10:30 AM – Noah Cruz', '1:00 PM – Mika Santos', '2:30 PM – Lily Santos', '4:00 PM – Jasper Reyes'],
    9:  ['8:00 AM – Aira Lopez', '10:00 AM – Noah Cruz', '2:00 PM – Mika Santos'],
    16: ['9:00 AM – Jasper Reyes', '11:00 AM – Lily Santos', '3:00 PM – Aira Lopez'],
  },
  '2026-7': {
    4:  ['8:30 AM – Noah Cruz', '10:00 AM – Aira Lopez', '2:00 PM – Jasper Reyes'],
    17: ['9:00 AM – Mika Santos', '11:00 AM – Lily Santos'],
  },
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const DISTRIBUTION = [
  { label: 'On Track',         count: 16, color: '#4a6b5d' },
  { label: 'Needs Attention',  count: 6,  color: '#f59e0b' },
  { label: 'Critical',         count: 2,  color: '#ef4444' },
]
const TOTAL_PATIENTS = DISTRIBUTION.reduce((s, d) => s + d.count, 0)

const THERAPY_COMPLETION = [
  { type: 'Speech Therapy',      pct: 92, color: '#4a6b5d' },
  { type: 'Physical Therapy',    pct: 87, color: '#3b82f6' },
  { type: 'Occupational Therapy',pct: 78, color: '#8b5cf6' },
  { type: 'Developmental',       pct: 85, color: '#f59e0b' },
]

const APPOINTMENTS = [
  { time: '9:00 AM',  patient: 'Aira Lopez',    type: 'Speech Therapy',    status: 'confirmed', emoji: '👧' },
  { time: '10:30 AM', patient: 'Noah Cruz',      type: 'Developmental',     status: 'pending',   emoji: '👦' },
  { time: '1:00 PM',  patient: 'Mika Santos',   type: 'Articulation',      status: 'confirmed', emoji: '👧' },
  { time: '2:30 PM',  patient: 'Lily Santos',   type: 'Speech Therapy',    status: 'confirmed', emoji: '👧' },
  { time: '4:00 PM',  patient: 'Jasper Reyes',  type: 'Physical Therapy',  status: 'pending',   emoji: '👦' },
]

const TODAY_TASKS = [
  { text: "Review Jasper's speech progress note",                     priority: 'high'   },
  { text: 'Prepare balance exercise set for afternoon sessions',       priority: 'medium' },
  { text: 'Follow up on parent feedback forms',                        priority: 'medium' },
  { text: 'Update patient assessments for weekly review',              priority: 'low'    },
]

const ACTIVITY = [
  { time: '2h ago',    text: 'SOAP note completed — Aira Lopez',          icon: '📝' },
  { time: '3h ago',    text: 'Exercise set assigned — Noah Cruz',          icon: '🏃' },
  { time: '5h ago',    text: 'Appointment rescheduled — Mika Santos',     icon: '📅' },
  { time: 'Yesterday', text: 'Progress report submitted — Jasper Reyes',  icon: '📊' },
  { time: 'Yesterday', text: 'New patient intake completed — Lily Santos', icon: '👤' },
]

// ── Sub-components ─────────────────────────────────────
function CalendarPanel() {
  const [view, setView] = useState({ year: REAL_TODAY.year, month: REAL_TODAY.month })
  const [selectedDay, setSelectedDay] = useState(REAL_TODAY.day)

  const { year, month } = view
  const isToday = (d) => d === REAL_TODAY.day && year === REAL_TODAY.year && month === REAL_TODAY.month

  // Dynamic calendar math
  const firstDOW   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Look up data for this month
  const sessKey  = `${year}-${month}`
  const sessions = ALL_SESSIONS[sessKey] || {}
  const appts    = (ALL_APPTS[sessKey] || {})[selectedDay] || []
  const selSess  = sessions[selectedDay] || 0
  const monthTotal = Object.values(sessions).reduce((s, v) => s + v, 0)

  const sessLevel = (n) => !n ? null : n <= 3 ? 'low' : n <= 6 ? 'med' : 'high'

  const goPrev = () => setView(v => {
    const nm = v.month === 0  ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }
    setSelectedDay(null)
    return nm
  })
  const goNext = () => setView(v => {
    const nm = v.month === 11 ? { year: v.year + 1, month: 0  } : { year: v.year, month: v.month + 1 }
    setSelectedDay(null)
    return nm
  })

  // Build grid
  const cells = Array.from({ length: firstDOW }, (_, i) => ({ key: `e${i}`, empty: true }))
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: d, day: d })

  return (
    <div className="th-panel th-cal-panel">
      <div className="th-panel-head">
        <div>
          <h3>Session Calendar</h3>
          <p>Tap a day to view appointments</p>
        </div>
        <div className="th-cal-nav">
          <button className="th-cal-nav-btn" onClick={goPrev} aria-label="Previous month">&#8249;</button>
          <span className="th-cal-month-label">{MONTH_NAMES[month]} {year}</span>
          <button className="th-cal-nav-btn" onClick={goNext} aria-label="Next month">&#8250;</button>
        </div>
      </div>

      <div className="th-cal-dow-row">
        {DOW.map(d => <span key={d} className="th-cal-dow">{d}</span>)}
      </div>

      <div className="th-cal-grid">
        {cells.map(({ key, empty, day }) =>
          empty ? <div key={key} className="th-cal-cell th-cal-empty" /> : (
            <button
              key={key}
              className={[
                'th-cal-cell',
                isToday(day)                                 ? 'th-cal-today'    : '',
                day === selectedDay && !isToday(day)         ? 'th-cal-selected' : '',
                sessions[day]                                ? 'th-cal-has-sess' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(day)}
              aria-label={`${MONTH_NAMES[month]} ${day} ${year}`}
            >
              <span className="th-cal-dn">{day}</span>
              {sessions[day] && (
                <span className={`th-cal-pip th-pip-${sessLevel(sessions[day])}`} />
              )}
            </button>
          )
        )}
      </div>

      <div className="th-cal-legend-row">
        <span className="th-cal-leg-item"><span className="th-cal-pip th-pip-low" />Available</span>
        <span className="th-cal-leg-item"><span className="th-cal-pip th-pip-med" />Booked</span>
        <span className="th-cal-leg-item"><span className="th-cal-pip th-pip-high" />Closed</span>
        <span className="th-cal-leg-sep" />
        <span className="th-cal-leg-total">
          {monthTotal > 0
            ? <>{MONTH_NAMES[month]} total: <strong>{monthTotal} sessions</strong></>
            : <>{MONTH_NAMES[month]}: <strong>no data</strong></>
          }
        </span>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="th-cal-detail">
          <div className="th-cal-detail-head">
            <span className="th-cal-detail-date">
              {MONTH_NAMES[month]} {selectedDay}, {year}
              {isToday(selectedDay) && <span className="th-cal-today-tag">Today</span>}
            </span>
            <span className="th-cal-detail-count">
              {selSess ? `${selSess} sessions` : 'No sessions'}
            </span>
          </div>
          {appts.length > 0 ? (
            <div className="th-cal-appt-list">
              {appts.map((a, i) => (
                <div key={i} className="th-cal-appt-row">
                  <span className="th-cal-appt-dot" />
                  <span className="th-cal-appt-text">{a}</span>
                </div>
              ))}
            </div>
          ) : selSess > 0 ? (
            <p className="th-cal-no-detail">Session details not available for this date.</p>
          ) : (
            <p className="th-cal-no-detail">No appointments scheduled.</p>
          )}
        </div>
      )}
    </div>
  )
}

function DonutChart({ data, total }) {
  let currentPct = 0
  const stops = data.map(d => {
    const start = currentPct
    currentPct += (d.count / total) * 100
    return `${d.color} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`
  }).join(', ')

  return (
    <div className="th-donut-wrap">
      <div className="th-donut-ring" style={{ background: `conic-gradient(${stops})` }}>
        <div className="th-donut-center">
          <span className="th-donut-total">{total}</span>
          <span className="th-donut-sublabel">Patients</span>
        </div>
      </div>
      <div className="th-donut-legend">
        {data.map(d => (
          <div key={d.label} className="th-legend-row">
            <span className="th-legend-dot" style={{ background: d.color }} />
            <span className="th-legend-label">{d.label}</span>
            <span className="th-legend-count">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────
export default function TherapistDashboard({ user, onLogout, betaTier }) {
  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Daily therapy workload and patient progress"
      icon="🩺"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {/* ── KPI Cards ── */}
      <div className="th-kpi-grid">
        {KPI_DATA.map(({ label, value, meta, trend, trendUp, color, Icon }) => (
          <div key={label} className={`th-kpi-card ${color}`}>
            <div className="th-kpi-top">
              <div className="th-kpi-icon"><Icon /></div>
              <span className={`th-kpi-trend ${trendUp ? 'up' : 'down'}`}>
                {trendUp ? <TrendUpIcon /> : <TrendDownIcon />}
                {trend}
              </span>
            </div>
            <div className="th-kpi-value">{value}</div>
            <div className="th-kpi-label">{label}</div>
            <div className="th-kpi-meta">{meta}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="th-charts-row">
        {/* Calendar */}
        <CalendarPanel />

        {/* Donut Chart */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Patient Status</h3>
              <p>Progress distribution</p>
            </div>
          </div>
          <DonutChart data={DISTRIBUTION} total={TOTAL_PATIENTS} />
        </div>
      </div>

      {/* ── Middle Row ── */}
      <div className="th-mid-row">
        {/* Therapy Completion Progress Bars */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Session Completion Rates</h3>
              <p>By therapy type this week</p>
            </div>
          </div>
          <div className="th-progress-list">
            {THERAPY_COMPLETION.map(({ type, pct, color }) => (
              <div key={type} className="th-progress-item">
                <div className="th-progress-header">
                  <span className="th-progress-name">{type}</span>
                  <span className="th-progress-pct">{pct}%</span>
                </div>
                <div className="th-progress-track">
                  <div
                    className="th-progress-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Today's Appointments</h3>
              <p>{APPOINTMENTS.length} sessions scheduled</p>
            </div>
          </div>
          <div className="th-appt-list">
            {APPOINTMENTS.map((a) => (
              <div key={a.time + a.patient} className="th-appt-row">
                <span className="th-appt-time">{a.time}</span>
                <div className="th-appt-avatar">{a.emoji}</div>
                <div className="th-appt-info">
                  <div className="th-appt-name">{a.patient}</div>
                  <div className="th-appt-type">{a.type}</div>
                </div>
                <span className={`th-appt-badge ${a.status}`}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="th-bottom-row">
        {/* Today's Focus */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Today's Focus</h3>
              <p>Priority tasks for the current shift</p>
            </div>
          </div>
          <div className="th-task-list">
            {TODAY_TASKS.map((t, i) => (
              <div key={i} className="th-task-row">
                <span className={`th-task-dot ${t.priority}`} />
                <span className="th-task-text">{t.text}</span>
                <span className={`th-task-pri ${t.priority}`}>
                  {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest updates across patients</p>
            </div>
          </div>
          <div className="th-activity-list">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="th-activity-row">
                <div className="th-activity-icon">{a.icon}</div>
                <div className="th-activity-info">
                  <div className="th-activity-text">{a.text}</div>
                  <div className="th-activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TherapistPageShell>
  )
}
