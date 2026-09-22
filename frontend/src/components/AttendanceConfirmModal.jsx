import { formatManilaTime, formatManilaDate } from '../utils/manilaTime'
import './ScanIdModal.css'

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

function initialsFromName(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

function formatLoggedTime(iso) {
  // Philippine time, regardless of the viewing device's own timezone — this
  // is the clinic's official attendance record, not a local convenience.
  return `${formatManilaTime(iso)}, ${formatManilaDate(iso)}`
}

// Shown after ScanIdModal has already closed itself following a successful
// scan — kept as a separate popup (rather than a phase inside the scanner)
// so the camera is fully torn down before this confirmation appears.
function AttendanceConfirmModal({ result, onClose, onScanNext }) {
  return (
    <div className="sim-backdrop" onClick={onClose}>
      <div className="sim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sim-body">
          <div className="sim-top">
            <div className="sim-success-check"><CheckCircleIcon /></div>
            <button className="sim-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3 className="sim-title">Attendance logged</h3>

          <div className="sim-result-card">
            <div className="sim-result-avatar">{result.initials || initialsFromName(result.name)}</div>
            <div className="sim-result-info">
              <div className="sim-result-name">{result.name}</div>
              <div className="sim-result-sub">{result.specialty || 'Unassigned'} · {result.branch || '—'}</div>
            </div>
            <span className={`sim-pill ${result.type === 'Time In' ? 'green' : 'yellow'}`}>{result.type}</span>
          </div>

          <div className="sim-logged-time">
            <ClockIcon />
            Logged at {formatLoggedTime(result.loggedAt)}
          </div>
        </div>
        <div className="sim-footer">
          <button className="sim-btn-secondary" onClick={onScanNext}>Scan next</button>
          <button className="sim-btn-dark" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

export default AttendanceConfirmModal
