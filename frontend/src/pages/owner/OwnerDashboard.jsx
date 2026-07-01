import OwnerPageShell from './OwnerPageShell'
import { ownerMenuItems } from './ownerSidebarConfig'

export default function OwnerDashboard({ user, onLogout }) {
  const stats = [
    { label: 'Appointments Today', value: '34', meta: '6 pending confirmation' },
    { label: 'Active Patients', value: '218', meta: '+14 this week' },
    { label: 'Staff Online', value: '19', meta: '4 currently in session' },
    { label: 'Gross Sales', value: '₱86K', meta: 'This month' },
  ]

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Overview of clinic operations, people, and revenue"
      icon="📈"
      menuItems={ownerMenuItems}
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
              <h3>Today’s Operations</h3>
              <p>Same clean patient-style UI, tuned for ownership oversight</p>
            </div>
          </div>
          <div className="admin-list">
            <div className="admin-list-item"><div><h4>Morning sessions fully booked</h4><p>Bookings at 92% capacity</p></div><span className="admin-pill green">Good</span></div>
            <div className="admin-list-item"><div><h4>Payment processing healthy</h4><p>No failed card retries</p></div><span className="admin-pill green">OK</span></div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Revenue Snapshot</h3>
              <p>Weekly billing summary</p>
            </div>
          </div>
          <div className="admin-list">
            <div className="admin-list-item"><div><h4>Paid Invoices</h4><p>₱54,200</p></div><span className="admin-pill green">+8%</span></div>
            <div className="admin-list-item"><div><h4>Outstanding</h4><p>₱7,400</p></div><span className="admin-pill yellow">Follow up</span></div>
          </div>
        </section>
      </div>
    </OwnerPageShell>
  )
}
