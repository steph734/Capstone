import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import AssignGamesPlanner from './assign/AssignGamesPlanner'
import HomePracticeTab from './assign/homeSets/HomePracticeTab'
import TherapySessionTab from './assign/homeSets/TherapySessionTab'
import useHomeSets from './assign/homeSets/useHomeSets'
import './assign/homeSets/homeSets.css'
import { authFetch } from '../../utils/session'
import './TherapistAssignExercisesPage.css'

function dueLabel(iso) {
  if (!iso) return '—'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso + 'T00:00')
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dueTone(iso) {
  const label = dueLabel(iso)
  if (label === 'Today' || label === 'Yesterday') return 'tae-due-red'
  if (label === 'Tomorrow') return 'tae-due-amber'
  return 'tae-due-gray'
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

const AVATAR_COLORS = [
  { bg: '#d9efe7', color: '#159a72' },
  { bg: '#e7e3fb', color: '#6d5bd0' },
  { bg: '#d8ecfb', color: '#0284c7' },
  { bg: '#fbeacb', color: '#d97706' },
  { bg: '#fbdce8', color: '#db2777' },
]
function avatarColor(name) {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

/* ── Icons ──────────────────────────────────────────────── */
const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ListIcon = () => <svg {...ico}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
const CalMiniIcon = () => <svg {...ico} width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const TrashIcon = () => <svg {...ico} width="15" height="15"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" /></svg>
const BulbIcon = () => <svg {...ico}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>

// therapy_notes-style API row -> the {patient, exercise, domain, due,
// status} shape the Assigned Exercises list already renders.
function fromApiAssignment(a) {
  return {
    id: a.id,
    patient: a.patientName,
    exercise: a.exercise,
    domain: a.domain,
    instructions: a.instructions,
    due: a.due,
    status: a.status,
  }
}

export default function TherapistAssignExercisesPage({ user, onLogout, betaTier }) {
  const [assignments, setAssignments] = useState([])
  const [toast, setToast] = useState('')
  const [plans, setPlans] = useState([])
  // Two tabs: Therapy session (today) and Home practice (sets of games at home). The tab lives in the URL: ?tab=therapy|home.
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'home' ? 'home' : 'therapy'
  const setTab = (id) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', id); return n }, { replace: true })
  const home = useHomeSets()
  const needsNew = (home.data?.patients || []).filter((p) => p.needsNew)
  const tabRefs = useRef([])
  const onTabKey = (e, i) => {
    const n = e.key === 'ArrowRight' ? (i + 1) % 2 : e.key === 'ArrowLeft' ? (i + 1) % 2 : null
    if (n == null) return
    e.preventDefault(); setTab(['therapy', 'home'][n]); tabRefs.current[n]?.focus()
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200) }

  // Home exercises already assigned (kept as its own list below the game planner).
  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    fetch(`/api/exercises/therapist-list?email=${encodeURIComponent(user.email)}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`); return b.assignments || [] })
      .then((list) => { if (!cancelled) setAssignments(list.map(fromApiAssignment)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.email])

  // The games this therapist assigned (session plans), kept fresh while the page is open.
  useEffect(() => {
    let alive = true
    const load = () => { if (!document.hidden) authFetch('/api/therapist/game-plans/history').then((d) => { if (alive) setPlans(d.plans || []) }).catch(() => {}) }
    load()
    const t = setInterval(load, 15000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const handleDelete = async (id) => {
    const assignment = assignments.find((a) => a.id === id)
    setAssignments((current) => current.filter((a) => a.id !== id))
    try {
      const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`) }
    } catch (err) {
      if (assignment) setAssignments((current) => [assignment, ...current])
      showToast(err.message || 'Could not delete this assignment. Please try again.')
      return
    }
    if (assignment) {
      logActivity({ role: 'Therapist', user: user?.name || 'Therapist', email: user?.email || '—', actionIcon: '🗑️', action: 'Exercise', description: `Removed "${assignment.exercise}" assignment for ${assignment.patient}`, entity: `Patient · ${assignment.patient}`, status: 'Review' })
    }
  }

  const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Assign Games"
      subtitle={tab === 'home' ? `${todayLong} · manage the games each patient plays at home.` : `${todayLong} · pick today's games for each session. Only these games unlock for the patient.`}
      icon="🎯"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div className="tae-page">
        <div className="hs-tabs" role="tablist" aria-label="Assign games">
          <button ref={(el) => { tabRefs.current[0] = el }} type="button" role="tab" id="tab-therapy" aria-selected={tab === 'therapy'} aria-controls="panel-therapy" tabIndex={tab === 'therapy' ? 0 : -1} className="hs-tab-btn therapy" onClick={() => setTab('therapy')} onKeyDown={(e) => onTabKey(e, 0)}>
            <span className="ico" aria-hidden="true">📅</span><span className="txt"><b>Therapy session</b><small>Games for today&apos;s session</small></span>
          </button>
          <button ref={(el) => { tabRefs.current[1] = el }} type="button" role="tab" id="tab-home" aria-selected={tab === 'home'} aria-controls="panel-home" tabIndex={tab === 'home' ? 0 : -1} className="hs-tab-btn home" onClick={() => setTab('home')} onKeyDown={(e) => onTabKey(e, 1)}>
            <span className="ico" aria-hidden="true">🏠</span><span className="txt"><b>Home practice</b><small>Games each patient plays at home</small></span>
            {needsNew.length > 0 && <span className="hs-count-badge">{needsNew.length} needs new games</span>}
          </button>
        </div>

        {tab === 'home' ? (
          <HomePracticeTab overview={home.data} loading={home.loading} error={home.error} onReload={home.reload} onSetupHome={() => setTab('therapy')} />
        ) : (
        <TherapySessionTab needsNew={needsNew} onGoHome={() => setTab('home')}>
        <AssignGamesPlanner onToast={showToast} onAssigned={home.reload} />

        <section className="tae-card tae-assigned-card">
          <div className="tae-card-head">
            <span className="tae-card-icon"><ListIcon /></span>
            <div>
              <h3>Assigned Exercises</h3>
              <p>Live list of active home exercises</p>
            </div>
          </div>

          <div className="tae-list">
            {assignments.length === 0 && plans.length === 0 && <p className="tae-empty">No active assignments yet.</p>}
            {plans.map((p) => {
              const c = avatarColor(p.patientName)
              const done = p.games.filter((g) => g.status === 'done').length
              const label = p.status === 'ended' ? 'Ended' : p.status === 'paused' ? 'Paused' : p.status === 'active' ? (p.games.some((g) => g.status === 'in_progress') ? 'Playing' : 'Open now') : 'Scheduled'
              return (
                <div key={p.id} className="tae-assignment">
                  <span className="tae-avatar" style={{ background: c.bg, color: c.color }}>{initials(p.patientName)}</span>
                  <div className="tae-assignment-body">
                    <span className="tae-assignment-name">{p.patientName}</span>
                    <span className="tae-assignment-meta">{p.games.map((g) => g.name).join(', ')}</span>
                    <span className={`tae-due ${dueTone(p.date)}`}><CalMiniIcon /> {dueLabel(p.date)} · {done} of {p.games.length} done{p.atHomeUntil ? ' · home practice on' : ''}</span>
                    <span className="tae-pill">{label}</span>
                  </div>
                </div>
              )
            })}
            {assignments.map((a) => {
              const c = avatarColor(a.patient)
              return (
                <div key={a.id} className="tae-assignment">
                  <span className="tae-avatar" style={{ background: c.bg, color: c.color }}>{initials(a.patient)}</span>
                  <div className="tae-assignment-body">
                    <span className="tae-assignment-name">{a.patient}</span>
                    <span className="tae-assignment-meta">{a.exercise} · {a.domain}</span>
                    <span className={`tae-due ${dueTone(a.due)}`}><CalMiniIcon /> Due {dueLabel(a.due)}</span>
                    <span className="tae-pill">{a.status}</span>
                  </div>
                  <button className="tae-delete" onClick={() => handleDelete(a.id)}><TrashIcon /> Delete</button>
                </div>
              )
            })}
          </div>

          <div className="tae-tip">
            <span className="tae-tip-icon"><BulbIcon /></span>
            <div>
              <strong>Tip</strong>
              <p>Consistent home practice helps patients make better progress.</p>
            </div>
          </div>
        </section>
        </TherapySessionTab>
        )}
      </div>

      {toast && <div className="tae-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
