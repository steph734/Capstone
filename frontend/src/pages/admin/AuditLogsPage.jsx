import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const logs = [
  { action: 'Updated Gold plan pricing', admin: 'Super Admin', time: 'Today, 9:12 AM', status: 'Success' },
  { action: 'Added North Branch', admin: 'Super Admin', time: 'Today, 8:45 AM', status: 'Success' },
  { action: 'Edited Memory Match game', admin: 'Super Admin', time: 'Yesterday, 4:20 PM', status: 'Review' },
  { action: 'Exported monthly audit report', admin: 'Super Admin', time: 'Yesterday, 2:05 PM', status: 'Success' },
]

export default function AuditLogsPage({ user, onLogout }) {
  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Audit Logs"
      subtitle="Track administrative changes and actions"
      icon="🧾"
      menuItems={adminMenuItems}
    >
      <section className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={`${log.action}-${log.time}`}>
                <td>{log.action}</td>
                <td>{log.admin}</td>
                <td>{log.time}</td>
                <td>
                  <span className={`admin-pill ${log.status === 'Success' ? 'green' : 'yellow'}`}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminPageShell>
  )
}
