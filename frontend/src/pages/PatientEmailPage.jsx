import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'
import './PatientEmailPage.css'

// ── Mock emails from therapist ─────────────────────────────────────────────────
const MOCK_EMAILS = [
  {
    id: 1, from: 'Dr. Sarah Reyes', email: 'therapist@therapypro.com',
    subject: 'Session notes from yesterday',
    preview: 'Hi! I wanted to follow up on our session yesterday. You did great with the breathing exercises...',
    body: `Hi Alvrin,\n\nI wanted to follow up on our session yesterday. You did great with the breathing exercises and I could see real progress with your motor skills.\n\nFor this week, please try to practice the exercises we discussed for at least 10 minutes a day. Remember to take breaks if you feel tired.\n\nFeel free to reach out if you have any questions or concerns.\n\nWarm regards,\nDr. Sarah Reyes\nTherapyPro Clinic`,
    time: '9:04 AM', date: 'Jul 2', read: false, starred: false,
  },
  {
    id: 2, from: 'Dr. Sarah Reyes', email: 'therapist@therapypro.com',
    subject: 'Appointment reminder — Thursday 2PM',
    preview: 'Just a friendly reminder that your next session is on Thursday, July 4 at 2:00 PM...',
    body: `Hi Alvrin,\n\nJust a friendly reminder that your next session is scheduled for:\n\n📅 Thursday, July 4, 2026\n⏰ 2:00 PM\n📍 TherapyPro Clinic, Room 3\n\nPlease let me know if you need to reschedule.\n\nSee you soon!\n\nDr. Sarah Reyes`,
    time: '7:20 AM', date: 'Jul 2', read: false, starred: true,
  },
  {
    id: 3, from: 'TherapyPro Clinic', email: 'noreply@therapypro.com',
    subject: 'Your weekly progress report is ready',
    preview: 'Great news! Your weekly therapy progress report for the week of June 30 is now available...',
    body: `Hi Alvrin,\n\nYour weekly therapy progress report for June 30 – July 4 is now available.\n\n📊 Progress Summary:\n• Speech exercises: 5/5 sessions completed ✅\n• Motor skills: Improving steadily 📈\n• Mood: Positive trend 😊\n\nKeep up the fantastic work! Consistency is key to your recovery.\n\nThe TherapyPro Team`,
    time: 'Jun 30', date: 'Jun 30', read: true, starred: false,
  },
  {
    id: 4, from: 'Dr. Sarah Reyes', email: 'therapist@therapypro.com',
    subject: 'Re: Question about the homework exercises',
    preview: 'Thank you for asking, Alvrin! Those exercises are meant to be done in a seated position...',
    body: `Hi Alvrin,\n\nThank you for asking! Those exercises are meant to be done in a seated position with your back straight.\n\nFor the hand exercises:\n1. Open and close your hand slowly 10 times\n2. Rotate your wrist clockwise 5 times, then counter-clockwise 5 times\n3. Rest for 1 minute, then repeat\n\nIf you feel any pain, stop immediately and let me know.\n\nYou're doing amazing — keep it up! 💪\n\nDr. Sarah Reyes`,
    time: 'Jun 28', date: 'Jun 28', read: true, starred: false,
  },
  {
    id: 5, from: 'TherapyPro Clinic', email: 'noreply@therapypro.com',
    subject: 'Welcome to TherapyPro Patient Portal',
    preview: 'Welcome aboard! We\'re so glad to have you as part of the TherapyPro family...',
    body: `Hi Alvrin,\n\nWelcome aboard! We're so glad to have you as part of the TherapyPro family. 🎉\n\nYour patient portal gives you access to:\n✅ Appointment scheduling\n✅ Session notes\n✅ Exercise library\n✅ Direct messaging with your therapist\n\nIf you have any questions, don't hesitate to reach out.\n\nThe TherapyPro Team`,
    time: 'Jun 20', date: 'Jun 20', read: true, starred: false,
  },
]

const FOLDERS = [
  { id: 'inbox',   label: 'Inbox',   icon: '📥', count: 2 },
  { id: 'starred', label: 'Starred', icon: '⭐', count: 0 },
  { id: 'sent',    label: 'Sent',    icon: '📤', count: 0 },
  { id: 'drafts',  label: 'Drafts',  icon: '📝', count: 0 },
]

// ── Icons ──────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
}
function StarIcon({ filled }) {
  return filled
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#f4b400"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.35"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zm-10 6.43l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.32 4.38.38-3.32 2.88 1 4.28L12 15.67z"/></svg>
}
function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
}
function TrashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
}
function PencilIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 1.42H5v-.71l9.06-9.06.71.71-9.06 9.06H5.92zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
}
function CloseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
}
function SendIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
}
function MinimizeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
}
function OpenInFullIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
}
function ChevronDownIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
}
function FormatTextIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/></svg>
}
function AttachIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6h-1.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
}
function LinkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
}
function EmojiIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
}
function MoreVertIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
}

// ── Compose Modal ──────────────────────────────────────────────────────────────
function ComposeModal({ user, onClose }) {
  const [to] = useState('therapist@therapypro.com')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const handleSend = () => {
    if (!subject.trim() && !body.trim()) return
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
    setSent(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className={`pe-compose-modal${minimized ? ' pe-compose-minimized' : ''}`}>
      {/* Header */}
      <div className="pe-compose-header" onDoubleClick={() => setMinimized(v => !v)}>
        <span className="pe-compose-title">New Message</span>
        <div className="pe-compose-controls">
          <button
            className="pe-compose-ctrl-btn"
            onClick={() => setMinimized(v => !v)}
            aria-label={minimized ? 'Restore' : 'Minimize'}
            title={minimized ? 'Restore' : 'Minimize'}
          >
            <MinimizeIcon />
          </button>
          <button
            className="pe-compose-ctrl-btn"
            aria-label="Full screen"
            title="Full screen"
          >
            <OpenInFullIcon />
          </button>
          <button
            className="pe-compose-ctrl-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {/* To */}
          <div className="pe-compose-field pe-compose-to-row">
            <span className="pe-compose-field-label">To</span>
            <span className="pe-compose-recipient">{to}</span>
            <span className="pe-compose-cc-bcc">Cc  Bcc</span>
          </div>

          {/* Subject */}
          <div className="pe-compose-field">
            <input
              className="pe-compose-field-input"
              placeholder="Subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <textarea
            className="pe-compose-body"
            placeholder=""
            value={body}
            onChange={e => setBody(e.target.value)}
            autoFocus
          />

          {/* Footer toolbar */}
          <div className="pe-compose-footer">
            {/* Send split button */}
            <div className="pe-compose-send-group">
              <button
                className={`pe-send-btn${sent ? ' pe-send-btn-sent' : ''}`}
                onClick={handleSend}
                disabled={sent}
              >
                {sent ? 'Sent!' : 'Send'}
              </button>
              {!sent && (
                <button className="pe-send-arrow" aria-label="More send options" title="Schedule send">
                  <ChevronDownIcon />
                </button>
              )}
            </div>

            {/* Formatting toolbar */}
            <div className="pe-compose-toolbar">
              <button className="pe-tb-btn" title="Formatting options"><FormatTextIcon /></button>
              <button className="pe-tb-btn" title="Attach files"><AttachIcon /></button>
              <button className="pe-tb-btn" title="Insert link"><LinkIcon /></button>
              <button className="pe-tb-btn" title="Insert emoji"><EmojiIcon /></button>
              <button className="pe-tb-btn" title="More options"><MoreVertIcon /></button>
            </div>

            {/* Trash */}
            <button
              className="pe-tb-btn pe-compose-trash"
              onClick={onClose}
              title="Discard draft"
              aria-label="Discard"
            >
              <TrashIcon />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Email Detail View ──────────────────────────────────────────────────────────
function EmailDetail({ email, onBack, onDelete, onToggleStar }) {
  return (
    <div className="pe-detail">
      <div className="pe-detail-toolbar">
        <button className="pe-icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <button className="pe-icon-btn" onClick={() => onDelete(email.id)} aria-label="Delete"><TrashIcon /></button>
      </div>
      <h2 className="pe-detail-subject">{email.subject}</h2>
      <div className="pe-detail-meta">
        <div className="pe-detail-avatar">{email.from[0]}</div>
        <div className="pe-detail-sender-info">
          <span className="pe-detail-sender">{email.from}</span>
          <span className="pe-detail-sender-email">&lt;{email.email}&gt;</span>
        </div>
        <button
          className="pe-icon-btn pe-star-inline"
          onClick={() => onToggleStar(email.id)}
          aria-label="Star"
        >
          <StarIcon filled={email.starred} />
        </button>
        <span className="pe-detail-date">{email.date}</span>
      </div>
      <div className="pe-detail-body">
        {email.body.split('\n').map((line, i) => (
          <p key={i}>{line || <br />}</p>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PatientEmailPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [folder, setFolder] = useState('inbox')
  const [emails, setEmails] = useState(MOCK_EMAILS)
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [search, setSearch] = useState('')

  const starredEmails = emails.filter(e => e.starred)
  const sentEmails = []
  const draftEmails = []

  const visibleEmails = (() => {
    let list = folder === 'inbox'   ? emails
             : folder === 'starred' ? starredEmails
             : folder === 'sent'    ? sentEmails
             : draftEmails
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.from.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q)
      )
    }
    return list
  })()

  const unreadCount = emails.filter(e => !e.read).length

  const openEmail = (email) => {
    setSelected(email)
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e))
  }

  const deleteEmail = (id) => {
    setEmails(prev => prev.filter(e => e.id !== id))
    setSelected(null)
  }

  const toggleStar = (id) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e))
    if (selected?.id === id) setSelected(prev => ({ ...prev, starred: !prev.starred }))
  }

  return (
    <div className="page-with-sidebar">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
      />

      <main className="page-content pe-page">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        {/* Gmail-style layout */}
        <div className="pe-gmail">

          {/* Left folder sidebar */}
          <aside className="pe-left">
            <button className="pe-compose-btn" onClick={() => { setComposing(true); setSelected(null) }}>
              <PencilIcon />
              <span>Compose</span>
            </button>

            <nav className="pe-folders">
              {FOLDERS.map(f => (
                <button
                  key={f.id}
                  className={`pe-folder-item ${folder === f.id ? 'pe-folder-active' : ''}`}
                  onClick={() => { setFolder(f.id); setSelected(null) }}
                >
                  <span className="pe-folder-icon">{f.icon}</span>
                  <span className="pe-folder-label">{f.label}</span>
                  {f.id === 'inbox' && unreadCount > 0 && (
                    <span className="pe-folder-count">{unreadCount}</span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main area */}
          <section className="pe-main">

            {/* Search bar */}
            <div className="pe-search-bar">
              <span className="pe-search-icon"><SearchIcon /></span>
              <input
                className="pe-search-input"
                type="text"
                placeholder="Search mail"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Email detail */}
            {selected ? (
              <EmailDetail
                email={selected}
                onBack={() => setSelected(null)}
                onDelete={deleteEmail}
                onToggleStar={toggleStar}
              />
            ) : (
              /* Email list */
              <div className="pe-list">
                <div className="pe-list-header">
                  <span className="pe-list-title">
                    {folder.charAt(0).toUpperCase() + folder.slice(1)}
                  </span>
                  <span className="pe-list-count">{visibleEmails.length} messages</span>
                </div>

                {visibleEmails.length === 0 ? (
                  <div className="pe-empty">
                    <div className="pe-empty-icon">📭</div>
                    <p>No messages here</p>
                  </div>
                ) : (
                  visibleEmails.map(email => (
                    <div
                      key={email.id}
                      className={`pe-row ${!email.read ? 'pe-row-unread' : ''}`}
                      onClick={() => openEmail(email)}
                    >
                      <div className="pe-row-avatar">{email.from[0]}</div>
                      <button
                        className="pe-row-star"
                        onClick={e => { e.stopPropagation(); toggleStar(email.id) }}
                        aria-label="Star"
                      >
                        <StarIcon filled={email.starred} />
                      </button>
                      <span className="pe-row-from">{email.from}</span>
                      <span className="pe-row-body">
                        <span className="pe-row-from-mobile">{email.from}</span>
                        <span className="pe-row-subject">{email.subject}</span>
                        <span className="pe-row-preview"> — {email.preview}</span>
                      </span>
                      <span className="pe-row-time">{email.time || email.date}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>

        {/* Compose modal */}
        {composing && (
          <ComposeModal user={user} onClose={() => setComposing(false)} />
        )}
      </main>
    </div>
  )
}
