import { useState, useEffect } from 'react'
import AdminPageShell from './AdminPageShell'
import '../therapist/TherapistProfilePage.css'

const STORAGE_KEY = 'admin_profile'

const DEFAULT_PROFILE = {
  name: 'Super Admin',
  title: 'System Administrator',
  department: 'IT & Operations',
  accessLevel: 'Full System Access',
  email: 'superadmin@therapypro.com',
  phone: '+63 917 000 9999',
  location: 'TherapyPro HQ, Makati City',
  bio: 'Responsible for managing the entire TherapyPro platform, overseeing branch operations, user management, system configurations, and ensuring platform-wide security and compliance.',
  avatar: 'https://i.pravatar.cc/150?img=68',
}

const AVATAR_OPTIONS = [
  'https://i.pravatar.cc/150?img=68',
  'https://i.pravatar.cc/150?img=65',
  'https://i.pravatar.cc/150?img=70',
  'https://i.pravatar.cc/150?img=67',
]

function loadProfile(user) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_PROFILE, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULT_PROFILE, name: user?.name || DEFAULT_PROFILE.name }
}

function EditIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
}
function SaveIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
}
function CameraIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
}

function Field({ icon, label, value, editing, field, draft, onChange }) {
  return (
    <div className="trp-field-row">
      <div className="trp-field-icon">{icon}</div>
      <div className="trp-field-body">
        <span className="trp-field-lbl">{label}</span>
        {editing
          ? <input className="trp-field-input" value={draft[field]} onChange={e => onChange(field, e.target.value)} />
          : <span className="trp-field-val">{value}</span>}
      </div>
    </div>
  )
}

export default function AdminProfilePage({ user, onLogout, menuItems }) {
  const [profile, setProfile] = useState(() => loadProfile(user))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [toast, setToast] = useState(false)

  useEffect(() => { if (editing) setDraft(profile) }, [editing])

  const handleSave = () => {
    setProfile(draft)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setEditing(false)
    setToast(true)
    setTimeout(() => setToast(false), 2800)
  }

  const set = (field, val) => setDraft(prev => ({ ...prev, [field]: val }))
  const cycleAvatar = () => {
    const idx = AVATAR_OPTIONS.indexOf(draft.avatar)
    set('avatar', AVATAR_OPTIONS[(idx + 1) % AVATAR_OPTIONS.length])
  }

  const iconProps = { editing, draft, onChange: set }

  return (
    <AdminPageShell user={user} onLogout={onLogout} title="My Profile" subtitle="View and manage your administrator profile" icon="👤" menuItems={menuItems}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header */}
        <div className="trp-header">
          <h1 className="trp-title">My Profile</h1>
          <div className="trp-header-actions">
            {editing ? (
              <>
                <button className="trp-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
                <button className="trp-save-btn" onClick={handleSave}><SaveIcon /> Save Changes</button>
              </>
            ) : (
              <button className="trp-edit-btn" onClick={() => setEditing(true)}><EditIcon /> Edit Profile</button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="trp-hero">
          <div className="trp-avatar-wrap">
            <img className="trp-avatar" src={editing ? draft.avatar : profile.avatar} alt={profile.name} />
            {editing && <button className="trp-avatar-edit-btn" onClick={cycleAvatar}><CameraIcon /></button>}
          </div>
          <div className="trp-hero-body">
            {editing
              ? <input className="trp-name-field" value={draft.name} onChange={e => set('name', e.target.value)} />
              : <h2 className="trp-hero-name">{profile.name}</h2>}
            <p className="trp-hero-title">{profile.title}</p>
            <div className="trp-hero-badges">
              <span className="trp-badge trp-badge-teal">{profile.department}</span>
              <span className="trp-badge trp-badge-gold">{profile.accessLevel}</span>
              <span className="trp-badge trp-badge-green">Active</span>
            </div>
            <div className="trp-hero-stats">
              <div className="trp-hero-stat"><span className="trp-hero-stat-num">12</span><span className="trp-hero-stat-lbl">Branches</span></div>
              <div className="trp-hero-stat"><span className="trp-hero-stat-num">234</span><span className="trp-hero-stat-lbl">Active Licenses</span></div>
              <div className="trp-hero-stat"><span className="trp-hero-stat-num">99.9%</span><span className="trp-hero-stat-lbl">Uptime</span></div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="trp-stats-strip">
          {[
            { icon: '🏢', num: '12', lbl: 'Branches', cls: 'trp-stat-teal' },
            { icon: '👥', num: '234', lbl: 'Active Licenses', cls: 'trp-stat-blue' },
            { icon: '📋', num: '1,248', lbl: 'Audit Logs', cls: 'trp-stat-purple' },
            { icon: '✅', num: '99.9%', lbl: 'System Uptime', cls: 'trp-stat-amber' },
          ].map(s => (
            <div key={s.lbl} className="trp-stat-card">
              <div className={`trp-stat-icon ${s.cls}`} style={{ fontSize: '20px' }}>{s.icon}</div>
              <span className="trp-stat-num">{s.num}</span>
              <span className="trp-stat-lbl">{s.lbl}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="trp-grid">
          <div className="trp-card">
            <h3 className="trp-card-title">Contact Information</h3>
            <div className="trp-field-list">
              <Field label="Full Name" value={profile.name} field="name" icon="👤" {...iconProps} />
              <Field label="Email Address" value={profile.email} field="email" icon="✉️" {...iconProps} />
              <Field label="Phone Number" value={profile.phone} field="phone" icon="📞" {...iconProps} />
              <Field label="Office Location" value={profile.location} field="location" icon="🏢" {...iconProps} />
            </div>
          </div>

          <div className="trp-card">
            <h3 className="trp-card-title">Admin Details</h3>
            <div className="trp-field-list">
              <Field label="Department" value={profile.department} field="department" icon="🗂️" {...iconProps} />
              <Field label="Access Level" value={profile.accessLevel} field="accessLevel" icon="🔐" {...iconProps} />
              <div className="trp-field-row" style={{ alignItems: 'flex-start', paddingTop: '14px' }}>
                <div className="trp-field-icon" style={{ marginTop: '2px' }}>📝</div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Bio / Notes</span>
                  {editing
                    ? <textarea className="trp-bio-field" value={draft.bio} onChange={e => set('bio', e.target.value)} rows={5} />
                    : <p className="trp-bio-text">{profile.bio}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {toast && <div className="trp-toast">Profile saved successfully!</div>}
    </AdminPageShell>
  )
}
