import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

export default function SuperAdminDashboard({ user, onLogout }) {
  const stats = [
    { label: 'Branches', value: '12', meta: '3 new this quarter' },
    { label: 'Active Subscribers', value: '248', meta: '+18% from last month' },
    { label: 'Games in Library', value: '36', meta: '6 recently updated' },
    { label: 'Audit Events', value: '1,284', meta: '24 flagged today' },
  ]

  const activity = [
    'New branch added in Davao North',
    'Gold subscription plan updated',
    'Memory Match game edited by admin',
    'Suspicious login review completed',
  ]

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Monitor branches, plans, games, and audit activity"
      icon="📊"
      menuItems={adminMenuItems}
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
              <h3>Quick Actions</h3>
              <p>Common super admin tasks</p>
            </div>
          </div>
          <div className="admin-button-row">
            <button className="admin-btn">Add Branch</button>
            <button className="admin-btn-secondary">Create Game</button>
            <button className="admin-btn-secondary">Review Logs</button>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h3>Recent Activity</h3>
              <p>Latest admin updates</p>
            </div>
          </div>
          <div className="admin-list">
            {activity.map((item) => (
              <div key={item} className="admin-list-item">
                <div>
                  <h4>{item}</h4>
                  <p>Updated a few minutes ago</p>
                </div>
                <span className="admin-pill green">Live</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminPageShell>
  )
}
