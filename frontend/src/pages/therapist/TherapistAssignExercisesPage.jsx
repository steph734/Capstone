import { useEffect, useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import AssignGamesPlanner from './assign/AssignGamesPlanner'
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
      subtitle={`${todayLong} · pick today's games for each session. Only these games unlock for the patient.`}
      icon="🎯"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div className="tae-page">
        <AssignGamesPlanner onToast={showToast} />

        <section className="tae-card tae-assigned-card">
          <div className="tae-card-head">
            <span className="tae-card-icon"><ListIcon /></span>
            <div>
              <h3>Assigned Exercises</h3>
              <p>Live list of active home exercises</p>
            </div>
          </div>

          <div className="tae-list">
            {assignments.length === 0 && <p className="tae-empty">No active assignments yet.</p>}
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
      </div>

      {toast && <div className="tae-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
