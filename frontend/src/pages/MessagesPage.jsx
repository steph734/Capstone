import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChannelList,
  Channel,
  Window,
  MessageList,
  MessageComposer,
  Thread,
  useChannelStateContext,
  useChatContext,
} from 'stream-chat-react'
import PatientSidebar from '../components/PatientSidebar'
import { useStreamCtx } from '../stream/StreamProvider'
import useContact from '../stream/useContact'
import { GuardianRecommendationAttachment } from '../components/SessionRecommendationCard'
import './PageWithSidebar.css'
import './MessagesPage.css'

function VideoIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
}
function PhoneIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
}
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
}
function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
}

// Chat header with real online status (Stream's `watcher_count`/presence) and
// working voice/video buttons — replaces the old hardcoded header. `onBack`
// (mobile only, see .msg-back-btn in MessagesPage.css) returns to the list.
function ChatHeader({ onCall, onBack }) {
  const { channel } = useChannelStateContext()
  const members = Object.values(channel.state.members || {})
  const other = members.find((m) => m.user?.id !== channel.getClient().userID)?.user
  const online = Boolean(other?.online)

  return (
    <div className="msg-chat-header">
      <button className="msg-icon-btn msg-back-btn" onClick={onBack} aria-label="Back to conversations">
        <BackIcon />
      </button>
      <div className="msg-chat-header-avatar">
        {other?.image
          ? <img src={other.image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          : <div className="msg-avatar" style={{ width: 40, height: 40, background: '#234C40', fontSize: 15 }}>{(other?.name || '?')[0]}</div>}
      </div>
      <div className="msg-chat-header-info">
        <span className="msg-chat-header-name">{other?.name || 'Conversation'}</span>
        <span className="msg-chat-header-status">{online ? 'Online' : 'Offline'}</span>
      </div>
      <div className="msg-chat-header-actions">
        <button className="msg-icon-btn" onClick={() => onCall(other, true, channel.id)} aria-label="Video call"><VideoIcon /></button>
        <button className="msg-icon-btn" onClick={() => onCall(other, false, channel.id)} aria-label="Voice call"><PhoneIcon /></button>
      </div>
    </div>
  )
}

// ChannelList has no `onSelect` prop in this version — the active channel
// lives in Stream's own ChatContext, set by whatever calls `setActiveChannel`
// (normally the default Preview). We render our own Preview row instead, both
// to match the app's styling and so we can flip `onPick` for mobile view.
function ConvPreview({ channel, setActiveChannel, activeChannel, onPick }) {
  const other = Object.values(channel.state.members || {}).find((m) => m.user?.id !== channel.getClient().userID)?.user
  const lastMessage = [...channel.state.messages].pop()
  const unread = channel.countUnread()
  const isActive = activeChannel?.id === channel.id

  return (
    <button
      className={`msg-conv-item${isActive ? ' msg-conv-active' : ''}`}
      onClick={() => { setActiveChannel(channel); onPick() }}
    >
      <div className="msg-conv-avatar-wrap">
        {other?.image
          ? <img src={other.image} alt="" className="msg-avatar" style={{ width: 46, height: 46 }} />
          : <div className="msg-avatar" style={{ width: 46, height: 46, background: '#234C40' }}>{(other?.name || '?')[0]}</div>}
      </div>
      <div className="msg-conv-body">
        <div className="msg-conv-top">
          <span className="msg-conv-name">{other?.name || 'Conversation'}</span>
          <span className="msg-conv-time">{lastMessage ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <div className="msg-conv-bottom">
          <span className="msg-conv-preview">{lastMessage?.text || 'No messages yet'}</span>
          {unread > 0 && <span className="msg-unread-badge">{unread}</span>}
        </div>
      </div>
    </button>
  )
}

function EmptyChat() {
  return (
    <div className="msg-empty">
      <div className="msg-empty-icon">💬</div>
      <h3>Select a conversation</h3>
      <p>Choose a contact to start messaging</p>
    </div>
  )
}

// Rendered only once `chatClient` exists, i.e. only once StreamProvider has
// actually mounted its <Chat client={chatClient}> wrapper — useChatContext()
// would otherwise read from no provider at all and crash.
function MessagesInner({ user, mobileView, setMobileView }) {
  const [search, setSearch] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [contacts, setContacts] = useState([])
  const [searchParams] = useSearchParams()

  const { chatClient } = useStreamCtx() || {}
  const { channel: activeChannel, setActiveChannel } = useChatContext()
  const contact = useContact(user?.email)

  const filters = chatClient ? { type: 'messaging', members: { $in: [chatClient.userID] } } : null
  const sort = { last_message_at: -1 }

  // /messages?cid=messaging:xyz — deep link from the therapist patient modal.
  useEffect(() => {
    const cid = searchParams.get('cid')
    if (!cid || !chatClient) return
    const [type, id] = cid.split(':')
    if (!type || !id) return
    chatClient.channel(type, id).watch().then((ch) => {
      setActiveChannel(chatClient.channel(type, id))
      setMobileView('chat')
    }).catch(() => {})
  }, [searchParams, chatClient])

  const openCompose = async () => {
    setComposeOpen(true)
    try {
      setContacts(await contact.listContacts())
    } catch {
      setContacts([])
    }
  }

  const startWith = async (target) => {
    try {
      const { channel } = await contact.openChannel(target)
      setActiveChannel(channel)
      setComposeOpen(false)
      setMobileView('chat')
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCall = (otherUser, video, channelId) => {
    if (!otherUser?.id) return
    contact.callOtherUser(otherUser.id, { video, channelId }).catch((err) => alert(err.message))
  }

  return (
    <div className="msg-shell">
      <aside className={`msg-left${mobileView === 'chat' ? ' msg-left-hidden' : ''}`}>
        <div className="msg-left-header">
          <h2 className="msg-left-title">Messages</h2>
          <button className="msg-icon-btn" onClick={openCompose} aria-label="New conversation">+</button>
        </div>

        <div className="msg-search-wrap">
          <span className="msg-search-icon"><SearchIcon /></span>
          <input className="msg-search-input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {composeOpen && (
          <div className="msg-compose-list">
            {contacts.length === 0 && <p className="msg-no-results">No contacts yet.</p>}
            {contacts.map((c) => (
              <button key={c.targetPatientId || c.targetEmployeeId} className="msg-conv-item" onClick={() => startWith(c)}>
                <div className="msg-conv-body"><span className="msg-conv-name">{c.name}</span></div>
              </button>
            ))}
          </div>
        )}

        <div className="msg-list">
          <ChannelList
            filters={filters}
            sort={sort}
            options={{ state: true, watch: true, presence: true }}
            Preview={(props) => (
              <ConvPreview {...props} onPick={() => setMobileView('chat')} />
            )}
          />
        </div>
      </aside>

      <section className={`msg-center${mobileView === 'list' ? ' msg-center-hidden' : ''}`}>
        {!activeChannel ? <EmptyChat /> : (
          <Channel channel={activeChannel} Attachment={GuardianRecommendationAttachment}>
            <Window>
              <ChatHeader onCall={handleCall} onBack={() => setMobileView('list')} />
              <MessageList />
              <MessageComposer />
            </Window>
            <Thread />
          </Channel>
        )}
      </section>
    </div>
  )
}

export default function MessagesPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileView, setMobileView] = useState('list')
  const { chatClient, error: streamError } = useStreamCtx() || {}

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

        {streamError && <div className="tp-messages-error">{streamError}</div>}

        {!chatClient ? (
          <div className="msg-empty"><p>Connecting to messaging…</p></div>
        ) : (
          <MessagesInner user={user} mobileView={mobileView} setMobileView={setMobileView} />
        )}
      </main>
    </div>
  )
}
