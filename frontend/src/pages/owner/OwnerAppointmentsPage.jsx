import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import './OwnerAppointmentsPage.css'

const BRANCHES = ['Main', 'North', 'Cebu']
const STATUSES = ['Confirmed', 'Pending', 'Completed', 'Cancelled']

const INITIAL_APPOINTMENTS = [
  { id: 1, patient: 'Juan Dela Cruz', avatar: 'https://i.pravatar.cc/150?img=33', therapist: 'Marco Reyes', service: 'Speech Therapy', branch: 'Main', date: 'Jul 6, 2026', time: '9:00 - 10:00 AM', status: 'Confirmed', bookedOn: 'Jun 28, 2026', notes: 'Follow-up session focused on articulation drills. Guardian to join for the last 10 minutes.' },
  { id: 2, patient: 'Mika Santos', avatar: 'https://i.pravatar.cc/150?img=45', therapist: 'Jade Tan', service: 'Physical Therapy', branch: 'North', date: 'Jul 6, 2026', time: '10:30 - 11:30 AM', status: 'Pending', bookedOn: 'Jul 3, 2026', notes: 'First-time booking, awaiting downpayment confirmation before the slot is locked in.' },
  { id: 3, patient: 'Aira Lopez', avatar: 'https://i.pravatar.cc/150?img=47', therapist: 'Andre Lim', service: 'Behavioral Therapy', branch: 'Cebu', date: 'Jul 6, 2026', time: '1:00 - 2:00 PM', status: 'Confirmed', bookedOn: 'Jun 25, 2026', notes: 'Continuing weekly behavior plan. Bring updated home-log sheet.' },
  { id: 4, patient: 'Noah Cruz', avatar: 'https://i.pravatar.cc/150?img=11', therapist: 'Carmen Dizon', service: 'Occupational Therapy', branch: 'Main', date: 'Jul 7, 2026', time: '9:00 - 10:00 AM', status: 'Pending', bookedOn: 'Jul 4, 2026', notes: 'Requested a schedule change from afternoon to morning slot.' },
  { id: 5, patient: 'Lily Santos', avatar: 'https://i.pravatar.cc/150?img=32', therapist: 'Jade Tan', service: 'Speech Therapy', branch: 'North', date: 'Jul 5, 2026', time: '2:00 - 3:00 PM', status: 'Completed', bookedOn: 'Jun 20, 2026', notes: 'Session completed. Vocabulary exercises went well, notes filed by therapist.' },
  { id: 6, patient: 'Jasper Reyes', avatar: 'https://i.pravatar.cc/150?img=14', therapist: 'Paolo Ramos', service: 'Physical Therapy', branch: 'North', date: 'Jul 5, 2026', time: '11:00 AM - 12:00 PM', status: 'Completed', bookedOn: 'Jun 18, 2026', notes: 'Gross motor coordination drills completed. Next session scheduled for next week.' },
  { id: 7, patient: 'Emma Villanueva', avatar: 'https://i.pravatar.cc/150?img=44', therapist: 'Andre Lim', service: 'Behavioral Therapy', branch: 'Cebu', date: 'Jul 4, 2026', time: '3:00 - 4:00 PM', status: 'Cancelled', bookedOn: 'Jun 15, 2026', notes: 'Cancelled by guardian due to a scheduling conflict. Rebooking requested for next week.' },
  { id: 8, patient: 'Carlos Mendez', avatar: 'https://i.pravatar.cc/150?img=13', therapist: 'Andre Lim', service: 'Occupational Therapy', branch: 'Cebu', date: 'Jul 7, 2026', time: '1:00 - 2:00 PM', status: 'Confirmed', bookedOn: 'Jul 1, 2026', notes: 'Adaptive skills session. Guardian highly engaged, bring updated home worksheet.' },
  { id: 9, patient: 'Isabella Park', avatar: 'https://i.pravatar.cc/150?img=48', therapist: 'Grace Uy', service: 'Cognitive Therapy', branch: 'Cebu', date: 'Jul 8, 2026', time: '10:00 - 11:00 AM', status: 'Pending', bookedOn: 'Jul 5, 2026', notes: 'Awaiting parent confirmation on the proposed time slot.' },
  { id: 10, patient: 'Maya Torres', avatar: 'https://i.pravatar.cc/150?img=46', therapist: 'Marco Reyes', service: 'Speech Therapy', branch: 'Main', date: 'Jul 3, 2026', time: '9:00 - 10:00 AM', status: 'Cancelled', bookedOn: 'Jun 10, 2026', notes: 'Clinic-initiated cancellation due to therapist unavailability. Guardian notified and refunded.' },
]

// ── Icons ──────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
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
function XCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
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
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function CancelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const STATUS_PILL = {
  Confirmed: 'oa-pill-green',
  Pending: 'oa-pill-yellow',
  Completed: 'oa-pill-gray',
  Cancelled: 'oa-pill-red',
}

/* ── View Appointment Modal ── */
function ViewModal({ appt, onClose }) {
  return (
    <div className="oa-modal-backdrop" onClick={onClose}>
      <div className="oa-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="oa-profile-hero">
          <button className="oa-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <img src={appt.avatar} alt={appt.patient} className="oa-profile-avatar" />
          <h2 className="oa-profile-name">{appt.patient}</h2>
          <p className="oa-profile-meta">{appt.service}</p>
          <span className={`oa-pill ${STATUS_PILL[appt.status]}`}>{appt.status}</span>
        </div>

        <div className="oa-profile-body">
          <h4 className="oa-section-title">Appointment Details</h4>
          <div className="oa-detail-grid">
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Therapist</span>
              <span className="oa-detail-val">{appt.therapist}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Branch</span>
              <span className="oa-detail-val">{appt.branch}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Date</span>
              <span className="oa-detail-val">{appt.date}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Time</span>
              <span className="oa-detail-val">{appt.time}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Booked On</span>
              <span className="oa-detail-val">{appt.bookedOn}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Status</span>
              <span className="oa-detail-val">{appt.status}</span>
            </div>
          </div>

          <h4 className="oa-section-title" style={{ marginTop: 20 }}>Notes</h4>
          <p className="oa-notes-box">{appt.notes}</p>
        </div>

        <div className="oa-modal-footer">
          <button className="oa-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function OwnerAppointmentsPage({ user, onLogout, betaTier }) {
  const [appointments, setAppointments] = useState(INITIAL_APPOINTMENTS)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [viewing, setViewing] = useState(null)

  const filtered = appointments.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch = a.patient.toLowerCase().includes(q) || a.therapist.toLowerCase().includes(q) || a.service.toLowerCase().includes(q)
    const matchBranch = branchFilter === 'All' || a.branch === branchFilter
    const matchStatus = statusFilter === 'All' || a.status === statusFilter
    return matchSearch && matchBranch && matchStatus
  })

  const counts = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === 'Confirmed').length,
    pending: appointments.filter((a) => a.status === 'Pending').length,
    cancelled: appointments.filter((a) => a.status === 'Cancelled').length,
  }

  const setStatus = (id, status) => {
    const appt = appointments.find((a) => a.id === id)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    if (appt) {
      logActivity({
        role: 'Owner',
        user: user?.name || 'Owner',
        email: user?.email || '—',
        actionIcon: status === 'Cancelled' ? '❌' : '✅',
        action: 'Appointment',
        description: `${status} appointment for ${appt.patient} with ${appt.therapist}`,
        entity: `Appointment #${id}`,
        status: status === 'Cancelled' ? 'Review' : 'Success',
      })
    }
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Monitor bookings and session flow across all branches"
      icon="🗓️"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      {/* KPI Cards */}
      <div className="oa-kpi-grid">
        <div className="oa-kpi-card teal">
          <div className="oa-kpi-icon"><CalendarIcon /></div>
          <div className="oa-kpi-value">{counts.total}</div>
          <div className="oa-kpi-label">Total Appointments</div>
        </div>
        <div className="oa-kpi-card green">
          <div className="oa-kpi-icon"><CheckCircleIcon /></div>
          <div className="oa-kpi-value">{counts.confirmed}</div>
          <div className="oa-kpi-label">Confirmed</div>
        </div>
        <div className="oa-kpi-card amber">
          <div className="oa-kpi-icon"><ClockIcon /></div>
          <div className="oa-kpi-value">{counts.pending}</div>
          <div className="oa-kpi-label">Pending</div>
        </div>
        <div className="oa-kpi-card red">
          <div className="oa-kpi-icon"><XCircleIcon /></div>
          <div className="oa-kpi-value">{counts.cancelled}</div>
          <div className="oa-kpi-label">Cancelled</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="oa-toolbar">
        <div className="oa-search-wrap">
          <svg className="oa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="oa-search"
            placeholder="Search by patient, therapist, or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="oa-branch-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="All">All Branches</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b} Branch</option>)}
        </select>
        <div className="oa-filter-tabs">
          {['All', ...STATUSES].map((s) => (
            <button key={s} className={`oa-filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments Table */}
      <section className="admin-table-card">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Therapist</th>
                <th>Service</th>
                <th>Branch</th>
                <th>Date &amp; Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><p className="oa-empty">No appointments match your search.</p></td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="oa-table-person">
                      <img src={a.avatar} alt={a.patient} className="oa-avatar" />
                      <div>
                        <div className="oa-table-name">{a.patient}</div>
                        <div className="oa-table-sub">Booked {a.bookedOn}</div>
                      </div>
                    </div>
                  </td>
                  <td>{a.therapist}</td>
                  <td><span className="oa-service-badge">{a.service}</span></td>
                  <td><span className="oa-branch-badge">{a.branch}</span></td>
                  <td>
                    <div className="oa-datetime">
                      <span className="oa-date">{a.date}</span>
                      <span className="oa-time">{a.time}</span>
                    </div>
                  </td>
                  <td><span className={`oa-pill ${STATUS_PILL[a.status]}`}>{a.status}</span></td>
                  <td>
                    <div className="oa-table-actions">
                      <button className="oa-icon-btn oa-icon-view" onClick={() => setViewing(a)} title="View" aria-label={`View ${a.patient}'s appointment`}>
                        <EyeIcon />
                      </button>
                      {a.status === 'Pending' && (
                        <button className="oa-icon-btn oa-icon-confirm" onClick={() => setStatus(a.id, 'Confirmed')} title="Confirm" aria-label={`Confirm ${a.patient}'s appointment`}>
                          <CheckIcon />
                        </button>
                      )}
                      {(a.status === 'Pending' || a.status === 'Confirmed') && (
                        <button className="oa-icon-btn oa-icon-cancel" onClick={() => setStatus(a.id, 'Cancelled')} title="Cancel" aria-label={`Cancel ${a.patient}'s appointment`}>
                          <CancelIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewing && <ViewModal appt={viewing} onClose={() => setViewing(null)} />}
    </OwnerPageShell>
  )
}
