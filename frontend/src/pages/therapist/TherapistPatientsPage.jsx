import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { useSharedMessages } from '../../context/MessagesContext'
import CallOverlay from '../../components/CallOverlay'
import { STREAM_THERAPIST_USER } from '../../utils/streamConfig'

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

const PATIENTS = [
  {
    id: 0,
    name: 'Alvrin',
    age: 14,
    condition: 'Anxiety Disorder',
    progress: 68,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=33',
    lastSession: 'Jul 3, 2026',
    nextSession: 'Jul 10, 2026',
    sessions: 36,
    guardian: 'Self / Parent',
    contact: '+63 912 000 0001',
    joined: 'Sep 1, 2025',
    notes: 'Alvrin has shown consistent improvement in managing anxiety triggers. CBT sessions have been highly productive, with notable progress in breathing techniques and cognitive reframing. Continue current treatment plan and begin exploring school reintegration strategies.',
  },
  {
    id: 1,
    name: 'Aira Lopez',
    age: 8,
    condition: 'ADHD',
    progress: 62,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=47',
    lastSession: 'Jul 2, 2026',
    nextSession: 'Jul 9, 2026',
    sessions: 24,
    guardian: 'Maria Lopez',
    contact: '+63 912 345 6789',
    joined: 'Jan 15, 2026',
    notes: 'Patient shows improvement in focus and attention span. Responds well to structured activities and positive reinforcement. Recommend continuing current behavior therapy plan with increased session frequency.',
  },
  {
    id: 2,
    name: 'Mika Santos',
    age: 6,
    condition: 'Speech Delay',
    progress: 74,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=45',
    lastSession: 'Jul 1, 2026',
    nextSession: 'Jul 8, 2026',
    sessions: 31,
    guardian: 'Ana Santos',
    contact: '+63 917 234 5678',
    joined: 'Nov 3, 2025',
    notes: 'Significant progress in articulation and vocabulary. Now forming 3-4 word sentences consistently. Guardian reports improvement in home communication. Continue speech exercises and introduce reading aloud activities.',
  },
  {
    id: 3,
    name: 'Noah Cruz',
    age: 10,
    condition: 'Autism Spectrum Disorder',
    progress: 48,
    status: 'Needs Review',
    avatar: 'https://i.pravatar.cc/150?img=11',
    lastSession: 'Jun 28, 2026',
    nextSession: 'Jul 5, 2026',
    sessions: 18,
    guardian: 'Roberto Cruz',
    contact: '+63 920 876 5432',
    joined: 'Feb 10, 2026',
    notes: 'Social engagement has plateaued over the last month. Sensory sensitivities remain a barrier. Recommend a team review to adjust current therapy plan and consider adding occupational therapy component.',
  },
  {
    id: 4,
    name: 'Sofia Reyes',
    age: 12,
    condition: 'Anxiety Disorder',
    progress: 81,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=49',
    lastSession: 'Jul 3, 2026',
    nextSession: 'Jul 10, 2026',
    sessions: 42,
    guardian: 'Carmen Reyes',
    contact: '+63 918 654 3210',
    joined: 'Sep 20, 2025',
    notes: 'Excellent progress with CBT techniques. Patient is applying coping strategies independently in school settings. Guardian reports reduced anxiety episodes. Begin gradual reduction of session frequency as per discharge plan.',
  },
  {
    id: 5,
    name: 'Liam Tan',
    age: 7,
    condition: 'Dyslexia',
    progress: 55,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=15',
    lastSession: 'Jun 30, 2026',
    nextSession: 'Jul 7, 2026',
    sessions: 20,
    guardian: 'Kevin Tan',
    contact: '+63 915 111 2233',
    joined: 'Dec 5, 2025',
    notes: 'Steady improvement in phonological awareness and letter recognition. School performance improving with accommodations in place. Continue multisensory reading approach and coordinate with school teacher.',
  },
  {
    id: 6,
    name: 'Emma Villanueva',
    age: 9,
    condition: 'PTSD',
    progress: 38,
    status: 'Needs Review',
    avatar: 'https://i.pravatar.cc/150?img=44',
    lastSession: 'Jun 25, 2026',
    nextSession: 'Jul 5, 2026',
    sessions: 15,
    guardian: 'Lisa Villanueva',
    contact: '+63 921 999 8877',
    joined: 'Mar 1, 2026',
    notes: 'Patient continues to experience flashbacks and sleep disturbances. Trauma-focused CBT has started but progress is slow. Coordinating with family for additional support. Review treatment approach with supervision team this week.',
  },
  {
    id: 7,
    name: 'Carlos Mendez',
    age: 11,
    condition: 'Down Syndrome',
    progress: 67,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=13',
    lastSession: 'Jul 2, 2026',
    nextSession: 'Jul 9, 2026',
    sessions: 28,
    guardian: 'Pedro Mendez',
    contact: '+63 916 444 5566',
    joined: 'Oct 12, 2025',
    notes: 'Good progress in adaptive skills and communication. Participating well in group activities. Fine motor skills improving with consistent OT exercises. Guardian is highly engaged and supportive of home practice.',
  },
  {
    id: 8,
    name: 'Isabella Park',
    age: 5,
    condition: 'Selective Mutism',
    progress: 72,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=48',
    lastSession: 'Jun 29, 2026',
    nextSession: 'Jul 6, 2026',
    sessions: 22,
    guardian: 'Jenny Park',
    contact: '+63 919 777 6655',
    joined: 'Jan 8, 2026',
    notes: 'Remarkable progress — now speaking in full sentences with familiar adults in therapy setting. Beginning generalization to school environment. Guardian working closely with kindergarten teacher. Continue graduated exposure plan.',
  },
  {
    id: 9,
    name: 'Jake Rivera',
    age: 8,
    condition: 'ADHD',
    progress: 59,
    status: 'Active',
    avatar: 'https://i.pravatar.cc/150?img=12',
    lastSession: 'Jul 1, 2026',
    nextSession: 'Jul 8, 2026',
    sessions: 19,
    guardian: 'Diana Rivera',
    contact: '+63 913 321 0987',
    joined: 'Feb 28, 2026',
    notes: 'Impulse control improving with behavior modification strategies. Teacher reports fewer classroom disruptions. Working on organizational skills for homework completion. Parent training sessions ongoing — family engagement is strong.',
  },
  {
    id: 10,
    name: 'Maya Torres',
    age: 7,
    condition: 'Autism Spectrum Disorder',
    progress: 43,
    status: 'Critical',
    avatar: 'https://i.pravatar.cc/150?img=46',
    lastSession: 'Jun 20, 2026',
    nextSession: 'Jul 5, 2026',
    sessions: 12,
    guardian: 'Rosa Torres',
    contact: '+63 922 555 4433',
    joined: 'Apr 14, 2026',
    notes: 'Significant regression observed over the past two weeks. Self-injurious behaviors have increased. Urgent review needed. Coordinating with pediatric psychiatrist for medication evaluation. Guardian has been notified and is in daily contact.',
  },
]

// Patient id=0 (Alvrin) messages come from MessagesContext — not seeded here.
const SEED_MESSAGES = {
  1:  [
    { from: 'them', text: 'Good morning! How is Aira doing this week?', time: 'Jun 30, 8:45 AM' },
    { from: 'me',   text: 'Good morning! She had a great session yesterday — her focus has improved noticeably.', time: 'Jun 30, 9:02 AM' },
    { from: 'them', text: 'That is wonderful to hear! She has been more settled at home too.', time: 'Jun 30, 9:10 AM' },
    { from: 'me',   text: 'That is great to know. Keep encouraging her morning routine — consistency really helps.', time: 'Jun 30, 9:15 AM' },
  ],
  2:  [
    { from: 'them', text: 'Hi, Mika said three new words at dinner last night!', time: 'Jul 1, 7:30 AM' },
    { from: 'me',   text: 'That is fantastic progress! Which words were they?', time: 'Jul 1, 8:00 AM' },
    { from: 'them', text: '"More", "please", and "mama". We were so happy!', time: 'Jul 1, 8:05 AM' },
    { from: 'me',   text: 'Amazing! Those are key functional words. Keep encouraging her at mealtimes.', time: 'Jul 1, 8:20 AM' },
  ],
  3:  [
    { from: 'them', text: 'Noah had a meltdown at school again this morning. I am worried.', time: 'Jun 27, 10:00 AM' },
    { from: 'me',   text: 'I understand. Can you tell me what triggered it?', time: 'Jun 27, 10:15 AM' },
    { from: 'them', text: 'The noise in the cafeteria seemed to overwhelm him.', time: 'Jun 27, 10:20 AM' },
    { from: 'me',   text: 'We will address sensory regulation in our next session. I will also contact his teacher.', time: 'Jun 27, 10:35 AM' },
  ],
  4:  [
    { from: 'them', text: 'Sofia presented in front of her class today and did not have a panic attack!', time: 'Jul 3, 3:15 PM' },
    { from: 'me',   text: 'That is a huge milestone! She worked so hard for that. Please tell her I am proud of her.', time: 'Jul 3, 3:30 PM' },
    { from: 'them', text: 'She is very proud of herself too. Thank you for everything.', time: 'Jul 3, 3:35 PM' },
  ],
  5:  [
    { from: 'them', text: 'Liam finished his reading worksheet without any help today!', time: 'Jun 30, 5:00 PM' },
    { from: 'me',   text: 'That is wonderful! The multisensory approach is clearly working for him.', time: 'Jun 30, 5:10 PM' },
    { from: 'them', text: 'He even asked to do an extra page. I could not believe it!', time: 'Jun 30, 5:12 PM' },
    { from: 'me',   text: 'Intrinsic motivation is the best sign. Keep that momentum going!', time: 'Jun 30, 5:20 PM' },
  ],
  6:  [
    { from: 'them', text: 'Emma had nightmares again last night. Should I bring her session forward?', time: 'Jun 25, 7:00 AM' },
    { from: 'me',   text: 'Yes, let us move her session to this Thursday. I will send a new calendar invite.', time: 'Jun 25, 7:30 AM' },
    { from: 'them', text: 'Thank you. She also refuses to go to school today.', time: 'Jun 25, 7:35 AM' },
    { from: 'me',   text: 'That is okay for today. Rest is important. We will work on school re-entry gradually.', time: 'Jun 25, 7:50 AM' },
  ],
  7:  [
    { from: 'them', text: 'Carlos tied his shoes by himself this morning! First time ever!', time: 'Jul 2, 9:00 AM' },
    { from: 'me',   text: 'What a milestone! All those fine motor exercises are paying off.', time: 'Jul 2, 9:10 AM' },
    { from: 'them', text: 'He was so proud. He made us watch five times!', time: 'Jul 2, 9:12 AM' },
    { from: 'me',   text: 'That is the best! Celebrate those wins — they matter so much to his confidence.', time: 'Jul 2, 9:20 AM' },
  ],
  8:  [
    { from: 'them', text: 'Isabella spoke to her teacher today without being prompted!', time: 'Jun 29, 2:00 PM' },
    { from: 'me',   text: 'That is incredible! Spontaneous speech with a new adult is a major breakthrough.', time: 'Jun 29, 2:15 PM' },
    { from: 'them', text: 'Her teacher was amazed. She even smiled after!', time: 'Jun 29, 2:18 PM' },
    { from: 'me',   text: 'Wonderful. Let us keep the exposure plan gradual and celebrate every step.', time: 'Jun 29, 2:30 PM' },
  ],
  9:  [
    { from: 'them', text: 'Jake completed all his homework this week without a single reminder!', time: 'Jul 1, 6:00 PM' },
    { from: 'me',   text: 'That is a big deal! The checklist system you set up at home is working perfectly.', time: 'Jul 1, 6:15 PM' },
    { from: 'them', text: 'He even organized his backpack on his own. I am shocked in the best way.', time: 'Jul 1, 6:20 PM' },
    { from: 'me',   text: 'Keep reinforcing it positively! We will build on this in our next session.', time: 'Jul 1, 6:30 PM' },
  ],
  10: [
    { from: 'them', text: 'Maya hurt herself again this morning. I am scared. What do I do?', time: 'Jun 20, 8:00 AM' },
    { from: 'me',   text: 'I am so sorry. Please keep her safe and stay calm with her. I am calling you now.', time: 'Jun 20, 8:05 AM' },
    { from: 'them', text: 'Thank you for calling. She has calmed down but I am still shaking.', time: 'Jun 20, 9:30 AM' },
    { from: 'me',   text: 'You are doing the right things. I have escalated her case and we will meet this week urgently.', time: 'Jun 20, 9:40 AM' },
  ],
}

const STATUS_CONFIG = {
  Active:          { cls: 'tp-pill-green',  dot: 'dot-green'  },
  'Needs Review':  { cls: 'tp-pill-yellow', dot: 'dot-yellow' },
  Critical:        { cls: 'tp-pill-red',    dot: 'dot-red'    },
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
              <span className="tp-detail-lbl">Guardian</span>
              <span className="tp-detail-val">{patient.guardian}</span>
            </div>
            <div className="tp-detail-row">
              <span className="tp-detail-lbl">Contact</span>
              <span className="tp-detail-val">{patient.contact}</span>
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
                <option>Needs Review</option>
                <option>Critical</option>
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
  const [patients, setPatients]   = useState(PATIENTS)
  const [showAdd, setShowAdd]     = useState(false)
  const [profilePt, setProfilePt] = useState(null)
  const [messagePt, setMessagePt] = useState(null)
  const [threads, setThreads]     = useState(SEED_MESSAGES)

  const { thread, sendAsTherapist } = useSharedMessages()

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

  const filtered = patients.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.name.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q)
    const matchFilter = filter === 'All' || p.status === filter
    return matchSearch && matchFilter
  })

  const counts = {
    total:    patients.length,
    active:   patients.filter(p => p.status === 'Active').length,
    review:   patients.filter(p => p.status === 'Needs Review').length,
    critical: patients.filter(p => p.status === 'Critical').length,
  }

  const handleAdd = (form) => {
    const seed = Math.floor(Math.random() * 70) + 1
    const newPt = {
      id:          Date.now(),
      name:        form.name,
      age:         Number(form.age) || 0,
      condition:   form.condition,
      progress:    0,
      status:      form.status,
      avatar:      `https://i.pravatar.cc/150?img=${seed}`,
      lastSession: 'Not yet',
      nextSession: 'TBD',
      sessions:    0,
      guardian:    'Not specified',
      contact:     'Not specified',
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
      {/* Stats Strip */}
      <div className="tp-stats-strip">
        <div className="tp-stat-item tp-stat-total">
          <span className="tp-stat-num">{counts.total}</span>
          <span className="tp-stat-lbl">Total Patients</span>
        </div>
        <div className="tp-stat-sep" />
        <div className="tp-stat-item tp-stat-active">
          <span className="tp-stat-num">{counts.active}</span>
          <span className="tp-stat-lbl">Active</span>
        </div>
        <div className="tp-stat-sep" />
        <div className="tp-stat-item tp-stat-review">
          <span className="tp-stat-num">{counts.review}</span>
          <span className="tp-stat-lbl">Needs Review</span>
        </div>
        <div className="tp-stat-sep" />
        <div className="tp-stat-item tp-stat-critical">
          <span className="tp-stat-num">{counts.critical}</span>
          <span className="tp-stat-lbl">Critical</span>
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
          {['All', 'Active', 'Needs Review', 'Critical'].map(f => (
            <button key={f} className={`tp-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button className="tp-add-btn" onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Patient
        </button>
      </div>

      {/* Patient Cards */}
      <div className="tp-patients-grid">
        {filtered.length === 0 ? (
          <p className="tp-empty">No patients match your search.</p>
        ) : filtered.map(p => {
          const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG['Active']
          return (
            <div key={p.id} className="tp-patient-card">
              <div className="tp-card-top">
                <div className="tp-avatar-wrap">
                  <img src={p.avatar} alt={p.name} className="tp-avatar" />
                  <span className={`tp-status-dot ${sc.dot}`} />
                </div>
                <div className="tp-card-info">
                  <h3 className="tp-patient-name">{p.name}</h3>
                  <span className="tp-patient-age">Age {p.age}</span>
                </div>
                <span className={`tp-pill ${sc.cls}`}>{p.status}</span>
              </div>

              <span className="tp-condition-badge">{p.condition}</span>

              <div className="tp-session-info">
                <div className="tp-session-item">
                  <span className="tp-session-lbl">Last Session</span>
                  <span className="tp-session-val">{p.lastSession}</span>
                </div>
                <div className="tp-session-item">
                  <span className="tp-session-lbl">Next Session</span>
                  <span className="tp-session-val">{p.nextSession}</span>
                </div>
                <div className="tp-session-item">
                  <span className="tp-session-lbl">Sessions</span>
                  <span className="tp-session-val">{p.sessions}</span>
                </div>
              </div>

              <div className="tp-card-actions">
                <button className="tp-action-btn tp-action-view" onClick={() => setProfilePt(p)}>
                  View Profile
                </button>
                <button className="tp-action-btn tp-action-msg" onClick={() => setMessagePt(p)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Message
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
