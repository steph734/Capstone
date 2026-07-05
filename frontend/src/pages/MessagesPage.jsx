import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import { useSharedMessages } from '../context/MessagesContext'
import CallOverlay from '../components/CallOverlay'
import './PageWithSidebar.css'
import './MessagesPage.css'

// Lazy-loaded: the Daily.co video SDK is only needed once someone actually
// opens a real video/voice call.
const DailyCallOverlay = lazy(() => import('../components/DailyCallOverlay'))

// ── Mock Data ────────────────────────────────────────────────────────────────
const CONVERSATIONS = [
  { id: 1, name: 'Dr. Sarah Reyes', initials: 'SR', color: '#4a6b5d', role: 'Your Therapist', lastMessage: 'See you at 2PM tomorrow! 🎉', time: '9:04 AM', unread: 2, pinned: true, typing: false, online: true },
  { id: 2, name: 'TherapyPro Clinic', initials: 'TC', color: '#1565c0', role: 'Clinic', lastMessage: 'Your appointment is confirmed.', time: '7:20 AM', unread: 0, pinned: true, typing: true, online: true },
  { id: 3, name: 'Dr. Mark Torres', initials: 'MT', color: '#7b1fa2', role: 'Specialist', lastMessage: 'Please review the exercises.', time: 'Jun 30', unread: 0, pinned: false, typing: false, online: false },
  { id: 4, name: 'Reception', initials: 'RC', color: '#e65100', role: 'Front Desk', lastMessage: 'Your bill is ready for pickup.', time: 'Jun 28', unread: 1, pinned: false, typing: false, online: true },
  { id: 5, name: 'Nurse Ana', initials: 'NA', color: '#c2185b', role: 'Nurse', lastMessage: 'Please fill the update form.', time: 'Jun 25', unread: 0, pinned: false, typing: false, online: false },
]

const MESSAGES = {
  1: [
    { id: 1, fromMe: false, sender: 'Dr. Sarah Reyes', text: 'Hi Alvrin! How are you feeling today?', time: '9:00 AM' },
    { id: 2, fromMe: true, text: "I'm feeling much better, thank you! The exercises really helped.", time: '9:01 AM' },
    { id: 3, fromMe: false, sender: 'Dr. Sarah Reyes', text: "That's wonderful to hear! Did you complete the breathing exercises I assigned this week?", time: '9:02 AM' },
    { id: 4, fromMe: true, text: 'Yes! I did them every morning. It really made a difference.', time: '9:03 AM' },
    { id: 5, fromMe: false, sender: 'Dr. Sarah Reyes', text: 'Excellent progress! Keep it up. See you at 2PM tomorrow! 🎉', time: '9:04 AM' },
  ],
  2: [
    { id: 1, fromMe: false, sender: 'TherapyPro Clinic', text: 'Hello Alvrin! Your appointment has been scheduled.', time: '7:18 AM' },
    { id: 2, fromMe: false, sender: 'TherapyPro Clinic', text: '📅 Thursday, July 4, 2026 at 2:00 PM\n📍 Room 3, TherapyPro Clinic', time: '7:19 AM' },
    { id: 3, fromMe: false, sender: 'TherapyPro Clinic', text: 'Your appointment is confirmed. See you soon!', time: '7:20 AM' },
  ],
  3: [
    { id: 1, fromMe: false, sender: 'Dr. Mark Torres', text: 'Good afternoon, Alvrin! Here are your exercise notes for this week.', time: 'Jun 30' },
    { id: 2, fromMe: false, sender: 'Dr. Mark Torres', text: 'Please review the exercises and reach out if you have any questions.', time: 'Jun 30' },
  ],
  4: [
    { id: 1, fromMe: false, sender: 'Reception', text: 'Hi Alvrin! Your monthly statement is now available.', time: 'Jun 28' },
    { id: 2, fromMe: false, sender: 'Reception', text: 'Your bill is ready for pickup at the front desk.', time: 'Jun 28' },
  ],
  5: [
    { id: 1, fromMe: false, sender: 'Nurse Ana', text: 'Hi Alvrin! Please remember to fill out the patient update form at your next visit.', time: 'Jun 25' },
  ],
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
}
function PinIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
}
function EditIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
}
function VideoIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
}
function PhoneIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
}
function MoreVertIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
}
function SendIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
}
function EmojiIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
}
function AttachIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6h-1.5v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
}
function BackIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
}
function InfoIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
}
function CloseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ conv, size = 44 }) {
  return (
    <div
      className="msg-avatar"
      style={{
        width: size, height: size, background: conv.color,
        fontSize: size * 0.36,
        borderRadius: '50%',
      }}
    >
      {conv.initials}
      {conv.online && <span className="msg-online-dot" />}
    </div>
  )
}

// ── Conversation Item ─────────────────────────────────────────────────────────
function ConvItem({ conv, active, onClick }) {
  return (
    <button
      className={`msg-conv-item${active ? ' msg-conv-active' : ''}`}
      onClick={onClick}
    >
      <div className="msg-conv-avatar-wrap">
        <Avatar conv={conv} size={46} />
      </div>
      <div className="msg-conv-body">
        <div className="msg-conv-top">
          <span className="msg-conv-name">{conv.name}</span>
          <span className="msg-conv-time">{conv.time}</span>
        </div>
        <div className="msg-conv-bottom">
          <span className={`msg-conv-preview${conv.typing ? ' msg-typing-text' : ''}`}>
            {conv.typing ? 'typing...' : conv.lastMessage}
          </span>
          {conv.unread > 0 && (
            <span className="msg-unread-badge">{conv.unread}</span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg, conv, showAvatar }) {
  return (
    <div className={`msg-bubble-row${msg.fromMe ? ' msg-bubble-me' : ''}`}>
      {!msg.fromMe && (
        <div className="msg-bubble-avatar">
          {showAvatar
            ? <Avatar conv={conv} size={32} />
            : <div style={{ width: 32 }} />}
        </div>
      )}
      <div className="msg-bubble-content">
        {!msg.fromMe && showAvatar && (
          <span className="msg-bubble-sender">{msg.sender}</span>
        )}
        <div className={`msg-bubble${msg.fromMe ? ' msg-bubble-sent' : ' msg-bubble-recv'}`}>
          {msg.text.split('\n').map((line, i) => (
            <span key={i}>{line}{i < msg.text.split('\n').length - 1 && <br />}</span>
          ))}
        </div>
        <span className="msg-bubble-time">{msg.time}</span>
      </div>
    </div>
  )
}

// ── Info Panel ────────────────────────────────────────────────────────────────
function InfoPanel({ conv, onClose }) {
  return (
    <aside className="msg-right">
      <div className="msg-right-header">
        <span className="msg-right-title">Contact Info</span>
        <button className="msg-icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </div>

      <div className="msg-right-profile">
        <Avatar conv={conv} size={72} />
        <h3 className="msg-right-name">{conv.name}</h3>
        <p className="msg-right-role">{conv.role}</p>
        <span className={`msg-right-status${conv.online ? ' online' : ''}`}>
          {conv.online ? '● Online' : '● Offline'}
        </span>
      </div>

      <div className="msg-right-section">
        <p className="msg-right-section-title">About</p>
        <p className="msg-right-section-body">
          {conv.role === 'Your Therapist'
            ? 'Licensed Occupational Therapist at TherapyPro Clinic. Specializes in pediatric therapy and motor skill development.'
            : `${conv.role} at TherapyPro Clinic.`}
        </p>
      </div>

      <div className="msg-right-section">
        <p className="msg-right-section-title">Quick Actions</p>
        <div className="msg-right-actions">
          <button className="msg-right-action-btn">
            <PhoneIcon /> Call
          </button>
          <button className="msg-right-action-btn">
            <VideoIcon /> Video
          </button>
        </div>
      </div>

      <div className="msg-right-section">
        <p className="msg-right-section-title">Media</p>
        <div className="msg-right-media">
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className="msg-right-media-thumb" />
          ))}
        </div>
      </div>
    </aside>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="msg-empty">
      <div className="msg-empty-icon">💬</div>
      <h3>Select a conversation</h3>
      <p>Choose a contact to start messaging</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MessagesPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeId, setActiveId] = useState(1)
  const [conversations, setConversations] = useState(CONVERSATIONS)
  const [messageMap, setMessageMap] = useState(MESSAGES)
  const [input, setInput] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [mobileView, setMobileView] = useState('list') // 'list' | 'chat'
  const [search, setSearch] = useState('')
  const [activeCall, setActiveCall] = useState(null) // null | 'video' | 'voice'
  const bodyRef = useRef(null)
  const activeIdRef = useRef(activeId)
  const prevThreadLenRef = useRef(0)

  const { thread, sendAsPatient } = useSharedMessages()

  // Keep activeIdRef in sync so the thread effect can read it without being a dependency
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // Sync conversation-1 preview and unread badge when therapist sends a new message
  useEffect(() => {
    if (thread.length <= prevThreadLenRef.current) return
    const last = thread[thread.length - 1]
    prevThreadLenRef.current = thread.length
    if (last.from !== 'therapist') return
    setConversations(prev => prev.map(c =>
      c.id === 1
        ? { ...c, lastMessage: last.text, time: last.time, unread: activeIdRef.current !== 1 ? c.unread + 1 : 0 }
        : c
    ))
  }, [thread])

  const activeConv = conversations.find(c => c.id === activeId)

  // Conv 1 uses the shared thread; all others use local messageMap
  const messages = activeId === 1
    ? thread.map(m => ({
        id: m.id,
        fromMe: m.from === 'patient',
        sender: m.from === 'therapist' ? 'Dr. Sarah Reyes' : undefined,
        text: m.text,
        time: m.time,
      }))
    : (messageMap[activeId] || [])

  const pinned = conversations.filter(c => c.pinned && matchSearch(c, search))
  const others = conversations.filter(c => !c.pinned && matchSearch(c, search))

  function matchSearch(c, q) {
    if (!q.trim()) return true
    const lq = q.toLowerCase()
    return c.name.toLowerCase().includes(lq) || c.lastMessage.toLowerCase().includes(lq)
  }

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [activeId, messages.length])

  const openConv = (id) => {
    setActiveId(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
    setMobileView('chat')
    setShowInfo(false)
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return
    if (activeId === 1) {
      // Route through shared context so therapist sees the reply
      sendAsPatient(text)
      setConversations(prev => prev.map(c =>
        c.id === 1 ? { ...c, lastMessage: text, time: 'now' } : c
      ))
    } else {
      const newMsg = {
        id: Date.now(),
        fromMe: true,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessageMap(prev => ({
        ...prev,
        [activeId]: [...(prev[activeId] || []), newMsg],
      }))
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, lastMessage: text, time: 'now' } : c
      ))
    }
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
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

      <main className="page-content msg-page">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="msg-shell">
          {/* ── Left: Conversation List ── */}
          <aside className={`msg-left${mobileView === 'chat' ? ' msg-left-hidden' : ''}`}>
            {/* Header */}
            <div className="msg-left-header">
              <h2 className="msg-left-title">Messages</h2>
              <div className="msg-left-header-actions">
                <button className="msg-icon-btn" aria-label="Compose"><EditIcon /></button>
                <button className="msg-icon-btn" aria-label="More"><MoreVertIcon /></button>
              </div>
            </div>

            {/* Search */}
            <div className="msg-search-wrap">
              <span className="msg-search-icon"><SearchIcon /></span>
              <input
                className="msg-search-input"
                type="text"
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* List */}
            <div className="msg-list">
              {pinned.length > 0 && (
                <>
                  <div className="msg-section-label">
                    <PinIcon /> Pinned
                  </div>
                  {pinned.map(c => (
                    <ConvItem key={c.id} conv={c} active={c.id === activeId} onClick={() => openConv(c.id)} />
                  ))}
                </>
              )}
              {others.length > 0 && (
                <>
                  {pinned.length > 0 && <div className="msg-section-label">All Messages</div>}
                  {others.map(c => (
                    <ConvItem key={c.id} conv={c} active={c.id === activeId} onClick={() => openConv(c.id)} />
                  ))}
                </>
              )}
              {pinned.length === 0 && others.length === 0 && (
                <p className="msg-no-results">No conversations found</p>
              )}
            </div>
          </aside>

          {/* ── Center: Chat Area ── */}
          <section className={`msg-center${mobileView === 'list' ? ' msg-center-hidden' : ''}`}>
            {!activeConv ? <EmptyChat /> : (
              <>
                {/* Chat header */}
                <div className="msg-chat-header">
                  <button
                    className="msg-icon-btn msg-back-btn"
                    onClick={() => setMobileView('list')}
                    aria-label="Back"
                  >
                    <BackIcon />
                  </button>
                  <div className="msg-chat-header-avatar">
                    <Avatar conv={activeConv} size={40} />
                  </div>
                  <div className="msg-chat-header-info">
                    <span className="msg-chat-header-name">{activeConv.name}</span>
                    <span className="msg-chat-header-status">
                      {activeConv.typing
                        ? <span className="msg-typing-indicator">is typing<span className="msg-typing-dots"><span /><span /><span /></span></span>
                        : activeConv.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="msg-chat-header-actions">
                    <button className="msg-icon-btn" onClick={() => setActiveCall('video')} aria-label="Video call"><VideoIcon /></button>
                    <button className="msg-icon-btn" onClick={() => setActiveCall('voice')} aria-label="Voice call"><PhoneIcon /></button>
                    <button
                      className={`msg-icon-btn${showInfo ? ' msg-icon-btn-active' : ''}`}
                      onClick={() => setShowInfo(v => !v)}
                      aria-label="Info"
                    >
                      <InfoIcon />
                    </button>
                    <button className="msg-icon-btn" aria-label="More"><MoreVertIcon /></button>
                  </div>
                </div>

                {/* Messages */}
                <div className="msg-chat-body" ref={bodyRef}>
                  <div className="msg-date-sep">
                    <span>Today, July 3</span>
                  </div>
                  {messages.map((msg, i) => {
                    const showAvatar = !msg.fromMe && (i === 0 || messages[i - 1]?.fromMe)
                    return <Bubble key={msg.id} msg={msg} conv={activeConv} showAvatar={showAvatar} />
                  })}
                </div>

                {/* Input */}
                <div className="msg-input-bar">
                  <button className="msg-icon-btn msg-input-icon" aria-label="Emoji"><EmojiIcon /></button>
                  <div className="msg-input-wrap">
                    <textarea
                      className="msg-input"
                      placeholder="Write a message..."
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                    />
                  </div>
                  <button className="msg-icon-btn msg-input-icon" aria-label="Attach"><AttachIcon /></button>
                  <button
                    className="msg-send-btn"
                    onClick={sendMessage}
                    aria-label="Send"
                    disabled={!input.trim()}
                  >
                    <SendIcon />
                  </button>
                </div>
              </>
            )}
          </section>

          {/* ── Right: Info Panel ── */}
          {showInfo && activeConv && (
            <InfoPanel conv={activeConv} onClose={() => setShowInfo(false)} />
          )}
        </div>
      </main>

      {activeConv && (
        activeConv.id === 1 ? (
          activeCall && (
            <Suspense fallback={null}>
              <DailyCallOverlay
                open={!!activeCall}
                userName="Alvrin"
                onClose={() => setActiveCall(null)}
              />
            </Suspense>
          )
        ) : (
          <CallOverlay
            open={!!activeCall}
            type={activeCall || 'voice'}
            contactName={activeConv.name}
            initials={activeConv.initials}
            color={activeConv.color}
            onClose={() => setActiveCall(null)}
          />
        )
      )}
    </div>
  )
}
