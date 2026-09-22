import { useEffect, useMemo, useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { apiGet, apiPost } from '../../utils/api'
import { manilaDateKey, formatManilaTime, formatManilaDate, manilaMinutesOfDay } from '../../utils/manilaTime'
import AvailabilityModal, { AVAILABILITY_SLOTS } from '../../components/AvailabilityModal'
import LeaveRequestModal from '../../components/LeaveRequestModal'
import '../admin/AdminPages.css'
import './TherapistAttendancePage.css'

// No shift schedule exists in the data model yet, so "late" has no official
// definition — 9:00 AM is a simple, visible stand-in cutoff used only for the
// punctuality stat/pill/dot, not a configured business rule.
const LATE_CUTOFF_MINUTES = 9 * 60
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return formatManilaDate(dateStr, { weekday: 'short' })
}

function formatTime(iso) {
  if (!iso) return '—'
  return formatManilaTime(iso)
}

function hoursBetween(inIso, outIso) {
  if (!inIso || !outIso) return null
  return Math.round(((new Date(outIso) - new Date(inIso)) / 3600000) * 10) / 10
}

function formatDuration(ms) {
  if (ms == null || ms < 0) return '—'
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

function isLate(timeInIso) {
  if (!timeInIso) return false
  return manilaMinutesOfDay(timeInIso) > LATE_CUTOFF_MINUTES
}

// Status for a single row in the Daily Log table — on-time/late/active, kept
// separate from the calendar's own dot status below.
function dayStatus(record) {
  if (!record || !record.timeIn) return null
  if (!record.timeOut) return 'active'
  return isLate(record.timeIn) ? 'late' : 'ontime'
}

export default function TherapistAttendancePage({ user, onLogout, betaTier }) {
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [error, setError] = useState('')
  const [employee, setEmployee] = useState(null)
  const [records, setRecords] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(null)

  // Which date the "Set/Edit availability" modal is open for, or null if closed.
  const [availabilityModalDate, setAvailabilityModalDate] = useState(null)
  // Whether we've already asked (at most once per page load) if they haven't
  // answered for today yet, right after clocking in.
  const [availabilityChecked, setAvailabilityChecked] = useState(false)

  // Which date the "Availability" panel is currently showing — null means today.
  const [availabilityViewDate, setAvailabilityViewDate] = useState(null)
  const [viewedAvailability, setViewedAvailability] = useState(null) // { status, slots } | null
  const [viewedAvailabilityLoading, setViewedAvailabilityLoading] = useState(true)

  // date -> { status, slots }, for the visible month — feeds the calendar's
  // "Planned" dots.
  const [monthAvailability, setMonthAvailability] = useState(new Map())

  const [leaveRequests, setLeaveRequests] = useState([])
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveNote, setLeaveNote] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setNotLinked(true)
      return
    }
    apiGet(`/api/attendance/me?email=${encodeURIComponent(user.email)}`)
      .then((data) => {
        if (cancelled) return
        setEmployee(data.employee || null)
        setRecords(data.records || [])
      })
      .catch((err) => {
        if (cancelled) return
        if (/no staff record/i.test(err.message || '')) setNotLinked(true)
        else setError(err.message || 'Could not load your attendance.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    apiGet(`/api/attendance/leave-requests?email=${encodeURIComponent(user.email)}`)
      .then((data) => { if (!cancelled) setLeaveRequests(data.requests || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  const recordsByDate = useMemo(() => {
    const map = new Map()
    for (const r of records) map.set(r.date, r)
    return map
  }, [records])

  const todayKey = manilaDateKey(now)
  const todayRecord = recordsByDate.get(todayKey) || null
  const clockedIn = !!(todayRecord?.timeIn && !todayRecord?.timeOut)
  const todayDurationMs = todayRecord?.timeIn
    ? (todayRecord.timeOut ? new Date(todayRecord.timeOut) - new Date(todayRecord.timeIn) : now - new Date(todayRecord.timeIn))
    : null

  // Once they've clocked in today, ask (at most once per day) which same-day
  // slots they're open for — `slots: null` from the backend means they
  // haven't answered yet today, as opposed to `[]` for an explicit skip.
  useEffect(() => {
    if (!user?.email || !todayRecord?.timeIn || availabilityChecked) return
    let cancelled = false
    apiGet(`/api/attendance/availability?email=${encodeURIComponent(user.email)}&date=${todayKey}`)
      .then((data) => {
        if (cancelled) return
        setAvailabilityChecked(true)
        if (data.slots === null) {
          setAvailabilityViewDate(null)
          setAvailabilityModalDate(todayKey)
        }
      })
      .catch(() => { if (!cancelled) setAvailabilityChecked(true) })
    return () => { cancelled = true }
  }, [user?.email, todayRecord?.timeIn, todayKey, availabilityChecked])

  // Whichever date the Availability panel is showing right now.
  const viewDate = availabilityViewDate || todayKey

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    setViewedAvailabilityLoading(true)
    apiGet(`/api/attendance/availability?email=${encodeURIComponent(user.email)}&date=${viewDate}`)
      .then((data) => { if (!cancelled) setViewedAvailability({ status: data.status, slots: data.slots }) })
      .catch(() => { if (!cancelled) setViewedAvailability({ status: null, slots: null }) })
      .finally(() => { if (!cancelled) setViewedAvailabilityLoading(false) })
    return () => { cancelled = true }
  }, [user?.email, viewDate])

  const monthPrefix = `${viewedMonth.year}-${pad2(viewedMonth.month + 1)}`

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    apiGet(`/api/attendance/availability-month?email=${encodeURIComponent(user.email)}&month=${monthPrefix}`)
      .then((data) => {
        if (cancelled) return
        const map = new Map()
        for (const r of data.records || []) map.set(r.date, { status: r.status, slots: r.slots })
        setMonthAvailability(map)
      })
      .catch(() => { if (!cancelled) setMonthAvailability(new Map()) })
    return () => { cancelled = true }
  }, [user?.email, monthPrefix])

  const answerAvailability = ({ status, slots }) => {
    const date = availabilityModalDate || viewDate
    setAvailabilityModalDate(null)
    setViewedAvailability({ status, slots })
    setMonthAvailability((prev) => {
      const next = new Map(prev)
      next.set(date, { status, slots })
      return next
    })
    apiPost('/api/attendance/availability', { email: user.email, date, status, slots }).catch(() => {})
  }

  const submitLeaveRequest = async ({ leaveType, startDate, endDate, reason }) => {
    const created = await apiPost('/api/attendance/leave-requests', {
      email: user.email,
      leaveType,
      startDate,
      endDate,
      reason,
    })
    setLeaveRequests((prev) => [created, ...prev])
    setShowLeaveModal(false)
    setLeaveNote(`Leave request submitted — awaiting the owner's approval.`)
    setTimeout(() => setLeaveNote(''), 6000)
  }

  const monthLabel = new Date(viewedMonth.year, viewedMonth.month, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const monthRecords = useMemo(
    () => records.filter((r) => r.date.startsWith(monthPrefix)),
    [records, monthPrefix]
  )

  const monthStats = useMemo(() => {
    const present = monthRecords.filter((r) => r.timeIn).length
    const late = monthRecords.filter((r) => r.timeIn && isLate(r.timeIn)).length
    let hours = 0
    for (const r of monthRecords) {
      if (r.timeIn && r.timeOut) hours += (new Date(r.timeOut) - new Date(r.timeIn)) / 3600000
    }
    const rate = present > 0 ? Math.round(((present - late) / present) * 100) : 0
    return { present, late, rate, hours: Math.round(hours * 10) / 10 }
  }, [monthRecords])

  // Every day a currently-approved leave request covers, as 'YYYY-MM-DD' keys.
  const approvedLeaveDates = useMemo(() => {
    const set = new Set()
    for (const r of leaveRequests) {
      if (r.status !== 'approved') continue
      let d = new Date(`${r.startDate}T00:00:00Z`)
      const end = new Date(`${r.endDate}T00:00:00Z`)
      while (d <= end) {
        set.add(d.toISOString().slice(0, 10))
        d = new Date(d.getTime() + 86400000)
      }
    }
    return set
  }, [leaveRequests])

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewedMonth.year, viewedMonth.month, 1).getDay()
    const totalDays = new Date(viewedMonth.year, viewedMonth.month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let day = 1; day <= totalDays; day++) {
      const key = `${monthPrefix}-${pad2(day)}`
      const record = recordsByDate.get(key)
      let dotStatus = null
      if (record?.timeIn) dotStatus = 'checkedin'
      else if (approvedLeaveDates.has(key)) dotStatus = 'leave'
      else {
        const avail = monthAvailability.get(key)
        if (avail?.status === 'confirmed' && (avail.slots?.length || 0) > 0) dotStatus = 'planned'
      }
      cells.push({ day, key, dotStatus })
    }
    return cells
  }, [viewedMonth, monthPrefix, recordsByDate, monthAvailability, approvedLeaveDates])

  const selectedRecord = selectedDate ? recordsByDate.get(selectedDate) : null

  const dailyLog = useMemo(
    () => [...monthRecords].sort((a, b) => b.date.localeCompare(a.date)),
    [monthRecords]
  )

  function goToMonth(delta) {
    setSelectedDate(null)
    setViewedMonth(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function handleDayClick(key) {
    if (key === selectedDate) {
      setSelectedDate(null)
      setAvailabilityViewDate(null)
    } else {
      setSelectedDate(key)
      setAvailabilityViewDate(key === todayKey ? null : key)
    }
  }

  function backToToday() {
    setSelectedDate(null)
    setAvailabilityViewDate(null)
  }

  const plannedSlots = useMemo(
    () => (viewedAvailability?.slots || []).filter((s) => s.status === 'available' || s.status === 'booked'),
    [viewedAvailability]
  )
  const bookedStarts = useMemo(
    () => plannedSlots.filter((s) => s.status === 'booked').map((s) => s.start),
    [plannedSlots]
  )

  const isViewingToday = viewDate === todayKey
  const calendarSubtitle = selectedRecord
    ? `${formatDate(selectedRecord.date)} — In ${formatTime(selectedRecord.timeIn)} · Out ${formatTime(selectedRecord.timeOut)}`
    : selectedDate
      ? `${formatDate(selectedDate)} — no check-in recorded`
      : `${formatDate(todayKey)} — ${todayRecord?.timeIn ? 'checked in' : 'no check-in recorded'}`

  return (
    <>
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="My Attendance"
      subtitle="Your check-in/check-out history from the branch's ID scanner."
      icon="🕒"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your attendance…</p>
      ) : notLinked ? (
        <div className="admin-table-card">
          <div className="ta-empty-state">
            <h3>No attendance yet</h3>
            <p>
              Your account isn't linked to a staff record yet, so there's nothing to show here. Once
              your branch owner scans your ID badge for the first time, your check-ins will appear on
              this page.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="admin-table-card">
          <div className="ta-empty-state">
            <h3>Couldn't load your attendance</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className={`ta-clock-banner ${clockedIn ? 'ta-clock-banner-active' : ''}`}>
            <div className="ta-clock-banner-left">
              <p className="ta-clock-banner-status">
                <span className="ta-clock-banner-dot" />
                {clockedIn ? 'Currently clocked in' : 'Not clocked in today'}
              </p>
              <h3 className="ta-clock-banner-duration">
                {todayDurationMs != null ? `${formatDuration(todayDurationMs)} today` : 'No activity yet'}
              </h3>
              <p className="ta-clock-banner-meta">
                {todayRecord?.timeIn
                  ? `Since ${formatTime(todayRecord.timeIn)}${employee?.branch ? ` · ${employee.branch}` : ''}`
                  : "You haven't checked in yet today."}
              </p>
            </div>
            <div className="ta-clock-banner-times">
              <div className="ta-clock-banner-time">
                <span className="ta-clock-banner-time-label">Time In</span>
                <span className="ta-clock-banner-time-value">{formatTime(todayRecord?.timeIn)}</span>
              </div>
              <div className="ta-clock-banner-time">
                <span className="ta-clock-banner-time-label">Time Out</span>
                <span className="ta-clock-banner-time-value">{formatTime(todayRecord?.timeOut)}</span>
              </div>
            </div>
          </div>

          <div className="admin-panel ta-availability-panel">
            <div className="admin-panel-header">
              <div>
                <h3>{isViewingToday ? "Today's availability" : `Availability · ${formatDate(viewDate)}`}</h3>
                {!isViewingToday && (
                  <button type="button" className="ta-back-today" onClick={backToToday}>← Back to today</button>
                )}
              </div>
              <div className="ta-availability-actions">
                <button type="button" className="ta-btn-leave" onClick={() => setShowLeaveModal(true)}>
                  🏖 Request leave
                </button>
                <button type="button" className="admin-btn-secondary" onClick={() => setAvailabilityModalDate(viewDate)}>
                  {plannedSlots.length > 0 ? 'Edit availability' : 'Set availability'}
                </button>
              </div>
            </div>

            {leaveNote && <p className="ta-leave-note">✓ {leaveNote}</p>}

            {viewedAvailabilityLoading ? (
              <p className="ta-avail-empty-note">Loading…</p>
            ) : plannedSlots.length > 0 ? (
              <div className="ta-avail-pills">
                {plannedSlots.map((s) => {
                  const def = AVAILABILITY_SLOTS.find((a) => a.start === s.start)
                  const booked = s.status === 'booked'
                  return (
                    <span key={s.start} className={`ta-avail-pill ${booked ? 'ta-avail-pill-booked' : ''}`}>
                      {def?.label || `${s.start} – ${s.end}`}{booked ? ' · Booked' : ''}
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="ta-avail-empty-note">
                {isViewingToday
                  ? "You're not marked available for same-day bookings today."
                  : "You haven't planned this day yet."}
              </p>
            )}
          </div>

          <div className="admin-stats-grid">
            <section className="admin-stat-card ta-stat-card">
              <span className="ta-stat-icon ta-stat-icon-green">📈</span>
              <p className="admin-stat-label">Rate</p>
              <h3 className="admin-stat-value">{monthStats.rate}%</h3>
              <p className="admin-stat-meta">On-time this month</p>
            </section>
            <section className="admin-stat-card ta-stat-card">
              <span className="ta-stat-icon ta-stat-icon-blue">📅</span>
              <p className="admin-stat-label">Present</p>
              <h3 className="admin-stat-value">{monthStats.present}</h3>
              <p className="admin-stat-meta">Days logged</p>
            </section>
            <section className="admin-stat-card ta-stat-card">
              <span className="ta-stat-icon ta-stat-icon-orange">⏰</span>
              <p className="admin-stat-label">Late</p>
              <h3 className="admin-stat-value">{monthStats.late}</h3>
              <p className="admin-stat-meta">After 9:00 AM</p>
            </section>
            <section className="admin-stat-card ta-stat-card">
              <span className="ta-stat-icon ta-stat-icon-teal">⌛</span>
              <p className="admin-stat-label">Hours</p>
              <h3 className="admin-stat-value">{monthStats.hours}</h3>
              <p className="admin-stat-meta">Logged this month</p>
            </section>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>Attendance calendar</h3>
                <p>{calendarSubtitle}</p>
              </div>
              <div className="admin-panel-tags">
                <button type="button" className="admin-btn-secondary ta-cal-nav" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
                <span className="ta-cal-month-label">{monthLabel}</span>
                <button type="button" className="admin-btn-secondary ta-cal-nav" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
              </div>
            </div>

            <div className="ta-calendar-compact">
              <div className="ta-calendar-weekdays">
                {WEEKDAY_LABELS.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="ta-calendar-grid">
                {calendarCells.map((cell, i) =>
                  cell === null ? (
                    <span key={`blank-${i}`} className="ta-calendar-day ta-calendar-day-empty" />
                  ) : (
                    <button
                      type="button"
                      key={cell.key}
                      className={`ta-calendar-day ${cell.key === todayKey ? 'ta-calendar-day-today' : ''} ${cell.key === selectedDate ? 'ta-calendar-day-selected' : ''}`}
                      onClick={() => handleDayClick(cell.key)}
                    >
                      {cell.day}
                      <span className={`ta-calendar-dot ${cell.dotStatus ? `ta-calendar-dot-${cell.dotStatus}` : 'ta-calendar-dot-none'}`} />
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="ta-calendar-footer">
              <div className="ta-calendar-legend">
                <span><i className="ta-calendar-dot ta-calendar-dot-checkedin" /> Checked in</span>
                <span><i className="ta-calendar-dot ta-calendar-dot-planned" /> Planned</span>
                <span><i className="ta-calendar-dot ta-calendar-dot-leave" /> On leave</span>
              </div>
              <p className="ta-calendar-total">{monthLabel} total: {monthStats.present} day{monthStats.present === 1 ? '' : 's'} logged</p>
            </div>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyLog.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: '#6b7c75' }}>No check-ins recorded for {monthLabel}.</td></tr>
                  ) : dailyLog.map((r) => {
                    const hrs = hoursBetween(r.timeIn, r.timeOut)
                    const status = dayStatus(r)
                    return (
                      <tr key={r.date}>
                        <td data-label="Date">{formatDate(r.date)}</td>
                        <td data-label="Time In">{formatTime(r.timeIn)}</td>
                        <td data-label="Time Out">{r.timeOut ? formatTime(r.timeOut) : 'In progress'}</td>
                        <td data-label="Hours">{hrs != null ? `${hrs}h` : '—'}</td>
                        <td data-label="Status">
                          <span className={`ta-status-pill ta-status-${status}`}>
                            {status === 'active' ? 'Active now' : status === 'late' ? 'Late' : 'On time'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </TherapistPageShell>
    {availabilityModalDate && (
      <AvailabilityModal
        firstName={(employee?.name || '').split(' ')[0] || 'there'}
        dateLabel={availabilityModalDate === todayKey ? formatManilaDate(now).toUpperCase() : formatDate(availabilityModalDate)}
        now={now}
        isToday={availabilityModalDate === todayKey}
        initialSlots={
          availabilityModalDate === viewDate && viewedAvailability?.slots
            ? viewedAvailability.slots.filter((s) => s.status === 'available' || s.status === 'booked').map((s) => s.start)
            : undefined
        }
        bookedStarts={availabilityModalDate === viewDate ? bookedStarts : undefined}
        onSkip={() => answerAvailability({ status: 'skipped', slots: [] })}
        onConfirm={(slots) => answerAvailability({ status: 'confirmed', slots })}
      />
    )}
    {showLeaveModal && (
      <LeaveRequestModal
        minDate={todayKey}
        defaultFrom={viewDate > todayKey ? viewDate : todayKey}
        onClose={() => setShowLeaveModal(false)}
        onSubmit={submitLeaveRequest}
      />
    )}
    </>
  )
}
