import { useEffect, useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { authFetch } from '../../utils/session'
import './OwnerPatientsPage.css'

// Clinical status isn't tracked, so status reflects activity: a session in the last 60 days
// or one booked ahead (Active), no recent sessions (Inactive), or never booked (New).
const STATUS_CONFIG = {
  Active:   { cls: 'op-pill-green', dot: 'op-dot-green' },
  Inactive: { cls: 'op-pill-yellow', dot: 'op-dot-yellow' },
  New:      { cls: 'op-pill-green', dot: 'op-dot-green' },
}

const FILTERS = ['All', 'Active', 'Inactive', 'New']

const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
function fmtVisit(iso) {
  if (!iso) return '—'
  const days = Math.round((new Date(new Date().toDateString()) - new Date(`${iso}T00:00:00`)) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  return fmtDate(iso)
}
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

function Avatar({ patient, className, size }) {
  const [broken, setBroken] = useState(false)
  if (patient.avatar && !broken) return <img src={patient.avatar} alt={patient.name} className={className} onError={() => setBroken(true)} />
  return (
    <span className={className} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e8f5f0', color: '#2c4a3e', fontWeight: 800, fontSize: size * 0.36 }} role="img" aria-label={patient.name}>
      {initials(patient.name)}
    </span>
  )
}

function ProfileModal({ patient, onClose }) {
  const sc = STATUS_CONFIG[patient.status] || STATUS_CONFIG.Active
  return (
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="op-profile-hero">
          <button className="op-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <Avatar patient={patient} className="op-profile-avatar" size={88} />
          <h2 className="op-profile-name">{patient.name}</h2>
          <p className="op-profile-meta">{patient.age != null ? `Age ${patient.age}` : 'Age not recorded'}{patient.condition ? <> &nbsp;·&nbsp; {patient.condition}</> : null}</p>
          <span className={`op-pill ${sc.cls}`}>{patient.status}</span>
        </div>

        <div className="op-profile-body">
          <h4 className="op-section-title">Patient Details</h4>
          <div className="op-detail-grid">
            <div className="op-detail-row">
              <span className="op-detail-lbl">Branch</span>
              <span className="op-detail-val">{patient.branch || 'Unassigned'}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Assigned Therapist</span>
              <span className="op-detail-val">{patient.therapist || 'Not assigned'}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Guardian</span>
              <span className="op-detail-val">{patient.guardian || '—'}{patient.guardianRelationship ? ` (${patient.guardianRelationship})` : ''}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Contact</span>
              <span className="op-detail-val">{patient.contact || '—'}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Joined</span>
              <span className="op-detail-val">{fmtDate(patient.joined)}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Total Sessions</span>
              <span className="op-detail-val">{patient.sessions}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Last Visit</span>
              <span className="op-detail-val">{fmtVisit(patient.lastVisit)}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Next Session</span>
              <span className="op-detail-val">{fmtDate(patient.nextSession)}</span>
            </div>
          </div>

          <div className="op-detail-grid" style={{ marginTop: 12 }}>
            <div className="op-detail-row"><span className="op-detail-lbl">Email</span><span className="op-detail-val">{patient.email || '—'}</span></div>
            <div className="op-detail-row"><span className="op-detail-lbl">Address</span><span className="op-detail-val">{patient.address || '—'}</span></div>
          </div>
          <p className="op-notes-box" style={{ marginTop: 16 }}>Clinical notes are encrypted and only visible to the assigned therapist.</p>
        </div>

        <div className="op-modal-footer">
          <button className="op-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function OwnerPatientsPage({ user, onLogout, betaTier }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [branch, setBranch] = useState('All')
  const [profilePt, setProfilePt] = useState(null)
  const [patients, setPatients] = useState([])
  const [branchNames, setBranchNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    authFetch('/api/owner/patients')
      .then((d) => { setPatients(d.patients); setBranchNames(d.branches) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  const BRANCHES = useMemo(() => ['All', ...branchNames], [branchNames])

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q) || p.guardian.toLowerCase().includes(q)
    const matchFilter = filter === 'All' || p.status === filter
    const matchBranch = branch === 'All' || p.branch === branch
    return matchSearch && matchFilter && matchBranch
  })

  const counts = {
    total: patients.length,
    active: patients.filter((p) => p.status === 'Active').length,
    review: patients.filter((p) => p.status === 'Inactive').length,
    critical: patients.filter((p) => p.status === 'New').length,
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Patients"
      subtitle="Track patient activity across all branches"
      icon="🧒"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      {/* Stats Strip */}
      <div className="op-stats-strip">
        <div className="op-stat-item op-stat-total">
          <span className="op-stat-num">{counts.total}</span>
          <span className="op-stat-lbl">Total Patients</span>
        </div>
        <div className="op-stat-sep" />
        <div className="op-stat-item op-stat-active">
          <span className="op-stat-num">{counts.active}</span>
          <span className="op-stat-lbl">Active</span>
        </div>
        <div className="op-stat-sep" />
        <div className="op-stat-item op-stat-review">
          <span className="op-stat-num">{counts.review}</span>
          <span className="op-stat-lbl">Inactive</span>
        </div>
        <div className="op-stat-sep" />
        <div className="op-stat-item op-stat-active">
          <span className="op-stat-num">{counts.critical}</span>
          <span className="op-stat-lbl">New (no sessions)</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="op-toolbar">
        <div className="op-search-wrap">
          <svg className="op-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="op-search"
            placeholder="Search by name, condition or guardian…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="op-branch-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>
          ))}
        </select>
        <div className="op-filter-tabs">
          {FILTERS.map((f) => (
            <button key={f} className={`op-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Cards */}
      <div className="op-patients-grid">
        {loading ? (
          <p className="op-empty">Loading patients…</p>
        ) : error ? (
          <p className="op-empty">{error} <button type="button" className="op-action-btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={load}>Try again</button></p>
        ) : filtered.length === 0 ? (
          <p className="op-empty">{patients.length ? 'No patients match your search.' : 'No patients have been recorded yet.'}</p>
        ) : filtered.map((p) => {
          const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.Active
          return (
            <div key={p.id} className="op-patient-card">
              <div className="op-card-top">
                <div className="op-avatar-wrap">
                  <Avatar patient={p} className="op-avatar" size={54} />
                  <span className={`op-status-dot ${sc.dot}`} />
                </div>
                <div className="op-card-info">
                  <h3 className="op-patient-name">{p.name}</h3>
                  <span className="op-patient-age">{p.age != null ? `Age ${p.age}` : 'Age not recorded'}</span>
                </div>
                <span className={`op-pill ${sc.cls}`}>{p.status}</span>
              </div>

              <div className="op-badge-row">
                {p.condition && <span className="op-condition-badge">{p.condition}</span>}
                <span className="op-branch-badge">{p.branch || 'Unassigned'}</span>
              </div>
              <p className="op-therapist-line">Therapist: <strong>{p.therapist || 'Not assigned'}</strong></p>

              <div className="op-session-info">
                <div className="op-session-item">
                  <span className="op-session-lbl">Last Visit</span>
                  <span className="op-session-val">{fmtVisit(p.lastVisit)}</span>
                </div>
                <div className="op-session-item">
                  <span className="op-session-lbl">Next Session</span>
                  <span className="op-session-val">{fmtDate(p.nextSession)}</span>
                </div>
                <div className="op-session-item">
                  <span className="op-session-lbl">Sessions</span>
                  <span className="op-session-val">{p.sessions}</span>
                </div>
              </div>

              <button className="op-action-btn" onClick={() => setProfilePt(p)}>View Profile</button>
            </div>
          )
        })}
      </div>

      {profilePt && (
        <ProfileModal patient={profilePt} onClose={() => setProfilePt(null)} />
      )}
    </OwnerPageShell>
  )
}
