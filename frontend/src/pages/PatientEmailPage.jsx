import { useEffect, useState, useCallback } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import EmailGuardianModal from '../components/EmailGuardianModal'
import { listEmails, getThread, patchEmail, deleteEmail, attachmentUrl } from '../lib/emailApi'
import './PageWithSidebar.css'
import './PatientEmailPage.css'

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'starred', label: 'Starred', icon: '⭐' },
  { id: 'sent', label: 'Sent', icon: '📤' },
  { id: 'drafts', label: 'Drafts', icon: '📝' },
  { id: 'trash', label: 'Trash', icon: '🗑️' },
]

function StarIcon({ filled }) {
  return filled
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#f4b400"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.35"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zm-10 6.43l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.32 4.38.38-3.32 2.88 1 4.28L12 15.67z"/></svg>
}
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
}
function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
}
function TrashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
}
function AttachIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6h-1.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function EmailDetail({ email, thread, onBack, onDelete, onToggleStar, onReply, isGuardian }) {
  return (
    <div className="pe-detail">
      <div className="pe-detail-toolbar">
        <button className="pe-icon-btn" onClick={onBack} aria-label="Back"><BackIcon /></button>
        <button className="pe-icon-btn" onClick={onDelete} aria-label="Delete"><TrashIcon /></button>
      </div>
      {thread.messages.map((m) => (
        <div key={m.id} className="pe-thread-message">
          <h2 className="pe-detail-subject">{m.subject}</h2>
          <div className="pe-detail-meta">
            <div className="pe-detail-avatar">{(m.sender.name || '?')[0]}</div>
            <div className="pe-detail-sender-info">
              <span className="pe-detail-sender">{m.sender.name}</span>
            </div>
            {m.id === thread.messages[0].id && (
              <button className="pe-icon-btn pe-star-inline" onClick={onToggleStar} aria-label="Star">
                <StarIcon filled={thread.isStarred} />
              </button>
            )}
            <span className="pe-detail-date">{formatWhen(m.email_sent_at || m.email_created_at)}</span>
          </div>
          <div className="pe-detail-body">
            {m.body.split('\n').map((line, i) => (
              <p key={i}>{line || <br />}</p>
            ))}
          </div>
          {m.attachments.length > 0 && (
            <div className="pe-attachments">
              {m.attachments.map((a) => (
                <button
                  key={a.index}
                  className="pe-attachment-chip"
                  onClick={async () => {
                    const { url } = await attachmentUrl(email.callerEmail, m.id, a.index)
                    window.open(url, '_blank', 'noopener')
                  }}
                >
                  <AttachIcon /> {a.file_name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button className="pe-reply-btn" onClick={onReply}>
        Reply{isGuardian ? '' : ''}
      </button>
    </div>
  )
}

export default function PatientEmailPage({ user, onLogout, betaTier, menuItems, profilePath = '/patient/profile' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [folder, setFolder] = useState('inbox')
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState(null)
  const [composing, setComposing] = useState(false)
  const [replying, setReplying] = useState(false)
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const email = user?.email

  const load = useCallback(() => {
    if (!email) return
    setLoading(true)
    setLoadError('')
    listEmails(email, { folder, search })
      .then((data) => setEmails(data.emails || []))
      .catch((err) => setLoadError(err.message || 'Could not load emails.'))
      .finally(() => setLoading(false))
  }, [email, folder, search, refreshKey])

  useEffect(() => { load() }, [load])

  const openEmail = (id) => {
    setSelectedId(id)
    getThread(email, id).then((data) => {
      setThread({ ...data, callerEmail: email })
      setRefreshKey((k) => k + 1)
    }).catch((err) => setLoadError(err.message))
  }

  const back = () => { setSelectedId(null); setThread(null) }

  const toggleStar = () => {
    if (!thread) return
    patchEmail(email, selectedId, { is_starred: !thread.isStarred }).then(() => {
      setThread((t) => ({ ...t, isStarred: !t.isStarred }))
      load()
    })
  }

  const trashEmail = () => {
    patchEmail(email, selectedId, { folder: 'trash' }).then(() => { back(); load() })
  }

  const restoreEmail = (id) => {
    patchEmail(email, id, { restore: true }).then(load)
  }

  const permanentlyDelete = (id) => {
    deleteEmail(email, id).then(load)
  }

  const isGuardian = user?.role !== 'Therapist'

  return (
    <div className="page-with-sidebar">
      <PatientSidebar
        user={user}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        menuItems={menuItems}
        profilePath={profilePath}
      />

      <main className="page-content pe-page">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="pe-gmail">
          <aside className="pe-left">
            {!isGuardian && (
              <button className="pe-compose-btn" onClick={() => { setComposing(true); back() }}>
                ✏️ <span>Compose</span>
              </button>
            )}

            <nav className="pe-folders">
              {FOLDERS.map((f) => (
                <button
                  key={f.id}
                  className={`pe-folder-item ${folder === f.id ? 'pe-folder-active' : ''}`}
                  onClick={() => { setFolder(f.id); back() }}
                >
                  <span className="pe-folder-icon">{f.icon}</span>
                  <span className="pe-folder-label">{f.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="pe-main">
            <div className="pe-search-bar">
              <span className="pe-search-icon"><SearchIcon /></span>
              <input
                className="pe-search-input"
                type="text"
                placeholder="Search mail"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loadError && <p className="pe-error">{loadError}</p>}

            {thread ? (
              <EmailDetail
                email={{ callerEmail: email }}
                thread={thread}
                onBack={back}
                onDelete={folder === 'trash' ? () => permanentlyDelete(selectedId) : trashEmail}
                onToggleStar={toggleStar}
                onReply={() => setReplying(true)}
                isGuardian={isGuardian}
              />
            ) : (
              <div className="pe-list">
                <div className="pe-list-header">
                  <span className="pe-list-title">{folder.charAt(0).toUpperCase() + folder.slice(1)}</span>
                  <span className="pe-list-count">{loading ? 'Loading…' : `${emails.length} messages`}</span>
                </div>

                {!loading && emails.length === 0 ? (
                  <div className="pe-empty">
                    <div className="pe-empty-icon">📭</div>
                    <p>No emails yet</p>
                  </div>
                ) : (
                  emails.map((e) => (
                    <div
                      key={e.id}
                      className={`pe-row ${!e.is_read ? 'pe-row-unread' : ''}`}
                      onClick={() => openEmail(e.id)}
                    >
                      <div className="pe-row-avatar">{(e.sender?.name || '?')[0]}</div>
                      <button
                        className="pe-row-star"
                        onClick={(ev) => { ev.stopPropagation(); patchEmail(email, e.id, { is_starred: !e.is_starred }).then(load) }}
                        aria-label="Star"
                      >
                        <StarIcon filled={e.is_starred} />
                      </button>
                      <span className="pe-row-from">{e.sender?.name}</span>
                      <span className="pe-row-body">
                        <span className="pe-row-from-mobile">{e.sender?.name}</span>
                        <span className="pe-row-subject">{e.subject}</span>
                        <span className="pe-row-preview"> — {e.snippet}</span>
                        {e.attachmentCount > 0 && <AttachIcon />}
                      </span>
                      <span className="pe-row-time">{formatWhen(e.email_sent_at || e.email_created_at)}</span>
                      {folder === 'trash' && (
                        <button
                          className="pe-row-restore"
                          onClick={(ev) => { ev.stopPropagation(); restoreEmail(e.id) }}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>

        {composing && (
          <EmailGuardianModal
            currentUserEmail={email}
            mode="compose"
            onClose={() => setComposing(false)}
            onSent={() => { setComposing(false); load() }}
          />
        )}

        {replying && thread && (
          <EmailGuardianModal
            currentUserEmail={email}
            mode="reply"
            guardianName={thread.messages[0]?.sender?.name}
            replyTo={{ id: selectedId, subject: thread.messages[0]?.subject }}
            onClose={() => setReplying(false)}
            onSent={() => { setReplying(false); openEmail(selectedId); load() }}
          />
        )}
      </main>
    </div>
  )
}
