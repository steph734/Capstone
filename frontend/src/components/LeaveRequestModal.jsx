import { useMemo, useState } from 'react'
import './LeaveRequestModal.css'

const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Other']

function PalmIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-9" />
      <path d="M12 13c-3-4-8-4-9-9 5 0 8 3 9 6" />
      <path d="M12 13c3-4 8-4 9-9-5 0-8 3-9 6" />
      <path d="M12 13c-1.5-3-5-4-6-7 4 0 6.5 2 6.5 2" />
      <path d="M12 13c1.5-3 5-4 6-7-4 0-6.5 2-6.5 2" />
    </svg>
  )
}

function dayCount(from, to) {
  if (!from || !to) return 0
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  const diff = Math.round((b - a) / 86400000)
  return diff >= 0 ? diff + 1 : 0
}

// Lets a therapist ask the owner for time off over a date range. Submits to
// POST /api/attendance/leave-requests, which stores it as 'pending' in the
// `leave_request` collection — the same one the owner's staff page reads for
// its (currently mocked) approvals panel.
export default function LeaveRequestModal({ minDate, defaultFrom, onClose, onSubmit }) {
  const [from, setFrom] = useState(defaultFrom || minDate)
  const [to, setTo] = useState(defaultFrom || minDate)
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const days = useMemo(() => dayCount(from, to), [from, to])
  const valid = from && to && to >= from

  const handleFrom = (v) => {
    setFrom(v)
    if (to && to < v) setTo(v)
  }

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ leaveType, startDate: from, endDate: to, reason: reason.trim() })
    } catch (err) {
      setError(err.message || 'Could not submit your request.')
      setSubmitting(false)
    }
  }

  return (
    <div className="lrm-backdrop" onClick={onClose}>
      <div className="lrm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lrm-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="lrm-check"><PalmIcon /></div>
        <h3 className="lrm-title">Request leave</h3>
        <p className="lrm-sub">Your request goes to the owner for approval.</p>

        <div className="lrm-date-row">
          <div className="lrm-field">
            <label>From</label>
            <input type="date" value={from} min={minDate} onChange={(e) => handleFrom(e.target.value)} />
          </div>
          <div className="lrm-field">
            <label>To</label>
            <input type="date" value={to} min={from || minDate} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {days > 0 && <p className="lrm-days">{days} day{days === 1 ? '' : 's'}</p>}

        <div className="lrm-field">
          <label>Leave type</label>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="lrm-field">
          <label>Reason <span className="lrm-optional">(optional)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Let the owner know why you're requesting this leave…"
            rows={3}
          />
        </div>

        {error && <p className="lrm-error">{error}</p>}

        <div className="lrm-footer">
          <button type="button" className="lrm-btn-cancel" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="lrm-btn-submit" onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  )
}
