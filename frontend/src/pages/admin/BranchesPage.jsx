import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const branches = [
  { name: 'Therapy Pro - Davao Main', location: 'Davao City', therapists: 12, status: 'Active' },
  { name: 'Therapy Pro - North Branch', location: 'Cagayan de Oro', therapists: 7, status: 'Active' },
  { name: 'Therapy Pro - Cebu Branch', location: 'Cebu City', therapists: 9, status: 'Review' },
]

export default function BranchesPage({ user, onLogout }) {
  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Branches"
      subtitle="View and manage clinic locations"
      icon="🏢"
      menuItems={adminMenuItems}
    >
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h3>Branch Directory</h3>
            <p>Unified branch overview in the same patient-style shell</p>
          </div>
          <button className="admin-btn">Add Branch</button>
        </div>

        <div className="admin-list">
          {branches.map((branch) => (
            <div key={branch.name} className="admin-list-item">
              <div>
                <h4>{branch.name}</h4>
                <p>{branch.location} · {branch.therapists} therapists assigned</p>
              </div>
              <span className={`admin-pill ${branch.status === 'Active' ? 'green' : 'yellow'}`}>{branch.status}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminPageShell>
  )
}
