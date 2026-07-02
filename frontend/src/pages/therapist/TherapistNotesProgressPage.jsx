import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'

const entries = [
  { patient: 'Aira Lopez', note: 'Improved attention span during drills', progress: '78%' },
  { patient: 'Mika Santos', note: 'Stronger articulation on target sounds', progress: '65%' },
  { patient: 'Noah Cruz', note: 'Needs more repetition for sequencing tasks', progress: '52%' },
]

export default function TherapistNotesProgressPage({ user, onLogout, betaTier }) {
  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Notes & Progress"
      subtitle="Document session notes and track outcomes"
      icon="📝"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div className="admin-grid-2">
        {entries.map((entry) => (
          <section key={entry.patient} className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>{entry.patient}</h3>
                <p>{entry.note}</p>
              </div>
              <span className="admin-pill green">{entry.progress}</span>
            </div>
            <div className="admin-button-row">
              <button className="admin-btn">Add Note</button>
              <button className="admin-btn-secondary">Update Progress</button>
            </div>
          </section>
        ))}
      </div>
    </TherapistPageShell>
  )
}
