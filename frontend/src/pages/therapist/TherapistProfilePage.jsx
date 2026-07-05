import { useState, useEffect } from 'react'
import TherapistPageShell from './TherapistPageShell'
import './TherapistProfilePage.css'

const STORAGE_KEY = 'therapist_profile'

const DEFAULT_PROFILE = {
  name: 'Dr. Sarah Reyes',
  title: 'Licensed Occupational Therapist',
  specialization: 'Pediatric Occupational Therapy',
  license: 'OT-PH-2019-00123',
  email: 'sarah.reyes@therapypro.com',
  phone: '+63 917 123 4567',
  clinic: 'TherapyPro Clinic, Makati City',
  availability: 'Mon – Fri, 8:00 AM – 5:00 PM',
  bio: 'Licensed Occupational Therapist with over 7 years of experience specializing in pediatric therapy. Passionate about helping children with developmental disorders reach their full potential through evidence-based interventions and compassionate care.',
  avatar: 'https://i.pravatar.cc/150?img=47',
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULT_PROFILE, ...JSON.parse(saved) }
  } catch {}
  return DEFAULT_PROFILE
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  )
}

function MedkitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.34C18 2.54 15.46 0 12.33 0c-1.7 0-3.21.9-4.33 2.17C6.88.9 5.37 0 3.67 0 .54 0-2 2.54-2 5.67c0 .46.11.9.18 1.33H-2c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h22c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM8 18H6v-2H4v-2h2v-2h2v2h2v2H8v2zm5-2c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h4c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-4z"/>
    </svg>
  )
}

function LicenseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  )
}

function ClinicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L2 12h3v9h14v-9h3L12 3zm1 14h-2v-4h2v4zm0-6h-2V9h2v2z"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  )
}

export default function TherapistProfilePage({ user, onLogout, menuItems }) {
  const [profile, setProfile] = useState(loadProfile)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (editing) setDraft(profile)
  }, [editing])

  const handleSave = () => {
    setProfile(draft)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setEditing(false)
    setToast(true)
    setTimeout(() => setToast(false), 2800)
  }

  const handleCancel = () => {
    setDraft(profile)
    setEditing(false)
  }

  const set = (field) => (e) => setDraft(prev => ({ ...prev, [field]: e.target.value }))

  const AVATAR_OPTIONS = [
    'https://i.pravatar.cc/150?img=47',
    'https://i.pravatar.cc/150?img=48',
    'https://i.pravatar.cc/150?img=44',
    'https://i.pravatar.cc/150?img=49',
  ]

  const cycleAvatar = () => {
    const idx = AVATAR_OPTIONS.indexOf(draft.avatar)
    const next = AVATAR_OPTIONS[(idx + 1) % AVATAR_OPTIONS.length]
    setDraft(prev => ({ ...prev, avatar: next }))
  }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="My Profile"
      subtitle="View and edit your professional profile"
      icon="👤"
      menuItems={menuItems}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header */}
        <div className="trp-header">
          <h1 className="trp-title">My Profile</h1>
          <div className="trp-header-actions">
            {editing ? (
              <>
                <button className="trp-cancel-btn" onClick={handleCancel}>Cancel</button>
                <button className="trp-save-btn" onClick={handleSave}>
                  <SaveIcon /> Save Changes
                </button>
              </>
            ) : (
              <button className="trp-edit-btn" onClick={() => setEditing(true)}>
                <EditIcon /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="trp-hero">
          <div className="trp-avatar-wrap">
            <img
              className="trp-avatar"
              src={editing ? draft.avatar : profile.avatar}
              alt={profile.name}
            />
            {editing && (
              <button className="trp-avatar-edit-btn" onClick={cycleAvatar} title="Change photo">
                <CameraIcon />
              </button>
            )}
          </div>

          <div className="trp-hero-body">
            {editing ? (
              <input
                className="trp-name-field"
                value={draft.name}
                onChange={set('name')}
                placeholder="Full name"
              />
            ) : (
              <h2 className="trp-hero-name">{profile.name}</h2>
            )}
            <p className="trp-hero-title">{profile.title}</p>

            <div className="trp-hero-badges">
              <span className="trp-badge trp-badge-teal">{profile.specialization}</span>
              <span className="trp-badge trp-badge-gold">
                <StarIcon /> 4.9 Rating
              </span>
              <span className="trp-badge trp-badge-green">Active</span>
            </div>

            <div className="trp-hero-stats">
              <div className="trp-hero-stat">
                <span className="trp-hero-stat-num">11</span>
                <span className="trp-hero-stat-lbl">Patients</span>
              </div>
              <div className="trp-hero-stat">
                <span className="trp-hero-stat-num">42</span>
                <span className="trp-hero-stat-lbl">Sessions / Mo</span>
              </div>
              <div className="trp-hero-stat">
                <span className="trp-hero-stat-num">7</span>
                <span className="trp-hero-stat-lbl">Years Exp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="trp-stats-strip">
          <div className="trp-stat-card">
            <div className="trp-stat-icon trp-stat-teal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <span className="trp-stat-num">11</span>
            <span className="trp-stat-lbl">Total Patients</span>
          </div>

          <div className="trp-stat-card">
            <div className="trp-stat-icon trp-stat-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
            </div>
            <span className="trp-stat-num">42</span>
            <span className="trp-stat-lbl">Sessions / Month</span>
          </div>

          <div className="trp-stat-card">
            <div className="trp-stat-icon trp-stat-purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
              </svg>
            </div>
            <span className="trp-stat-num">7</span>
            <span className="trp-stat-lbl">Years Experience</span>
          </div>

          <div className="trp-stat-card">
            <div className="trp-stat-icon trp-stat-amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </div>
            <span className="trp-stat-num">4.9</span>
            <span className="trp-stat-lbl">Avg Rating</span>
          </div>
        </div>

        {/* Two-column info grid */}
        <div className="trp-grid">

          {/* Personal Information */}
          <div className="trp-card">
            <h3 className="trp-card-title">Contact Information</h3>
            <div className="trp-field-list">

              <div className="trp-field-row">
                <div className="trp-field-icon"><PersonIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Full Name</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.name} onChange={set('name')} />
                  ) : (
                    <span className="trp-field-val">{profile.name}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row">
                <div className="trp-field-icon"><EmailIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Email Address</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.email} onChange={set('email')} type="email" />
                  ) : (
                    <span className="trp-field-val">{profile.email}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row">
                <div className="trp-field-icon"><PhoneIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Phone Number</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.phone} onChange={set('phone')} />
                  ) : (
                    <span className="trp-field-val">{profile.phone}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row">
                <div className="trp-field-icon"><ClinicIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Clinic / Location</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.clinic} onChange={set('clinic')} />
                  ) : (
                    <span className="trp-field-val">{profile.clinic}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row">
                <div className="trp-field-icon"><ClockIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Availability</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.availability} onChange={set('availability')} />
                  ) : (
                    <span className="trp-field-val">{profile.availability}</span>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Professional Information */}
          <div className="trp-card">
            <h3 className="trp-card-title">Professional Information</h3>
            <div className="trp-field-list">

              <div className="trp-field-row">
                <div className="trp-field-icon"><MedkitIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Specialization</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.specialization} onChange={set('specialization')} />
                  ) : (
                    <span className="trp-field-val">{profile.specialization}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row">
                <div className="trp-field-icon"><LicenseIcon /></div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">License Number</span>
                  {editing ? (
                    <input className="trp-field-input" value={draft.license} onChange={set('license')} />
                  ) : (
                    <span className="trp-field-val">{profile.license}</span>
                  )}
                </div>
              </div>

              <div className="trp-field-row" style={{ alignItems: 'flex-start', paddingTop: '14px' }}>
                <div className="trp-field-icon" style={{ marginTop: '2px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
                  </svg>
                </div>
                <div className="trp-field-body">
                  <span className="trp-field-lbl">Professional Bio</span>
                  {editing ? (
                    <textarea
                      className="trp-bio-field"
                      value={draft.bio}
                      onChange={set('bio')}
                      rows={5}
                    />
                  ) : (
                    <p className="trp-bio-text">{profile.bio}</p>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      {toast && (
        <div className="trp-toast">Profile saved successfully!</div>
      )}
    </TherapistPageShell>
  )
}
