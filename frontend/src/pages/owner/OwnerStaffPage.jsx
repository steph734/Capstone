import OwnerPageShell from './OwnerPageShell'
import { ownerMenuItems } from './ownerSidebarConfig'

const staff = [
  { name: 'Marco Reyes', role: 'Speech Therapist', branch: 'Main', status: 'On Duty' },
  { name: 'Jade Tan', role: 'Physical Therapist', branch: 'North', status: 'On Leave' },
  { name: 'Andre Lim', role: 'Behavior Therapist', branch: 'Cebu', status: 'On Duty' },
]

export default function OwnerStaffPage({ user, onLogout }) {
  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Staff"
      subtitle="Manage therapist and clinic staff assignments"
      icon="👥"
      menuItems={ownerMenuItems}
    >
      <div className="admin-list">
        {staff.map((member) => (
          <div key={member.name} className="admin-list-item">
            <div>
              <h4>{member.name}</h4>
              <p>{member.role} · {member.branch} branch</p>
            </div>
            <span className={`admin-pill ${member.status === 'On Duty' ? 'green' : 'yellow'}`}>{member.status}</span>
          </div>
        ))}
      </div>
    </OwnerPageShell>
  )
}
