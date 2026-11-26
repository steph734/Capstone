import { useState, useEffect, useRef } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import { logActivity } from '../utils/auditLog'
import { loadMyProfile, saveMyProfile, photoToAvatar, readLocalProfile } from '../utils/myProfile'
import './therapist/TherapistProfilePage.css'
import './PageWithSidebar.css'
import './admin/AdminPages.css'

const DEFAULT_PROFILE = {
  name: 'Alvrin',
  title: 'Patient – Occupational Therapy',
  diagnosis: 'Anxiety Disorder',
  dateOfBirth: 'March 12, 2012',
  guardian: 'Self / Parent',
  email: 'patient@gmail.com',
  phone: '+63 912 000 0001',
  school: 'Makati Science High School',
  therapist: 'Dr. Sarah Reyes',
  joined: 'September 1, 2025',
  bio: '',
  avatar: 'https://i.pravatar.cc/150?img=33',
}

const AVATAR_OPTIONS = [
  'https://i.pravatar.cc/150?img=33',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=15',
  'https://i.pravatar.cc/150?img=8',
]

// This account's own details: what it saved before (this browser's copy of it), otherwise what the account itself
// says (name, email, photo). Never another account's profile.
function baseProfile(user) {
  const own = readLocalProfile(user?.email) || {}
  const photo = user?.avatar && user.avatar !== '/therapy-pro-logo.png' ? user.avatar : ''
  return { ...DEFAULT_PROFILE, name: user?.name || DEFAULT_PROFILE.name, email: user?.email || DEFAULT_PROFILE.email, ...(photo ? { avatar: photo } : {}), ...own }
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

export default function PatientProfilePage({ user, onLogout, betaTier, onUpdateUser }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profile, setProfile] = useState(() => baseProfile(user))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => { if (editing) { setDraft(profile); setSaveError('') } }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  // The saved profile comes from the server, so it is the same after a reload, a logout and on another device.
  useEffect(() => {
    let cancelled = false
    loadMyProfile(user?.email).then((saved) => { if (!cancelled && saved && !editing) setProfile({ ...baseProfile(user), ...saved }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  const handleSave = async () => {
    if (!String(draft.name || '').trim()) { setSaveError('Please enter your name.'); return }
    setSaving(true); setSaveError('')
    let saved
    try {
      saved = await saveMyProfile(user?.email, { ...draft, name: draft.name.trim() })
    } catch (err) {
      setSaving(false)
      setSaveError(err.fields ? Object.values(err.fields)[0] : err.message || 'Could not save your profile. Please try again.')
      return
    }
    setSaving(false)
    const next = { ...draft, ...saved }
    setProfile(next)
    // The sidebar and every other page read the signed-in user, so the new name and photo show up everywhere at once.
    onUpdateUser?.({ name: next.name, avatar: next.avatar })
    setEditing(false)
    setToast('Profile saved successfully!')
    setTimeout(() => setToast(''), 2800)
    logActivity({
      role: 'Patient',
      user: user?.name || draft.name,
      email: user?.email || draft.email,
      actionIcon: '👤',
      action: 'Profile',
      description: `Updated profile information for ${draft.name}`,
      entity: `Patient · ${draft.name}`,
      status: 'Success',
    })
  }

  const set = (field, val) => setDraft(prev => ({ ...prev, [field]: val }))
  const cycleAvatar = () => {
    const idx = AVATAR_OPTIONS.indexOf(draft.avatar)
    set('avatar', AVATAR_OPTIONS[(idx + 1) % AVATAR_OPTIONS.length])
  }
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { set('avatar', await photoToAvatar(file)); setSaveError('') } catch (err) { setSaveError(err.message) }
  }

  const iconProps = { editing, draft, onChange: set }

  return (
    <div className="page-with-sidebar admin-page-shell">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <main className="page-content admin-page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="page-header admin-page-header">
          <div>
            <h1>My Profile</h1>
            <p>View and update your personal information</p>
          </div>
        </div>

        <div className="content-container admin-content-container">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div className="trp-header">
              <h1 className="trp-title">My Profile</h1>
              <div className="trp-header-actions">
                {editing ? (
                  <>
                    <button className="trp-cancel-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                    <button className="trp-save-btn" onClick={handleSave} disabled={saving}><SaveIcon /> {saving ? 'Saving…' : 'Save Changes'}</button>
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
                {editing && <button className="trp-avatar-edit-btn" onClick={() => fileRef.current?.click()} aria-label="Upload a photo" title="Upload a photo"><CameraIcon /></button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} style={{ display: 'none' }} />
                {editing && <button type="button" onClick={cycleAvatar} style={{ marginTop: 8, background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', fontSize: 12, cursor: 'pointer' }}>Use a sample photo</button>}
              </div>
              <div className="trp-hero-body">
                {editing
                  ? <input className="trp-name-field" value={draft.name} onChange={e => set('name', e.target.value)} />
                  : <h2 className="trp-hero-name">{profile.name}</h2>}
                <p className="trp-hero-title">{profile.title}</p>
                <div className="trp-hero-badges">
                  <span className="trp-badge trp-badge-teal">{profile.diagnosis}</span>
                  <span className="trp-badge trp-badge-green">Active Patient</span>
                </div>
                <div className="trp-hero-stats">
                  <div className="trp-hero-stat"><span className="trp-hero-stat-num">36</span><span className="trp-hero-stat-lbl">Sessions Done</span></div>
                  <div className="trp-hero-stat"><span className="trp-hero-stat-num">85%</span><span className="trp-hero-stat-lbl">Progress</span></div>
                  <div className="trp-hero-stat"><span className="trp-hero-stat-num">Jul 10</span><span className="trp-hero-stat-lbl">Next Session</span></div>
                </div>
              </div>
            </div>

            {/* Stats strip */}
            <div className="trp-stats-strip">
              {[
                { icon: '🗓️', num: '36', lbl: 'Sessions Done', cls: 'trp-stat-teal' },
                { icon: '✅', num: '128', lbl: 'Exercises Done', cls: 'trp-stat-blue' },
                { icon: '📈', num: '85%', lbl: 'Progress Score', cls: 'trp-stat-purple' },
                { icon: '⭐', num: '4.9', lbl: 'Therapist Rating', cls: 'trp-stat-amber' },
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
                <h3 className="trp-card-title">Personal Information</h3>
                <div className="trp-field-list">
                  <Field label="Full Name" value={profile.name} field="name" icon="👤" {...iconProps} />
                  <Field label="Email Address" value={profile.email} field="email" icon="✉️" {...iconProps} />
                  <Field label="Phone Number" value={profile.phone} field="phone" icon="📞" {...iconProps} />
                  <Field label="Date of Birth" value={profile.dateOfBirth} field="dateOfBirth" icon="🎂" {...iconProps} />
                  <Field label="School / Institution" value={profile.school} field="school" icon="🏫" {...iconProps} />
                  <Field label="Guardian" value={profile.guardian} field="guardian" icon="👨‍👩‍👦" {...iconProps} />
                </div>
              </div>

              <div className="trp-card">
                <h3 className="trp-card-title">Medical Information</h3>
                <div className="trp-field-list">
                  <Field label="Diagnosis" value={profile.diagnosis} field="diagnosis" icon="🩺" {...iconProps} />
                  <Field label="Assigned Therapist" value={profile.therapist} field="therapist" icon="👩‍⚕️" {...iconProps} />
                  <Field label="Member Since" value={profile.joined} field="joined" icon="📅" {...iconProps} />
                  <div className="trp-field-row" style={{ alignItems: 'flex-start', paddingTop: '14px' }}>
                    <div className="trp-field-icon" style={{ marginTop: '2px' }}>📝</div>
                    <div className="trp-field-body">
                      <span className="trp-field-lbl">About Me</span>
                      {editing
                        ? <textarea className="trp-bio-field" value={draft.bio} onChange={e => set('bio', e.target.value)} rows={5} />
                        : <p className="trp-bio-text">{profile.bio || 'Add a short note about yourself.'}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {saveError && editing && <div className="trp-toast" role="alert" style={{ background: '#b4233c' }}>{saveError}</div>}
      {toast && <div className="trp-toast">{toast}</div>}
    </div>
  )
}
