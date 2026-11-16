import { useMemo, useRef, useState } from 'react'
import { AVAILABILITY_SLOTS, clinicHour } from '../utils/availabilitySlots'
import { ConfirmAvailabilityModal } from './AvailabilityDialogs'
import './AvailabilityModal.css'

function CheckCircleIcon({ size = 22, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

// The slot grid lives in utils/availabilitySlots.js so the API shares it; re-exported
// here because other screens import it from this component.
export { AVAILABILITY_SLOTS }

// Shown right after a therapist's own Attendance page notices they've timed
// in and haven't answered for today yet. onConfirm hands back the full slot
// objects (not just labels) for the selected AVAILABILITY_SLOTS entries — the
// parent persists them to the `therapist_availability` collection, which is
// what the patient-facing booking page reads to gray out unavailable slots.
//
// Also reused to set/edit availability for a date other than today (from the
// attendance calendar) — pass `isToday={false}` to drop the "already passed"
// graying-out (nothing on a future day is "past" yet) and `initialSlots`
// (an array of already-open 'HH:mm' start times) to preselect whatever that
// day was last saved with, instead of the today-only "everything from now on"
// default. `bookedStarts` (start times a patient has already booked) are
// always shown selected and can't be unchecked — the backend preserves them
// regardless of what gets submitted, but locking them here too means the
// therapist never sees their own edit silently drop a real appointment.
function AvailabilityModal({ firstName, dateLabel, dateKey, now, isToday = true, initialSlots, bookedStarts, onSkip, onConfirm }) {
  const hourNow = clinicHour(now)
  const bookedSet = useMemo(() => new Set(bookedStarts || []), [bookedStarts])

  const [selected, setSelected] = useState(() => {
    const base = initialSlots
      ? new Set(AVAILABILITY_SLOTS.filter((s) => initialSlots.includes(s.start)).map((s) => s.label))
      : isToday
        ? new Set(AVAILABILITY_SLOTS.filter((s) => hourNow < s.endHour).map((s) => s.label))
        : new Set()
    AVAILABILITY_SLOTS.forEach((s) => { if (bookedSet.has(s.start)) base.add(s.label) })
    return base
  })

  const isBooked = (slot) => bookedSet.has(slot.start)
  const isPast = (slot) => isToday && hourNow >= slot.endHour
  const isLocked = (slot) => isBooked(slot) || isPast(slot)
  const hasPast = isToday && AVAILABILITY_SLOTS.some(isPast)

  // Confirm step: nothing is saved until the therapist says "Yes, confirm".
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pickError, setPickError] = useState('')
  const confirmBtnRef = useRef(null)
  // One id per distinct selection, so a retry after a network error is idempotent.
  const requestIdRef = useRef(null)

  const selectedSlots = AVAILABILITY_SLOTS.filter((s) => selected.has(s.label))

  const openConfirm = () => {
    if (selectedSlots.length === 0) {
      setPickError('Select at least one slot, or use Request leave.')
      return
    }
    setPickError('')
    setSaveError('')
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()
    setConfirming(true)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      await onConfirm(selectedSlots, requestIdRef.current)
    } catch (err) {
      setSaveError(err?.message || 'Could not save your availability. Please try again.')
      setSaving(false)
    }
  }

  const toggle = (slot) => {
    if (isLocked(slot)) return
    requestIdRef.current = null
    setPickError('')
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
        <h3 className="avm-title">{isToday ? `You're clocked in, ${firstName}` : 'Set your availability'}</h3>
        <p className="avm-sub">
          {isToday
            ? "Select which time slots you're open for today. Patients booking same-day sessions will only see these."
            : `Select which time slots patients can book on ${dateLabel}.`}
        </p>
        <p className="avm-date">{isToday ? `TODAY · ${dateLabel}` : dateLabel.toUpperCase()}</p>

        {isToday && (
          <div className="avm-legend">
            <span className="avm-legend-item"><i className="avm-legend-dot avm-legend-dot-available" /> Available</span>
            <span className="avm-legend-item"><i className="avm-legend-dot avm-legend-dot-past" /> Past</span>
          </div>
        )}

        <div className="avm-grid">
          {AVAILABILITY_SLOTS.map((slot) => {
            const booked = isBooked(slot)
            const past = isPast(slot)
            const isSelected = selected.has(slot.label)
            return (
              <button
                key={slot.label}
                type="button"
                className={`avm-slot ${isSelected ? 'selected' : ''} ${past ? 'past' : ''} ${booked ? 'booked' : ''}`}
                disabled={isLocked(slot)}
                onClick={() => toggle(slot)}
              >
                {isSelected && !past && !booked && <CheckCircleIcon size={14} className="avm-slot-check" />}
                {slot.label}
                {booked && <span className="avm-slot-booked-tag">Booked</span>}
              </button>
            )
          })}
        </div>

        {bookedSet.size > 0 && (
          <div className="avm-info avm-info-booked">
            <InfoIcon />
            <span>Slots marked Booked already have a patient scheduled — they can't be removed here.</span>
          </div>
        )}

        {hasPast && (
          <div className="avm-info">
            <InfoIcon />
            <span>Slots earlier than now are already past — grayed out. You can edit this anytime from your Attendance page.</span>
          </div>
        )}

        {pickError && (
          <div className="avm-inline-error" role="alert">
            <InfoIcon />
            <span>{pickError}</span>
          </div>
        )}

        <div className="avm-footer">
          <button type="button" className="avm-btn-skip" onClick={onSkip}>Skip for now</button>
          <button
            type="button"
            className="avm-btn-confirm"
            ref={confirmBtnRef}
            onClick={openConfirm}
          >
            Confirm Availability
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmAvailabilityModal
          dateKey={dateKey}
          starts={selectedSlots.map((x) => x.start)}
          saving={saving}
          error={saveError}
          returnFocusRef={confirmBtnRef}
          onCancel={() => { setConfirming(false); setSaveError('') }}
          onConfirm={save}
        />
      )}
    </div>
  )
}

export default AvailabilityModal
