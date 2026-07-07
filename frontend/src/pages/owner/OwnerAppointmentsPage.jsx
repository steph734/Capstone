import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'

const appointments = [
  { patient: 'Juan Dela Cruz', therapist: 'Marco Reyes', time: '9:00 AM', status: 'Confirmed' },
  { patient: 'Mika Santos', therapist: 'Jade Tan', time: '10:30 AM', status: 'Pending' },
  { patient: 'Aira Lopez', therapist: 'Andre Lim', time: '1:00 PM', status: 'Confirmed' },
]

export default function OwnerAppointmentsPage({ user, onLogout, betaTier }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Monitor bookings and session flow"
      icon="🗓️"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <section className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr><th>Patient</th><th>Therapist</th><th>Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={`${appointment.patient}-${appointment.time}`}>
                <td>{appointment.patient}</td>
                <td>{appointment.therapist}</td>
                <td>{appointment.time}</td>
                <td><span className={`admin-pill ${appointment.status === 'Confirmed' ? 'green' : 'yellow'}`}>{appointment.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </OwnerPageShell>
  )
}
