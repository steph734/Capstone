import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import { buildAvailability, fetchBookedDates } from '../utils/appointmentBookings'
import { AVAILABILITY_SLOTS } from '../components/AvailabilityModal'
import { SESSION_MODES } from '../data/sessionModes'
import { manilaDateKey } from '../utils/manilaTime'
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

export default function AppointmentsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const today = new Date()
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const currentUser = user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' }
  const [viewMonth, setViewMonth]       = useState(today.getMonth())
  const [viewYear, setViewYear]         = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(today.getDate())
  /* Dates booked in MongoDB for the month in view. Re-fetched every time the
     month changes so the calendar always reflects the real appointments
     table rather than a client-side guess. */
  const [serverBooked, setServerBooked] = useState([])
  const [availabilityError, setAvailabilityError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setAvailabilityError(false)
    fetchBookedDates(viewYear, viewMonth)
      .then(booked => { if (!cancelled) setServerBooked(booked) })
      .catch((err) => {
        if (cancelled) return
        // Swallowing this used to mean a broken /api/appointments/availability
        // call was indistinguishable from "no appointments this month" — every
        // day just rendered available. Surface it instead so a real outage is
        // visible rather than silently mimicking an empty calendar.
        console.error('Could not load booked dates:', err)
        setServerBooked([])
        setAvailabilityError(true)
      })
    return () => { cancelled = true }
  }, [viewYear, viewMonth])

  /* Fixed clinic calendar for the month in view: every day starts
     "available" and only flips to "booked" when it has a matching
     appointment in MongoDB (or a booking this browser just made). */
  const availability = useMemo(
    () => buildAvailability(viewYear, viewMonth, serverBooked),
    [viewYear, viewMonth, serverBooked]
  )
  const [showConfirm, setShowConfirm]   = useState(false)

  /* ── Therapist roster, straight from the employees collection ── */
  const [therapists, setTherapists] = useState([])
  const [therapistsLoading, setTherapistsLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    fetch('/api/appointments/therapists')
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        if (!cancelled) setTherapists(body.therapists || [])
      })
      .catch((e) => console.warn('Could not load therapists:', e.message))
      .finally(() => { if (!cancelled) setTherapistsLoading(false) })
    return () => { cancelled = true }
  }, [])

  /* ── Therapist / session mode / time slot picked for the selected date ── */
  const [selectedTherapist, setSelectedTherapist] = useState(null)
  const [sessionMode, setSessionMode]             = useState('in-person')
  const [pickedTime, setPickedTime]               = useState(null)

  // A previously picked time slot may not apply once the selected date
  // changes, so clear it (the therapist choice can carry over).
  useEffect(() => { setPickedTime(null) }, [selectedDate, viewMonth, viewYear])

  const bookingDateKey = selectedDate
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
    : null
  const isFutureBookingDate = bookingDateKey ? bookingDateKey > manilaDateKey() : false

  // Once a therapist is picked, ask which same-day slots they confirmed via
  // the "You're clocked in" modal on their Attendance page. See
  // BookAppointmentPage.jsx for the fuller explanation of `openSlots`.
  const [openSlots, setOpenSlots] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsNote, setSlotsNote] = useState('')

  useEffect(() => {
    if (!selectedTherapist || !bookingDateKey) {
      setOpenSlots(null)
      setSlotsNote('')
      return
    }
    let cancelled = false
    setSlotsLoading(true)
    fetch(`/api/appointments/therapist-slots?employeeId=${encodeURIComponent(selectedTherapist)}&date=${bookingDateKey}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        if (cancelled) return
        if (Array.isArray(body.slots)) {
          setOpenSlots(body.slots)
          setSlotsNote(
            body.slots.length
              ? 'Slots this therapist hasn’t opened up for this day are marked Not Available.'
              : "This therapist hasn't opened any slots for this day yet — all marked Not Available."
          )
        } else {
          setOpenSlots(null)
          setSlotsNote(
            isFutureBookingDate
              ? "This therapist hasn't confirmed their availability for this day yet — slots open up once they clock in that morning. All marked Not Available for now."
              : ''
          )
        }
      })
      .catch((e) => {
        if (cancelled) return
        console.warn('Could not load therapist slots:', e.message)
        setOpenSlots(null)
        setSlotsNote('')
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false) })
    return () => { cancelled = true }
  }, [selectedTherapist, bookingDateKey, isFutureBookingDate])

  const openSlotSet = useMemo(() => {
    if (!openSlots) return null
    return new Set(openSlots.filter((s) => s.status === 'available').map((s) => s.start))
  }, [openSlots])
  const isSlotAvailable = (slotDef) => {
    if (openSlotSet) return openSlotSet.has(slotDef.start)
    return !isFutureBookingDate
  }

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
  /* Past dates can't be booked — anything before midnight today is off-limits. */
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const isPast = (day) => new Date(viewYear, viewMonth, day) < startOfToday

  const selectedLabel = selectedDate
    ? `${MONTHS[viewMonth]} ${selectedDate}, ${viewYear}`
    : 'No date selected'

  const selectedStatus = selectedDate ? dotStatus(selectedDate) : null
  const selectedIsPast = selectedDate ? isPast(selectedDate) : false
  const canSchedule = selectedStatus === 'available' && !selectedIsPast
    && !!selectedTherapist && !!pickedTime

  const handleSchedule = () => {
    if (!canSchedule) return
    const therapistObj = therapists.find(t => t.id === selectedTherapist)
    navigate('/appointments/book', {
      state: {
        selectedDate, month: viewMonth, year: viewYear,
        therapist: therapistObj
          ? { id: therapistObj.id, name: therapistObj.name, role: therapistObj.role }
          : null,
        sessionMode,
        pickedTime,
      }
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

            {availabilityError && (
              <p className="schedule-hint">
                Couldn&apos;t check which dates are already booked, so every date below is
                shown as available. Refresh to try again.
              </p>
            )}

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
                  const past = isPast(day)
                  return (
                    <button
                      key={day}
                      className={`cal-day
                        ${isToday(day) ? 'cal-today' : ''}
                        ${isSelected(day) ? 'cal-selected' : ''}
                        ${status === 'closed' ? 'cal-closed' : ''}
                        ${status === 'booked' ? 'cal-booked' : ''}
                        ${past ? 'cal-past' : ''}
                      `}
                      onClick={() => setSelectedDate(day)}
                      disabled={status === 'closed' || past}
                      title={
                        past
                          ? 'Past date'
                          : status === 'booked'
                            ? 'Already booked'
                            : undefined
                      }
                    >
                      <span className="cal-day-num">{day}</span>
                      <span className={`dot dot-${status} dot-sm`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Booking Selection ── */}
            <div className="booking-select-row">
              <div className="appt-field">
                <label htmlFor="therapist-select">Therapist <span className="req">*</span></label>
                <select
                  id="therapist-select"
                  value={selectedTherapist ?? ''}
                  onChange={e => {
                    setSelectedTherapist(e.target.value || null)
                    setPickedTime(null)
                  }}
                  disabled={therapistsLoading}
                >
                  <option value="" disabled>
                    {therapistsLoading ? 'Loading therapists…' : 'Select your therapist'}
                  </option>
                  {therapists.map(t => (
                    <option key={t.id} value={t.id}>{t.name} - {t.role}</option>
                  ))}
                </select>
                {!therapistsLoading && therapists.length === 0 && (
                  <p className="appt-field-hint">No staff are on record yet — add employees from the owner dashboard first.</p>
                )}
              </div>

              <div className="appt-field">
                <label htmlFor="session-mode-select">Session Mode</label>
                <select
                  id="session-mode-select"
                  value={sessionMode}
                  onChange={e => setSessionMode(e.target.value)}
                >
                  {SESSION_MODES.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="appt-field">
                <label htmlFor="time-slot-select">Time Slot <span className="req">*</span></label>
                <select
                  id="time-slot-select"
                  value={pickedTime ?? ''}
                  onChange={e => setPickedTime(e.target.value)}
                  disabled={!selectedTherapist || slotsLoading}
                >
                  <option value="" disabled>
                    {!selectedTherapist
                      ? 'Select a therapist first'
                      : slotsLoading
                        ? 'Loading time slots…'
                        : 'Select a time slot'}
                  </option>
                  {AVAILABILITY_SLOTS.map(slot => {
                    const available = isSlotAvailable(slot)
                    return (
                      <option key={slot.label} value={slot.label} disabled={!available}>
                        {slot.label} {available ? '(Available)' : '(Not Available)'}
                      </option>
                    )
                  })}
                </select>
                {slotsNote && <p className="appt-field-hint">{slotsNote}</p>}
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
                disabled={!canSchedule}
              >
                Schedule Appointment
              </button>
            </div>

            {selectedIsPast && (
              <p className="schedule-hint">You can&apos;t book a date in the past. Please choose today or a later date.</p>
            )}
            {!selectedIsPast && selectedStatus === 'booked' && (
              <p className="schedule-hint">This date is already booked. Please choose an available date.</p>
            )}
            {!selectedIsPast && selectedStatus === 'closed' && (
              <p className="schedule-hint">The clinic is closed on this date.</p>
            )}

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
