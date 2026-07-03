import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'

const patients = [
  { name: 'Juan Dela Cruz', condition: 'Speech Delay', lastVisit: 'Today', status: 'Active' },
  { name: 'Mika Santos', condition: 'Autism Spectrum Disorder', lastVisit: 'Yesterday', status: 'Active' },
  { name: 'Aira Lopez', condition: 'ADHD', lastVisit: '2 days ago', status: 'Review' },
]

export default function OwnerPatientsPage({ user, onLogout, betaTier }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Patients"
      subtitle="Track patient activity across all branches"
      icon="🧒"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="admin-list">
        {patients.map((patient) => (
          <div key={patient.name} className="admin-list-item">
            <div>
              <h4>{patient.name}</h4>
              <p>{patient.condition} · Last visit: {patient.lastVisit}</p>
            </div>
            <span className={`admin-pill ${patient.status === 'Active' ? 'green' : 'yellow'}`}>{patient.status}</span>
          </div>
        ))}
      </div>
    </OwnerPageShell>
  )
}
