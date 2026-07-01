import OwnerPageShell from './OwnerPageShell'
import { ownerMenuItems } from './ownerSidebarConfig'

const reports = [
  { title: 'Monthly Revenue', detail: '₱86,000 collected', status: 'Up 12%' },
  { title: 'Attendance Rate', detail: '94% session attendance', status: 'Stable' },
  { title: 'Patient Growth', detail: '18 new patients', status: 'Up 7%' },
]

export default function OwnerReportsPage({ user, onLogout }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Reports"
      subtitle="See performance summaries and trends"
      icon="📑"
      menuItems={ownerMenuItems}
    >
      <div className="admin-grid-2">
        {reports.map((report) => (
          <section key={report.title} className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>{report.title}</h3>
                <p>{report.detail}</p>
              </div>
              <span className="admin-pill green">{report.status}</span>
            </div>
            <div className="admin-button-row">
              <button className="admin-btn">View Report</button>
              <button className="admin-btn-secondary">Export</button>
            </div>
          </section>
        ))}
      </div>
    </OwnerPageShell>
  )
}
