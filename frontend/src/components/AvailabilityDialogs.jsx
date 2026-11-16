import { useEffect, useRef, useState } from 'react'
import { formatManilaDate } from '../utils/manilaTime'
import { groupSlotRanges } from '../utils/availabilitySlots'
import './AvailabilityModal.css'
import './AvailabilityDialogs.css'

function CheckCircleIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Focus management shared by both dialogs: focus moves into the dialog on open,
// Tab is trapped inside, Esc calls onEscape (ignored while `busy`), and focus
// goes back to `returnFocusRef` (the "Confirm Availability" button) on close.
function useDialog({ onEscape, busy = false, returnFocusRef }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    return () => {
      const target = returnFocusRef?.current || previous
      if (target && target.isConnected) target.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onEscape?.()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll(FOCUSABLE)]
    if (items.length === 0) { e.preventDefault(); ref.current.focus(); return }
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return { ref, onKeyDown }
}

function Summary({ dateKey, starts, countSuffix }) {
  const ranges = groupSlotRanges(starts)
  return (
    <div className="avd-summary">
      <p className="avd-summary-date">{formatManilaDate(dateKey, { weekday: 'short' }).toUpperCase()}</p>
      {ranges.map((r) => <p key={r.start} className="avd-summary-range">{r.label}</p>)}
      <p className="avd-summary-count">{starts.length} slot{starts.length === 1 ? '' : 's'} {countSuffix}</p>
    </div>
  )
}

// "Confirm your availability?" — nothing is saved until "Yes, confirm".
export function ConfirmAvailabilityModal({ dateKey, starts, saving, error, onCancel, onConfirm, returnFocusRef }) {
  const { ref, onKeyDown } = useDialog({ onEscape: onCancel, busy: saving, returnFocusRef })
  return (
    <div className="avd-backdrop" onClick={(e) => { e.stopPropagation(); if (!saving) onCancel() }}>
      <div
        ref={ref}
        className="avd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avd-confirm-title"
        aria-describedby="avd-confirm-text"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="avm-check"><CheckCircleIcon /></div>
        <h3 className="avd-title" id="avd-confirm-title">Confirm your availability?</h3>
        <p className="avd-text" id="avd-confirm-text">Patients will only be able to book the time slots you selected for this day.</p>
        <Summary dateKey={dateKey} starts={starts} countSuffix="selected" />
        {error && <div className="avd-error" role="alert">{error}</div>}
        <div className="avd-footer">
          <button type="button" className="avm-btn-skip" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="avm-btn-confirm" onClick={onConfirm} disabled={saving} aria-busy={saving}>
            {saving ? (<><span className="avd-spinner" aria-hidden="true" />Saving…</>) : 'Yes, confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// "Availability saved!" with Pao celebrating on the top edge.
export function AvailabilitySuccessModal({ dateKey, starts, onDone }) {
  const { ref, onKeyDown } = useDialog({ onEscape: onDone })
  const [paoOk, setPaoOk] = useState(true)
  return (
    <div className="avd-backdrop avd-backdrop-success" onClick={(e) => { e.stopPropagation(); onDone() }}>
      <div
        ref={ref}
        className="avd-dialog avd-dialog-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avd-success-title"
        aria-describedby="avd-success-text"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {paoOk && <img className="avd-pao" src="/pao/letsgo.png" alt="" onError={() => setPaoOk(false)} />}
        <div className="avd-title-row">
          <span className="avd-badge"><CheckCircleIcon size={16} /></span>
          <h3 className="avd-title" id="avd-success-title">Availability saved!</h3>
        </div>
        <p className="avd-text" id="avd-success-text">Your schedule is now updated. Patients can book the slots you selected.</p>
        <Summary dateKey={dateKey} starts={starts} countSuffix="open to patients" />
        <div className="avd-footer">
          <button type="button" className="avm-btn-confirm avd-done" onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  )
}
