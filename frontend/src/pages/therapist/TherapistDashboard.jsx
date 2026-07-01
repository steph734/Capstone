import TherapistPageShell from './TherapistPageShell'
import { therapistMenuItems } from './therapistSidebarConfig'

export default function TherapistDashboard({ user, onLogout }) {
  const stats = [
    { label: 'Patients Assigned', value: '24', meta: '5 active today' },
    { label: 'Appointments Today', value: '8', meta: '2 pending' },
    { label: 'Notes Completed', value: '18', meta: 'This week' },
    { label: 'Exercises Assigned', value: '36', meta: '11 updated recently' },
  ]

  const reminders = [
    'Review Jasper’s speech progress note',
    'Prepare balance exercise set for afternoon sessions',
    'Follow up on parent feedback forms',
  ]

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Daily therapy workload and patient progress"
      icon="🩺"
      menuItems={therapistMenuItems}
    >
      <div className="admin-stats-grid">
        {stats.map((stat) => (
          <section key={stat.label} className="admin-stat-card">
            <p className="admin-stat-label">{stat.label}</p>
            <h3 className="admin-stat-value">{stat.value}</h3>
            <p className="admin-stat-meta">{stat.meta}</p>
          </section>
        ))}
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Today’s Focus</h3>
              <p>Priority items for the current shift</p>
            </div>
          </div>
          <div className="admin-list">
            {reminders.map((item) => (
              <div key={item} className="admin-list-item">
                <div>
                  <h4>{item}</h4>
                  <p>Marked for today</p>
                </div>
                <span className="admin-pill yellow">Pending</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Session Health</h3>
              <p>Quick status overview</p>
            </div>
          </div>
          <div className="admin-list">
            <div className="admin-list-item"><div><h4>Parents contacted</h4><p>15 successful calls</p></div><span className="admin-pill green">Good</span></div>
            <div className="admin-list-item"><div><h4>Follow-up notes</h4><p>3 need review</p></div><span className="admin-pill yellow">Review</span></div>
          </div>
        </section>
      </div>
    </TherapistPageShell>
  )
}
