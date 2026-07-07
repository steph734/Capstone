import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import { loadAccessibilityPrefs, saveAccessibilityPrefs, applyAccessibilityPrefs } from '../utils/accessibilityPrefs'
import { logActivity } from '../utils/auditLog'
import './PageWithSidebar.css'
import './SettingsPage.css'

const humanize = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())

const SETTINGS_KEY = 'therapypro_settings'

const DEFAULT_SETTINGS = {
  notifications: {
    appointmentReminders: true,
    exerciseReminders: true,
    progressUpdates: true,
    messages: true,
  },
  privacy: {
    shareProgressWithFamily: true,
    showProfileToTherapists: true,
  },
  security: {
    loginAlerts: true,
  },
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
        privacy: { ...DEFAULT_SETTINGS.privacy, ...parsed.privacy },
        security: { ...DEFAULT_SETTINGS.security, ...parsed.security },
      }
    }
  } catch {
    // ignore malformed storage
  }
  return DEFAULT_SETTINGS
}

const TEXT_SIZES = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'extra-large', label: 'Extra Large' },
]

function BellIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}
function ShieldIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" /></svg>
}
function EyeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
}
function LockIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
}
function UserIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
}
function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-toggle-knob" />
    </button>
  )
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-desc">{description}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function SettingsSection({ icon, title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-icon">{icon}</div>
        <div>
          <h2 className="settings-section-title">{title}</h2>
          {description && <p className="settings-section-desc">{description}</p>}
        </div>
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  )
}

export default function SettingsPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [accessibility, setAccessibility] = useState(loadAccessibilityPrefs)
  const [toast, setToast] = useState('')

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const logSettingsChange = (actionIcon, action, description) => {
    logActivity({
      role: 'Patient',
      user: user?.name || 'Patient',
      email: user?.email || '—',
      actionIcon,
      action,
      description,
      entity: 'Settings',
      status: 'Success',
    })
  }

  const persistSettings = (next, changeLabel) => {
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    showToast('Saved')
    if (changeLabel) logSettingsChange('🔔', 'Settings', changeLabel)
  }

  const updateNotification = (key, value) => {
    persistSettings(
      { ...settings, notifications: { ...settings.notifications, [key]: value } },
      `${value ? 'Enabled' : 'Disabled'} ${humanize(key)} notification`
    )
  }
  const updatePrivacy = (key, value) => {
    persistSettings(
      { ...settings, privacy: { ...settings.privacy, [key]: value } },
      `${value ? 'Enabled' : 'Disabled'} ${humanize(key)} privacy setting`
    )
  }
  const updateSecurity = (key, value) => {
    persistSettings(
      { ...settings, security: { ...settings.security, [key]: value } },
      `${value ? 'Enabled' : 'Disabled'} ${humanize(key)}`
    )
  }

  const updateAccessibility = (patch) => {
    const next = { ...accessibility, ...patch }
    setAccessibility(next)
    saveAccessibilityPrefs(next)
    applyAccessibilityPrefs(next)
    showToast('Saved')
    const [key, value] = Object.entries(patch)[0] || []
    if (key) logSettingsChange('♿', 'Accessibility', `Updated ${humanize(key)} to ${value}`)
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    setPasswordError('')
    if (!passwordForm.current.trim()) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (passwordForm.next.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.')
      return
    }
    setPasswordForm({ current: '', next: '', confirm: '' })
    showToast('Password updated')
    logSettingsChange('🔑', 'Security', 'Changed account password')
  }

  return (
    <div className="page-with-sidebar">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
      />

      <main className="page-content">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)}>☰</button>

        <div className="page-header">
          <h1>Settings</h1>
          <p>Manage your account and preferences</p>
        </div>

        <div className="settings-container">
          <SettingsSection icon={<UserIcon />} title="My Account" description="Your name, photo, and personal info">
            <div className="settings-row">
              <div className="settings-row-text">
                <span className="settings-row-label">{user?.name || 'My Profile'}</span>
                <span className="settings-row-desc">Update your photo, name, and bio</span>
              </div>
              <button className="settings-link-btn" onClick={() => navigate('/patient/profile')}>View Profile</button>
            </div>
          </SettingsSection>

          <SettingsSection icon={<BellIcon />} title="Notifications" description="Choose what you want to be reminded about">
            <ToggleRow
              label="Appointment reminders"
              description="Get a reminder before your therapy sessions"
              checked={settings.notifications.appointmentReminders}
              onChange={(v) => updateNotification('appointmentReminders', v)}
            />
            <ToggleRow
              label="Daily exercise reminders"
              description="A gentle nudge to do your daily exercises"
              checked={settings.notifications.exerciseReminders}
              onChange={(v) => updateNotification('exerciseReminders', v)}
            />
            <ToggleRow
              label="Progress note updates"
              description="When your therapist adds a new note"
              checked={settings.notifications.progressUpdates}
              onChange={(v) => updateNotification('progressUpdates', v)}
            />
            <ToggleRow
              label="New messages"
              description="When someone sends you a message"
              checked={settings.notifications.messages}
              onChange={(v) => updateNotification('messages', v)}
            />
          </SettingsSection>

          <SettingsSection icon={<EyeIcon />} title="Privacy" description="Control who can see your information">
            <ToggleRow
              label="Share progress with family"
              description="Let your parent or guardian see your progress"
              checked={settings.privacy.shareProgressWithFamily}
              onChange={(v) => updatePrivacy('shareProgressWithFamily', v)}
            />
            <ToggleRow
              label="Show my profile to therapists"
              description="Therapists at TherapyPro can view your basic info"
              checked={settings.privacy.showProfileToTherapists}
              onChange={(v) => updatePrivacy('showProfileToTherapists', v)}
            />
          </SettingsSection>

          <SettingsSection icon={<ShieldIcon />} title="Accessibility" description="Make the app easier to see and use">
            <div className="settings-row settings-row-column">
              <div className="settings-row-text">
                <span className="settings-row-label">Text size</span>
                <span className="settings-row-desc">Make text and buttons bigger</span>
              </div>
              <div className="text-size-picker">
                {TEXT_SIZES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`text-size-option ${accessibility.textSize === opt.value ? 'selected' : ''}`}
                    onClick={() => updateAccessibility({ textSize: opt.value })}
                    aria-pressed={accessibility.textSize === opt.value}
                  >
                    <span style={{ fontSize: opt.value === 'normal' ? 14 : opt.value === 'large' ? 17 : 20 }}>Aa</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow
              label="Reduce motion"
              description="Turn off animations and transitions"
              checked={accessibility.reduceMotion}
              onChange={(v) => updateAccessibility({ reduceMotion: v })}
            />
            <ToggleRow
              label="High contrast"
              description="Make colors and borders stand out more"
              checked={accessibility.highContrast}
              onChange={(v) => updateAccessibility({ highContrast: v })}
            />
          </SettingsSection>

          <SettingsSection icon={<LockIcon />} title="Security" description="Keep your account safe">
            <ToggleRow
              label="Login alerts"
              description="Tell me if someone signs in from a new device"
              checked={settings.security.loginAlerts}
              onChange={(v) => updateSecurity('loginAlerts', v)}
            />

            <form className="password-form" onSubmit={handlePasswordSubmit}>
              <p className="password-form-title">Change Password</p>
              <div className="password-form-grid">
                <label className="password-field">
                  <span>Current password</span>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                  />
                </label>
                <label className="password-field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                  />
                </label>
                <label className="password-field">
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                  />
                </label>
              </div>
              {passwordError && <p className="password-form-error">{passwordError}</p>}
              <button type="submit" className="password-submit-btn">
                <CheckIcon /> Update Password
              </button>
            </form>
          </SettingsSection>
        </div>
      </main>

      {toast && <div className="settings-toast">{toast}</div>}
    </div>
  )
}
