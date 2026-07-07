import { useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { useSharedProgress } from '../../context/ProgressContext'

const DOMAINS = ['Cognitive', 'Physical', 'Occupational', 'Speech']

const initialAssignments = [
  { id: 1, patient: 'Aira Lopez', exercise: 'Memory Match', domain: 'Cognitive', instructions: '', due: 'Today', status: 'Assigned' },
  { id: 2, patient: 'Mika Santos', exercise: 'Sound Builder', domain: 'Speech', instructions: '', due: 'Tomorrow', status: 'Assigned' },
]

export default function TherapistAssignExercisesPage({ user, onLogout, betaTier }) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [form, setForm] = useState({ patient: '', exercise: '', domain: DOMAINS[0], instructions: '', due: 'Today' })
  const { addExercise } = useSharedProgress()

  const handleSubmit = (event) => {
    event.preventDefault()
    setAssignments((currentAssignments) => [
      ...currentAssignments,
      { id: Date.now(), ...form, status: 'Assigned' },
    ])
    // Alvrin is the demo patient wired to the parent-facing Progress page.
    if (form.patient.trim().toLowerCase() === 'alvrin') {
      addExercise({
        title: form.exercise,
        domain: form.domain,
        instructions: form.instructions.trim() || `Practice ${form.exercise} together for a few minutes.`,
        due: form.due,
      })
    }
    setForm({ patient: '', exercise: '', domain: DOMAINS[0], instructions: '', due: 'Today' })
    logActivity({
      role: 'Therapist',
      user: user?.name || 'Therapist',
      email: user?.email || '—',
      actionIcon: '🎯',
      action: 'Exercise',
      description: `Assigned "${form.exercise}" to ${form.patient} (due ${form.due})`,
      entity: `Patient · ${form.patient}`,
      status: 'Success',
    })
  }

  const handleDelete = (id) => {
    const assignment = assignments.find((a) => a.id === id)
    setAssignments((currentAssignments) => currentAssignments.filter((assignment) => assignment.id !== id))
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
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>New Assignment</h3>
            <p>Add an exercise for a patient</p>
          </div>
        </div>

        <form className="admin-modal-form" onSubmit={handleSubmit}>
          <input
            value={form.patient}
            onChange={(event) => setForm((current) => ({ ...current, patient: event.target.value }))}
            placeholder="Patient name"
            required
          />
          <input
            value={form.exercise}
            onChange={(event) => setForm((current) => ({ ...current, exercise: event.target.value }))}
            placeholder="Exercise name"
            required
          />
          <select value={form.domain} onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}>
            {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={form.due} onChange={(event) => setForm((current) => ({ ...current, due: event.target.value }))}>
            <option>Today</option>
            <option>Tomorrow</option>
            <option>This Week</option>
          </select>
          <input
            value={form.instructions}
            onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
            placeholder="Simple instructions for parents (optional)"
          />
          <div className="admin-button-row">
            <button className="admin-btn" type="submit">Assign Exercise</button>
            <button className="admin-btn-secondary" type="button" onClick={() => setForm({ patient: '', exercise: '', domain: DOMAINS[0], instructions: '', due: 'Today' })}>Clear</button>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Current Assignments</h3>
            <p>Live list of active home exercises</p>
          </div>
        </div>

        <div className="games-list">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="game-card">
              <div>
                <h4>{assignment.patient}</h4>
                <p>{assignment.exercise} · {assignment.domain} · Due {assignment.due}</p>
                <div className="admin-button-row" style={{ marginTop: '10px' }}>
                  <span className="admin-pill green">{assignment.status}</span>
                </div>
              </div>
              <div className="game-actions">
                <button className="admin-btn-danger" onClick={() => handleDelete(assignment.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </TherapistPageShell>
  )
}
