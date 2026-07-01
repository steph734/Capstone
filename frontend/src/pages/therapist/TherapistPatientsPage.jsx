import TherapistPageShell from './TherapistPageShell'
import { therapistMenuItems } from './therapistSidebarConfig'

const patients = [
  { name: 'Aira Lopez', condition: 'ADHD', progress: '62%', status: 'Active' },
  { name: 'Mika Santos', condition: 'Speech Delay', progress: '74%', status: 'Active' },
  { name: 'Noah Cruz', condition: 'Autism Spectrum Disorder', progress: '48%', status: 'Needs Review' },
]

export default function TherapistPatientsPage({ user, onLogout }) {
  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="My Patients"
      subtitle="Track your assigned patients and current progress"
      icon="👨‍👩‍👧"
      menuItems={therapistMenuItems}
    >
      <div className="admin-list">
        {patients.map((patient) => (
          <div key={patient.name} className="admin-list-item">
            <div>
              <h4>{patient.name}</h4>
              <p>{patient.condition} · Progress {patient.progress}</p>
            </div>
            <span className={`admin-pill ${patient.status === 'Active' ? 'green' : 'yellow'}`}>{patient.status}</span>
          </div>
        ))}
      </div>
    </TherapistPageShell>
  )
}
