import { useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import './OwnerPatientsPage.css'

const PATIENTS = [
  { id: 1, name: 'Aira Lopez', age: 8, condition: 'Speech Delay', status: 'Active', branch: 'Main', therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=47', lastVisit: 'Today', nextSession: 'Jul 9, 2026', sessions: 24, guardian: 'Maria Lopez', contact: '+63 912 345 6789', joined: 'Jan 15, 2026', notes: 'Responding well to structured articulation drills. Guardian reports steady progress at home.' },
  { id: 2, name: 'Noah Cruz', age: 10, condition: 'Developmental Delay', status: 'Needs Review', branch: 'Main', therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=11', lastVisit: 'Yesterday', nextSession: 'Jul 8, 2026', sessions: 18, guardian: 'Roberto Cruz', contact: '+63 920 876 5432', joined: 'Feb 10, 2026', notes: 'Progress has plateaued this month. Care team recommends a plan review at next check-in.' },
  { id: 3, name: 'Mika Santos', age: 6, condition: 'Articulation Disorder', status: 'Active', branch: 'Main', therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=45', lastVisit: '2 days ago', nextSession: 'Jul 10, 2026', sessions: 31, guardian: 'Ana Santos', contact: '+63 917 234 5678', joined: 'Nov 3, 2025', notes: 'Now forming 3–4 word sentences consistently. Continue current speech exercise plan.' },
  { id: 4, name: 'Lily Santos', age: 9, condition: 'Speech Delay', status: 'Active', branch: 'North', therapist: 'Jade Tan', avatar: 'https://i.pravatar.cc/150?img=32', lastVisit: 'Today', nextSession: 'Jul 9, 2026', sessions: 20, guardian: 'Carmen Santos', contact: '+63 918 222 4455', joined: 'Dec 1, 2025', notes: 'Vocabulary expanding well. Guardian engaged and reinforcing exercises at home.' },
  { id: 5, name: 'Jasper Reyes', age: 11, condition: 'Motor Delay', status: 'Active', branch: 'North', therapist: 'Jade Tan', avatar: 'https://i.pravatar.cc/150?img=14', lastVisit: 'Yesterday', nextSession: 'Jul 8, 2026', sessions: 28, guardian: 'Elena Reyes', contact: '+63 921 333 8899', joined: 'Oct 20, 2025', notes: 'Gross motor coordination improving steadily with weekly PT sessions.' },
  { id: 6, name: 'Sofia Reyes', age: 12, condition: 'Anxiety Disorder', status: 'Active', branch: 'North', therapist: 'Jade Tan', avatar: 'https://i.pravatar.cc/150?img=49', lastVisit: 'Jul 3, 2026', nextSession: 'Jul 10, 2026', sessions: 42, guardian: 'Carmen Reyes', contact: '+63 918 654 3210', joined: 'Sep 20, 2025', notes: 'Applying coping strategies independently at school. Beginning discharge planning.' },
  { id: 7, name: 'Emma Villanueva', age: 9, condition: 'PTSD', status: 'Critical', branch: 'Cebu', therapist: 'Andre Lim', avatar: 'https://i.pravatar.cc/150?img=44', lastVisit: 'Jun 25, 2026', nextSession: 'Jul 5, 2026', sessions: 15, guardian: 'Lisa Villanueva', contact: '+63 921 999 8877', joined: 'Mar 1, 2026', notes: 'Sleep disturbances continue. Care team escalated for supervision review this week.' },
  { id: 8, name: 'Carlos Mendez', age: 11, condition: 'Down Syndrome', status: 'Active', branch: 'Cebu', therapist: 'Andre Lim', avatar: 'https://i.pravatar.cc/150?img=13', lastVisit: 'Jul 2, 2026', nextSession: 'Jul 9, 2026', sessions: 28, guardian: 'Pedro Mendez', contact: '+63 916 444 5566', joined: 'Oct 12, 2025', notes: 'Adaptive skills and communication improving. Guardian highly engaged.' },
  { id: 9, name: 'Isabella Park', age: 5, condition: 'Selective Mutism', status: 'Active', branch: 'Cebu', therapist: 'Andre Lim', avatar: 'https://i.pravatar.cc/150?img=48', lastVisit: 'Jun 29, 2026', nextSession: 'Jul 6, 2026', sessions: 22, guardian: 'Jenny Park', contact: '+63 919 777 6655', joined: 'Jan 8, 2026', notes: 'Now speaking in full sentences with familiar adults. Generalizing to school setting.' },
  { id: 10, name: 'Maya Torres', age: 7, condition: 'Autism Spectrum Disorder', status: 'Critical', branch: 'Main', therapist: 'Marco Reyes', avatar: 'https://i.pravatar.cc/150?img=46', lastVisit: 'Jun 20, 2026', nextSession: 'Jul 5, 2026', sessions: 12, guardian: 'Rosa Torres', contact: '+63 922 555 4433', joined: 'Apr 14, 2026', notes: 'Regression observed over the past two weeks. Urgent review scheduled with care team.' },
  { id: 11, name: 'Liam Tan', age: 7, condition: 'Dyslexia', status: 'Active', branch: 'North', therapist: 'Jade Tan', avatar: 'https://i.pravatar.cc/150?img=15', lastVisit: 'Jun 30, 2026', nextSession: 'Jul 7, 2026', sessions: 20, guardian: 'Kevin Tan', contact: '+63 915 111 2233', joined: 'Dec 5, 2025', notes: 'Steady improvement in phonological awareness. School accommodations in place.' },
  { id: 12, name: 'Jake Rivera', age: 8, condition: 'ADHD', status: 'Needs Review', branch: 'Cebu', therapist: 'Andre Lim', avatar: 'https://i.pravatar.cc/150?img=12', lastVisit: 'Jul 1, 2026', nextSession: 'Jul 8, 2026', sessions: 19, guardian: 'Diana Rivera', contact: '+63 913 321 0987', joined: 'Feb 28, 2026', notes: 'Impulse control improving but organizational skills still need reinforcement.' },
]

const STATUS_CONFIG = {
  Active:         { cls: 'op-pill-green', dot: 'op-dot-green' },
  'Needs Review': { cls: 'op-pill-yellow', dot: 'op-dot-yellow' },
  Critical:       { cls: 'op-pill-red', dot: 'op-dot-red' },
}

const BRANCHES = ['All', 'Main', 'North', 'Cebu']
const FILTERS = ['All', 'Active', 'Needs Review', 'Critical']

function ProfileModal({ patient, onClose }) {
  const sc = STATUS_CONFIG[patient.status] || STATUS_CONFIG.Active
  return (
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="op-profile-hero">
          <button className="op-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <img src={patient.avatar} alt={patient.name} className="op-profile-avatar" />
          <h2 className="op-profile-name">{patient.name}</h2>
          <p className="op-profile-meta">Age {patient.age} &nbsp;·&nbsp; {patient.condition}</p>
          <span className={`op-pill ${sc.cls}`}>{patient.status}</span>
        </div>

        <div className="op-profile-body">
          <h4 className="op-section-title">Patient Details</h4>
          <div className="op-detail-grid">
            <div className="op-detail-row">
              <span className="op-detail-lbl">Branch</span>
              <span className="op-detail-val">{patient.branch}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Assigned Therapist</span>
              <span className="op-detail-val">{patient.therapist}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Guardian</span>
              <span className="op-detail-val">{patient.guardian}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Contact</span>
              <span className="op-detail-val">{patient.contact}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Joined</span>
              <span className="op-detail-val">{patient.joined}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Total Sessions</span>
              <span className="op-detail-val">{patient.sessions}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Last Visit</span>
              <span className="op-detail-val">{patient.lastVisit}</span>
            </div>
            <div className="op-detail-row">
              <span className="op-detail-lbl">Next Session</span>
              <span className="op-detail-val">{patient.nextSession}</span>
            </div>
          </div>

          <h4 className="op-section-title" style={{ marginTop: 20 }}>Clinical Notes</h4>
          <p className="op-notes-box">{patient.notes}</p>
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

  const filtered = PATIENTS.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q)
    const matchFilter = filter === 'All' || p.status === filter
    const matchBranch = branch === 'All' || p.branch === branch
    return matchSearch && matchFilter && matchBranch
  })

  const counts = {
    total: PATIENTS.length,
    active: PATIENTS.filter((p) => p.status === 'Active').length,
    review: PATIENTS.filter((p) => p.status === 'Needs Review').length,
    critical: PATIENTS.filter((p) => p.status === 'Critical').length,
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
          <span className="op-stat-lbl">Needs Review</span>
        </div>
        <div className="op-stat-sep" />
        <div className="op-stat-item op-stat-critical">
          <span className="op-stat-num">{counts.critical}</span>
          <span className="op-stat-lbl">Critical</span>
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
            placeholder="Search by name or condition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="op-branch-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>{b === 'All' ? 'All Branches' : `${b} Branch`}</option>
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
        {filtered.length === 0 ? (
          <p className="op-empty">No patients match your search.</p>
        ) : filtered.map((p) => {
          const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.Active
          return (
            <div key={p.id} className="op-patient-card">
              <div className="op-card-top">
                <div className="op-avatar-wrap">
                  <img src={p.avatar} alt={p.name} className="op-avatar" />
                  <span className={`op-status-dot ${sc.dot}`} />
                </div>
                <div className="op-card-info">
                  <h3 className="op-patient-name">{p.name}</h3>
                  <span className="op-patient-age">Age {p.age}</span>
                </div>
                <span className={`op-pill ${sc.cls}`}>{p.status}</span>
              </div>

              <div className="op-badge-row">
                <span className="op-condition-badge">{p.condition}</span>
                <span className="op-branch-badge">{p.branch}</span>
              </div>
              <p className="op-therapist-line">Therapist: <strong>{p.therapist}</strong></p>

              <div className="op-session-info">
                <div className="op-session-item">
                  <span className="op-session-lbl">Last Visit</span>
                  <span className="op-session-val">{p.lastVisit}</span>
                </div>
                <div className="op-session-item">
                  <span className="op-session-lbl">Next Session</span>
                  <span className="op-session-val">{p.nextSession}</span>
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
