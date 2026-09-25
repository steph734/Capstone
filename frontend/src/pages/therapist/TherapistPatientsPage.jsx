import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { useSharedMessages } from '../../context/MessagesContext'
import CallOverlay from '../../components/CallOverlay'
import { STREAM_THERAPIST_USER } from '../../utils/streamConfig'
import { generateUniqueId } from '../../utils/idGenerator'

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
// A stable placeholder avatar for a given id — real patient ids are Mongo
// ObjectId strings (not the small sequential ints a `% N` trick expects), so
// this hashes the string down to a pravatar image index instead.
function avatarFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return `https://i.pravatar.cc/150?img=${(h % 70) + 1}`
}

// Lazy-loaded: the GetStream Video SDK is large and only needed once someone
// actually opens a real video/voice call.
const StreamCallOverlay = lazy(() => import('../../components/StreamCallOverlay'))
import './TherapistPatientsPage.css'

function VideoIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
}
function PhoneIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
}
function EmailIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></svg>
}
function PeopleIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function PersonCheckIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="m17 11 2 2 4-4" /></svg>
}
function CalendarCheckIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="m9 16 2 2 4-4" /></svg>
}
function AlertIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
}
function KebabIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
}
function EyeIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function ArchiveIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>
}

const STATUS_CONFIG = {
  Active:   { cls: 'tp-pill-green' },
  Inactive: { cls: 'tp-pill-gray'  },
}

// Deterministic initials + a matching pastel color, so a patient without a
// real profile photo still gets a stable, recognizable avatar circle.
const AVATAR_PALETTE = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#ffe4e6', fg: '#be123c' },
  { bg: '#e0f2fe', fg: '#0369a1' },
  { bg: '#fef9c3', fg: '#854d0e' },
]
function paletteFor(id) {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function initialsFor(name) {
  return (
    (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

/* ── Profile Modal ──────────────────────────────────────── */
function ProfileModal({ patient, onClose, onMessage }) {
  const sc = STATUS_CONFIG[patient.status] || STATUS_CONFIG['Active']

  return (
    <div className="tp-modal-backdrop" onClick={onClose}>
      <div className="tp-profile-modal" onClick={e => e.stopPropagation()}>
        {/* Hero */}
        <div className="tp-profile-hero">
          <button className="tp-modal-close tp-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <img src={patient.avatar} alt={patient.name} className="tp-profile-avatar" />
          <h2 className="tp-profile-name">{patient.name}</h2>
          <p className="tp-profile-meta">Age {patient.age} &nbsp;·&nbsp; {patient.condition}</p>
          <span className={`tp-pill ${sc.cls}`}>{patient.status}</span>
        </div>

        {/* Body */}
        <div className="tp-profile-body">
          <h4 className="tp-section-title">Patient Details</h4>
          <div className="tp-detail-grid">
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Patient ID</span>
              <span className="tp-detail-val">{patient.patientId || '—'}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Guardian</span>
              <span className="tp-detail-val">{patient.guardian}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Contact</span>
              <span className="tp-detail-val">{patient.contact}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Email</span>
              <span className="tp-detail-val">{patient.email || '—'}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Joined</span>
              <span className="tp-detail-val">{patient.joined}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Total Sessions</span>
              <span className="tp-detail-val">{patient.sessions}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Last Session</span>
              <span className="tp-detail-val">{patient.lastSession}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Next Session</span>
              <span className="tp-detail-val">{patient.nextSession}</span>
            </div>
          </div>

          <h4 className="tp-section-title" style={{ marginTop: 20 }}>Clinical Notes</h4>
          <p className="tp-notes-box">{patient.notes}</p>
        </div>

        {/* Footer */}
        <div className="tp-modal-footer">
          <button className="tp-btn-cancel" onClick={onClose}>Close</button>
          <a
            className="tp-btn-cancel tp-btn-email"
            href={patient.email ? `mailto:${patient.email}` : undefined}
            aria-disabled={!patient.email}
            onClick={(e) => { if (!patient.email) e.preventDefault() }}
          >
            <EmailIcon />
            Email Guardian
          </a>
          <button className="tp-btn-add" onClick={() => { onClose(); onMessage(patient) }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Message Guardian
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Message Modal ──────────────────────────────────────── */
function MessageModal({ patient, messages, onSend, onClose }) {
  const [text, setText] = useState('')
  const [activeCall, setActiveCall] = useState(null) // null | 'video' | 'voice'
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(patient.id, trimmed)
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="tp-modal-backdrop" onClick={onClose}>
      <div className="tp-msg-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="tp-msg-header">
          <img src={patient.avatar} alt={patient.name} className="tp-msg-avatar" />
          <div className="tp-msg-header-info">
            <span className="tp-msg-header-name">{patient.name}</span>
            <span className="tp-msg-header-sub">Messaging · {patient.guardian} (Guardian)</span>
          </div>
          <div className="tp-msg-header-actions">
            <button className="tp-icon-btn" onClick={() => setActiveCall('video')} aria-label="Video call"><VideoIcon /></button>
            <button className="tp-icon-btn" onClick={() => setActiveCall('voice')} aria-label="Voice call"><PhoneIcon /></button>
            <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Messages */}
        <div className="tp-msg-body">
          {messages.map((m, i) => (
            <div key={i} className={`tp-bubble-wrap ${m.from === 'me' ? 'tp-wrap-me' : 'tp-wrap-them'}`}>
              {m.from === 'them' && (
                <img src={patient.avatar} alt="" className="tp-bubble-avatar" />
              )}
              <div className={`tp-bubble ${m.from === 'me' ? 'tp-bubble-me' : 'tp-bubble-them'}`}>
                <p className="tp-bubble-text">{m.text}</p>
                <span className="tp-bubble-time">{m.time}</span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="tp-msg-input-row">
          <textarea
            className="tp-msg-input"
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button className="tp-msg-send" onClick={handleSend} aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {patient.id === 0 ? (
        activeCall && (
          <Suspense fallback={null}>
            <StreamCallOverlay
              open={!!activeCall}
              localUser={STREAM_THERAPIST_USER}
              onClose={() => setActiveCall(null)}
            />
          </Suspense>
        )
      ) : (
        <CallOverlay
          open={!!activeCall}
          type={activeCall || 'voice'}
          contactName={patient.name}
          avatarUrl={patient.avatar}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  )
}

/* ── Add Patient Modal ──────────────────────────────────── */
function AddPatientModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', age: '', condition: '', status: 'Active' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = () => {
    if (!form.name.trim() || !form.condition.trim()) return
    onAdd(form)
    onClose()
  }

  return (
    <div className="tp-modal-backdrop" onClick={onClose}>
      <div className="tp-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-modal-header">
          <h3>Add New Patient</h3>
          <button className="tp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-modal-form">
            <div className="tp-form-group">
              <label>Full Name</label>
              <input placeholder="e.g. Juan dela Cruz" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="tp-form-group">
              <label>Age</label>
              <input type="number" placeholder="e.g. 8" min="1" max="18" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="tp-form-group tp-form-full">
              <label>Condition / Diagnosis</label>
              <input placeholder="e.g. ADHD, Speech Delay" value={form.condition} onChange={e => set('condition', e.target.value)} />
            </div>
            <div className="tp-form-group tp-form-full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div className="tp-modal-footer">
          <button className="tp-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="tp-btn-add" onClick={handleAdd}>Add Patient</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function TherapistPatientsPage({ user, onLogout, betaTier }) {
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('All')
  const [sortBy, setSortBy]       = useState('name')
  const [patients, setPatients]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [profilePt, setProfilePt] = useState(null)
  const [messagePt, setMessagePt] = useState(null)
  const [threads, setThreads]     = useState({})
  const [openMenuId, setOpenMenuId] = useState(null)

  const { thread, sendAsTherapist } = useSharedMessages()

  // Every patient who has actually booked with this therapist, derived from
  // the `appointments` collection (see api/_lib/routes/patients-therapist-list.js)
  // — there's no direct "assigned therapist" field on a patient record, so
  // having an appointment with this therapist IS what it means to have
  // chosen them. Add/Mark inactive/Archive below only mutate this in-memory
  // list; none of it is wired to the backend yet, so changes here won't
  // survive a reload.
  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setLoading(false)
      setLoadError('Your account isn’t linked to a staff record yet.')
      return
    }
    setLoading(true)
    fetch(`/api/patients/therapist-list?email=${encodeURIComponent(user.email)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
        const list = (body.patients || []).map((p) => ({
          ...p,
          archived:    false,
          avatar:      avatarFor(p.id),
          lastSession: fmtDate(p.lastSessionDate) || 'Not yet',
          nextSession: fmtDate(p.nextSessionDate) || 'TBD',
          joined:      fmtDate(p.joinedDate) || '—',
        }))
        if (!cancelled) setPatients(list)
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || 'Could not load patients.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.email])

  // Close the row action menu on an outside click.
  useEffect(() => {
    if (openMenuId == null) return
    const onDocClick = (e) => { if (!e.target.closest('.tp-menu-cell')) setOpenMenuId(null) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openMenuId])

  // Build the message list for a given patient.
  // Patient id=0 (Alvrin) is the demo patient — use the shared context thread.
  const getMessages = (patientId) => {
    if (patientId === 0) {
      return thread.map(m => ({
        from: m.from === 'therapist' ? 'me' : 'them',
        text: m.text,
        time: m.time,
      }))
    }
    return threads[patientId] || []
  }

  const archivePatient = (id) => {
    setPatients(prev => prev.map(p => (p.id === id ? { ...p, archived: true } : p)))
    setOpenMenuId(null)
  }

  const deletePatient = (id) => {
    const p = patients.find(pt => pt.id === id)
    if (p && !window.confirm(`Delete ${p.name} from your patient list? This can't be undone.`)) return
    setPatients(prev => prev.filter(pt => pt.id !== id))
    setOpenMenuId(null)
  }

  // Archived patients drop out of the roster entirely — counts, filters and
  // the table below all work off this list, never the raw `patients` state.
  const roster = patients.filter(p => !p.archived)

  const filtered = roster.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q)
    const matchFilter = filter === 'All' || p.status === filter
    return matchSearch && matchFilter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'next') return (a.nextSessionDate || '9999-99-99').localeCompare(b.nextSessionDate || '9999-99-99')
    if (sortBy === 'last') return (b.lastSessionDate || '').localeCompare(a.lastSessionDate || '')
    if (sortBy === 'sessions') return b.sessions - a.sessions
    return a.name.localeCompare(b.name)
  })

  const counts = {
    total:          roster.length,
    active:         roster.filter(p => p.status === 'Active').length,
    inactive:       roster.filter(p => p.status === 'Inactive').length,
    upcomingBooked: roster.filter(p => p.nextSessionDate).length,
    noUpcoming:     roster.filter(p => !p.nextSessionDate).length,
  }

  const handleAdd = (form) => {
    const id = Date.now()
    const newPt = {
      id,
      patientId:   generateUniqueId('P', patients.map((p) => p.patientId).filter(Boolean)),
      name:        form.name,
      age:         Number(form.age) || 0,
      condition:   form.condition,
      status:      form.status,
      archived:    false,
      avatar:      avatarFor(id),
      lastSession: 'Not yet',
      nextSession: 'TBD',
      nextSessionDate: null,
      lastSessionDate: null,
      sessions:    0,
      guardian:    'Not specified',
      contact:     'Not specified',
      email:       'Not specified',
      joined:      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      notes:       'No clinical notes yet.',
    }
    setPatients(prev => [newPt, ...prev])
    setThreads(prev => ({ ...prev, [newPt.id]: [] }))
  }

  const handleSend = (patientId, text) => {
    if (patientId === 0) {
      // Route through shared context so Alvrin sees it in their Messages page
      sendAsTherapist(text)
      return
    }
    const now = new Date()
    const time = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    setThreads(prev => ({
      ...prev,
      [patientId]: [...(prev[patientId] || []), { from: 'me', text, time }],
    }))
  }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="My Patients"
      subtitle="Track your assigned patients and current progress"
      icon="👨‍👩‍👧"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      {loading ? (
        <p style={{ color: '#6b7c75', fontSize: 14 }}>Loading your patients…</p>
      ) : loadError ? (
        <p style={{ color: '#b91c1c', fontSize: 14 }}>{loadError}</p>
      ) : (
      <>
      {/* KPI Cards */}
      <div className="tp-kpi-grid">
        <div className="tp-kpi-card">
          <span className="tp-kpi-icon tp-kpi-icon-total"><PeopleIcon /></span>
          <div className="tp-kpi-text">
            <span className="tp-kpi-num">{counts.total}</span>
            <span className="tp-kpi-lbl">Total patients</span>
          </div>
        </div>
        <div className="tp-kpi-card">
          <span className="tp-kpi-icon tp-kpi-icon-active"><PersonCheckIcon /></span>
          <div className="tp-kpi-text">
            <span className="tp-kpi-num">{counts.active}</span>
            <span className="tp-kpi-lbl">Active</span>
          </div>
        </div>
        <div className="tp-kpi-card">
          <span className="tp-kpi-icon tp-kpi-icon-booked"><CalendarCheckIcon /></span>
          <div className="tp-kpi-text">
            <span className="tp-kpi-num">{counts.upcomingBooked}</span>
            <span className="tp-kpi-lbl">Upcoming booked</span>
          </div>
        </div>
        <div className="tp-kpi-card">
          <span className="tp-kpi-icon tp-kpi-icon-alert"><AlertIcon /></span>
          <div className="tp-kpi-text">
            <span className="tp-kpi-num">{counts.noUpcoming}</span>
            <span className="tp-kpi-lbl">No upcoming session</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="tp-toolbar">
        <div className="tp-search-wrap">
          <svg className="tp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="tp-search"
            placeholder="Search by name or condition…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="tp-filter-tabs">
          {[['All', counts.total], ['Active', counts.active], ['Inactive', counts.inactive]].map(([f, n]) => (
            <button key={f} className={`tp-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f} <span className="tp-filter-count">{n}</span>
            </button>
          ))}
        </div>
        <select className="tp-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort by">
          <option value="name">Sort by name</option>
          <option value="next">Sort by next session</option>
          <option value="last">Sort by last session</option>
          <option value="sessions">Sort by sessions</option>
        </select>
        <button className="tp-add-btn" onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Patient
        </button>
      </div>

      {/* Patient Table */}
      <div className="tp-table-card">
        <div className="tp-table-scroll">
          <table className="tp-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Last</th>
                <th>Next</th>
                <th>Sessions</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tp-table-empty">No patients match your search.</td>
                </tr>
              ) : sorted.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG['Active']
                const pal = paletteFor(p.id)
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="tp-table-patient">
                        <span className="tp-avatar-initials" style={{ background: pal.bg, color: pal.fg }}>
                          {initialsFor(p.name)}
                        </span>
                        <div className="tp-card-info">
                          <div className="tp-name-row">
                            <h3 className="tp-patient-name">{p.name}</h3>
                            <span className={`tp-pill ${sc.cls}`}>{p.status}</span>
                          </div>
                          <span className="tp-patient-age">Age {p.age ?? '—'} · {p.condition || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{p.lastSession}</td>
                    <td>{p.nextSessionDate ? p.nextSession : 'None'}</td>
                    <td>{p.sessions}</td>
                    <td>
                      <div className="tp-table-actions">
                        <button className="tp-action-btn tp-action-view" onClick={() => setProfilePt(p)}>
                          <EyeIcon /> View
                        </button>
                        <button className="tp-action-btn tp-action-archive" onClick={() => archivePatient(p.id)}>
                          <ArchiveIcon /> Archive
                        </button>
                        <button className="tp-action-btn tp-action-delete" onClick={() => deletePatient(p.id)}>
                          <TrashIcon /> Delete
                        </button>
                      </div>
                    </td>
                    <td className="tp-menu-cell">
                      <button
                        className="tp-kebab-btn"
                        onClick={() => setOpenMenuId(id => (id === p.id ? null : p.id))}
                        aria-label="Patient actions"
                        aria-expanded={openMenuId === p.id}
                      >
                        <KebabIcon />
                      </button>
                      {openMenuId === p.id && (
                        <div className="tp-row-menu">
                          <button onClick={() => { setMessagePt(p); setOpenMenuId(null) }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            Send message
                          </button>
                          <a
                            href={p.email ? `mailto:${p.email}` : undefined}
                            aria-disabled={!p.email}
                            onClick={(e) => { if (!p.email) e.preventDefault(); setOpenMenuId(null) }}
                          >
                            <EmailIcon />
                            Send email
                          </a>
                          <button onClick={() => { setProfilePt(p); setOpenMenuId(null) }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
                            View notes
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {showAdd && (
        <AddPatientModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
      {profilePt && (
        <ProfileModal
          patient={profilePt}
          onClose={() => setProfilePt(null)}
          onMessage={(p) => { setProfilePt(null); setMessagePt(p) }}
        />
      )}
      {messagePt && (
        <MessageModal
          patient={messagePt}
          messages={getMessages(messagePt.id)}
          onSend={handleSend}
          onClose={() => setMessagePt(null)}
        />
      )}
    </TherapistPageShell>
  )
}
