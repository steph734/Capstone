import { useState } from 'react'
import './AvailabilityModal.css'

function CheckCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </svg>
  )
}

// Same-day slot grid a patient could book into once wired up — kept in one
// place here since nothing outside this modal reads it yet.
export const AVAILABILITY_SLOTS = [
  { label: '8:00 - 9:00 AM', endHour: 9 },
  { label: '9:00 - 10:00 AM', endHour: 10 },
  { label: '10:00 - 11:00 AM', endHour: 11 },
  { label: '11:00 - 12:00 PM', endHour: 12 },
  { label: '1:00 - 2:00 PM', endHour: 14 },
  { label: '2:00 - 3:00 PM', endHour: 15 },
  { label: '3:00 - 4:00 PM', endHour: 16 },
  { label: '4:00 - 5:00 PM', endHour: 17 },
]

// Shown right after a therapist's own Attendance page notices they've timed
// in and haven't answered for today yet. Selecting slots here is UI-only for
// now — see AVAILABILITY_SLOTS above — it just records what they picked so
// the modal doesn't reappear every visit; nothing yet filters patient
// booking by it.
function AvailabilityModal({ firstName, dateLabel, now, onSkip, onConfirm }) {
  const [selected, setSelected] = useState(
    () => new Set(AVAILABILITY_SLOTS.filter((s) => now.getHours() < s.endHour).map((s) => s.label))
  )

  const isPast = (slot) => now.getHours() >= slot.endHour
  const hasPast = AVAILABILITY_SLOTS.some(isPast)

  const toggle = (slot) => {
    if (isPast(slot)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slot.label)) next.delete(slot.label)
      else next.add(slot.label)
      return next
    })
  }

  return (
    <div className="avm-backdrop" onClick={onSkip}>
      <div className="avm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="avm-close" onClick={onSkip} aria-label="Close">✕</button>
        <div className="avm-check"><CheckCircleIcon /></div>
        <h3 className="avm-title">You're clocked in, {firstName}</h3>
        <p className="avm-sub">
          Select which time slots you're open for today. Patients booking same-day sessions will only see these.
        </p>
        <p className="avm-date">TODAY · {dateLabel}</p>

        <div className="avm-grid">
          {AVAILABILITY_SLOTS.map((slot) => {
            const past = isPast(slot)
            const isSelected = selected.has(slot.label)
            return (
              <button
                key={slot.label}
                type="button"
                className={`avm-slot ${isSelected ? 'selected' : ''} ${past ? 'past' : ''}`}
                disabled={past}
                onClick={() => toggle(slot)}
              >
                {slot.label}
              </button>
            )
          })}
        </div>

        {hasPast && (
          <div className="avm-info">
            <InfoIcon />
            <span>Slots earlier than now are already past — grayed out. You can edit this anytime from your Attendance page.</span>
          </div>
        )}

        <div className="avm-footer">
          <button type="button" className="avm-btn-skip" onClick={onSkip}>Skip for now</button>
          <button type="button" className="avm-btn-confirm" onClick={() => onConfirm([...selected])}>
            Confirm Availability
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvailabilityModal
