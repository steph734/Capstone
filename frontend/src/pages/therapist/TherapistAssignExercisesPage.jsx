import { useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'
import './TherapistAssignExercisesPage.css'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']
const PATIENTS = ['Alvrin', 'Aira Lopez', 'Mika Santos', 'Noah Cruz', 'Lily Santos', 'Jasper Reyes', 'Carlos Buen']

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

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
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

const AVATAR_COLORS = [
  { bg: '#d9efe7', color: '#159a72' },
  { bg: '#e7e3fb', color: '#6d5bd0' },
  { bg: '#d8ecfb', color: '#0284c7' },
  { bg: '#fbeacb', color: '#d97706' },
  { bg: '#fbdce8', color: '#db2777' },
]
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}

const EMPTY_FORM = { patient: '', exercise: '', domain: '', instructions: '', due: '' }

const initialAssignments = [
  { id: 1, patient: 'Aira Lopez', exercise: 'Memory Match', domain: 'Cognitive', instructions: '', due: addDays(0), status: 'Assigned' },
  { id: 2, patient: 'Mika Santos', exercise: 'Sound Builder', domain: 'Speech', instructions: '', due: addDays(1), status: 'Assigned' },
]

/* ── Icons ──────────────────────────────────────────────── */
const ico = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ClipboardIcon = () => <svg {...ico}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /><path d="M9 12h6M9 16h4" /></svg>
const ListIcon = () => <svg {...ico}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>
const UserIcon = () => <svg {...ico}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
const FileIcon = () => <svg {...ico}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
const DomainIcon = () => <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>
const CalIcon = () => <svg {...ico}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const CalMiniIcon = () => <svg {...ico} width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const ChevronIcon = () => <svg {...ico}><path d="M6 9l6 6 6-6" /></svg>
const SendIcon = () => <svg {...ico}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
const RefreshIcon = () => <svg {...ico}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>
const TrashIcon = () => <svg {...ico} width="15" height="15"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14M10 11v6M14 11v6" /></svg>
const BulbIcon = () => <svg {...ico}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>

export default function TherapistAssignExercisesPage({ user, onLogout, betaTier }) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [form, setForm] = useState(EMPTY_FORM)
  const { addExercise } = useSharedProgress()

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const reset = () => setForm(EMPTY_FORM)

  const handleSubmit = (event) => {
    event.preventDefault()
    const label = dueLabel(form.due)
    setAssignments((current) => [...current, { id: Date.now(), ...form, status: 'Assigned' }])
    // Alvrin is the demo patient wired to the parent-facing Progress page.
    if (form.patient.trim().toLowerCase() === 'alvrin') {
      addExercise({
        title: form.exercise,
        domain: form.domain,
        instructions: form.instructions.trim() || `Practice ${form.exercise} together for a few minutes.`,
        due: label,
      })
    }
    reset()
    logActivity({
      role: 'Therapist',
      user: user?.name || 'Therapist',
      email: user?.email || '—',
      actionIcon: '🎯',
      action: 'Exercise',
      description: `Assigned "${form.exercise}" to ${form.patient} (due ${label})`,
      entity: `Patient · ${form.patient}`,
      status: 'Success',
    })
  }

  const handleDelete = (id) => {
    const assignment = assignments.find((a) => a.id === id)
    setAssignments((current) => current.filter((a) => a.id !== id))
    if (assignment) {
      logActivity({
        role: 'Therapist',
        user: user?.name || 'Therapist',
        email: user?.email || '—',
        actionIcon: '🗑️',
        action: 'Exercise',
        description: `Removed "${assignment.exercise}" assignment for ${assignment.patient}`,
        entity: `Patient · ${assignment.patient}`,
        status: 'Review',
      })
    }
  }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Assign Exercises"
      subtitle="Create and manage home exercises for patients"
      icon="🎯"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div className="tae-grid">
        {/* ── New Assignment ── */}
        <section className="tae-card">
          <div className="tae-card-head">
            <span className="tae-card-icon"><ClipboardIcon /></span>
            <div>
              <h3>Create New Assignment</h3>
              <p>Add an exercise for a patient.</p>
            </div>
          </div>

          <form className="tae-form" onSubmit={handleSubmit}>
            <div className="tae-field">
              <label htmlFor="tae-patient">Patient name</label>
              <div className="tae-input-wrap">
                <span className="tae-input-icon"><UserIcon /></span>
                <select id="tae-patient" className="tae-select" value={form.patient} onChange={(e) => set('patient', e.target.value)} required>
                  <option value="" disabled>Select a patient</option>
                  {PATIENTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="tae-input-caret"><ChevronIcon /></span>
              </div>
            </div>

            <div className="tae-field">
              <label htmlFor="tae-exercise">Exercise name</label>
              <div className="tae-input-wrap">
                <span className="tae-input-icon"><FileIcon /></span>
                <input
                  id="tae-exercise"
                  value={form.exercise}
                  onChange={(e) => set('exercise', e.target.value)}
                  placeholder="e.g., Memory Match"
                  required
                />
              </div>
            </div>

            <div className="tae-field">
              <label htmlFor="tae-domain">Cognitive domain</label>
              <div className="tae-input-wrap">
                <span className="tae-input-icon"><DomainIcon /></span>
                <select id="tae-domain" className="tae-select" value={form.domain} onChange={(e) => set('domain', e.target.value)} required>
                  <option value="" disabled>Select cognitive domain</option>
                  {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="tae-input-caret"><ChevronIcon /></span>
              </div>
            </div>

            <div className="tae-field">
              <label htmlFor="tae-due">Due date</label>
              <div className="tae-input-wrap">
                <span className="tae-input-icon"><CalIcon /></span>
                <input
                  id="tae-due"
                  type="date"
                  value={form.due}
                  onChange={(e) => set('due', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="tae-field">
              <label htmlFor="tae-instructions">Instructions (optional)</label>
              <div className="tae-input-wrap tae-input-wrap-area">
                <span className="tae-input-icon"><FileIcon /></span>
                <textarea
                  id="tae-instructions"
                  value={form.instructions}
                  onChange={(e) => set('instructions', e.target.value)}
                  placeholder="Enter simple instructions for parents…"
                  rows={3}
                />
              </div>
            </div>

            <div className="tae-actions">
              <button className="tae-btn-primary" type="submit"><SendIcon /> Assign Exercise</button>
              <button className="tae-btn-secondary" type="button" onClick={reset}><RefreshIcon /> Clear</button>
            </div>
          </form>
        </section>

        {/* ── Current Assignments ── */}
        <section className="tae-card">
          <div className="tae-card-head">
            <span className="tae-card-icon"><ListIcon /></span>
            <div>
              <h3>Current Assignments</h3>
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
    </TherapistPageShell>
  )
}
