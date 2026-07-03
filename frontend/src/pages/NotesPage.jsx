import { useState } from 'react'
import PatientSidebar from '../components/PatientSidebar'
import './PageWithSidebar.css'
import './NotesPage.css'

// ── Mock SOAP Notes ───────────────────────────────────────────────────────────
const MOCK_NOTES = [
  {
    id: 1, pinned: true,
    title: 'Session SOAP Note – Jun 30',
    date: 'Jun 30, 2026',
    shortDate: 'Jun 30',
    preview: 'Patient reports improved motor function and energy levels this week.',
    soap: {
      name: 'Alvrin Santos', date: 'June 30, 2026',
      diagnosis: 'Developmental delay – F82, Specific developmental disorder of motor function',
      subjective: 'Patient reports feeling more energetic this week. Completed all assigned home exercises. States "I feel stronger now." Parents confirm daily exercise compliance and improved mood.',
      objective: 'ROM improved by 15%. Left-hand grasp maintained for 3 seconds consistently. Single-leg balance: 8 seconds (up from 6). Fine motor task accuracy: 72%.',
      assessment: 'Patient is progressing well. Motor skills showing measurable improvement across all domains. Motivation is high. No adverse effects noted.',
      plan: 'Continue current exercise regimen. Add fine motor bead-threading activity. Schedule follow-up in 2 weeks. Monitor fatigue levels during sessions.',
    },
  },
  {
    id: 2, pinned: false,
    title: 'Session SOAP Note – Jul 2',
    date: 'Jul 2, 2026',
    shortDate: 'Jul 2',
    preview: 'Session focused on fine motor coordination and coin sorting tasks.',
    soap: {
      name: 'Alvrin Santos', date: 'July 2, 2026',
      diagnosis: 'Developmental delay – F82, ongoing OT',
      subjective: 'Patient arrived on time. Reports completing all home exercises. States thumb-and-index pinch feels easier. Good energy today.',
      objective: 'Coin sorting task completed in 45 sec (down from 62 sec). Balance: 9 seconds. Grip strength: 13 kg. Fine motor accuracy: 75%.',
      assessment: 'Continued steady improvement. Fine motor coordination responding well to current plan. Patient building confidence.',
      plan: 'Introduce scissor activities next session. Continue balance exercises. Home program: 15 min daily fine motor tasks.',
    },
  },
  {
    id: 3, pinned: false,
    title: 'Session SOAP Note – Jun 23',
    date: 'Jun 23, 2026',
    shortDate: 'Jun 23',
    preview: 'Some difficulty noted with wrist rotation. Fatigue observed.',
    soap: {
      name: 'Alvrin Santos', date: 'June 23, 2026',
      diagnosis: 'Developmental delay, motor dysfunction',
      subjective: 'Patient attended session on time. Reports some difficulty with wrist rotation exercises. States fatigue after prolonged activity. Slept well.',
      objective: 'Fine motor accuracy: 68%. Grip strength: 12 kg. Balance: 7 seconds. Wrist ROM slightly limited bilaterally.',
      assessment: 'Mild progress. Fatigue may be affecting performance. Duration of exercise sets may need adjustment.',
      plan: 'Reduce exercise sets to 3x each. Introduce rest intervals. Reassess wrist rotation next session. Check sleep schedule with parents.',
    },
  },
  {
    id: 4, pinned: false,
    title: 'Initial Assessment',
    date: 'Jun 16, 2026',
    shortDate: 'Jun 16',
    preview: 'Initial evaluation completed. Therapy recommended 2× per week.',
    soap: {
      name: 'Alvrin Santos', date: 'June 16, 2026',
      diagnosis: 'Developmental delay – referral from Dr. Cruz (pediatrician)',
      subjective: 'Referred for motor development delays. Parent reports difficulty with fine motor tasks and balance issues noticed since age 4. No known medical contraindications.',
      objective: 'Single-leg balance: 2 seconds. Grip strength: 8 kg. Fine motor accuracy: 40%. Unable to fasten buttons or use scissors independently.',
      assessment: 'Moderate motor skill delays across all domains. Good patient motivation and parent engagement. Prognosis is favorable with consistent therapy.',
      plan: 'Begin OT program 2×/week for 12 weeks. Focus: balance, grip strength, fine motor development. Establish 3-month functional goals with family.',
    },
  },
  {
    id: 5, pinned: false,
    title: 'Progress Report – May',
    date: 'May 31, 2026',
    shortDate: 'May 31',
    preview: 'Monthly summary. Good overall improvement. Patient can button shirt.',
    soap: {
      name: 'Alvrin Santos', date: 'May 31, 2026',
      diagnosis: 'Motor dysfunction, ongoing therapy',
      subjective: 'Patient and family report visible improvement in ADLs. Patient can now button shirt independently. Reports feeling proud of progress.',
      objective: 'Grip: 10 kg. Balance: 5 seconds. Fine motor accuracy: 58%. Improved button, zipper, and cup-stacking tasks.',
      assessment: 'Good progress over the month. Patient responding well to OT intervention. ADL independence improving.',
      plan: 'Continue plan. Introduce more complex fine motor tasks (lacing board). Increase to 3 sessions/week next month.',
    },
  },
  {
    id: 6, pinned: false,
    title: 'Session SOAP Note – Apr 28',
    date: 'Apr 28, 2026',
    shortDate: 'Apr 28',
    preview: 'Early sessions going well. Patient engaging positively with program.',
    soap: {
      name: 'Alvrin Santos', date: 'April 28, 2026',
      diagnosis: 'Developmental delay, motor dysfunction',
      subjective: 'Patient eager to participate. Reports enjoying exercises. Parent notes improved confidence at home. No complaints of pain.',
      objective: 'Grip: 9 kg. Balance: 3 seconds. Fine motor: 48%. Completing stacking tasks with fewer errors than Week 1.',
      assessment: 'Early positive response to therapy. Good therapeutic rapport. Parent actively reinforcing home program.',
      plan: 'Continue introductory program. Begin graduated difficulty in stacking tasks. Home program firmly established.',
    },
  },
]

// ── Grouping ──────────────────────────────────────────────────────────────────
function groupNotes(notes) {
  const today = new Date('2026-07-03')
  const pinned = notes.filter(n => n.pinned)
  const unpinned = notes.filter(n => !n.pinned)
  const prev7 = [], prev30 = [], byMonth = {}

  for (const note of unpinned) {
    const d = new Date(note.date)
    const diff = (today - d) / 86400000
    if (diff <= 7) {
      prev7.push(note)
    } else if (diff <= 30) {
      prev30.push(note)
    } else {
      const m = d.toLocaleString('default', { month: 'long' })
      if (!byMonth[m]) byMonth[m] = []
      byMonth[m].push(note)
    }
  }

  const groups = []
  if (prev7.length) groups.push({ label: 'Previous 7 Days', notes: prev7 })
  if (prev30.length) groups.push({ label: 'Previous 30 Days', notes: prev30 })
  Object.entries(byMonth).forEach(([month, notes]) => groups.push({ label: month, notes }))
  return { pinned, groups }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
}
function ComposeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
}
function ChevronDownIcon({ up }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <path d="M7 10l5 5 5-5z"/>
    </svg>
  )
}
function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
}
function PinIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
}
function ShareIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/></svg>
}
function MoreVertIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
}

// ── Note List Item ────────────────────────────────────────────────────────────
function NoteItem({ note, last, onClick, active, onTogglePin }) {
  return (
    <div className={`nl-item${active ? ' nl-item-active' : ''}${last ? ' nl-item-last' : ''}`}>
      {/* Left: clickable content to open the note */}
      <button className="nl-item-btn" onClick={onClick}>
        <div className="nl-item-title">{note.title}</div>
        <div className="nl-item-meta">
          <span className="nl-item-date">{note.shortDate}</span>
          <span className="nl-item-preview">{note.preview}</span>
        </div>
      </button>
      {/* Right: pin toggle */}
      <button
        className={`nl-pin-btn${note.pinned ? ' nl-pin-active' : ''}`}
        onClick={e => { e.stopPropagation(); onTogglePin(note.id) }}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
        aria-label={note.pinned ? 'Unpin' : 'Pin'}
      >
        {note.pinned ? '⭐' : '☆'}
      </button>
    </div>
  )
}

// ── SOAP Detail ───────────────────────────────────────────────────────────────
function SoapDetail({ note, onBack, onTogglePin }) {
  const s = note.soap
  return (
    <div className="nd-view">
      {/* Top bar */}
      <div className="nd-topbar">
        <button className="nd-back-btn" onClick={onBack}>
          <BackIcon />
          <span>Notes</span>
        </button>
        <div className="nd-topbar-actions">
          <button
            className={`nd-action-btn nd-pin-detail-btn${note.pinned ? ' nd-pin-detail-active' : ''}`}
            onClick={() => onTogglePin(note.id)}
            title={note.pinned ? 'Unpin this note' : 'Pin this note'}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            <span className="nd-pin-detail-star">{note.pinned ? '⭐' : '☆'}</span>
            <span className="nd-pin-detail-label">{note.pinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button className="nd-action-btn" aria-label="Share"><ShareIcon /></button>
          <button className="nd-action-btn" aria-label="More"><MoreVertIcon /></button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="nd-body">
        <div className="nd-notebook">
          {/* Spiral binding */}
          <div className="nd-spiral" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="nd-ring" />
            ))}
          </div>

          {/* Paper */}
          <div className="nd-paper">
            {/* Corner flower decoration */}
            <div className="nd-deco-tr">🌸</div>

            {/* Title row: title left, date right */}
            <div className="nd-title-row">
              <h2 className="nd-soap-title">Therapist Note</h2>
              <div className="nd-date-box">
                <span className="nd-field-label">📅 Date:</span>
                <span className="nd-field-val nd-field-line">{s.date}</span>
              </div>
            </div>

            {/* Name */}
            <div className="nd-field-row">
              <span className="nd-field-label">👤 Name:</span>
              <span className="nd-field-val nd-field-line">{s.name}</span>
            </div>

            {/* Diagnosis */}
            <div className="nd-field-row nd-field-row-last">
              <span className="nd-field-label">🩺 Diagnosis:</span>
              <span className="nd-field-val nd-field-line">{s.diagnosis}</span>
            </div>

            {/* Divider rule */}
            <div className="nd-rule" />

            {/* S — Subjective */}
            <div className="nd-section">
              <div className="nd-section-label nd-s">
                💬 Subjective
                <span className="nd-section-hint">What you said or felt</span>
              </div>
              <div className="nd-section-body">{s.subjective}</div>
            </div>

            {/* O — Objective */}
            <div className="nd-section">
              <div className="nd-section-label nd-o">
                👀 Objective
                <span className="nd-section-hint">What we observed</span>
              </div>
              <div className="nd-section-body">{s.objective}</div>
            </div>

            {/* A — Assessment */}
            <div className="nd-section">
              <div className="nd-section-label nd-a">
                📊 Assessment
                <span className="nd-section-hint">How you are doing</span>
              </div>
              <div className="nd-section-body">{s.assessment}</div>
            </div>

            {/* P — Plan */}
            <div className="nd-section">
              <div className="nd-section-label nd-p">
                🌟 Plan
                <span className="nd-section-hint">What's next for you</span>
              </div>
              <div className="nd-section-body">{s.plan}</div>
            </div>

            {/* Signature block */}
            <div className="nd-sig-block">
              <div className="nd-sig-cheer">✨ Great session today! ✨</div>
              <div className="nd-sig-right">
                <div className="nd-sig-line" />
                <span className="nd-sig-text">Therapist Signature</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty Detail Placeholder ──────────────────────────────────────────────────
function EmptyDetail() {
  return (
    <div className="nd-empty">
      <div className="nd-empty-icon">📝</div>
      <p>Pick a note to read! 🌈</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotesPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notes, setNotes] = useState(MOCK_NOTES)
  const [selectedId, setSelectedId] = useState(null)
  const [pinnedOpen, setPinnedOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [mobileView, setMobileView] = useState('list') // 'list' | 'detail'

  const togglePin = (id) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))
  }

  const filteredNotes = search.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.preview.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const { pinned, groups } = groupNotes(filteredNotes)
  const selectedNote = notes.find(n => n.id === selectedId)

  const openNote = (note) => {
    setSelectedId(note.id)
    setMobileView('detail')
  }

  const goBack = () => {
    setMobileView('list')
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

      <main className="page-content notes-page">
        <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

        <div className="notes-shell">

          {/* ── Left: Note List (Apple Notes style) ── */}
          <aside className={`notes-list-panel${mobileView === 'detail' ? ' nl-hidden' : ''}`}>
            {/* Header */}
            <div className="nl-header">
              <h1 className="nl-title">Notes</h1>
              <div className="nl-header-btns">
                <button className="nl-icon-btn" aria-label="Search"><SearchIcon /></button>
                <button className="nl-icon-btn" aria-label="New note"><ComposeIcon /></button>
              </div>
            </div>

            {/* Search */}
            <div className="nl-search-wrap">
              <span className="nl-search-icon"><SearchIcon /></span>
              <input
                className="nl-search-input"
                type="text"
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Scrollable content */}
            <div className="nl-body">

              {/* Pinned section */}
              {pinned.length > 0 && (
                <div className="nl-section">
                  <button className="nl-section-header" onClick={() => setPinnedOpen(v => !v)}>
                    <span className="nl-section-title">
                      ⭐ Pinned
                    </span>
                    <span className="nl-chevron"><ChevronDownIcon up={!pinnedOpen} /></span>
                  </button>
                  {pinnedOpen && (
                    <div className="nl-card">
                      {pinned.map((note, i) => (
                        <NoteItem
                          key={note.id}
                          note={note}
                          last={i === pinned.length - 1}
                          active={note.id === selectedId}
                          onClick={() => openNote(note)}
                          onTogglePin={togglePin}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Time groups */}
              {groups.map(group => (
                <div className="nl-section" key={group.label}>
                  <div className="nl-section-title nl-section-plain">{group.label}</div>
                  <div className="nl-card">
                    {group.notes.map((note, i) => (
                      <NoteItem
                        key={note.id}
                        note={note}
                        last={i === group.notes.length - 1}
                        active={note.id === selectedId}
                        onClick={() => openNote(note)}
                        onTogglePin={togglePin}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {pinned.length === 0 && groups.length === 0 && (
                <p className="nl-no-results">No notes found</p>
              )}
            </div>

            {/* Footer note count */}
            <div className="nl-footer">
              {notes.length} Notes · {notes.filter(n => n.pinned).length} Pinned
            </div>
          </aside>

          {/* ── Right: SOAP Detail ── */}
          <div className={`notes-detail-panel${mobileView === 'list' ? ' nd-hidden' : ''}`}>
            {selectedNote
              ? <SoapDetail note={selectedNote} onBack={goBack} onTogglePin={togglePin} />
              : <EmptyDetail />
            }
          </div>

        </div>
      </main>
    </div>
  )
}
