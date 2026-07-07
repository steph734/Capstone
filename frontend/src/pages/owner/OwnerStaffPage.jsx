import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
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
const BRANCHES = ['Main', 'North', 'Cebu']
const STATUSES = ['On Duty', 'On Leave']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const INITIAL_STAFF = [
  { id: 1, name: 'Marco Reyes', specialty: 'Speech Therapist', branch: 'Main', status: 'On Duty', caseload: 24, avatar: 'https://i.pravatar.cc/150?img=8', joined: 'Jan 2025', archived: false, attendance: { present: 21, late: 1, absent: 1, week: ['present', 'present', 'present', 'late', 'present'] } },
  { id: 2, name: 'Jade Tan', specialty: 'Physical Therapist', branch: 'North', status: 'On Leave', caseload: 18, avatar: 'https://i.pravatar.cc/150?img=9', joined: 'Mar 2025', archived: false, attendance: { present: 17, late: 0, absent: 3, week: ['present', 'absent', 'absent', 'present', 'present'] } },
  { id: 3, name: 'Andre Lim', specialty: 'Behavior Therapist', branch: 'Cebu', status: 'On Duty', caseload: 15, avatar: 'https://i.pravatar.cc/150?img=52', joined: 'Jun 2025', archived: false, attendance: { present: 22, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] } },
  { id: 4, name: 'Carmen Dizon', specialty: 'Occupational Therapist', branch: 'Main', status: 'On Duty', caseload: 20, avatar: 'https://i.pravatar.cc/150?img=25', joined: 'Aug 2025', archived: false, attendance: { present: 20, late: 2, absent: 0, week: ['present', 'late', 'present', 'present', 'late'] } },
  { id: 5, name: 'Paolo Ramos', specialty: 'Developmental Therapist', branch: 'North', status: 'On Duty', caseload: 16, avatar: 'https://i.pravatar.cc/150?img=51', joined: 'Oct 2025', archived: false, attendance: { present: 19, late: 1, absent: 2, week: ['present', 'present', 'absent', 'present', 'present'] } },
  { id: 6, name: 'Grace Uy', specialty: 'Psychologist', branch: 'Cebu', status: 'On Duty', caseload: 12, avatar: 'https://i.pravatar.cc/150?img=28', joined: 'Nov 2025', archived: false, attendance: { present: 22, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] } },
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
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </svg>
  )
}
function CalendarCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8.5 15l1.8 1.8L15 13" />
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
function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" />
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

/* ── View Staff Modal ──────────────────────────────────────── */
function ViewModal({ staffMember, onClose }) {
  const rate = attendanceRate(staffMember.attendance)
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

        <div className="os-profile-body">
          <h4 className="os-section-title">Staff Details</h4>
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
          </div>

          <h4 className="os-section-title" style={{ marginTop: 20 }}>Attendance This Month</h4>
          <div className="os-attendance-summary">
            <div className="os-attendance-stat">
              <span className="os-attendance-stat-num">{rate}%</span>
              <span className="os-attendance-stat-lbl">Rate</span>
            </div>
            <div className="os-attendance-stat">
              <span className="os-attendance-stat-num">{staffMember.attendance.present}</span>
              <span className="os-attendance-stat-lbl">Present</span>
            </div>
            <div className="os-attendance-stat">
              <span className="os-attendance-stat-num">{staffMember.attendance.late}</span>
              <span className="os-attendance-stat-lbl">Late</span>
            </div>
            <div className="os-attendance-stat">
              <span className="os-attendance-stat-num">{staffMember.attendance.absent}</span>
              <span className="os-attendance-stat-lbl">Absent</span>
            </div>
          </div>

          <div className="os-day-dots-lg">
            {staffMember.attendance.week.map((status, i) => (
              <div key={i} className="os-day-col">
                <span className="os-day-col-lbl">{DAY_LABELS[i]}</span>
                <span className={`os-day-dot-lg ${status}`} />
              </div>
            ))}
          </div>
          <div className="os-attendance-legend">
            <span><span className="os-day-dot present" /> Present</span>
            <span><span className="os-day-dot late" /> Late</span>
            <span><span className="os-day-dot absent" /> Absent</span>
          </div>
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

/* ── Add Staff Modal ───────────────────────────────────────── */
function AddStaffModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [branch, setBranch] = useState(BRANCHES[0])
  const [status, setStatus] = useState(STATUSES[0])

  const canSave = name.trim().length > 0

  return (
    <div className="os-modal-backdrop" onClick={onClose}>
      <div className="os-modal" onClick={(e) => e.stopPropagation()}>
        <div className="os-modal-header">
          <div>
            <h3>Add Staff Member</h3>
            <p>New staff start unassigned — use "Edit" afterwards to give them a specialty</p>
          </div>
          <button className="os-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="os-modal-body">
          <div className="os-form-group">
            <label>Full Name</label>
            <input placeholder="e.g. Diana Cruz" value={name} onChange={(e) => setName(e.target.value)} />
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
            disabled={!canSave}
            onClick={() => canSave && onAdd({ name: name.trim(), branch, status })}
          >
            Add Staff
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function OwnerStaffPage({ user, onLogout, betaTier }) {
  const [staff, setStaff] = useState(INITIAL_STAFF)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)

  const activeStaff = staff.filter((s) => !s.archived)
  const archivedStaff = staff.filter((s) => s.archived)

  const pool = statusFilter === 'Archived' ? archivedStaff : activeStaff
  const filtered = pool.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch = s.name.toLowerCase().includes(q) || (s.specialty || '').toLowerCase().includes(q)
    const matchBranch = branchFilter === 'All' || s.branch === branchFilter
    const matchStatus = statusFilter === 'All' || statusFilter === 'Archived' || s.status === statusFilter
    return matchSearch && matchBranch && matchStatus
  })

  const avgAttendance = activeStaff.length
    ? Math.round(activeStaff.reduce((sum, s) => sum + attendanceRate(s.attendance), 0) / activeStaff.length)
    : 100

  const counts = {
    total: activeStaff.length,
    onDuty: activeStaff.filter((s) => s.status === 'On Duty').length,
    onLeave: activeStaff.filter((s) => s.status === 'On Leave').length,
    coverage: new Set(activeStaff.map((s) => s.specialty).filter(Boolean)).size,
  }

  const handleAdd = (form) => {
    const seed = Math.floor(Math.random() * 70) + 1
    setStaff((prev) => [
      {
        id: Date.now(), name: form.name, specialty: null, branch: form.branch, status: form.status,
        caseload: 0, avatar: `https://i.pravatar.cc/150?img=${seed}`,
        joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        archived: false, attendance: { present: 0, late: 0, absent: 0, week: ['present', 'present', 'present', 'present', 'present'] },
      },
      ...prev,
    ])
    setShowAdd(false)
  }

  const handleEditSave = (updates) => {
    setStaff((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...updates } : s)))
    setEditing(null)
  }

  const toggleArchive = (id) => {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, archived: !s.archived } : s)))
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Staff"
      subtitle="Manage therapist assignments, specialties, and attendance across branches"
      icon="👥"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      {/* KPI Cards */}
      <div className="os-kpi-grid">
        <div className="os-kpi-card teal">
          <div className="os-kpi-icon"><PeopleIcon /></div>
          <div className="os-kpi-value">{counts.total}</div>
          <div className="os-kpi-label">Total Staff</div>
        </div>
        <div className="os-kpi-card green">
          <div className="os-kpi-icon"><CheckCircleIcon /></div>
          <div className="os-kpi-value">{counts.onDuty}</div>
          <div className="os-kpi-label">On Duty</div>
        </div>
        <div className="os-kpi-card amber">
          <div className="os-kpi-icon"><ClockIcon /></div>
          <div className="os-kpi-value">{counts.onLeave}</div>
          <div className="os-kpi-label">On Leave</div>
        </div>
        <div className="os-kpi-card blue">
          <div className="os-kpi-icon"><AwardIcon /></div>
          <div className="os-kpi-value">{counts.coverage}</div>
          <div className="os-kpi-label">Specialties Covered</div>
        </div>
        <div className="os-kpi-card purple">
          <div className="os-kpi-icon"><CalendarCheckIcon /></div>
          <div className="os-kpi-value">{avgAttendance}%</div>
          <div className="os-kpi-label">Avg Attendance</div>
        </div>
      </div>

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
        <select className="os-branch-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="All">All Branches</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b} Branch</option>)}
        </select>
        <div className="os-filter-tabs">
          {['All', ...STATUSES, 'Archived'].map((s) => (
            <button key={s} className={`os-filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'Archived' ? `Archived (${archivedStaff.length})` : s}
            </button>
          ))}
        </div>
        <button className="os-add-btn" onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Staff
        </button>
      </div>

      {/* Staff Table */}
      <div className="admin-table-card">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Specialty</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Caseload</th>
                <th>Attendance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><p className="os-empty">No staff match your search.</p></td></tr>
              ) : filtered.map((s) => {
                const rate = attendanceRate(s.attendance)
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="os-table-person">
                        <div className="os-avatar-wrap">
                          <img src={s.avatar} alt={s.name} className="os-avatar" />
                          <span className={`os-status-dot ${s.status === 'On Duty' ? 'os-dot-green' : 'os-dot-yellow'}`} />
                        </div>
                        <div>
                          <div className="os-table-name">{s.name}{s.archived && <span className="os-archived-pill">Archived</span>}</div>
                          <div className="os-table-joined">Joined {s.joined}</div>
                        </div>
                      </div>
                    </td>
                    <td><SpecialtyBadge specialty={s.specialty} /></td>
                    <td><span className="os-branch-badge">{s.branch}</span></td>
                    <td><span className={`os-pill ${s.status === 'On Duty' ? 'os-pill-green' : 'os-pill-yellow'}`}>{s.status}</span></td>
                    <td>{s.caseload} patients</td>
                    <td>
                      <div className="os-attendance-cell">
                        <span className={`os-attendance-rate ${rateTone(rate)}`}>{rate}%</span>
                        <DayDots week={s.attendance.week} />
                      </div>
                    </td>
                    <td>
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
                          {s.archived ? <RestoreIcon /> : <ArchiveIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {viewing && <ViewModal staffMember={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <EditStaffModal staffMember={editing} onClose={() => setEditing(null)} onSave={handleEditSave} />
      )}
    </OwnerPageShell>
  )
}
