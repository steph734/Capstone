import { useState } from 'react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'

const initialAssignments = [
  { id: 1, patient: 'Aira Lopez', exercise: 'Memory Match', due: 'Today', status: 'Assigned' },
  { id: 2, patient: 'Mika Santos', exercise: 'Sound Builder', due: 'Tomorrow', status: 'Assigned' },
]

export default function TherapistAssignExercisesPage({ user, onLogout, betaTier }) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [form, setForm] = useState({ patient: '', exercise: '', due: 'Today' })

  const handleSubmit = (event) => {
    event.preventDefault()
    setAssignments((currentAssignments) => [
      ...currentAssignments,
      { id: Date.now(), ...form, status: 'Assigned' },
    ])
    setForm({ patient: '', exercise: '', due: 'Today' })
  }

  const handleDelete = (id) => {
    setAssignments((currentAssignments) => currentAssignments.filter((assignment) => assignment.id !== id))
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
          <select value={form.due} onChange={(event) => setForm((current) => ({ ...current, due: event.target.value }))}>
            <option>Today</option>
            <option>Tomorrow</option>
            <option>This Week</option>
          </select>
          <div className="admin-button-row">
            <button className="admin-btn" type="submit">Assign Exercise</button>
            <button className="admin-btn-secondary" type="button" onClick={() => setForm({ patient: '', exercise: '', due: 'Today' })}>Clear</button>
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
                <p>{assignment.exercise} · Due {assignment.due}</p>
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
