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
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5a7a6d" strokeWidth="1.5">
      <path d="M11 8c0-2.21-1.79-4-4-4S3 5.79 3 8s1.79 4 4 4 4-1.79 4-4z" />
      <path d="M18.5 6c-1.38 0-2.5 1.12-2.5 2.5 0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5S19.88 6 18.5 6z" />
      <path d="M12 14v7" />
      <path d="M16 17l-4 4-4-4" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5a7a6d" strokeWidth="1.5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function DumbbellIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c77b3a" strokeWidth="1.5">
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
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d4a944" strokeWidth="1.5">
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
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
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

export default function Dashboard({ onLogout, user, betaTier }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser] = useState(user || {
    name: 'Alvrin',
    role: 'Patient',
    avatar: '/therapy-pro-logo.png'
  })

  // Quick-Log Progress Tracker State
  const [dailyMood, setDailyMood] = useState(null)
  const [exerciseCompleted, setExerciseCompleted] = useState(false)
  const [painLevel, setPainLevel] = useState(null)
  const [showQuickLog, setShowQuickLog] = useState(false)

  // Calendar State
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(false)
  const [appointmentDates] = useState([
    new Date(2026, 5, 29), // June 29, 2026
    new Date(2026, 6, 5),  // July 5, 2026
    new Date(2026, 6, 12), // July 12, 2026
  ])

  // Progress/Gamification State
  const [weeklyProgress, setWeeklyProgress] = useState(75)

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
    time: '10:00 AM'
  })

  const [recentNote] = useState({
    title: 'Great Progress today!',
    description: 'Alvrin was able to complete all activities',
    time: '2h ago'
  })

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
      description: 'Support Speech & Language',
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

  // Handlers
  const handleMoodSelect = (mood) => {
    setDailyMood(mood)
    // In production, send to backend: POST /api/logs/mood
    console.log('Mood logged:', mood)
  }

  const handleExerciseToggle = () => {
    setExerciseCompleted(!exerciseCompleted)
    // In production: POST /api/logs/exercise
    console.log('Exercise completed:', !exerciseCompleted)
    
    // Update weekly progress
    if (!exerciseCompleted) {
      setWeeklyProgress(Math.min(100, weeklyProgress + 5))
    }
  }

  const handlePainLevel = (level) => {
    setPainLevel(level)
    // In production: POST /api/logs/pain
    console.log('Pain level logged:', level)
  }

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
          {/* Welcome Banner with Progress Ring */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <h1 className="welcome-title">Welcome back, {currentUser.name}! 👋</h1>
              <p className="welcome-subtitle">
                Track appointments, notes, and therapy progress all in one place.
              </p>
              
              {/* Weekly Progress */}
              <div className="progress-container">
                <div className="progress-ring-wrapper">
                  <svg className="progress-ring" width="60" height="60">
                    <circle
                      className="progress-ring-circle-bg"
                      stroke="#d5ebe3"
                      strokeWidth="6"
                      fill="transparent"
                      r="24"
                      cx="30"
                      cy="30"
                    />
                    <circle
                      className="progress-ring-circle"
                      stroke="#4a6b5d"
                      strokeWidth="6"
                      fill="transparent"
                      r="24"
                      cx="30"
                      cy="30"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - weeklyProgress / 100)}`}
                      strokeLinecap="round"
                    />
                    <text
                      x="30"
                      y="35"
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="bold"
                      fill="#2c4a3e"
                    >
                      {weeklyProgress}%
                    </text>
                  </svg>
                </div>
                <div className="progress-text">
                  <p className="progress-label">Weekly Goals</p>
                  <p className="progress-description">{weeklyProgress}% of goals met!</p>
                </div>
              </div>
            </div>
            <div className="welcome-illustration">
              <span className="illustration-emoji">👩‍⚕️👦</span>
            </div>
          </div>

        {/* Quick-Log Progress Tracker */}
        <div className="quick-log-card">
          <div className="quick-log-header">
            <h2 className="quick-log-title">Quick Log</h2>
            <button 
              className="quick-log-toggle"
              onClick={() => setShowQuickLog(!showQuickLog)}
            >
              {showQuickLog ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showQuickLog && (
            <div className="quick-log-content">
              {/* Mood Tracker */}
              <div className="log-section">
                <label className="log-label">How are you feeling today?</label>
                <div className="mood-emojis">
                  {['😢', '😟', '😐', '😊', '😄'].map((emoji, index) => (
                    <button
                      key={index}
                      className={`mood-emoji ${dailyMood === index ? 'selected' : ''}`}
                      onClick={() => handleMoodSelect(index)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercise Completion */}
              <div className="log-section">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={exerciseCompleted}
                    onChange={handleExerciseToggle}
                  />
                  <span className="checkmark">
                    {exerciseCompleted && <CheckIcon />}
                  </span>
                  <span className="checkbox-label-text">Completed Daily Speech Exercises</span>
                </label>
              </div>

              {/* Pain Level */}
              <div className="log-section">
                <label className="log-label">Pain Level (0-10)</label>
                <div className="pain-scale">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <button
                      key={level}
                      className={`pain-level ${painLevel === level ? 'selected' : ''}`}
                      onClick={() => handlePainLevel(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {dailyMood !== null || exerciseCompleted || painLevel !== null ? (
                <p className="log-saved">✓ Progress logged successfully!</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Upcoming Appointment with Mini Calendar */}
        <div className="appointment-card">
          <div className="appointment-header">
            <div className="appointment-icon">
              <CalendarIcon />
            </div>
            <h2 className="appointment-heading">Upcoming Appointment</h2>
            <button 
              className="calendar-toggle-btn"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {showCalendar ? 'Hide' : 'View'} Calendar
            </button>
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
              <h3 className="appointment-type">{appointment.type}</h3>
              <p className="appointment-therapist">with {appointment.therapist}</p>
              
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

              <button className="view-details-btn">View Details</button>
            </div>
          )}
        </div>

        {/* Book Appointment Button */}
        <button className="book-appointment-btn">
          <CalendarIcon />
          Book an Appointment
        </button>

        {/* Therapy Services Grid - Now Interactive */}
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
              <p className="service-description">Support Speech & Language</p>
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

        {/* Recent Notes */}
        <div className="recent-notes-section">
          <div className="section-header">
            <h2 className="section-title">Recent Notes</h2>
            <button className="see-all-btn">See all</button>
          </div>

          <div className="note-card">
            <div className="note-icon">
              <ChartIcon />
            </div>
            <div className="note-content">
              <h3 className="note-title">{recentNote.title}</h3>
              <p className="note-description">{recentNote.description}</p>
            </div>
            <span className="note-time">{recentNote.time}</span>
          </div>
        </div>

          {/* Logout Button */}
          <button className="logout-btn" onClick={() => {
            onLogout()
            navigate('/')
          }}>
            Logout
          </button>
        </main>
      </div>

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
