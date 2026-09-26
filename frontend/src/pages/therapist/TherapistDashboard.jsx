import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { getAuditLogs } from '../../utils/auditLog'
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
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Helpers ────────────────────────────────────────────
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function fmt12(t) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
// Sunday of the week containing `iso` (YYYY-MM-DD), as an ISO date string.
function startOfWeekIso(iso) {
  const d = new Date(iso + 'T00:00')
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}
function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function monthPrefixOf(iso) {
  return iso.slice(0, 7)
}
function prevMonthPrefix(iso) {
  const d = new Date(iso + 'T00:00')
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}
// Initials for the avatar circle, e.g. "Alvrine Santiago" -> "AS".
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}
const AVATAR_PALETTE = ['#e8f5f0', '#e0f0ff', '#fde8f3', '#fef3c7', '#f3e8ff', '#e0fbf5']
const AVATAR_FG = ['#2c4a3e', '#1565c0', '#a3175c', '#92400e', '#7b1fa2', '#0f766e']
function avatarColorFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const idx = h % AVATAR_PALETTE.length
  return { bg: AVATAR_PALETTE[idx], fg: AVATAR_FG[idx] }
}
const DONUT_COLORS = ['#4a6b5d', '#3b82f6', '#f59e0b', '#8b5cf6', '#e46a4b', '#0f766e']

// ── Sub-components ─────────────────────────────────────
function CalendarPanel({ appointments }) {
  const today = isoToday()
  const [view, setView] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())

  const { year, month } = view
  const isToday = (d) => {
    const t = new Date()
    return d === t.getDate() && year === t.getFullYear() && month === t.getMonth()
  }

  const firstDOW = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const active = useMemo(() => appointments.filter(a => !a.isArchived), [appointments])

  const iso = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const apptsForDay = (d) => active.filter(a => a.date === iso(d)).sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const monthTotal = active.filter(a => a.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length

  const goPrev = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  const goNext = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })

  const cells = Array.from({ length: firstDOW }, (_, i) => ({ key: `e${i}`, empty: true }))
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: d, day: d })

  const selectedAppts = selectedDay ? apptsForDay(selectedDay) : []

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
                isToday(day) ? 'th-cal-today' : '',
                day === selectedDay && !isToday(day) ? 'th-cal-selected' : '',
                apptsForDay(day).length ? 'th-cal-has-sess' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              aria-label={`${MONTH_NAMES[month]} ${day} ${year}`}
            >
              <span className="th-cal-dn">{day}</span>
              <span className={`th-cal-pip th-pip-${apptsForDay(day).length ? 'med' : 'low'}`} />
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
            ? <>{MONTH_NAMES[month]} total: <strong>{monthTotal} session{monthTotal !== 1 ? 's' : ''}</strong></>
            : <>{MONTH_NAMES[month]}: <strong>no sessions</strong></>
          }
        </span>
      </div>

      {selectedDay && (
        <div className="th-cal-detail">
          <div className="th-cal-detail-head">
            <span className="th-cal-detail-date">
              {MONTH_NAMES[month]} {selectedDay}, {year}
              {isToday(selectedDay) && <span className="th-cal-today-tag">Today</span>}
            </span>
            <span className="th-cal-detail-count">
              {selectedAppts.length ? `${selectedAppts.length} session${selectedAppts.length !== 1 ? 's' : ''}` : 'No sessions'}
            </span>
          </div>
          {selectedAppts.length > 0 ? (
            <div className="th-cal-appt-list">
              {selectedAppts.map((a) => (
                <div key={a.id} className="th-cal-appt-row">
                  <span className="th-cal-appt-dot" />
                  <span className="th-cal-appt-text">{fmt12(a.time)} – {a.patientName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="th-cal-no-detail">No appointments scheduled.</p>
          )}
        </div>
      )}
    </div>
  )
}

function DonutChart({ data, total }) {
  if (!total) {
    return <p className="th-panel-note">No patients yet — this fills in once you have appointments booked.</p>
  }
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
  const navigate = useNavigate()

  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [patientsError, setPatientsError] = useState('')

  const [appointments, setAppointments] = useState([])
  const [apptsLoading, setApptsLoading] = useState(true)
  const [apptsError, setApptsError] = useState('')

  const [attendance, setAttendance] = useState(null)
  const [attLoading, setAttLoading] = useState(true)
  const [attError, setAttError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setPatientsLoading(false); setApptsLoading(false); setAttLoading(false)
      setPatientsError('Your account isn’t linked to a staff record yet.')
      return
    }
    const email = encodeURIComponent(user.email)

    fetch(`/api/patients/therapist-list?email=${email}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`); if (!cancelled) setPatients(b.patients || []) })
      .catch((e) => { if (!cancelled) setPatientsError(e.message || 'Could not load patients.') })
      .finally(() => { if (!cancelled) setPatientsLoading(false) })

    fetch(`/api/appointments/therapist-list?email=${email}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`); if (!cancelled) setAppointments(b.appointments || []) })
      .catch((e) => { if (!cancelled) setApptsError(e.message || 'Could not load appointments.') })
      .finally(() => { if (!cancelled) setApptsLoading(false) })

    fetch(`/api/attendance/me?email=${email}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`); if (!cancelled) setAttendance(b) })
      .catch((e) => { if (!cancelled) setAttError(e.message || 'Could not load attendance.') })
      .finally(() => { if (!cancelled) setAttLoading(false) })

    return () => { cancelled = true }
  }, [user?.email])

  const today = isoToday()
  const weekStart = startOfWeekIso(today)
  const weekEnd = addDaysIso(weekStart, 6)
  const lastWeekStart = addDaysIso(weekStart, -7)
  const lastWeekEnd = addDaysIso(weekStart, -1)

  const activeAppts = useMemo(() => appointments.filter(a => !a.isArchived), [appointments])
  const todaysAppts = useMemo(
    () => activeAppts.filter(a => a.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [activeAppts, today],
  )
  const bookedAppts = useMemo(() => activeAppts.filter(a => a.status !== 'Cancelled'), [activeAppts])

  const confirmedToday = todaysAppts.filter(a => a.status === 'Confirmed').length
  const pendingToday = todaysAppts.filter(a => a.status === 'Pending').length
  const activePatientsToday = new Set(todaysAppts.map(a => a.patientName)).size

  const addedTodayCount = useMemo(
    () => appointments.filter(a => a.createdAt && new Date(a.createdAt).toISOString().slice(0, 10) === today).length,
    [appointments, today],
  )

  const sevenDaysAgo = addDaysIso(today, -7)
  const newPatientsThisWeek = useMemo(
    () => patients.filter(p => p.joinedDate && p.joinedDate >= sevenDaysAgo).length,
    [patients, sevenDaysAgo],
  )

  const weekSessions = useMemo(() => bookedAppts.filter(a => a.date >= weekStart && a.date <= weekEnd).length, [bookedAppts, weekStart, weekEnd])
  const lastWeekSessions = useMemo(() => bookedAppts.filter(a => a.date >= lastWeekStart && a.date <= lastWeekEnd).length, [bookedAppts, lastWeekStart, lastWeekEnd])
  const weekDelta = weekSessions - lastWeekSessions

  const daysThisMonth = attendance?.summary?.daysThisMonth ?? 0
  const hoursThisMonth = attendance?.summary?.hoursThisMonth ?? 0
  const daysLastMonth = useMemo(() => {
    if (!attendance?.records) return 0
    const prefix = prevMonthPrefix(today)
    return attendance.records.filter(r => r.date.startsWith(prefix)).length
  }, [attendance, today])
  const attendanceDelta = daysThisMonth - daysLastMonth

  const KPI_DATA = [
    {
      label: 'Patients Assigned',
      value: String(patients.length),
      meta: `${activePatientsToday} active today`,
      trend: newPatientsThisWeek > 0 ? `+${newPatientsThisWeek} this week` : null,
      trendUp: true,
      color: 'teal',
      Icon: PatientIcon,
      path: '/therapist/patients',
      loading: patientsLoading,
      error: patientsError,
    },
    {
      label: 'Appointments Today',
      value: String(todaysAppts.length),
      meta: `${confirmedToday} confirmed · ${pendingToday} pending`,
      trend: addedTodayCount > 0 ? `+${addedTodayCount} added today` : null,
      trendUp: true,
      color: 'blue',
      Icon: CalendarIcon,
      path: '/therapist/appointments',
      loading: apptsLoading,
      error: apptsError,
    },
    {
      label: "This Week's Sessions",
      value: String(weekSessions),
      meta: `${MONTH_NAMES[new Date(weekStart + 'T00:00').getMonth()]} ${weekStart.slice(8)}–${weekEnd.slice(8)}`,
      trend: weekDelta !== 0 ? `${weekDelta > 0 ? '+' : ''}${weekDelta} vs last week` : null,
      trendUp: weekDelta >= 0,
      color: 'purple',
      Icon: NoteIcon,
      path: '/therapist/appointments',
      loading: apptsLoading,
      error: apptsError,
    },
    {
      label: 'Attendance This Month',
      value: String(daysThisMonth),
      meta: `${hoursThisMonth} hrs logged`,
      trend: attendanceDelta !== 0 ? `${attendanceDelta > 0 ? '+' : ''}${attendanceDelta} vs last month` : null,
      trendUp: attendanceDelta >= 0,
      color: 'amber',
      Icon: ClockIcon,
      path: '/therapist/attendance',
      loading: attLoading,
      error: attError,
    },
  ]

  // Patient mix by condition — the only real per-patient category the
  // schema tracks (clinical risk status isn't captured anywhere yet).
  const conditionDistribution = useMemo(() => {
    const counts = new Map()
    patients.forEach(p => {
      const key = (p.condition || '').trim() || 'Unspecified'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, [, c]) => s + c, 0)
    const list = top.map(([label, count], i) => ({ label, count, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
    if (rest > 0) list.push({ label: 'Other', count: rest, color: DONUT_COLORS[5] })
    return list
  }, [patients])

  // Sessions grouped by the actual session type recorded on each appointment.
  const typeDistribution = useMemo(() => {
    const counts = new Map()
    bookedAppts.forEach(a => {
      const key = (a.type || '').trim() || 'Other'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    const max = Math.max(1, ...sorted.map(([, c]) => c))
    return sorted.map(([type, count], i) => ({ type, count, color: DONUT_COLORS[i % DONUT_COLORS.length], pct: Math.round((count / max) * 100) }))
  }, [bookedAppts])

  // Real, derived "what needs attention" items — no invented task copy.
  const focusItems = useMemo(() => {
    const items = []
    const pendingCount = activeAppts.filter(a => a.status === 'Pending').length
    if (pendingCount > 0) {
      items.push({ text: `${pendingCount} appointment request${pendingCount !== 1 ? 's' : ''} need${pendingCount === 1 ? 's' : ''} your response`, priority: 'high' })
    }
    const noUpcoming = patients.filter(p => !p.nextSessionDate).length
    if (noUpcoming > 0) {
      items.push({ text: `${noUpcoming} patient${noUpcoming !== 1 ? 's have' : ' has'} no upcoming session scheduled`, priority: 'medium' })
    }
    if (todaysAppts.length > 0) {
      items.push({ text: `You have ${todaysAppts.length} session${todaysAppts.length !== 1 ? 's' : ''} today`, priority: 'low' })
    }
    return items
  }, [activeAppts, patients, todaysAppts])

  // Recent activity — this therapist's own real actions, logged locally as
  // they happen (see logActivity() calls on the Appointments page).
  const recentActivity = useMemo(() => {
    if (!user?.email) return []
    const mine = getAuditLogs().filter(l => (l.email || '').toLowerCase() === user.email.toLowerCase())
    return mine.slice(0, 5)
  }, [user?.email])

  const statusKey = (s) => String(s || '').toLowerCase()

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
        {KPI_DATA.map(({ label, value, meta, trend, trendUp, color, Icon, path, loading, error }) => (
          <div
            key={label}
            className={`th-kpi-card ${color} th-kpi-clickable`}
            onClick={() => navigate(path)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(path)}
          >
            <div className="th-kpi-top">
              <div className="th-kpi-icon"><Icon /></div>
              {trend && (
                <span className={`th-kpi-trend ${trendUp ? 'up' : 'down'}`}>
                  {trendUp ? <TrendUpIcon /> : <TrendDownIcon />}
                  {trend}
                </span>
              )}
            </div>
            <div className="th-kpi-value">{loading ? '—' : value}</div>
            <div className="th-kpi-label">{label}</div>
            <div className="th-kpi-meta">{error ? 'Unavailable' : loading ? 'Loading…' : meta}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="th-charts-row">
        {/* Left column: Calendar + Bar Chart */}
        <div className="th-left-col">
          {apptsError ? (
            <div className="th-panel th-cal-panel"><p className="th-panel-note error">Couldn't load your calendar: {apptsError}</p></div>
          ) : (
            <CalendarPanel appointments={appointments} />
          )}

          <div className="th-panel th-bar-panel">
            <div className="th-panel-head">
              <div>
                <h3>Sessions by Type</h3>
                <p>Booked appointments grouped by session type</p>
              </div>
            </div>
            {apptsError ? (
              <p className="th-panel-note error">Couldn't load sessions.</p>
            ) : typeDistribution.length === 0 ? (
              <p className="th-panel-note">{apptsLoading ? 'Loading…' : 'No booked sessions yet.'}</p>
            ) : (
              <div className="th-bar-chart">
                <div className="th-bar-grid">
                  {[...Array(4)].map((_, i) => <div key={i} className="th-bar-gridline" />)}
                </div>
                <div className="th-bar-bars">
                  {typeDistribution.map(({ type, count, color, pct }) => (
                    <div key={type} className="th-bar-group">
                      <span className="th-bar-count">{count}</span>
                      <div className="th-bar-wrap">
                        <div className="th-bar-fill" style={{ height: `${pct}%`, background: color }} />
                      </div>
                      <span className="th-bar-label">{type}</span>
                    </div>
                  ))}
                </div>
                <div className="th-bar-baseline" />
              </div>
            )}
          </div>
        </div>

        {/* Right column: Patient Status + Today's Appointments */}
        <div className="th-right-col">
          <div className="th-panel">
            <div className="th-panel-head">
              <div>
                <h3>Patient Mix</h3>
                <p>By condition on file</p>
              </div>
            </div>
            {patientsError ? (
              <p className="th-panel-note error">Couldn't load patients: {patientsError}</p>
            ) : patientsLoading ? (
              <p className="th-panel-note">Loading…</p>
            ) : (
              <DonutChart data={conditionDistribution} total={patients.length} />
            )}
          </div>

          <div className="th-panel">
            <div className="th-panel-head">
              <div>
                <h3>Today's Appointments</h3>
                <p>{apptsLoading ? 'Loading…' : `${todaysAppts.length} session${todaysAppts.length !== 1 ? 's' : ''} scheduled`}</p>
              </div>
            </div>
            {apptsError ? (
              <p className="th-panel-note error">Couldn't load appointments: {apptsError}</p>
            ) : todaysAppts.length === 0 ? (
              <p className="th-panel-note">{apptsLoading ? 'Loading…' : 'No appointments today.'}</p>
            ) : (
              <div className="th-appt-list">
                {todaysAppts.map((a) => {
                  const c = avatarColorFor(a.id)
                  return (
                    <div key={a.id} className="th-appt-row">
                      <span className="th-appt-time">{fmt12(a.time)}</span>
                      <div className="th-appt-avatar" style={{ background: c.bg, color: c.fg }}>{initials(a.patientName)}</div>
                      <div className="th-appt-info">
                        <div className="th-appt-name">{a.patientName}</div>
                        <div className="th-appt-type">{a.type} session</div>
                      </div>
                      <span className={`th-appt-badge ${statusKey(a.status)}`}>{a.status}</span>
                    </div>
                  )
                })}
              </div>
            )}
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
              <p>What actually needs your attention</p>
            </div>
          </div>
          {apptsError || patientsError ? (
            <p className="th-panel-note error">Some data couldn't load, so this list may be incomplete.</p>
          ) : (apptsLoading || patientsLoading) ? (
            <p className="th-panel-note">Loading…</p>
          ) : focusItems.length === 0 ? (
            <p className="th-panel-note">You're all caught up — nothing needs attention right now.</p>
          ) : (
            <div className="th-task-list">
              {focusItems.map((t, i) => (
                <div key={i} className="th-task-row">
                  <span className={`th-task-dot ${t.priority}`} />
                  <span className="th-task-text">{t.text}</span>
                  <span className={`th-task-pri ${t.priority}`}>
                    {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="th-panel">
          <div className="th-panel-head">
            <div>
              <h3>Recent Activity</h3>
              <p>Your latest actions in TherapyPro</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <p className="th-panel-note">No recent activity yet.</p>
          ) : (
            <div className="th-activity-list">
              {recentActivity.map((a) => (
                <div key={a.id} className="th-activity-row">
                  <div className="th-activity-icon">{a.actionIcon || '📋'}</div>
                  <div className="th-activity-info">
                    <div className="th-activity-text">{a.description}</div>
                    <div className="th-activity-time">{a.date} · {a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TherapistPageShell>
  )
}
