import { useState, useEffect, useRef, Fragment } from 'react'
import { jsPDF } from 'jspdf'
import Calendar from 'react-calendar'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { apiGet, apiPost, apiPostForm, apiPatch, apiDelete, API_BASE } from '../../utils/api'
import { generateUniqueId } from '../../utils/idGenerator'
import 'react-calendar/dist/Calendar.css'
import './OwnerStaffPage.css'

const SPECIALTY_COLORS = {
  'Speech Therapist':        { bg: '#e6f5f2', color: '#159a72' },
  'Occupational Therapist':  { bg: '#eff6ff', color: '#3b82f6' },
  'Physical Therapist':      { bg: '#f5f3ff', color: '#8b5cf6' },
  'Behavior Therapist':      { bg: '#fffbeb', color: '#d97706' },
  'Developmental Therapist': { bg: '#f0fdf4', color: '#16a34a' },
  'Psychologist':            { bg: '#fdf2f8', color: '#db2777' },
}
const SPECIALTIES = Object.keys(SPECIALTY_COLORS)
const BRANCHES = ['Main', 'North', 'Cebu', 'South']
const STATUSES = ['On Duty', 'On Leave']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const COUNTRY_CODES = ['+63', '+1', '+44', '+61', '+65']
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract']
const REJECT_REASONS = [
  'Incomplete or invalid documents',
  'Failed license/background verification',
  'Does not meet role requirements',
  'Position already filled',
  'Duplicate application',
  'Other',
]
const INITIAL_LEAVE_REQUESTS = [
  { id: 'lr1', staffId: 2, type: 'Vacation Leave', range: 'May 15 – May 17, 2026', days: 3, reason: 'Family vacation' },
]

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

// Client-side stand-in for demo applicants that have no real backend account
// to generate a password for — real hires get theirs from the approve API.
function randomTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const DOC_LABELS = [
  { key: 'ptr', label: 'PTR license' },
  { key: 'prc', label: 'PRC license' },
  { key: 'diploma', label: 'Diploma' },
  { key: 'id', label: 'Valid ID' },
]

// A newly-invited hire's documents are all uploaded together in one step
// (see backend staff-setup completion), so until that happens every item
// here is "awaiting upload".
function buildDocChecklist(documents = {}) {
  return DOC_LABELS.map(({ key, label }) => {
    const done = Boolean(documents?.[key])
    return { label, note: done ? 'uploaded' : 'awaiting upload', done }
  })
}

// ── Icons ──────────────────────────────────────────────
function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" />
      <path d="M16 5.2a3 3 0 0 1 0 5.8" />
      <path d="M21 20c0-2.8-1.8-5-4.5-5.7" />
    </svg>
  )
}
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
function AwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </svg>
  )
}
function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" />
    </svg>
  )
}
function RestoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="12" height="18" rx="1.5" />
      <path d="M16 8h4v13H4M8 7h1M12 7h1M8 11h1M12 11h1M8 15h1M12 15h1" />
    </svg>
  )
}
function CalendarSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function ChevronIcon({ up }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a2 2 0 0 1 2-2h1.2l1-1.6A1 1 0 0 1 9 4h6a1 1 0 0 1 .86.4L17 6h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}
function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}
function AlertCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  )
}
function DocLicenseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h5M7 13h8M7 17h4" />
    </svg>
  )
}
function DocMedalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </svg>
  )
}
function DocCapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5" />
    </svg>
  )
}
function DocIdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.5" /><path d="M14 10h5M14 14h5" />
    </svg>
  )
}

function SpecialtyBadge({ specialty }) {
  if (!specialty) return <span className="os-unassigned-pill">Unassigned</span>
  const c = SPECIALTY_COLORS[specialty] || SPECIALTY_COLORS['Speech Therapist']
  return (
    <span className="os-specialty-badge" style={{ background: c.bg, color: c.color }}>
      <span className="os-specialty-dot" style={{ background: c.color }} />
      {specialty}
    </span>
  )
}

function attendanceRate(attendance) {
  const total = attendance.present + attendance.late + attendance.absent
  if (!total) return 100
  return Math.round(((attendance.present + attendance.late * 0.5) / total) * 100)
}

function rateTone(rate) {
  if (rate >= 90) return 'good'
  if (rate >= 75) return 'warn'
  return 'critical'
}

function DayDots({ week }) {
  return (
    <div className="os-day-dots">
      {week.map((status, i) => <span key={i} className={`os-day-dot ${status}`} title={`${DAY_LABELS[i]}: ${status}`} />)}
    </div>
  )
}

/* ── Pending Leave Requests panel ──────────────────────────── */
function LeaveRequestsPanel({ requests, staff, onApprove, onDecline }) {
  const [collapsed, setCollapsed] = useState(false)
  if (requests.length === 0) return null

  return (
    <div className="os-lr-panel">
      <div className="os-lr-head">
        <div className="os-lr-head-icon"><CalendarSmallIcon /></div>
        <div className="os-lr-head-text">
          <div className="os-lr-title">
            Pending Leave Requests <span className="os-lr-count">{requests.length}</span>
          </div>
          <p>You have {requests.length} staff member{requests.length > 1 ? 's' : ''} requesting leave.</p>
        </div>
        <button type="button" className="os-lr-viewall">View All Requests</button>
        <button type="button" className="os-lr-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Expand' : 'Collapse'}>
          <ChevronIcon up={!collapsed} />
        </button>
      </div>

      {!collapsed && requests.map((req) => {
        const member = staff.find((s) => s.id === req.staffId)
        if (!member) return null
        return (
          <div key={req.id} className="os-lr-row">
            <div className="os-lr-person">
              <img src={member.avatar} alt={member.name} className="os-avatar" />
              <div>
                <div className="os-table-name">{member.name}</div>
                <SpecialtyBadge specialty={member.specialty} />
              </div>
            </div>
            <div className="os-lr-field">
              <span className="os-pill os-pill-yellow">On Leave</span>
              <span className="os-lr-sub">{req.type}</span>
            </div>
            <div className="os-lr-field">
              <span className="os-lr-strong"><CalendarSmallIcon /> {req.range}</span>
              <span className="os-lr-sub">{req.days} days</span>
            </div>
            <div className="os-lr-field">
              <span className="os-lr-strong">{req.reason}</span>
              <span className="os-lr-sub">Reason</span>
            </div>
            <div className="os-lr-actions">
              <button className="os-lr-approve" onClick={() => onApprove(req)}>
                <CheckCircleIcon /> Approve
              </button>
              <button className="os-lr-decline" onClick={() => onDecline(req)}>
                ✕ Decline
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── For Review (Job Applicants) panel ─────────────────────── */
function ApplicantsPanel({ applicants, onApprove, onReject }) {
  const [collapsed, setCollapsed] = useState(false)
  const [reviewingId, setReviewingId] = useState(null)
  const [viewingApplicantId, setViewingApplicantId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [rejectAck, setRejectAck] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectedResult, setRejectedResult] = useState(null)
  const [confirmApprove, setConfirmApprove] = useState(null)
  const [approving, setApproving] = useState(false)
  const [hiredResult, setHiredResult] = useState(null)
  if (applicants.length === 0) return null
  const reviewing = applicants.find((a) => a.id === reviewingId)
  const viewingApplicant = applicants.find((a) => a.id === viewingApplicantId)

  const openReject = (applicant) => {
    setRejectAck(false)
    setRejectReason('')
    setRejectNote('')
    setConfirmTarget(applicant)
  }

  const confirmReject = async () => {
    const applicant = confirmTarget
    setRejecting(true)
    const ok = await onReject(applicant, { reason: rejectReason, note: rejectNote.trim() })
    setRejecting(false)
    setConfirmTarget(null)
    setViewingApplicantId(null)
    setReviewingId(null)
    if (ok) {
      setRejectedResult({
        name: applicant.name,
        email: applicant.email,
        initials: applicant.initials,
        appliedFor: applicant.appliedFor,
        branch: applicant.branch,
        reason: rejectReason,
      })
    }
  }

  const runApprove = async () => {
    const applicant = confirmApprove
    setApproving(true)
    const result = await onApprove(applicant)
    setApproving(false)
    setConfirmApprove(null)
    setViewingApplicantId(null)
    setReviewingId(null)
    if (result) {
      setHiredResult({
        name: applicant.name,
        initials: applicant.initials,
        appliedFor: applicant.appliedFor,
        branch: applicant.branch,
        employeeId: applicant.employeeId,
        employment: applicant.employment,
        photoUrl: applicant.photoUrl,
        dob: applicant.dob,
        phone: applicant.phone,
      })
    }
  }

  return (
    <div className="os-ap-panel">
      <div className="os-ap-head">
        <div className="os-ap-head-icon"><PeopleIcon /></div>
        <div className="os-ap-head-text">
          <div className="os-ap-title">
            For Review <span className="os-ap-count">{applicants.length}</span>
          </div>
          <p>Applicants awaiting document verification and hiring decision.</p>
        </div>
        <button type="button" className="os-lr-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Expand' : 'Collapse'}>
          <ChevronIcon up={!collapsed} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="os-ap-table-wrap">
            <table className="os-ap-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Applied for</th>
                  <th>Applied on</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.appliedFor}</td>
                    <td>{formatDate(a.appliedOn)}</td>
                    <td>
                      {a.missingDocs > 0
                        ? <span className="os-ap-doc-missing">{a.missingDocs} missing</span>
                        : <span className="os-ap-doc-complete">Complete</span>}
                    </td>
                    <td><span className="os-pill os-pill-yellow">Pending</span></td>
                    <td>
                      <button
                        type="button"
                        className={`os-ap-review-btn ${reviewingId === a.id ? 'active' : ''}`}
                        onClick={() => setReviewingId(reviewingId === a.id ? null : a.id)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reviewing && (
            <div className="os-ap-detail">
              <div className="os-ap-detail-head">
                <div className="os-ap-detail-avatar">{reviewing.initials}</div>
                <div className="os-ap-detail-info">
                  <div className="os-ap-detail-name">{reviewing.name}</div>
                  <div className="os-ap-detail-sub">Applying as {reviewing.appliedFor.toLowerCase()} · {branchLabel(reviewing.branch)}</div>
                </div>
                <span className="os-pill os-pill-yellow">Pending review</span>
              </div>

              <div className="os-ap-checklist">
                {reviewing.checklist.map((item) => (
                  <div key={item.label} className={`os-ap-check-item ${item.done ? 'done' : 'missing'}`}>
                    <span className="os-ap-check-icon">{item.done ? '✓' : '✕'}</span>
                    {item.label} — {item.note}
                  </div>
                ))}
              </div>

              <div className="os-ap-detail-actions">
                <button type="button" className="os-ap-view-btn" onClick={() => setViewingApplicantId(reviewing.id)}>View full application</button>
                <button type="button" className="os-ap-reject" onClick={() => openReject(reviewing)}>Reject</button>
                <button type="button" className="os-ap-approve" onClick={() => setConfirmApprove(reviewing)}>Approve and hire</button>
              </div>
            </div>
          )}
        </>
      )}

      {viewingApplicant && (
        <ApplicantModal
          applicant={viewingApplicant}
          onClose={() => setViewingApplicantId(null)}
          onApprove={(a) => setConfirmApprove(a)}
          onReject={(a) => openReject(a)}
        />
      )}

      {confirmTarget && (
        <div className="os-modal-backdrop" onClick={() => (rejecting ? null : setConfirmTarget(null))}>
          <div className="os-reject-modal" onClick={(e) => e.stopPropagation()}>
            <div className="os-reject-top">
              <div className="os-reject-icon"><AlertCircleIcon /></div>
              <button className="os-reject-close" onClick={() => setConfirmTarget(null)} disabled={rejecting} aria-label="Close">✕</button>
            </div>
            <h3 className="os-reject-title">Reject this application?</h3>

            <div className="os-reject-card">
              <div className="os-ap-detail-avatar">{confirmTarget.initials}</div>
              <div>
                <div className="os-reject-card-name">{confirmTarget.name}</div>
                <div className="os-reject-card-sub">{confirmTarget.appliedFor} · {branchLabel(confirmTarget.branch)}</div>
              </div>
            </div>

            <div className="os-reject-field">
              <label>Reason for rejection <span className="os-reject-req">*</span></label>
              <select className="os-reject-select" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                <option value="" disabled>Select a reason</option>
                {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="os-reject-field">
              <label>Additional details <span className="os-reject-optional">(optional)</span></label>
              <textarea
                className="os-reject-textarea"
                placeholder="Add a short note for the record"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>

            <div className="os-reject-warning">
              <WarningIcon />
              <p>This permanently deletes their application and account. The reason above is saved to the audit log.</p>
            </div>

            <label className="os-reject-checkbox">
              <input type="checkbox" checked={rejectAck} onChange={(e) => setRejectAck(e.target.checked)} />
              I understand this action is permanent
            </label>

            <div className="os-reject-footer">
              <button className="os-reject-cancel" onClick={() => setConfirmTarget(null)} disabled={rejecting}>Cancel</button>
              <button className="os-reject-confirm" onClick={confirmReject} disabled={!rejectAck || !rejectReason || rejecting}>
                {rejecting ? 'Rejecting…' : 'Reject application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmApprove && (
        <div className="os-modal-backdrop" onClick={() => (approving ? null : setConfirmApprove(null))}>
          <div className="os-modal" onClick={(e) => e.stopPropagation()}>
            <div className="os-modal-body" style={{ paddingTop: 24 }}>
              <div className="os-hire-modal-top">
                <div className="os-success-check" style={{ margin: 0 }}><CheckCircleIcon /></div>
                <button
                  className="os-modal-close"
                  onClick={() => setConfirmApprove(null)}
                  disabled={approving}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <h3 className="os-hire-title">Approve and hire this applicant?</h3>
              <p className="os-hire-desc">This creates a staff account for them and generates a temporary login password.</p>
              <div className="os-hire-card">
                <div className="os-ap-detail-avatar">{confirmApprove.initials}</div>
                <div>
                  <div className="os-hire-card-name">{confirmApprove.name}</div>
                  <div className="os-hire-card-sub">{confirmApprove.appliedFor} · {branchLabel(confirmApprove.branch)}</div>
                </div>
              </div>
            </div>
            <div className="os-modal-footer">
              <button className="os-btn-cancel" onClick={() => setConfirmApprove(null)} disabled={approving}>Cancel</button>
              <button className="os-ap-approve" onClick={runApprove} disabled={approving}>
                {approving ? 'Generating…' : 'Proceed to ID Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {hiredResult && (
        <IdCardModal staff={hiredResult} onClose={() => setHiredResult(null)} />
      )}

      {rejectedResult && (
        <RejectedResultModal result={rejectedResult} onClose={() => setRejectedResult(null)} />
      )}
    </div>
  )
}

/* ── "Application rejected" confirmation modal ─────────────── */
function RejectedResultModal({ result, onClose }) {
  const { name, email, initials, appliedFor, branch, reason } = result
  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-body" style={{ paddingTop: 24 }}>
          <div className="os-hire-modal-top">
            <div className="os-success-check" style={{ margin: 0 }}><CheckCircleIcon /></div>
            <button className="os-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3 className="os-hire-title">Application rejected</h3>
          <p className="os-hire-desc">
            <strong>{name}</strong>'s application has been removed. They're no longer listed under For Review.
          </p>

          <div className="os-reject-result-card">
            <div className="os-ap-detail-avatar">{initials}</div>
            <div className="os-reject-result-info">
              <div className="os-hire-card-name">{name}</div>
              <div className="os-hire-card-sub">{appliedFor} · {branchLabel(branch)}</div>
            </div>
            {reason && <span className="os-reject-reason-pill">{reason}</span>}
          </div>

          {email && (
            <div className="os-reject-notified">
              <MailIcon />
              <span>Notified at <strong>{email}</strong></span>
            </div>
          )}
        </div>
        <div className="os-modal-footer">
          <button className="os-btn-dark os-reject-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

/* ── ID card canvas rendering ──────────────────────────────── */
// CR80 badge ratio (85.6mm x 53.98mm) rendered at ~300dpi for crisp export.
const ID_CARD_W = 1013
const ID_CARD_H = 638
const ID_CARD_LOGO_SRC = '/brickpath-logo.jpg'

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Loads an <img> for canvas drawing; resolves to null (never rejects) so a
// missing photo/logo/QR just falls back to a drawn placeholder instead of
// blocking the whole card.
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Crops+scales like CSS `object-fit: cover` into the given box.
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height
  const boxRatio = w / h
  let sx, sy, sw, sh
  if (imgRatio > boxRatio) {
    sh = img.height
    sw = sh * boxRatio
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / boxRatio
    sx = 0
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// Decorative only — a deterministic bar pattern seeded off the employee ID,
// not a real scannable barcode.
// A real barcode alternates bar/space continuously with no blank stretches —
// the previous version randomly skipped bars, leaving uneven gaps.
function drawBarcode(ctx, x, y, w, h, seedStr) {
  let seed = 0
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0
    return (seed % 1000) / 1000
  }
  const unit = 3
  ctx.fillStyle = '#111827'
  let cx = x
  let isBar = true
  while (cx < x + w) {
    const barW = unit * (1 + Math.floor(rand() * 3))
    if (isBar) ctx.fillRect(cx, y, barW, h)
    cx += barW
    isBar = !isBar
  }
}

function drawIdCard(ctx, staff, { logoImg, photoImg }) {
  const W = ID_CARD_W, H = ID_CARD_H
  const radius = 28
  const padding = 40
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  roundRectPath(ctx, 0, 0, W, H, radius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const barH = Math.round(H * 0.19)
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#159a72')
  grad.addColorStop(1, '#0e7a5a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, barH)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((staff.appliedFor || 'Staff').toUpperCase(), W / 2, barH / 2)

  const contentY = barH + 28
  const contentBottom = H - 32

  // A modest square photo frame, not stretched to fill the card.
  const photoSize = 190
  const photoX = padding
  const photoY = contentY
  roundRectPath(ctx, photoX, photoY, photoSize, photoSize, 14)
  if (photoImg) {
    ctx.save()
    ctx.clip()
    drawImageCover(ctx, photoImg, photoX, photoY, photoSize, photoSize)
    ctx.restore()
  } else {
    ctx.fillStyle = '#e5e7eb'
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 56px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(staff.initials || '?', photoX + photoSize / 2, photoY + photoSize / 2)
  }
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2
  roundRectPath(ctx, photoX, photoY, photoSize, photoSize, 14)
  ctx.stroke()

  const infoX = photoX + photoSize + 36
  const logoSize = 84
  const logoY = photoY
  if (logoImg) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(infoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(logoImg, infoX, logoY, logoSize, logoSize)
    ctx.restore()
  } else {
    ctx.fillStyle = '#159a72'
    ctx.beginPath()
    ctx.arc(infoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '700 28px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('BP', infoX + logoSize / 2, logoY + logoSize / 2 + 1)
  }

  const nameY = logoY + logoSize + 42
  ctx.fillStyle = '#1a2e26'
  ctx.font = '800 36px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText((staff.name || '').toUpperCase(), infoX, nameY)

  const idDigits = (staff.employeeId || '').replace(/\D/g, '') || '—'
  ctx.fillStyle = '#4b5563'
  ctx.font = '600 22px Arial, sans-serif'
  ctx.fillText(`ID#. ${idDigits}`, infoX, nameY + 34)
  ctx.fillText(`EMPLOYMENT: ${staff.employment || '—'}`, infoX, nameY + 68)
  ctx.fillText(`BRANCH: ${branchLabel(staff.branch)}`, infoX, nameY + 102)
  ctx.fillText(`BIRTHDAY: ${formatDate(staff.dob)}`, infoX, nameY + 136)
  ctx.fillText(`PHONE: ${staff.phone || '—'}`, infoX, nameY + 170)

  // A full-width barcode strip anchors the bottom of the card.
  drawBarcode(ctx, padding, contentBottom - 56, W - padding * 2, 48, String(staff.employeeId || staff.name || 'ID'))

  ctx.restore()
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  roundRectPath(ctx, 1, 1, W - 2, H - 2, radius)
  ctx.stroke()
}

/* ── "Employee is now hired" ID card modal ─────────────────── */
function IdCardModal({ staff, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    canvas.width = ID_CARD_W
    canvas.height = ID_CARD_H
    const ctx = canvas.getContext('2d')

    // Draw an immediate placeholder pass so the modal never looks blank
    // while the logo/photo load, then redraw once everything's ready.
    drawIdCard(ctx, staff, { logoImg: null, photoImg: null })

    Promise.all([
      loadImage(ID_CARD_LOGO_SRC),
      loadImage(staff.photoUrl),
    ]).then(([logoImg, photoImg]) => {
      if (cancelled) return
      drawIdCard(ctx, staff, { logoImg, photoImg })
    })

    return () => { cancelled = true }
  }, [staff])

  const fileBase = () => (staff.name || 'staff').trim().replace(/\s+/g, '_')

  const downloadImage = () => {
    const url = canvasRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase()}_ID_Card.png`
    a.click()
  }

  const downloadPdf = () => {
    const imgData = canvasRef.current.toDataURL('image/png')
    // CR80 card size in mm.
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] })
    doc.addImage(imgData, 'PNG', 0, 0, 85.6, 53.98)
    doc.save(`${fileBase()}_ID_Card.pdf`)
  }

  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal os-idcard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-body" style={{ paddingTop: 24 }}>
          <div className="os-hire-modal-top">
            <div className="os-success-check" style={{ margin: 0 }}><CheckCircleIcon /></div>
            <button className="os-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3 className="os-hire-title">{staff.name} is now hired</h3>
          <p className="os-hire-desc">Their staff ID card has been generated below.</p>

          <div className="os-idcard-preview">
            <canvas ref={canvasRef} className="os-idcard-canvas" />
          </div>
        </div>
        <div className="os-modal-footer" style={{ flexWrap: 'wrap' }}>
          <button className="os-btn-cancel" onClick={downloadImage}>Export as Image</button>
          <button className="os-btn-cancel" onClick={downloadPdf}>Export as PDF</button>
          <button className="os-btn-dark" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

/* ── Full Application modal ────────────────────────────────── */
function ApplicantModal({ applicant, onClose, onApprove, onReject }) {
  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-profile-hero">
          <button className="os-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <div className="os-ap-modal-avatar">{applicant.initials}</div>
          <h2 className="os-profile-name">{applicant.name}</h2>
          <p className="os-ap-detail-sub">Applying as {applicant.appliedFor.toLowerCase()} · {branchLabel(applicant.branch)}</p>
          <span className="os-pill os-pill-yellow">Pending review</span>
        </div>

        <div className="os-profile-body">
          <h4 className="os-section-title">Applicant Details</h4>
          <div className="os-detail-grid">
            <div className="os-detail-row">
              <span className="os-detail-lbl">Email</span>
              <span className="os-detail-val">{applicant.email}</span>
            </div>
            <div className="os-detail-row">
              <span className="os-detail-lbl">Phone</span>
              <span className="os-detail-val">{applicant.phone}</span>
            </div>
            <div className="os-detail-row">
              <span className="os-detail-lbl">Applied For</span>
              <span className="os-detail-val">{applicant.appliedFor}</span>
            </div>
            <div className="os-detail-row">
              <span className="os-detail-lbl">Branch</span>
              <span className="os-detail-val">{applicant.branch}</span>
            </div>
            <div className="os-detail-row">
              <span className="os-detail-lbl">Applied On</span>
              <span className="os-detail-val">{formatDate(applicant.appliedOn)}</span>
            </div>
            <div className="os-detail-row">
              <span className="os-detail-lbl">Experience</span>
              <span className="os-detail-val">{applicant.experience} years</span>
            </div>
          </div>

          <h4 className="os-section-title" style={{ marginTop: 20 }}>Cover Letter</h4>
          <p className="os-ap-cover-letter">{applicant.coverLetter}</p>

          <h4 className="os-section-title" style={{ marginTop: 20 }}>Documents &amp; Verification</h4>
          <div className="os-ap-checklist">
            {applicant.checklist.map((item) => (
              <div key={item.label} className={`os-ap-check-item ${item.done ? 'done' : 'missing'}`}>
                <span className="os-ap-check-icon">{item.done ? '✓' : '✕'}</span>
                {item.label} — {item.note}
              </div>
            ))}
          </div>
        </div>

        <div className="os-modal-footer">
          <button className="os-btn-cancel" onClick={onClose}>Close</button>
          <button className="os-ap-reject" onClick={() => onReject(applicant)}>Reject</button>
          <button className="os-ap-approve" onClick={() => onApprove(applicant)}>Approve and hire</button>
        </div>
      </div>
    </div>
  )
}

/* ── View Staff Modal ──────────────────────────────────────── */
const VIEW_TABS = ['Personal Info', 'Documents']

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Mock applicants use short branch names ("Main"), but real branches loaded
// from the DB already end in "Branch" ("Davao Main Branch") — avoid "Davao
// Main Branch branch" by only appending the word when it isn't there yet.
function branchLabel(branch) {
  if (!branch) return ''
  return /\bbranch\b/i.test(branch) ? branch : `${branch} branch`
}

function ViewModal({ staffMember, onClose }) {
  const [tab, setTab] = useState('Personal Info')

  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-profile-hero">
          <button className="os-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <img src={staffMember.avatar} alt={staffMember.name} className="os-profile-avatar" />
          <h2 className="os-profile-name">{staffMember.name}</h2>
          <SpecialtyBadge specialty={staffMember.specialty} />
          {staffMember.archived && <span className="os-archived-pill">Archived</span>}
        </div>

        <div className="os-view-tabs">
          {VIEW_TABS.map((t) => (
            <button key={t} type="button" className={`os-view-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="os-profile-body">
          {tab === 'Personal Info' && (
            <>
              <h4 className="os-section-title">Employment Details</h4>
              <div className="os-detail-grid">
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Branch</span>
                  <span className="os-detail-val">{staffMember.branch}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Duty Status</span>
                  <span className="os-detail-val">{staffMember.status}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Joined</span>
                  <span className="os-detail-val">{staffMember.joined}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Caseload</span>
                  <span className="os-detail-val">{staffMember.caseload} patients</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Employee ID</span>
                  <span className="os-detail-val">{staffMember.employeeId || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Employment</span>
                  <span className="os-detail-val">{staffMember.employment || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">PRC License No.</span>
                  <span className="os-detail-val">{staffMember.prcNumber || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">License Expiry</span>
                  <span className="os-detail-val">{formatDate(staffMember.licenseExpiry)}</span>
                </div>
              </div>

              <h4 className="os-section-title" style={{ marginTop: 20 }}>Contact Details</h4>
              <div className="os-detail-grid">
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Email</span>
                  <span className="os-detail-val">{staffMember.email || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Phone</span>
                  <span className="os-detail-val">{staffMember.phone || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Date of Birth</span>
                  <span className="os-detail-val">{formatDate(staffMember.dob)}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Gender</span>
                  <span className="os-detail-val">{staffMember.gender || '—'}</span>
                </div>
                <div className="os-detail-row" style={{ gridColumn: '1 / -1' }}>
                  <span className="os-detail-lbl">Address</span>
                  <span className="os-detail-val">{staffMember.address || '—'}</span>
                </div>
              </div>

              <h4 className="os-section-title" style={{ marginTop: 20 }}>Emergency Contact</h4>
              <div className="os-detail-grid">
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Name / Relationship</span>
                  <span className="os-detail-val">{staffMember.emergencyContact || '—'}</span>
                </div>
                <div className="os-detail-row">
                  <span className="os-detail-lbl">Phone</span>
                  <span className="os-detail-val">{staffMember.emergencyPhone || '—'}</span>
                </div>
              </div>
            </>
          )}

          {tab === 'Documents' && (
            <>
              <h4 className="os-section-title">Uploaded Documents</h4>
              {DOC_FIELDS.map((f) => {
                const doc = staffMember.documents?.[f.key]
                // Real hires store a GridFS file id (string) once they upload it
                // during self-setup; demo rows carry a legacy {name} object.
                const fileUrl = doc && staffMember.mongoEmployeeId
                  ? `${API_BASE}/api/employees/${staffMember.mongoEmployeeId}/documents/${f.key}/file`
                  : null
                return (
                  <div key={f.key} className="os-doc-card">
                    <div className="os-doc-icon" style={{ background: f.tint, color: f.color }}>{f.icon}</div>
                    <div className="os-doc-info">
                      <div className="os-doc-label">{f.label}</div>
                      <div className={`os-doc-hint ${doc ? 'uploaded' : ''}`}>
                        {doc
                          ? (fileUrl
                            ? <a href={fileUrl} target="_blank" rel="noreferrer">✓ View file</a>
                            : `✓ ${doc.name || 'Uploaded'}`)
                          : 'Not uploaded'}
                      </div>
                    </div>
                    {doc && <span className="os-pill os-pill-green">On File</span>}
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="os-modal-footer">
          <button className="os-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit / Assign Therapy Modal ───────────────────────────── */
function EditStaffModal({ staffMember, onClose, onSave }) {
  const [name, setName] = useState(staffMember.name)
  const [specialty, setSpecialty] = useState(staffMember.specialty)
  const [branch, setBranch] = useState(staffMember.branch)
  const [status, setStatus] = useState(staffMember.status)

  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-header">
          <div>
            <h3>Edit Staff</h3>
            <p>Update {staffMember.name}'s details and therapy specialty</p>
          </div>
          <button className="os-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="os-modal-body">
          <div className="os-form-group">
            <label>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="os-form-group">
            <label>Therapy Specialty</label>
            <div className="os-specialty-grid">
              <button
                type="button"
                className={`os-specialty-chip ${!specialty ? 'selected' : ''}`}
                onClick={() => setSpecialty(null)}
              >
                <span className="os-specialty-dot" style={{ background: '#c7d2cd' }} />
                Unassigned
              </button>
              {SPECIALTIES.map((s) => {
                const c = SPECIALTY_COLORS[s]
                return (
                  <button
                    key={s}
                    type="button"
                    className={`os-specialty-chip ${specialty === s ? 'selected' : ''}`}
                    onClick={() => setSpecialty(s)}
                  >
                    <span className="os-specialty-dot" style={{ background: c.color }} />
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="os-form-row">
            <div className="os-form-group">
              <label>Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="os-form-group">
              <label>Duty Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="os-modal-footer">
          <button className="os-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="os-btn-save"
            onClick={() => onSave({ name: name.trim() || staffMember.name, specialty, branch, status })}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Add Staff Modal (multi-step wizard) ───────────────────── */
// Documents are uploaded by the hire themselves during self-setup (see
// StaffSetup.jsx), not by the owner — this list is only used here to render
// a staff member's already-uploaded documents in the read-only ViewModal tab.
const WIZARD_STEPS = ['Personal Information', 'Professional Information', 'Upload Documents', 'Review & Add']
const DOC_FIELDS = [
  { key: 'ptr', icon: <DocLicenseIcon />, tint: '#e6f5f2', color: '#159a72', label: 'Professional License (PTR)' },
  { key: 'prc', icon: <DocMedalIcon />, tint: '#fdf2f8', color: '#db2777', label: 'PRC License' },
  { key: 'diploma', icon: <DocCapIcon />, tint: '#fffbeb', color: '#d97706', label: 'Diploma / Certificate' },
  { key: 'id', icon: <DocIdIcon />, tint: '#eff6ff', color: '#3b82f6', label: 'Valid ID' },
]

function DOBPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const dateVal = value ? new Date(`${value}T00:00:00`) : null
  const display = dateVal
    ? dateVal.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const handlePick = (d) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="os-dob-wrap" ref={wrapRef}>
      <button type="button" className="os-dob-input" onClick={() => setOpen((o) => !o)}>
        <span className={display ? '' : 'os-dob-placeholder'}>{display || 'mm/dd/yyyy'}</span>
        <CalendarSmallIcon />
      </button>
      {open && (
        <div className="os-dob-popover">
          <Calendar
            onChange={handlePick}
            value={dateVal}
            maxDate={new Date()}
            defaultView="decade"
            defaultActiveStartDate={dateVal || new Date(new Date().getFullYear() - 25, 0, 1)}
          />
        </div>
      )}
    </div>
  )
}

// Same dropdown-calendar pattern as DOBPicker, but for a future-facing date
// (license expiry) — opens on the month view and disallows past dates
// instead of restricting to 25 years back. Also accepts the date typed in
// directly (mm/dd/yyyy), so the calendar is an assist rather than the only way in.
const formatMDY = (d) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`

function ExpiryDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const dateVal = value ? new Date(`${value}T00:00:00`) : null

  // Keep the typed text in sync with the stored value, but don't clobber
  // whatever the user is mid-typing while the input is focused.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(dateVal ? formatMDY(dateVal) : '')
    }
  }, [value])

  const handlePick = (d) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    onChange(iso)
    setText(formatMDY(d))
    setOpen(false)
  }

  // Parses "mm/dd/yyyy" digits into a real, non-past date, or null if invalid/incomplete.
  const parseTyped = (digits) => {
    if (digits.length !== 8) return null
    const month = parseInt(digits.slice(0, 2), 10)
    const day = parseInt(digits.slice(2, 4), 10)
    const year = parseInt(digits.slice(4), 10)
    const d = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isRealDate = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
    if (!isRealDate || d < today) return null
    return d
  }

  const handleTextChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 4
      ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
      : digits.length > 2
        ? `${digits.slice(0, 2)}/${digits.slice(2)}`
        : digits
    setText(formatted)

    const d = parseTyped(digits)
    if (d) onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const handleBlur = () => {
    const digits = text.replace(/\D/g, '')
    if (!parseTyped(digits)) {
      // Incomplete or invalid (e.g. a past date) — snap back to the last valid value.
      setText(dateVal ? formatMDY(dateVal) : '')
    }
  }

  return (
    <div className="os-dob-wrap" ref={wrapRef}>
      <div className="os-dob-input">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className="os-dob-text"
          placeholder="mm/dd/yyyy"
          value={text}
          onChange={handleTextChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="os-dob-icon-btn"
          onClick={() => setOpen((o) => !o)}
          aria-label="Open calendar"
        >
          <CalendarSmallIcon />
        </button>
      </div>
      {open && (
        <div className="os-dob-popover">
          <Calendar
            onChange={handlePick}
            value={dateVal}
            minDate={new Date()}
            defaultActiveStartDate={dateVal || new Date()}
          />
        </div>
      )}
    </div>
  )
}

function AddStaffModal({ onClose, onAdd, onSuccess, existingIds = [] }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', phoneCode: '+63', phone: '',
    dob: '', gender: '', address: '', emergencyContact: '', emergencyCode: '+63', emergencyPhone: '',
    specialty: null, branch: BRANCHES[0], status: STATUSES[0],
    // Therapist/staff ID scheme: "T-" + 6 random digits, unique against
    // every employeeId already in use (approved staff and pending review).
    employeeId: generateUniqueId('T', existingIds),
    prcNumber: '', experience: '', employment: EMPLOYMENT_TYPES[0], licenseExpiry: '',
  })
  // The DB's `employees` collection needs a real branch_id (ObjectId), not the
  // demo branch names above, so this pulls the live list from the `branchs`
  // collection instead of reusing BRANCHES.
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [files, setFiles] = useState({ ptr: null, prc: null, diploma: null, id: null })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Local object URL for the profile photo preview — revoke the previous one
  // whenever it changes (or the modal unmounts) so it doesn't leak.
  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    let cancelled = false
    apiGet('/api/branches')
      .then((data) => {
        if (cancelled) return
        const list = data.branches || []
        setBranches(list)
        if (list.length) {
          setBranchId(list[0].id)
          setForm((f) => ({ ...f, branch: list[0].branch_name }))
        }
      })
      .catch(() => { if (!cancelled) setBranches([]) })
      .finally(() => { if (!cancelled) setBranchesLoading(false) })
    return () => { cancelled = true }
  }, [])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const setFile = (key, file) => setFiles((f) => ({ ...f, [key]: file }))
  const allFilesChosen = DOC_FIELDS.every((d) => files[d.key])

  const handlePhotoChange = (file) => {
    if (!file) { setPhoto(null); return }
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError('Profile photo must be 2MB or smaller.')
      return
    }
    setSubmitError('')
    setPhoto(file)
  }

  const selectBranch = (id) => {
    setBranchId(id)
    const b = branches.find((x) => x.id === id)
    set('branch', b ? b.branch_name : '')
  }

  const stepValid = [
    form.name.trim() && form.email.trim(),
    !!form.specialty && form.prcNumber.trim() && String(form.experience).trim() && !!form.licenseExpiry
      && !!branchId,
    allFilesChosen,
    true,
  ]

  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const nextLabel = submitting ? 'Saving…' : ['Next', 'Next', 'Next', 'Add Staff'][step]

  const submit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const today = new Date()
      // The DB requires `position` and `hired_at` but the wizard doesn't ask for
      // them separately — the therapy specialty doubles as the position, and
      // the hire date defaults to today (the day they're added).
      const hiredAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const formData = new FormData()
      const fields = {
        name: form.name.trim(),
        email: form.email.trim(),
        phoneCode: form.phoneCode,
        phone: form.phone,
        dob: form.dob,
        gender: form.gender,
        address: form.address,
        emergencyContact: form.emergencyContact,
        emergencyCode: form.emergencyCode,
        emergencyPhone: form.emergencyPhone,
        branchId,
        specialty: form.specialty,
        position: form.specialty,
        hiredAt,
        employeeId: form.employeeId,
        prcNumber: form.prcNumber,
        experience: form.experience,
        employment: form.employment,
        licenseExpiry: form.licenseExpiry,
        status: form.status,
      }
      Object.entries(fields).forEach(([key, val]) => formData.append(key, val ?? ''))
      DOC_FIELDS.forEach((d) => formData.append(d.key, files[d.key]))
      if (photo) formData.append('photo', photo)

      const data = await apiPostForm('/api/employees', formData)

      onAdd({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone ? `${form.phoneCode} ${form.phone}` : '',
        dob: form.dob,
        gender: form.gender,
        address: form.address,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone ? `${form.emergencyCode} ${form.emergencyPhone}` : '',
        branch: form.branch,
        status: form.status,
        specialty: form.specialty,
        employeeId: form.employeeId,
        prcNumber: form.prcNumber,
        experience: form.experience,
        employment: form.employment,
        licenseExpiry: form.licenseExpiry,
        position: form.specialty,
        hiredAt,
        mongoEmployeeId: data.employee?._id,
        accountStatus: 'pending',
        documents: data.employee?.documents || {},
        photoUrl: data.employee?.profile_picture?.url ? `${API_BASE}${data.employee.profile_picture.url}` : '',
      })
      onSuccess({ name: form.name.trim(), email: form.email.trim() })
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Could not save this staff member.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal os-modal-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-header">
          <div className="os-wizard-title">
            <span className="os-wizard-title-icon"><PeopleIcon /></span>
            <div>
              <h3>Add New Staff</h3>
              <p>Fill in the information below to add a new team member.</p>
            </div>
          </div>
          <button className="os-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="os-wizard-steps">
          {WIZARD_STEPS.map((label, i) => (
            <Fragment key={label}>
              {i > 0 && <div className={`os-wizard-connector ${i <= step ? 'done' : ''}`} />}
              <div className={`os-wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <span className="os-wizard-step-num">{i < step ? '✓' : i + 1}</span>
                <span className="os-wizard-step-label">{label}</span>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="os-modal-body">
          {step === 0 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Personal Information</h4>
              <div className="os-photo-upload">
                <div className="os-photo-circle">
                  {photoPreview
                    ? <img src={photoPreview} alt="Profile preview" className="os-photo-preview" />
                    : <div className="os-photo-placeholder"><CameraIcon /></div>}
                  <label className="os-photo-add" aria-label="Upload photo">
                    <PlusIcon />
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      hidden
                      onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <label className="os-photo-upload-btn">
                  Upload photo
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    hidden
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="os-photo-hint">JPG or PNG, max 2MB</p>
                {submitError && <p className="os-form-error">{submitError}</p>}
              </div>
              <div className="os-form-group">
                <label>Full Name <span className="os-req">*</span></label>
                <input placeholder="Enter full name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="os-form-group">
                <label>Email Address <span className="os-req">*</span></label>
                <input type="email" placeholder="Enter email address" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="os-form-group">
                <label>Phone Number <span className="os-req">*</span></label>
                <div className="os-phone-row">
                  <select value={form.phoneCode} onChange={(e) => set('phoneCode', e.target.value)}>
                    {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="912 345 6789" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>
              </div>
              <div className="os-form-row">
                <div className="os-form-group">
                  <label>Date of Birth <span className="os-req">*</span></label>
                  <DOBPicker value={form.dob} onChange={(v) => set('dob', v)} />
                </div>
                <div className="os-form-group">
                  <label>Gender <span className="os-req">*</span></label>
                  <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="" disabled>Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="os-form-group">
                <label>Address <span className="os-req">*</span></label>
                <input placeholder="Enter complete address" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </div>
              <div className="os-form-row">
                <div className="os-form-group">
                  <label>Emergency Contact <span className="os-req">*</span></label>
                  <input placeholder="Name / Relationship" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
                </div>
                <div className="os-form-group">
                  <label>Emergency Phone <span className="os-req">*</span></label>
                  <div className="os-phone-row">
                    <select value={form.emergencyCode} onChange={(e) => set('emergencyCode', e.target.value)}>
                      {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input placeholder="912 345 6789" value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Professional Information</h4>
              <div className="os-form-group">
                <label>Therapy Specialty <span className="os-req">*</span></label>
                <select value={form.specialty || ''} onChange={(e) => set('specialty', e.target.value || null)}>
                  <option value="" disabled>Select specialty</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="os-form-row">
                <div className="os-form-group">
                  <label>Branch <span className="os-req">*</span></label>
                  <select
                    value={branchId}
                    onChange={(e) => selectBranch(e.target.value)}
                    disabled={branchesLoading || branches.length === 0}
                  >
                    {branchesLoading && <option value="">Loading branches…</option>}
                    {!branchesLoading && branches.length === 0 && <option value="">No branches found</option>}
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                  </select>
                </div>
                <div className="os-form-group">
                  <label>Employee ID / Staff Number</label>
                  <input readOnly title="Auto-generated" className="os-input-readonly" value={form.employeeId} />
                </div>
              </div>
              <div className="os-form-row">
                <div className="os-form-group">
                  <label>PRC License No. <span className="os-req">*</span></label>
                  <input placeholder="e.g. 1234567" value={form.prcNumber} onChange={(e) => set('prcNumber', e.target.value)} />
                </div>
                <div className="os-form-group">
                  <label>Years of Experience <span className="os-req">*</span></label>
                  <input type="number" min="0" placeholder="e.g. 3" value={form.experience} onChange={(e) => set('experience', e.target.value)} />
                </div>
              </div>
              <div className="os-form-row">
                <div className="os-form-group">
                  <label>Employment Type</label>
                  <select value={form.employment} onChange={(e) => set('employment', e.target.value)}>
                    {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="os-form-group">
                  <label>License Expiry Date <span className="os-req">*</span></label>
                  <ExpiryDatePicker value={form.licenseExpiry} onChange={(v) => set('licenseExpiry', v)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Upload Documents</h4>
              <p className="os-wizard-hint">Upload {form.name || 'the new hire'}'s PTR, PRC license, diploma, and a valid ID. PDF, JPG, or PNG — up to 5MB each.</p>
              {DOC_FIELDS.map((f) => (
                <label key={f.key} className="os-doc-card os-doc-upload">
                  <div className="os-doc-icon" style={{ background: f.tint, color: f.color }}>{f.icon}</div>
                  <div className="os-doc-info">
                    <div className="os-doc-label">{f.label} <span className="os-req">*</span></div>
                    <div className={`os-doc-hint ${files[f.key] ? 'uploaded' : ''}`}>
                      {files[f.key] ? files[f.key].name : 'PDF, JPG, PNG (max 5MB)'}
                    </div>
                  </div>
                  <span className="os-doc-btn">{files[f.key] ? 'Replace' : 'Upload'}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    hidden
                    onChange={(e) => setFile(f.key, e.target.files?.[0] || null)}
                  />
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Review &amp; Add</h4>
              <div className="os-detail-grid">
                <div className="os-detail-row"><span className="os-detail-lbl">Full Name</span><span className="os-detail-val">{form.name || '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Email</span><span className="os-detail-val">{form.email || '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Phone</span><span className="os-detail-val">{form.phone ? `${form.phoneCode} ${form.phone}` : '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Specialty</span><span className="os-detail-val">{form.specialty || 'Unassigned'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Branch</span><span className="os-detail-val">{form.branch}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Duty Status</span><span className="os-detail-val">{form.status}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Employment</span><span className="os-detail-val">{form.employment}</span></div>
              </div>
              <div className="os-doc-note">
                <ShieldIcon />
                <p>{form.name || 'They'} will appear under "For Review" with the documents you uploaded, so you can double-check them before approving {form.name ? `${form.name.split(' ')[0]}` : 'them'} onto your staff.</p>
              </div>
              {submitError && <p className="os-form-error">{submitError}</p>}
            </div>
          )}
        </div>

        <div className="os-modal-footer os-wizard-footer">
          <button className="os-btn-cancel" onClick={step === 0 ? onClose : back} disabled={submitting}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            className="os-btn-save"
            disabled={!stepValid[step] || submitting}
            onClick={() => (step === WIZARD_STEPS.length - 1 ? submit() : next())}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Add Staff Success Modal ───────────────────────────────── */
// Shown on its own, after the wizard modal has closed, so the confirmation
// reads as a distinct step rather than another page of the same form.
function AddStaffSuccessModal({ name, email, onClose }) {
  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal os-modal-success" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-body">
          <div className="os-wizard-single os-wizard-success">
            <div className="os-success-check"><CheckCircleIcon /></div>
            <h4 className="os-wizard-section">Staff added</h4>
            <p>
              <strong>{name}</strong>'s details and documents have been saved. They now appear under{' '}
              <strong>For Review</strong> — mark their documents as complete and set approval to add
              {name ? ` ${name.split(' ')[0]}` : ' them'} to your TherapyPro list.
            </p>
            <p>
              An email has been sent to <strong>{email}</strong> letting them know their application is being
              processed and will be reviewed within 2–3 working days.
            </p>
          </div>
        </div>
        <div className="os-modal-footer os-wizard-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="os-btn-save" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// Reverses the shorthand maps `backend/routes/employees.js` uses when saving.
// (employment_type is stored pre-capitalized to match Atlas's validator, so
// it needs no reverse mapping — it's already display-ready.)
const REVERSE_EMPLOYEE_STATUS = { active: 'On Duty', on_leave: 'On Leave' }
const REVERSE_GENDER = { male: 'Male', female: 'Female', prefer_not_to_say: 'Prefer not to say' }

// Maps a GET /api/employees document (+ populated branch_id/user_id) into the
// shape the rest of this page already expects from the demo INITIAL_STAFF rows.
function mapEmployeeDoc(emp) {
  const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ')
  const seed = Math.abs(String(emp._id).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 1000
  return {
    id: emp._id,
    mongoEmployeeId: emp._id,
    name,
    email: emp.email || '',
    specialty: emp.specialty || null,
    branch: emp.branch_id?.branch_name || '',
    status: REVERSE_EMPLOYEE_STATUS[emp.status] || 'On Duty',
    archived: emp.status === 'terminated',
    caseload: 0,
    avatar: emp.profile_picture?.storage_key
      ? `${API_BASE}/api/employees/${emp._id}/photo`
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=${(seed % 2 ? '159a72' : '3b82f6')}&color=fff`,
    joined: emp.hired_at ? new Date(emp.hired_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
    attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
    phone: emp.phone?.number ? `${emp.phone.country_code || ''} ${emp.phone.number}`.trim() : '',
    dob: emp.dob ? new Date(emp.dob).toISOString().slice(0, 10) : '',
    gender: REVERSE_GENDER[emp.gender] || emp.gender || '',
    address: emp.address || '',
    emergencyContact: emp.emergency_contact || '',
    emergencyPhone: emp.emergency_phone || '',
    employeeId: emp.employee_id || '',
    prcNumber: emp.prc_number || '',
    experience: emp.experience ?? '',
    employment: emp.employment_type || '',
    licenseExpiry: emp.license_expiry ? new Date(emp.license_expiry).toISOString().slice(0, 10) : '',
    position: emp.position || '',
    hiredAt: emp.hired_at || '',
    documents: emp.documents || {},
    accountStatus: emp.user_id?.is_verified ? 'active' : 'pending',
  }
}

// A newly-invited employee whose account isn't verified yet (hasn't set a
// password / uploaded documents) belongs in the "For Review" panel instead
// of the Employees table — map it into the shape ApplicantsPanel expects.
function mapEmployeeToApplicant(emp) {
  const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ')
  const branchName = emp.branch_id?.branch_name || ''
  const role = emp.specialty || emp.position || ''
  const checklist = buildDocChecklist(emp.documents)
  return {
    id: `inv-${emp._id}`,
    mongoEmployeeId: emp._id,
    name,
    initials: initialsFromName(name),
    appliedFor: role,
    branch: branchName,
    appliedOn: emp.created_at
      ? new Date(emp.created_at).toISOString().slice(0, 10)
      : emp.hired_at
        ? new Date(emp.hired_at).toISOString().slice(0, 10)
        : '',
    missingDocs: checklist.filter((c) => !c.done).length,
    email: emp.email || '',
    phone: emp.phone?.number ? `${emp.phone.country_code || ''} ${emp.phone.number}`.trim() : '',
    experience: emp.experience ?? '',
    photoUrl: emp.profile_picture?.url ? `${API_BASE}${emp.profile_picture.url}` : '',
    coverLetter: `Invited to join as ${role || 'a team member'} at ${branchName || 'the branch'}. An account setup email was sent to ${emp.email} to collect their password, PTR, PRC license, diploma, and ID.`,
    checklist,
    // Kept so "Approve and hire" can promote this record with its full profile.
    dob: emp.dob ? new Date(emp.dob).toISOString().slice(0, 10) : '',
    gender: REVERSE_GENDER[emp.gender] || emp.gender || '',
    address: emp.address || '',
    emergencyContact: emp.emergency_contact || '',
    emergencyPhone: emp.emergency_phone || '',
    employeeId: emp.employee_id || '',
    prcNumber: emp.prc_number || '',
    employment: emp.employment_type || '',
    licenseExpiry: emp.license_expiry ? new Date(emp.license_expiry).toISOString().slice(0, 10) : '',
    position: emp.position || '',
    hiredAt: emp.hired_at || '',
    status: REVERSE_EMPLOYEE_STATUS[emp.status] || 'On Duty',
    documents: emp.documents || {},
  }
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function OwnerStaffPage({ user, onLogout, betaTier }) {
  const [staff, setStaff] = useState([])
  const [leaveRequests, setLeaveRequests] = useState(INITIAL_LEAVE_REQUESTS)
  const [applicants, setApplicants] = useState([])
  const [activeTab, setActiveTab] = useState('list')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [toneFilter, setToneFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [addSuccess, setAddSuccess] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Real hires created through the wizard live in MongoDB. A hire shows up in
  // "For Review" as soon as they're invited (the Documents column reflects
  // whether they've uploaded yet), and only joins the Employees table once
  // the owner has approved them.
  useEffect(() => {
    let cancelled = false
    apiGet('/api/employees')
      .then((data) => {
        if (cancelled) return
        const docs = data.employees || []
        const approved = docs.filter((e) => e.approved_at)
        const forReview = docs.filter((e) => !e.approved_at)
        const mappedStaff = approved.map(mapEmployeeDoc)
        const mappedApplicants = forReview.map(mapEmployeeToApplicant)
        setStaff((prev) => [...mappedStaff, ...prev.filter((s) => !s.mongoEmployeeId)])
        setApplicants((prev) => [...mappedApplicants, ...prev.filter((a) => !a.mongoEmployeeId)])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const activeStaff = staff.filter((s) => !s.archived)
  const archivedStaff = staff.filter((s) => s.archived)

  const pool = statusFilter === 'Archived' ? archivedStaff : activeStaff
  const filteredList = pool.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch = s.name.toLowerCase().includes(q) || (s.specialty || '').toLowerCase().includes(q)
    const matchBranch = branchFilter === 'All' || s.branch === branchFilter
    const matchStatus = statusFilter === 'All' || statusFilter === 'Archived' || s.status === statusFilter
    return matchSearch && matchBranch && matchStatus
  })

  const filteredAttendance = activeStaff.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch = s.name.toLowerCase().includes(q) || (s.specialty || '').toLowerCase().includes(q)
    const matchBranch = branchFilter === 'All' || s.branch === branchFilter
    const matchTone = toneFilter === 'All' || rateTone(attendanceRate(s.attendance)) === toneFilter
    return matchSearch && matchBranch && matchTone
  })

  const activeFiltered = activeTab === 'list' ? filteredList : filteredAttendance

  useEffect(() => { setPage(1) }, [search, branchFilter, statusFilter, toneFilter, pageSize, activeTab])

  const totalPages = Math.max(1, Math.ceil(activeFiltered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = activeFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const avgAttendance = activeStaff.length
    ? Math.round(activeStaff.reduce((sum, s) => sum + attendanceRate(s.attendance), 0) / activeStaff.length)
    : 100

  const counts = {
    total: activeStaff.length,
    onDuty: activeStaff.filter((s) => s.status === 'On Duty').length,
    onLeave: activeStaff.filter((s) => s.status === 'On Leave').length,
    coverage: new Set(activeStaff.map((s) => s.specialty).filter(Boolean)).size,
  }

  const attendanceBuckets = activeStaff.reduce(
    (acc, s) => {
      acc[rateTone(attendanceRate(s.attendance))]++
      return acc
    },
    { good: 0, warn: 0, critical: 0 }
  )

  const LIST_KPIS = [
    { cls: 'teal', icon: <PeopleIcon />, value: counts.total, label: 'Total Staff', sub: 'Across all branches' },
    { cls: 'amber', icon: <ClockIcon />, value: applicants.length, label: 'For Review', sub: 'Pending applications' },
    { cls: 'blue', icon: <AwardIcon />, value: counts.coverage, label: 'Specialties Covered', sub: 'By our team' },
    { cls: 'grey', icon: <TrashIcon />, value: archivedStaff.length, label: 'Archived', sub: 'Inactive records' },
  ]

  const ATTENDANCE_KPIS = [
    { cls: 'purple', icon: <TrendIcon />, value: `${avgAttendance}%`, label: 'Avg Attendance', sub: 'This month' },
    { cls: 'green', icon: <CheckCircleIcon />, value: attendanceBuckets.good, label: 'Good Standing', sub: '≥ 90% attendance' },
    { cls: 'amber', icon: <ClockIcon />, value: attendanceBuckets.warn, label: 'Needs Attention', sub: '75–89% attendance' },
    { cls: 'red', icon: <AwardIcon />, value: attendanceBuckets.critical, label: 'At Risk', sub: '< 75% attendance' },
    { cls: 'blue', icon: <CalendarSmallIcon />, value: leaveRequests.length, label: 'Pending Leave', sub: 'Awaiting review' },
  ]

  const logStaff = (actionIcon, description, staffId, status = 'Success') => {
    logActivity({
      role: 'Owner',
      user: user?.name || 'Owner',
      email: user?.email || '—',
      actionIcon,
      action: 'Staff',
      description,
      entity: `Staff #${staffId}`,
      status,
    })
  }

  // A newly-invited hire isn't a real staff member yet — they land in "For
  // Review" right away (their invite email just went out), and the
  // Documents column reflects whether they've uploaded yet. They only move
  // into the Employees table once the owner approves them. The modal itself
  // stays open to show its own confirmation screen, so this doesn't close it.
  const handleAdd = (form) => {
    const role = form.specialty || form.position || ''
    const checklist = buildDocChecklist(form.documents)
    setApplicants((prev) => [
      {
        id: form.mongoEmployeeId ? `inv-${form.mongoEmployeeId}` : `inv-${Date.now()}`,
        mongoEmployeeId: form.mongoEmployeeId,
        name: form.name, initials: initialsFromName(form.name),
        appliedFor: role, branch: form.branch,
        appliedOn: new Date().toISOString().slice(0, 10),
        missingDocs: checklist.filter((c) => !c.done).length,
        email: form.email, phone: form.phone, experience: form.experience,
        coverLetter: `Invited to join as ${role || 'a team member'} at ${branchLabel(form.branch)}. An email was sent to ${form.email} asking them to upload their PTR, PRC license, diploma, and ID for your review.`,
        checklist,
        dob: form.dob, gender: form.gender, address: form.address,
        emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
        employeeId: form.employeeId, prcNumber: form.prcNumber,
        employment: form.employment, licenseExpiry: form.licenseExpiry,
        position: form.position, hiredAt: form.hiredAt, status: form.status,
        documents: form.documents || {}, photoUrl: form.photoUrl || '',
      },
      ...prev,
    ])
    logStaff('✉️', `Invited ${form.name} as ${role} (${branchLabel(form.branch)}) — for review`, form.mongoEmployeeId || form.email)
  }

  const handleEditSave = (updates) => {
    setStaff((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...updates } : s)))
    logStaff('✏️', `Updated staff details for ${updates.name || editing.name}`, editing.id)
    setEditing(null)
  }

  const toggleArchive = (id) => {
    const member = staff.find((s) => s.id === id)
    const willArchive = member && !member.archived
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, archived: !s.archived } : s)))
    if (member) {
      logStaff(
        willArchive ? '🗃️' : '♻️',
        `${willArchive ? 'Archived' : 'Restored'} staff member ${member.name}`,
        id,
        willArchive ? 'Review' : 'Success'
      )
    }
  }

  const handleApproveLeave = (req) => {
    const member = staff.find((s) => s.id === req.staffId)
    setLeaveRequests((prev) => prev.filter((r) => r.id !== req.id))
    if (member) logStaff('✅', `Approved ${req.type.toLowerCase()} for ${member.name} (${req.range})`, member.id)
  }

  const handleDeclineLeave = (req) => {
    const member = staff.find((s) => s.id === req.staffId)
    setStaff((prev) => prev.map((s) => (s.id === req.staffId ? { ...s, status: 'On Duty' } : s)))
    setLeaveRequests((prev) => prev.filter((r) => r.id !== req.id))
    if (member) logStaff('❌', `Declined ${req.type.toLowerCase()} for ${member.name}`, member.id, 'Review')
  }

  const handleApproveApplicant = async (applicant) => {
    // A real invited hire (created via Add Staff) has already uploaded their
    // documents by the time they reach "For Review" — persist the owner's
    // approval so they stick in the Employees table across page reloads.
    if (applicant.mongoEmployeeId) {
      let data
      try {
        data = await apiPatch(`/api/employees/${applicant.mongoEmployeeId}/approve`)
      } catch (err) {
        window.alert(err.message || 'Could not approve this employee. Please try again.')
        return null
      }
      setApplicants((prev) => prev.filter((a) => a.id !== applicant.id))
      setStaff((prev) => [
        {
          id: applicant.mongoEmployeeId, mongoEmployeeId: applicant.mongoEmployeeId,
          name: applicant.name, email: applicant.email, specialty: applicant.appliedFor || null,
          branch: applicant.branch, status: applicant.status || 'On Duty', caseload: 0,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(applicant.name || '?')}&background=159a72&color=fff`,
          joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          archived: false, attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
          phone: applicant.phone, dob: applicant.dob, gender: applicant.gender, address: applicant.address,
          emergencyContact: applicant.emergencyContact, emergencyPhone: applicant.emergencyPhone,
          employeeId: applicant.employeeId, prcNumber: applicant.prcNumber, experience: applicant.experience,
          employment: applicant.employment, licenseExpiry: applicant.licenseExpiry, documents: applicant.documents,
          position: applicant.position, hiredAt: applicant.hiredAt, accountStatus: 'active',
        },
        ...prev,
      ])
      logStaff('✅', `Approved and hired ${applicant.name} as ${applicant.appliedFor} (${branchLabel(applicant.branch)})`, applicant.mongoEmployeeId)
      return { tempPassword: data.tempPassword }
    }

    // Demo applicants (no backend record) have no real account to generate a
    // password for — fake one client-side so the confirmation UI still has
    // something to show, but skip the (nonexistent) hire email.
    setApplicants((prev) => prev.filter((a) => a.id !== applicant.id))
    const seed = Math.floor(Math.random() * 70) + 1
    const newId = Date.now()
    setStaff((prev) => [
      {
        id: newId, name: applicant.name, specialty: applicant.appliedFor, branch: applicant.branch, status: 'On Duty',
        caseload: 0, avatar: `https://i.pravatar.cc/150?img=${seed}`,
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        archived: false, attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
        employeeId: generateUniqueId('T', prev.map((s) => s.employeeId).filter(Boolean)),
        documents: {},
      },
      ...prev,
    ])
    logStaff('✅', `Approved and hired ${applicant.name} as ${applicant.appliedFor} (${branchLabel(applicant.branch)})`, newId)
    return { tempPassword: randomTempPassword() }
  }

  const handleRejectApplicant = async (applicant, { reason, note } = {}) => {
    if (applicant.mongoEmployeeId) {
      try {
        await apiDelete(`/api/employees/${applicant.mongoEmployeeId}`, { reason, note })
      } catch (err) {
        window.alert(err.message || 'Could not reject this applicant. Please try again.')
        return false
      }
    }
    setApplicants((prev) => prev.filter((a) => a.id !== applicant.id))
    logActivity({
      role: 'Owner',
      user: user?.name || 'Owner',
      email: user?.email || '—',
      actionIcon: '❌',
      action: 'Recruitment',
      description: `Rejected application from ${applicant.name} for ${applicant.appliedFor}`
        + (reason ? ` — ${reason}` : '') + (note ? ` (${note})` : ''),
      entity: `Applicant ${applicant.id}`,
      status: 'Review',
    })
    return true
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Staff"
      subtitle="Manage therapist assignments, specialties, and attendance across branches."
      icon="👥"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      {/* Tabs */}
      <div className="os-tabs">
        <button type="button" className={`os-tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <PeopleIcon /> Employee List
        </button>
        <button type="button" className={`os-tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
          <ClockIcon /> Attendance Monitoring
          {leaveRequests.length > 0 && <span className="os-tab-badge">{leaveRequests.length}</span>}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="os-kpi-grid">
        {(activeTab === 'list' ? LIST_KPIS : ATTENDANCE_KPIS).map((k) => (
          <div key={k.label} className={`os-kpi-card ${k.cls}`}>
            <div className="os-kpi-icon">{k.icon}</div>
            <div className="os-kpi-main">
              <div className="os-kpi-value">{k.value}</div>
              <div className="os-kpi-label">{k.label}</div>
              <div className="os-kpi-sub">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'list' && (
        <ApplicantsPanel
          applicants={applicants}
          onApprove={handleApproveApplicant}
          onReject={handleRejectApplicant}
        />
      )}

      {activeTab === 'attendance' && (
        <LeaveRequestsPanel
          requests={leaveRequests}
          staff={staff}
          onApprove={handleApproveLeave}
          onDecline={handleDeclineLeave}
        />
      )}

      {/* Toolbar */}
      <div className="os-toolbar">
        <div className="os-search-wrap">
          <svg className="os-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="os-search"
            placeholder="Search by name or specialty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="os-branch-wrap">
          <span className="os-branch-icon"><BuildingIcon /></span>
          <select className="os-branch-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="All">All Branches</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b} Branch</option>)}
          </select>
        </div>
        {activeTab === 'list' ? (
          <div className="os-filter-tabs">
            {['All', 'Archived'].map((s) => (
              <button key={s} className={`os-filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'Archived' ? `Archived (${archivedStaff.length})` : s}
              </button>
            ))}
          </div>
        ) : (
          <div className="os-filter-tabs">
            {[
              { key: 'All', label: 'All' },
              { key: 'good', label: 'Good' },
              { key: 'warn', label: 'Needs Attention' },
              { key: 'critical', label: 'At Risk' },
            ].map((t) => (
              <button key={t.key} className={`os-filter-tab ${toneFilter === t.key ? 'active' : ''}`} onClick={() => setToneFilter(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Staff / Attendance Table */}
      {activeTab === 'list' ? (
        <div className="admin-table-card os-staff-table-card">
          <div className="os-table-card-head">
            <h3>Employees</h3>
            <button className="os-add-btn" onClick={() => setShowAdd(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Staff
            </button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Specialty</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Caseload</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={8}><p className="os-empty">No staff match your search.</p></td></tr>
                ) : pageRows.map((s) => {
                  return (
                    <tr key={s.id}>
                      <td data-label="Employee ID">{s.employeeId || '—'}</td>
                      <td data-label="Full Name">
                        <div className="os-table-person">
                          <div className="os-avatar-wrap">
                            <img src={s.avatar} alt={s.name} className="os-avatar" />
                            <span className={`os-status-dot ${s.accountStatus === 'pending' ? 'os-dot-yellow' : s.status === 'On Duty' ? 'os-dot-green' : 'os-dot-yellow'}`} />
                          </div>
                          <div className="os-table-name">{s.name}{s.archived && <span className="os-archived-pill">Archived</span>}</div>
                        </div>
                      </td>
                      <td data-label="Email">{s.email || '—'}</td>
                      <td data-label="Specialty"><SpecialtyBadge specialty={s.specialty} /></td>
                      <td data-label="Branch"><span className="os-branch-badge">{s.branch}</span></td>
                      <td data-label="Status">
                        {s.accountStatus === 'pending' ? (
                          <span className="os-pill os-pill-yellow">Pending Setup</span>
                        ) : (
                          <span className={`os-pill ${s.status === 'On Duty' ? 'os-pill-green' : 'os-pill-yellow'}`}>{s.status}</span>
                        )}
                      </td>
                      <td data-label="Caseload">{s.caseload} patients</td>
                      <td data-label="Actions">
                        <div className="os-table-actions">
                          <button className="os-icon-btn os-icon-view" onClick={() => setViewing(s)} title="View" aria-label={`View ${s.name}`}>
                            <EyeIcon />
                          </button>
                          <button className="os-icon-btn os-icon-edit" onClick={() => setEditing(s)} title="Edit" aria-label={`Edit ${s.name}`}>
                            <PencilIcon />
                          </button>
                          <button
                            className={`os-icon-btn ${s.archived ? 'os-icon-restore' : 'os-icon-archive'}`}
                            onClick={() => toggleArchive(s.id)}
                            title={s.archived ? 'Restore' : 'Archive'}
                            aria-label={`${s.archived ? 'Restore' : 'Archive'} ${s.name}`}
                          >
                            {s.archived ? <RestoreIcon /> : <TrashIcon />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="os-pagination">
            <button
              className="os-page-arrow"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >←</button>
            <span className="os-page-current">{currentPage}</span>
            <button
              className="os-page-arrow"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >→</button>
            <select className="os-page-size" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="admin-table-card os-staff-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Specialty</th>
                  <th>Branch</th>
                  <th>Rate</th>
                  <th>Weekly Pattern</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={9}><p className="os-empty">No staff match your search.</p></td></tr>
                ) : pageRows.map((s) => {
                  const rate = attendanceRate(s.attendance)
                  return (
                    <tr key={s.id}>
                      <td data-label="Staff">
                        <div className="os-table-person">
                          <div className="os-avatar-wrap">
                            <img src={s.avatar} alt={s.name} className="os-avatar" />
                            <span className={`os-status-dot ${s.status === 'On Duty' ? 'os-dot-green' : 'os-dot-yellow'}`} />
                          </div>
                          <div>
                            <div className="os-table-name">{s.name}</div>
                            <div className="os-table-joined"><CalendarSmallIcon /> Joined {s.joined}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Specialty"><SpecialtyBadge specialty={s.specialty} /></td>
                      <td data-label="Branch"><span className="os-branch-badge">{s.branch}</span></td>
                      <td data-label="Rate"><span className={`os-attendance-rate ${rateTone(rate)}`}>{rate}%</span></td>
                      <td data-label="Weekly Pattern"><DayDots week={s.attendance.week} /></td>
                      <td data-label="Present">{s.attendance.present}</td>
                      <td data-label="Late">{s.attendance.late}</td>
                      <td data-label="Absent">{s.attendance.absent}</td>
                      <td data-label="Actions">
                        <div className="os-table-actions">
                          <button className="os-icon-btn os-icon-view" onClick={() => setViewing(s)} title="View" aria-label={`View ${s.name}`}>
                            <EyeIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="os-pagination">
            <button
              className="os-page-arrow"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >←</button>
            <span className="os-page-current">{currentPage}</span>
            <button
              className="os-page-arrow"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >→</button>
            <select className="os-page-size" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </div>
      )}

      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
          onSuccess={(info) => setAddSuccess(info)}
          existingIds={[...staff, ...applicants].map((s) => s.employeeId).filter(Boolean)}
        />
      )}
      {addSuccess && (
        <AddStaffSuccessModal
          name={addSuccess.name}
          email={addSuccess.email}
          onClose={() => setAddSuccess(null)}
        />
      )}
      {viewing && <ViewModal staffMember={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditStaffModal staffMember={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </OwnerPageShell>
  )
}
