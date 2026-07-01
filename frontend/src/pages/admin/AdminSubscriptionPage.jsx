import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const plans = [
  { name: 'Free', price: '₱0', notes: 'Core booking and notes access', status: 'Current' },
  { name: 'Silver', price: '₱299', notes: 'Adds voice-assisted support', status: 'Locked' },
  { name: 'Gold', price: '₱499', notes: 'Adds games and avatar tools', status: 'Popular' },
]

export default function AdminSubscriptionPage({ user, onLogout }) {
  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Subscription"
      subtitle="Review active plans and upgrade options"
      icon="💳"
      menuItems={adminMenuItems}
    >
      <div className="admin-grid-2">
        {plans.map((plan) => (
          <section key={plan.name} className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>{plan.name} Plan</h3>
                <p>{plan.notes}</p>
              </div>
              <span className={`admin-pill ${plan.status === 'Current' ? 'green' : plan.status === 'Popular' ? 'yellow' : 'red'}`}>{plan.status}</span>
            </div>
            <h2 style={{ margin: '0 0 10px', color: '#2c4a3e' }}>{plan.price}</h2>
            <div className="admin-button-row">
              <button className="admin-btn">View Details</button>
              <button className="admin-btn-secondary">Edit Plan</button>
            </div>
          </section>
        ))}
      </div>
    </AdminPageShell>
  )
}
