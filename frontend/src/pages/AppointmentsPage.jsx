import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import './AppointmentsPage.css'

/* ── Icons ── */
function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

/* ── Helpers ── */
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

/* Mock availability data — keyed "YYYY-M-D" */
function buildAvailability(year, month) {
  const total = daysInMonth(year, month)
  const map = {}
  for (let d = 1; d <= total; d++) {
    const r = Math.random()
    if (r < 0.35) map[`${year}-${month}-${d}`] = 'booked'
    else if (r < 0.55) map[`${year}-${month}-${d}`] = 'closed'
    else map[`${year}-${month}-${d}`] = 'available'
  }
  return map
}

export default function AppointmentsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const today = new Date()
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [currentUser] = useState(user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' })
  const [viewMonth, setViewMonth]       = useState(today.getMonth())
  const [viewYear, setViewYear]         = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(today.getDate())
  const [availability]                  = useState(() => buildAvailability(today.getFullYear(), today.getMonth()))
  const [showConfirm, setShowConfirm]   = useState(false)

  /* ── Calendar navigation ── */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const totalDays  = daysInMonth(viewYear, viewMonth)
  const startDay   = firstDayOfMonth(viewYear, viewMonth)
  const cells      = Array.from({ length: startDay + totalDays }, (_, i) =>
    i < startDay ? null : i - startDay + 1
  )

  const dotStatus = (day) => availability[`${viewYear}-${viewMonth}-${day}`] || 'available'
  const isToday   = (day) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
  const isSelected = (day) => day === selectedDate

  const selectedLabel = selectedDate
    ? `${MONTHS[viewMonth]} ${selectedDate}, ${viewYear}`
    : 'No date selected'

  const handleSchedule = () => {
    const status = dotStatus(selectedDate)
    if (status === 'closed') return
    navigate('/appointments/book', {
      state: { selectedDate, month: viewMonth, year: viewYear }
    })
  }

  return (
    <div className="appt-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <div className="appt-main">
        {/* ── Top Bar ── */}
        <div className="appt-topbar">
          <button className="appt-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <MenuIcon />
          </button>
          <h1 className="appt-topbar-title">Appointment</h1>
          <button className="appt-bell-btn" aria-label="Notifications">
            <BellIcon />
            <span className="bell-dot" />
          </button>
        </div>

        <div className="appt-scroll">
          {/* ── Hero Image ── */}
          <div className="appt-hero">
            <img src="/therapy-hero.png" alt="Therapy session illustration" className="hero-img" />
          </div>

          <div className="appt-card">
            {/* ── Session Overview Legend ── */}
            <div className="session-overview">
              <span className="overview-title">Session Overview</span>
              <div className="legend-items">
                <span className="legend-item"><span className="dot dot-available" />Available</span>
                <span className="legend-item"><span className="dot dot-booked"    />Booked</span>
                <span className="legend-item"><span className="dot dot-closed"    />Closed</span>
              </div>
            </div>

            {/* ── Calendar ── */}
            <div className="calendar-wrap">
              {/* Month Nav */}
              <div className="cal-nav">
                <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft /></button>
                <span className="cal-month-label">{MONTHS[viewMonth]} {viewYear}</span>
                <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight /></button>
              </div>

              {/* Day Headers */}
              <div className="cal-grid">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="cal-day-header">{d}</div>
                ))}

                {/* Day Cells */}
                {cells.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />
                  const status = dotStatus(day)
                  return (
                    <button
                      key={day}
                      className={`cal-day
                        ${isToday(day) ? 'cal-today' : ''}
                        ${isSelected(day) ? 'cal-selected' : ''}
                        ${status === 'closed' ? 'cal-closed' : ''}
                      `}
                      onClick={() => setSelectedDate(day)}
                      disabled={status === 'closed'}
                    >
                      <span className="cal-day-num">{day}</span>
                      <span className={`dot dot-${status} dot-sm`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Schedule Bar ── */}
            <div className="schedule-bar">
              <div className="selected-date-info">
                <CalendarIcon />
                <div>
                  <span className="sdi-label">Selected Date</span>
                  <span className="sdi-value">{selectedLabel}</span>
                </div>
              </div>
              <button
                className="schedule-btn"
                onClick={handleSchedule}
                disabled={!selectedDate || dotStatus(selectedDate) === 'closed'}
              >
                Schedule Appointment
              </button>
            </div>

            {/* ── Confirm Toast ── */}
            {showConfirm && (
              <div className="appt-confirm-toast">
                ✓ Appointment request sent for {selectedLabel}!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
