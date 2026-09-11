import { useState, useEffect, useRef } from 'react'
import Calendar from 'react-calendar'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { apiGet, apiPost } from '../../utils/api'
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
// Demo document records for the profile "Documents" tab — a real backend
// would store uploaded file metadata instead of these placeholders.
const demoDocuments = (base) => ({
  ptr: { name: `${base}_PTR_License.pdf` },
  prc: { name: `${base}_PRC_License.pdf` },
  diploma: { name: `${base}_Diploma.pdf` },
  id: { name: `${base}_Valid_ID.jpg` },
})

const INITIAL_STAFF = [
  {
    id: 1, name: 'Marco Reyes', specialty: 'Speech Therapist', branch: 'Main', status: 'On Duty', caseload: 24,
    avatar: 'https://i.pravatar.cc/150?img=8', joined: 'Jan 2025', archived: false,
    attendance: { present: 21, late: 1, absent: 1, week: ['present', 'present', 'present', 'late', 'present'] },
    email: 'marco.reyes@therapypro.ph', phone: '+63 917 234 5678', dob: '1994-03-12', gender: 'Male',
    address: '12 Rizal St, Quezon City', emergencyContact: 'Liza Reyes (Spouse)', emergencyPhone: '+63 917 234 5000',
    employeeId: 'EMP-0001', prcNumber: '0123456', experience: '5', employment: 'Full-time', licenseExpiry: '2027-01-15',
    documents: demoDocuments('Marco_Reyes'),
  },
  {
    id: 2, name: 'Jade Tan', specialty: 'Physical Therapist', branch: 'North', status: 'On Leave', caseload: 18,
    avatar: 'https://i.pravatar.cc/150?img=9', joined: 'Mar 2025', archived: false,
    attendance: { present: 17, late: 0, absent: 3, week: ['present', 'absent', 'absent', 'present', 'present'] },
    email: 'jade.tan@therapypro.ph', phone: '+63 918 345 6789', dob: '1996-07-22', gender: 'Female',
    address: '45 Mabini Ave, Makati City', emergencyContact: 'Robert Tan (Father)', emergencyPhone: '+63 918 345 1111',
    employeeId: 'EMP-0002', prcNumber: '0234567', experience: '3', employment: 'Full-time', licenseExpiry: '2026-11-30',
    documents: demoDocuments('Jade_Tan'),
  },
  {
    id: 3, name: 'Andre Lim', specialty: 'Behavior Therapist', branch: 'Cebu', status: 'On Duty', caseload: 15,
    avatar: 'https://i.pravatar.cc/150?img=52', joined: 'Jun 2025', archived: false,
    attendance: { present: 22, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
    email: 'andre.lim@therapypro.ph', phone: '+63 919 456 7890', dob: '1992-11-05', gender: 'Male',
    address: '8 Osmeña Blvd, Cebu City', emergencyContact: 'Grace Lim (Sister)', emergencyPhone: '+63 919 456 2222',
    employeeId: 'EMP-0003', prcNumber: '0345678', experience: '7', employment: 'Full-time', licenseExpiry: '2028-05-20',
    documents: demoDocuments('Andre_Lim'),
  },
  {
    id: 4, name: 'Clara Dela Cruz', specialty: 'Occupational Therapist', branch: 'South', status: 'On Duty', caseload: 21,
    avatar: 'https://i.pravatar.cc/150?img=32', joined: 'Apr 2025', archived: false,
    attendance: { present: 23, late: 1, absent: 0, week: ['present', 'present', 'present', 'late', 'present'] },
    email: 'clara.delacruz@therapypro.ph', phone: '+63 920 567 8901', dob: '1995-02-18', gender: 'Female',
    address: '23 Aguinaldo Hwy, Dasmariñas', emergencyContact: 'Mark Dela Cruz (Husband)', emergencyPhone: '+63 920 567 3333',
    employeeId: 'EMP-0004', prcNumber: '0456789', experience: '4', employment: 'Part-time', licenseExpiry: '2027-08-09',
    documents: demoDocuments('Clara_Dela_Cruz'),
  },
  {
    id: 5, name: 'Carmen Dizon', specialty: 'Occupational Therapist', branch: 'Main', status: 'On Duty', caseload: 20,
    avatar: 'https://i.pravatar.cc/150?img=25', joined: 'Aug 2025', archived: false,
    attendance: { present: 20, late: 2, absent: 0, week: ['present', 'late', 'present', 'present', 'late'] },
    email: 'carmen.dizon@therapypro.ph', phone: '+63 921 678 9012', dob: '1998-09-30', gender: 'Female',
    address: '5 Katipunan Ave, Quezon City', emergencyContact: 'Elena Dizon (Mother)', emergencyPhone: '+63 921 678 4444',
    employeeId: 'EMP-0005', prcNumber: '0567890', experience: '2', employment: 'Full-time', licenseExpiry: '2026-04-14',
    documents: demoDocuments('Carmen_Dizon'),
  },
  {
    id: 6, name: 'Paolo Ramos', specialty: 'Developmental Therapist', branch: 'North', status: 'On Duty', caseload: 16,
    avatar: 'https://i.pravatar.cc/150?img=51', joined: 'Oct 2025', archived: false,
    attendance: { present: 19, late: 1, absent: 2, week: ['present', 'present', 'absent', 'present', 'present'] },
    email: 'paolo.ramos@therapypro.ph', phone: '+63 922 789 0123', dob: '1993-05-27', gender: 'Male',
    address: '17 Session Rd, Baguio City', emergencyContact: 'Nina Ramos (Spouse)', emergencyPhone: '+63 922 789 5555',
    employeeId: 'EMP-0006', prcNumber: '0678901', experience: '6', employment: 'Contract', licenseExpiry: '2027-12-02',
    documents: demoDocuments('Paolo_Ramos'),
  },
  {
    id: 7, name: 'Grace Uy', specialty: 'Psychologist', branch: 'Cebu', status: 'On Duty', caseload: 12,
    avatar: 'https://i.pravatar.cc/150?img=28', joined: 'Nov 2025', archived: false,
    attendance: { present: 22, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
    email: 'grace.uy@therapypro.ph', phone: '+63 923 890 1234', dob: '1990-01-09', gender: 'Female',
    address: '30 Gorordo Ave, Cebu City', emergencyContact: 'Daniel Uy (Brother)', emergencyPhone: '+63 923 890 6666',
    employeeId: 'EMP-0007', prcNumber: '0789012', experience: '9', employment: 'Full-time', licenseExpiry: '2028-02-27',
    documents: demoDocuments('Grace_Uy'),
  },
]

const INITIAL_LEAVE_REQUESTS = [
  { id: 'lr1', staffId: 2, type: 'Vacation Leave', range: 'May 15 – May 17, 2026', days: 3, reason: 'Family vacation' },
]

const INITIAL_APPLICANTS = [
  {
    id: 'ap1', name: 'Rica Domingo', initials: 'RD', appliedFor: 'Occupational Therapist', branch: 'Main',
    appliedOn: '2026-09-08', missingDocs: 0,
    email: 'rica.domingo@gmail.com', phone: '+63 917 111 2233', experience: '4',
    coverLetter: "Passionate about helping children build fine motor and daily living skills. Looking forward to joining the Main branch team.",
    checklist: [
      { label: 'PRC license', note: 'verified', done: true },
      { label: 'NBI clearance', note: 'verified', done: true },
      { label: 'Resume', note: 'uploaded', done: true },
      { label: 'References', note: '2 contacted', done: true },
    ],
  },
  {
    id: 'ap2', name: 'Kevin Santos', initials: 'KS', appliedFor: 'Speech Therapist', branch: 'Main',
    appliedOn: '2026-09-10', missingDocs: 2,
    email: 'kevin.santos@gmail.com', phone: '+63 918 222 3344', experience: '2',
    coverLetter: 'Recent PRC board passer eager to start clinical practice in speech-language pathology.',
    checklist: [
      { label: 'PRC license', note: 'missing', done: false },
      { label: 'NBI clearance', note: 'missing', done: false },
      { label: 'Resume', note: 'uploaded', done: true },
      { label: 'References', note: 'not yet contacted', done: false },
    ],
  },
]

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
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
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
  if (applicants.length === 0) return null
  const reviewing = applicants.find((a) => a.id === reviewingId)
  const viewingApplicant = applicants.find((a) => a.id === viewingApplicantId)

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
                  <div className="os-ap-detail-sub">Applying as {reviewing.appliedFor.toLowerCase()} · {reviewing.branch} branch</div>
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
                <button type="button" className="os-ap-reject" onClick={() => { onReject(reviewing); setReviewingId(null) }}>Reject</button>
                <button type="button" className="os-ap-approve" onClick={() => { onApprove(reviewing); setReviewingId(null) }}>Approve and hire</button>
              </div>
            </div>
          )}
        </>
      )}

      {viewingApplicant && (
        <ApplicantModal
          applicant={viewingApplicant}
          onClose={() => setViewingApplicantId(null)}
          onApprove={(a) => { onApprove(a); setViewingApplicantId(null); setReviewingId(null) }}
          onReject={(a) => { onReject(a); setViewingApplicantId(null); setReviewingId(null) }}
        />
      )}
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
          <p className="os-ap-detail-sub">Applying as {applicant.appliedFor.toLowerCase()} · {applicant.branch} branch</p>
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
                return (
                  <div key={f.key} className="os-doc-card">
                    <div className="os-doc-icon" style={{ background: f.tint, color: f.color }}>{f.icon}</div>
                    <div className="os-doc-info">
                      <div className="os-doc-label">{f.label}</div>
                      <div className={`os-doc-hint ${doc ? 'uploaded' : ''}`}>
                        {doc ? `✓ ${doc.name}` : 'Not uploaded'}
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
const WIZARD_STEPS = ['Personal Information', 'Professional Information', 'Documents & Verification', 'Review & Invite']
const DOC_FIELDS = [
  { key: 'ptr', icon: <DocLicenseIcon />, tint: '#e6f5f2', color: '#159a72', label: 'Professional License (PTR)', desc: 'Upload a clear photo or scan of your valid PTR.' },
  { key: 'prc', icon: <DocMedalIcon />, tint: '#fdf2f8', color: '#db2777', label: 'PRC License', desc: 'Upload your Professional Regulation Commission license.' },
  { key: 'diploma', icon: <DocCapIcon />, tint: '#fffbeb', color: '#d97706', label: 'Diploma / Certificate', desc: 'Upload your diploma or certification.' },
  { key: 'id', icon: <DocIdIcon />, tint: '#eff6ff', color: '#3b82f6', label: 'Valid ID', desc: 'Upload a valid government-issued ID.' },
]

function DocUpload({ field, value, onChange }) {
  const inputRef = useRef(null)
  return (
    <div className="os-doc-card">
      <div className="os-doc-icon" style={{ background: field.tint, color: field.color }}>{field.icon}</div>
      <div className="os-doc-info">
        <div className="os-doc-label">{field.label} <span className="os-req">*</span></div>
        <div className="os-doc-desc">{field.desc}</div>
        <div className={`os-doc-hint ${value ? 'uploaded' : ''}`}>
          {value ? `✓ ${value.name}` : 'PDF, JPG, PNG (Max 5MB)'}
        </div>
      </div>
      <button type="button" className="os-doc-btn" onClick={() => inputRef.current?.click()}>
        <UploadIcon /> {value ? 'Replace' : 'Upload File'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </div>
  )
}

function DocsConfidentialNote() {
  return (
    <div className="os-doc-note">
      <ShieldIcon />
      <p>Your documents are securely stored and will only be used for verification purposes. All information will remain confidential.</p>
    </div>
  )
}

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
// instead of restricting to 25 years back.
function ExpiryDatePicker({ value, onChange }) {
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
            minDate={new Date()}
            defaultActiveStartDate={dateVal || new Date()}
          />
        </div>
      )}
    </div>
  )
}

// Same pattern again, but for a past-facing date (date hired) — opens on the
// month view and disallows future dates.
function HiredDatePicker({ value, onChange }) {
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
            defaultActiveStartDate={dateVal || new Date()}
          />
        </div>
      )}
    </div>
  )
}

function AddStaffModal({ onClose, onAdd, staffCount = 0 }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '', email: '', phoneCode: '+63', phone: '',
    dob: '', gender: '', address: '', emergencyContact: '', emergencyCode: '+63', emergencyPhone: '',
    specialty: null, branch: BRANCHES[0], status: STATUSES[0],
    employeeId: `EMP-${String(staffCount + 1).padStart(4, '0')}`,
    prcNumber: '', experience: '', employment: EMPLOYMENT_TYPES[0], licenseExpiry: '',
    position: '', hiredAt: '',
  })
  const [docs, setDocs] = useState({ ptr: null, prc: null, diploma: null, id: null })

  // The DB's `employees` collection needs a real branch_id (ObjectId), not the
  // demo branch names above, so this pulls the live list from the `branchs`
  // collection instead of reusing BRANCHES.
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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
  const setDoc = (key, val) => setDocs((d) => ({ ...d, [key]: val }))

  const selectBranch = (id) => {
    setBranchId(id)
    const b = branches.find((x) => x.id === id)
    set('branch', b ? b.branch_name : '')
  }

  const stepValid = [
    form.name.trim() && form.email.trim(),
    !!form.specialty && form.prcNumber.trim() && String(form.experience).trim() && !!form.licenseExpiry
      && form.position.trim() && !!form.hiredAt && !!branchId,
    true,
    true,
  ]

  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const nextLabel = submitting ? 'Saving…' : ['Next', 'Next', 'Next: Review', 'Send Invite'][step]

  const submit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const uploadedDocs = Object.fromEntries(
        Object.entries(docs).filter(([, file]) => file).map(([key, file]) => [key, file.name])
      )
      const data = await apiPost('/api/employees', {
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
        position: form.position.trim(),
        hiredAt: form.hiredAt,
        employeeId: form.employeeId,
        prcNumber: form.prcNumber,
        experience: form.experience,
        employment: form.employment,
        licenseExpiry: form.licenseExpiry,
        status: form.status,
        documents: uploadedDocs,
      })

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
        position: form.position,
        hiredAt: form.hiredAt,
        mongoEmployeeId: data.employee?._id,
        documents: Object.fromEntries(
          Object.entries(docs).filter(([, file]) => file).map(([key, file]) => [key, { name: file.name }])
        ),
      })
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
            <div key={label} className={`os-wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="os-wizard-step-num">{i < step ? '✓' : i + 1}</span>
              <span className="os-wizard-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="os-modal-body">
          {step === 0 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Personal Information</h4>
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
                  <label>Position / Job Title <span className="os-req">*</span></label>
                  <input placeholder="e.g. Senior Therapist" value={form.position} onChange={(e) => set('position', e.target.value)} />
                </div>
                <div className="os-form-group">
                  <label>Date Hired <span className="os-req">*</span></label>
                  <HiredDatePicker value={form.hiredAt} onChange={(v) => set('hiredAt', v)} />
                </div>
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
              <h4 className="os-wizard-section">Documents &amp; Verification</h4>
              <p className="os-wizard-section-sub">Upload the required documents for {form.name || 'this staff member'}.</p>
              {DOC_FIELDS.map((f) => (
                <DocUpload key={f.key} field={f} value={docs[f.key]} onChange={(v) => setDoc(f.key, v)} />
              ))}
              <DocsConfidentialNote />
            </div>
          )}

          {step === 3 && (
            <div className="os-wizard-single">
              <h4 className="os-wizard-section">Review &amp; Invite</h4>
              <div className="os-detail-grid">
                <div className="os-detail-row"><span className="os-detail-lbl">Full Name</span><span className="os-detail-val">{form.name || '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Email</span><span className="os-detail-val">{form.email || '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Phone</span><span className="os-detail-val">{form.phone ? `${form.phoneCode} ${form.phone}` : '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Specialty</span><span className="os-detail-val">{form.specialty || 'Unassigned'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Position</span><span className="os-detail-val">{form.position || '—'}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Date Hired</span><span className="os-detail-val">{formatDate(form.hiredAt)}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Branch</span><span className="os-detail-val">{form.branch}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Duty Status</span><span className="os-detail-val">{form.status}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Employment</span><span className="os-detail-val">{form.employment}</span></div>
                <div className="os-detail-row"><span className="os-detail-lbl">Documents</span><span className="os-detail-val">{Object.values(docs).filter(Boolean).length} / {DOC_FIELDS.length} uploaded</span></div>
              </div>
              <div className="os-doc-note">
                <ShieldIcon />
                <p>An invitation email will be sent to {form.email || 'the staff member'} to complete their account setup.</p>
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

/* ── Main Page ─────────────────────────────────────────────── */
export default function OwnerStaffPage({ user, onLogout, betaTier }) {
  const [staff, setStaff] = useState(INITIAL_STAFF)
  const [leaveRequests, setLeaveRequests] = useState(INITIAL_LEAVE_REQUESTS)
  const [applicants, setApplicants] = useState(INITIAL_APPLICANTS)
  const [activeTab, setActiveTab] = useState('list')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [toneFilter, setToneFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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

  const handleAdd = (form) => {
    const seed = Math.floor(Math.random() * 70) + 1
    const newId = Date.now()
    setStaff((prev) => [
      {
        id: newId, name: form.name, email: form.email, specialty: form.specialty || null, branch: form.branch, status: form.status,
        caseload: 0, avatar: `https://i.pravatar.cc/150?img=${seed}`,
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        archived: false, attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
        phone: form.phone, dob: form.dob, gender: form.gender, address: form.address,
        emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
        employeeId: form.employeeId, prcNumber: form.prcNumber, experience: form.experience,
        employment: form.employment, licenseExpiry: form.licenseExpiry, documents: form.documents,
        position: form.position, hiredAt: form.hiredAt, mongoEmployeeId: form.mongoEmployeeId,
      },
      ...prev,
    ])
    setShowAdd(false)
    logStaff('➕', `Added new staff member ${form.name} (${form.branch} branch)`, newId)
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

  const handleApproveApplicant = (applicant) => {
    const seed = Math.floor(Math.random() * 70) + 1
    const newId = Date.now()
    setStaff((prev) => [
      {
        id: newId, name: applicant.name, specialty: applicant.appliedFor, branch: applicant.branch, status: 'On Duty',
        caseload: 0, avatar: `https://i.pravatar.cc/150?img=${seed}`,
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        archived: false, attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
        employeeId: `EMP-${String(prev.length + 1).padStart(4, '0')}`,
        documents: {},
      },
      ...prev,
    ])
    setApplicants((prev) => prev.filter((a) => a.id !== applicant.id))
    logStaff('✅', `Approved and hired ${applicant.name} as ${applicant.appliedFor} (${applicant.branch} branch)`, newId)
  }

  const handleRejectApplicant = (applicant) => {
    setApplicants((prev) => prev.filter((a) => a.id !== applicant.id))
    logActivity({
      role: 'Owner',
      user: user?.name || 'Owner',
      email: user?.email || '—',
      actionIcon: '❌',
      action: 'Recruitment',
      description: `Rejected application from ${applicant.name} for ${applicant.appliedFor}`,
      entity: `Applicant ${applicant.id}`,
      status: 'Review',
    })
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
                  <th>Staff</th>
                  <th>Specialty</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Caseload</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={6}><p className="os-empty">No staff match your search.</p></td></tr>
                ) : pageRows.map((s) => {
                  return (
                    <tr key={s.id}>
                      <td data-label="Staff">
                        <div className="os-table-person">
                          <div className="os-avatar-wrap">
                            <img src={s.avatar} alt={s.name} className="os-avatar" />
                            <span className={`os-status-dot ${s.status === 'On Duty' ? 'os-dot-green' : 'os-dot-yellow'}`} />
                          </div>
                          <div>
                            <div className="os-table-name">{s.name}{s.archived && <span className="os-archived-pill">Archived</span>}</div>
                            <div className="os-table-joined"><CalendarSmallIcon /> Joined {s.joined}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Specialty"><SpecialtyBadge specialty={s.specialty} /></td>
                      <td data-label="Branch"><span className="os-branch-badge">{s.branch}</span></td>
                      <td data-label="Status"><span className={`os-pill ${s.status === 'On Duty' ? 'os-pill-green' : 'os-pill-yellow'}`}>{s.status}</span></td>
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

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onAdd={handleAdd} staffCount={staff.length} />}
      {viewing && <ViewModal staffMember={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditStaffModal staffMember={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </OwnerPageShell>
  )
}
