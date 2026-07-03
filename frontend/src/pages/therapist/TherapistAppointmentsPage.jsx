import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'

const appointments = [
  { patient: 'Aira Lopez', date: 'July 1, 2026', time: '9:00 AM', status: 'Confirmed' },
  { patient: 'Mika Santos', date: 'July 1, 2026', time: '10:30 AM', status: 'Pending' },
  { patient: 'Noah Cruz', date: 'July 1, 2026', time: '1:00 PM', status: 'Confirmed' },
]

export default function TherapistAppointmentsPage({ user, onLogout, betaTier }) {
  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Review your upcoming sessions"
      icon="🗓️"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <section className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={`${appointment.patient}-${appointment.time}`}>
                <td>{appointment.patient}</td>
                <td>{appointment.date}</td>
                <td>{appointment.time}</td>
                <td><span className={`admin-pill ${appointment.status === 'Confirmed' ? 'green' : 'yellow'}`}>{appointment.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </TherapistPageShell>
  )
}
