import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Calendar from 'react-calendar'
import PatientSidebar from '../components/PatientSidebar'
import 'react-calendar/dist/Calendar.css'
import './Dashboard.css'

// SVG Icons
function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function HandHeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 8c0-2.21-1.79-4-4-4S3 5.79 3 8s1.79 4 4 4 4-1.79 4-4z" />
      <path d="M18.5 6c-1.38 0-2.5 1.12-2.5 2.5 0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S19.88 6 18.5 6z" />
      <path d="M12 14v7" />
      <path d="M16 17l-4 4-4-4" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function DumbbellIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 6.5l11 11" />
      <path d="M6.5 17.5l11-11" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a4 4 0 0 1 4 4c0 .73-.19 1.41-.54 2" />
      <path d="M12 2a4 4 0 0 0-4 4c0 .73.19 1.41.54 2" />
      <path d="M8 12a4 4 0 0 1-4-4" />
      <path d="M16 12a4 4 0 0 0 4-4" />
      <path d="M12 22c-2.21 0-4-1.79-4-4v-4" />
      <path d="M12 22c2.21 0 4-1.79 4-4v-4" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a6b5d" strokeWidth="2">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function PencilNoteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a6b5d" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function DirectionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  )
}

function WaveIcon() {
  return (
    <svg className="welcome-wave" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M10 10V5a1.5 1.5 0 0 1 3 0v5" />
      <path d="M13 10V6a1.5 1.5 0 0 1 3 0v5" />
      <path d="M16 8.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-1a7 7 0 0 1-6.3-3.9L4 13.4a1.5 1.5 0 0 1 2.6-1.5L7.7 14" />
    </svg>
  )
}

// Small progress donut used for the hero stat pills
function MiniRing({ value, color }) {
  const r = 16
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <svg className="mini-ring" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#dcebe4" strokeWidth="5" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" transform="rotate(-90 22 22)"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  )
}

const CLINIC = {
  name: 'TherapyPro — Main Branch',
  address: 'BGC, Taguig City, Metro Manila',
  mapsQuery: 'TherapyPro Main Branch BGC Taguig',
}

export default function Dashboard({ onLogout, user, betaTier }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser] = useState(user || {
    name: 'Alvrin',
    role: 'Patient',
    avatar: '/therapy-pro-logo.png'
  })

  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false)

  // Calendar State
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [appointmentDates] = useState([
    new Date(2026, 5, 29), // June 29, 2026
    new Date(2026, 6, 5),  // July 5, 2026
    new Date(2026, 6, 12), // July 12, 2026
  ])

  // Progress / gamification stats shown in the hero
  const [weeklyProgress] = useState(75)
  const [gameStats] = useState({
    level: 9,
    xp: 340,
    xpTarget: 500,
    gamesThisWeek: 5,
    streakDays: 4,
  })

  // Therapy Modal State
  const [selectedTherapy, setSelectedTherapy] = useState(null)

  // Notification State
  const [notificationCount, setNotificationCount] = useState(2)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications] = useState([
    { id: 1, message: 'Speech Therapy session tomorrow at 10:00 AM', time: '1h ago', read: false },
    { id: 2, message: 'Great progress this week! Keep it up!', time: '3h ago', read: false }
  ])

  const [appointment] = useState({
    type: 'Speech Therapy',
    therapist: 'Stephen Tatel',
    date: 'June 29, 2026',
    time: '10:00 AM',
    inDays: 3,
  })

  const recentNotes = [
    { icon: <ChartIcon />, title: 'Great progress today!', description: 'Alvrin was able to complete all activities', time: '2h ago' },
    { icon: <PencilNoteIcon />, title: 'Homework assigned', description: "Practice 10 words from this week's list", time: '1d ago' },
  ]

  // Therapy categories data
  const therapyCategories = {
    occupational: {
      title: 'Occupational Therapy',
      description: 'Improve daily skills',
      exercises: [
        'Button fastening practice',
        'Handwriting exercises',
        'Fine motor skill games'
      ],
      milestones: ['Self-feeding mastered', 'Dressing independently']
    },
    speech: {
      title: 'Speech Therapy',
      description: 'Support speech & language',
      exercises: [
        'Articulation drills',
        'Reading aloud practice',
        'Pronunciation exercises'
      ],
      milestones: ['Clear consonant sounds', 'Full sentence communication']
    },
    physical: {
      title: 'Physical Therapy',
      description: 'Improve movement & strength',
      exercises: [
        'Leg stretches',
        'Balance exercises',
        'Core strengthening'
      ],
      milestones: ['Walking 50m unassisted', 'Climbing stairs independently']
    },
    cognitive: {
      title: 'Cognitive Therapy',
      description: 'Enhance thinking & learning',
      exercises: [
        'Memory card games',
        'Puzzle solving',
        'Pattern recognition'
      ],
      milestones: ['Remembering daily routines', 'Following multi-step instructions']
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const handleTherapyClick = (category) => {
    setSelectedTherapy(category)
  }

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications)
    if (!showNotifications) {
      setNotificationCount(0)
    }
  }

  const sendTestNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Therapy Pro Reminder', {
        body: 'You have a Speech Therapy session at 10:00 AM today!',
        icon: '/therapy-pro-logo.png',
        badge: '/therapy-pro-logo.png'
      })
    }
  }

  const tileClassName = ({ date }) => {
    const isAppointment = appointmentDates.some(
      appointmentDate =>
        appointmentDate.toDateString() === date.toDateString()
    )
    return isAppointment ? 'appointment-day' : null
  }

  const xpRemaining = gameStats.xpTarget - gameStats.xp
  const levelRingR = 42
  const levelRingC = 2 * Math.PI * levelRingR

  return (
    <div className="dashboard-layout">
      {/* Patient Sidebar */}
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      {/* Main Dashboard Content */}
      <div className="dashboard-main">
        {/* Mobile Menu Toggle */}
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        {/* Top Header Bar */}
        <header className="dashboard-top-header">
          <div className="header-left">
            <img src="/therapy-pro-logo.png" alt="Therapy Pro" className="header-logo-img" />
            <span className="header-brand">Therapy Pro</span>
          </div>

          <div className="header-right">
            <button
              className="header-notification-btn"
              aria-label="Notifications"
              onClick={handleNotificationClick}
            >
              <BellIcon />
              {notificationCount > 0 && (
                <span className="header-notification-badge">{notificationCount}</span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="header-notifications-dropdown">
                <div className="notifications-header">
                  <h3>Notifications</h3>
                  <button onClick={sendTestNotification} className="test-notification-btn">
                    Test
                  </button>
                </div>
                <div className="notifications-list">
                  {notifications.map(notif => (
                    <div key={notif.id} className="notification-item">
                      <p className="notification-message">{notif.message}</p>
                      <span className="notification-time">{notif.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="dashboard-content-area">
          {/* Welcome Hero */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <h1 className="welcome-title">
                Welcome back, {currentUser.name}
                <WaveIcon />
              </h1>
              <p className="welcome-subtitle">
                Track appointments, notes, and therapy progress all in one place.
              </p>

              <div className="hero-stats">
                <div className="hero-stat">
                  <MiniRing value={weeklyProgress} color="#4a6b5d" />
                  <div className="hero-stat-text">
                    <span className="hero-stat-label">Weekly goals</span>
                    <span className="hero-stat-value">{weeklyProgress}% met</span>
                  </div>
                </div>
                <div className="hero-stat">
                  <MiniRing value={(gameStats.gamesThisWeek / 7) * 100} color="#7c5cff" />
                  <div className="hero-stat-text">
                    <span className="hero-stat-label">Games this week</span>
                    <span className="hero-stat-value">{gameStats.gamesThisWeek} played</span>
                  </div>
                </div>
                <div className="hero-stat">
                  <MiniRing value={(gameStats.streakDays / 7) * 100} color="#f59e0b" />
                  <div className="hero-stat-text">
                    <span className="hero-stat-label">Current streak</span>
                    <span className="hero-stat-value">{gameStats.streakDays} days</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-level-card">
              <div className="hero-level-ring">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="48" r={levelRingR} fill="none" stroke="#e6efe9" strokeWidth="7" />
                  <circle
                    cx="48" cy="48" r={levelRingR} fill="none" stroke="#f59e0b" strokeWidth="7"
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    strokeDasharray={levelRingC}
                    strokeDashoffset={levelRingC * (1 - gameStats.xp / gameStats.xpTarget)}
                  />
                </svg>
                <div className="hero-level-ring-label">
                  <span className="hero-level-num">{gameStats.level}</span>
                  <span className="hero-level-word">Level</span>
                </div>
              </div>
              <p className="hero-level-xp">
                {gameStats.xp} / {gameStats.xpTarget} XP · {xpRemaining} to level {gameStats.level + 1}
              </p>
              <button
                className="hero-play-btn"
                onClick={() => navigate('/patient/gamified-activities')}
              >
                Play a game
              </button>
            </div>
          </div>

          {/* Upcoming Appointment */}
          <div className="appointment-card">
            <div className="appointment-header">
              <div className="appointment-icon">
                <CalendarIcon />
              </div>
              <h2 className="appointment-heading">Upcoming Appointment</h2>
              <span className="appointment-badge">In {appointment.inDays} days</span>
            </div>

            {showCalendar ? (
              <div className="calendar-widget">
                <Calendar
                  value={selectedDate}
                  onChange={setSelectedDate}
                  tileClassName={tileClassName}
                  minDate={new Date()}
                />
                <p className="calendar-hint">
                  <span className="appointment-dot"></span> Days with appointments
                </p>
              </div>
            ) : (
              <div className="appointment-body">
                <div className="appointment-title-row">
                  <span className="appt-type-icon"><CalendarIcon /></span>
                  <div>
                    <h3 className="appointment-type">{appointment.type}</h3>
                    <p className="appointment-therapist">with {appointment.therapist}</p>
                  </div>
                </div>

                <div className="appointment-details">
                  <div className="detail-item">
                    <CalendarIcon />
                    <span>{appointment.date}</span>
                  </div>
                  <div className="detail-item">
                    <ClockIcon />
                    <span>{appointment.time}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="appointment-actions">
              <button className="appt-action-btn" onClick={() => setShowAppointmentDetails(true)}>
                View Details
              </button>
              <button className="appt-action-btn" onClick={() => setShowCalendar(!showCalendar)}>
                {showCalendar ? 'Hide Calendar' : 'View Calendar'}
              </button>
            </div>
          </div>

          {/* Clinic + Recent Notes */}
          <div className="dashboard-two-col">
            <div className="clinic-card">
              <div className="clinic-header">
                <div className="clinic-icon">
                  <MapPinIcon />
                </div>
                <h2 className="clinic-heading">Our Clinic</h2>
              </div>
              <div className="clinic-body">
                <a
                  className="clinic-map-thumb"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CLINIC.mapsQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open clinic location in Google Maps"
                >
                  <div className="clinic-map-art">
                    <span className="clinic-map-pin"><MapPinIcon /></span>
                  </div>
                </a>
                <h3 className="clinic-name">{CLINIC.name}</h3>
                <p className="clinic-address">{CLINIC.address}</p>
                <a
                  className="get-directions-btn"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CLINIC.mapsQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DirectionsIcon />
                  Get Directions
                </a>
              </div>
            </div>

            <div className="recent-notes-section">
              <div className="section-header">
                <h2 className="section-title">Recent Notes</h2>
                <button className="see-all-btn" onClick={() => navigate('/notes')}>See all</button>
              </div>

              <div className="notes-list-card">
                {recentNotes.map((n, i) => (
                  <div key={i} className="note-row">
                    <div className="note-row-icon">{n.icon}</div>
                    <div className="note-row-content">
                      <h3 className="note-row-title">{n.title}</h3>
                      <p className="note-row-desc">{n.description}</p>
                    </div>
                    <span className="note-row-time">{n.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Therapy Types */}
          <div className="services-section">
            <h2 className="section-title">Therapy Types</h2>
            <div className="services-grid">
              <div
                className="service-card blue clickable"
                onClick={() => handleTherapyClick('occupational')}
              >
                <div className="service-icon">
                  <HandHeartIcon />
                </div>
                <div className="service-info">
                  <h3 className="service-title">Occupational Therapy</h3>
                  <p className="service-description">Improve daily skills</p>
                </div>
              </div>

              <div
                className="service-card green clickable"
                onClick={() => handleTherapyClick('speech')}
              >
                <div className="service-icon">
                  <ChatIcon />
                </div>
                <div className="service-info">
                  <h3 className="service-title">Speech Therapy</h3>
                  <p className="service-description">Support speech & language</p>
                </div>
              </div>

              <div
                className="service-card peach clickable"
                onClick={() => handleTherapyClick('physical')}
              >
                <div className="service-icon">
                  <DumbbellIcon />
                </div>
                <div className="service-info">
                  <h3 className="service-title">Physical Therapy</h3>
                  <p className="service-description">Improve movement & strength</p>
                </div>
              </div>

              <div
                className="service-card yellow clickable"
                onClick={() => handleTherapyClick('cognitive')}
              >
                <div className="service-icon">
                  <BrainIcon />
                </div>
                <div className="service-info">
                  <h3 className="service-title">Cognitive Therapy</h3>
                  <p className="service-description">Enhance thinking & learning</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Appointment Details Modal */}
      {showAppointmentDetails && (
        <div className="modal-overlay" onClick={() => setShowAppointmentDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{appointment.type}</h2>
              <button
                className="modal-close"
                onClick={() => setShowAppointmentDetails(false)}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
            <div className="modal-body">
              <section className="modal-section">
                <h3>When &amp; Where</h3>
                <ul className="exercise-list">
                  <li className="exercise-item"><span className="exercise-bullet">•</span>{appointment.date} at {appointment.time}</li>
                  <li className="exercise-item"><span className="exercise-bullet">•</span>with {appointment.therapist}</li>
                  <li className="exercise-item"><span className="exercise-bullet">•</span>at {CLINIC.name}</li>
                </ul>
              </section>
              <section className="modal-section">
                <h3>Good to Know</h3>
                <ul className="milestone-list">
                  <li className="milestone-item"><span className="milestone-check">✓</span>Please arrive 10 minutes early</li>
                  <li className="milestone-item"><span className="milestone-check">✓</span>Bring your therapy notebook</li>
                </ul>
              </section>
              <button
                className="modal-action-btn"
                onClick={() => setShowAppointmentDetails(false)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Therapy Modal */}
      {selectedTherapy && (
        <div className="modal-overlay" onClick={() => setSelectedTherapy(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{therapyCategories[selectedTherapy].title}</h2>
              <button
                className="modal-close"
                onClick={() => setSelectedTherapy(null)}
              >
                <XIcon />
              </button>
            </div>

            <div className="modal-body">
              <section className="modal-section">
                <h3>Today's Exercises</h3>
                <ul className="exercise-list">
                  {therapyCategories[selectedTherapy].exercises.map((exercise, index) => (
                    <li key={index} className="exercise-item">
                      <span className="exercise-bullet">•</span>
                      {exercise}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="modal-section">
                <h3>Milestones Achieved</h3>
                <ul className="milestone-list">
                  {therapyCategories[selectedTherapy].milestones.map((milestone, index) => (
                    <li key={index} className="milestone-item">
                      <span className="milestone-check">✓</span>
                      {milestone}
                    </li>
                  ))}
                </ul>
              </section>

              <button
                className="modal-action-btn"
                onClick={() => {
                  setSelectedTherapy(null)
                  navigate(`/therapy/${selectedTherapy}`)
                }}
              >
                View Full {therapyCategories[selectedTherapy].title} Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
