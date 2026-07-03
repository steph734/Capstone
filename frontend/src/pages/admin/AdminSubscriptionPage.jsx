import { useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const plans = [
  { name: 'Free', price: '₱0', notes: 'Core booking and notes access', status: 'Current' },
  { name: 'Silver', price: '₱299', notes: 'Adds voice-assisted support', status: 'Locked' },
  { name: 'Gold', price: '₱499', notes: 'Adds games and avatar tools', status: 'Popular' },
]

const allUsers = [
  { name: 'Alvrin', role: 'Patient', email: 'patient@gmail.com' },
  { name: 'Super Admin', role: 'Super Admin', email: 'superadmin@gmail.com' },
  { name: 'Owner', role: 'Owner', email: 'owner@gmail.com' },
  { name: 'Therapist', role: 'Therapist', email: 'therapists@gmail.com' },
]

const buildDefaultBetaStatus = () => ({
  Free: {
    'patient@gmail.com': true,
    'superadmin@gmail.com': false,
    'owner@gmail.com': false,
    'therapists@gmail.com': false,
  },
  Silver: {
    'patient@gmail.com': false,
    'superadmin@gmail.com': false,
    'owner@gmail.com': true,
    'therapists@gmail.com': true,
  },
  Gold: {
    'patient@gmail.com': false,
    'superadmin@gmail.com': true,
    'owner@gmail.com': true,
    'therapists@gmail.com': false,
  },
})

export default function AdminSubscriptionPage({ user, onLogout }) {
  const [betaModalPlan, setBetaModalPlan] = useState(null)
  const [betaStatusByPlan, setBetaStatusByPlan] = useState(buildDefaultBetaStatus)

  const hasActiveBetaTesters = (planName) => {
    return Object.values(betaStatusByPlan[planName] || {}).some(Boolean)
  }

  const handleAddSubscription = () => {
    console.log('Add subscription')
  }

  const handleOpenBetaModal = (planName) => {
    setBetaModalPlan(planName)
  }

  const handleCloseBetaModal = () => {
    setBetaModalPlan(null)
  }

  const handleToggleBetaStatus = (planName, email) => {
    setBetaStatusByPlan((currentStatus) => ({
      ...currentStatus,
      [planName]: {
        ...currentStatus[planName],
        [email]: !currentStatus[planName]?.[email],
      },
    }))
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Subscription"
      subtitle="Review active plans and upgrade options"
      icon="💳"
      menuItems={adminMenuItems}
    >
      <div className="admin-toolbar admin-subscription-toolbar">
        <div>
          <h3 className="admin-subscription-toolbar-title">Plan controls</h3>
          <p className="admin-subscription-toolbar-text">Manage tier access from a single place for all users.</p>
        </div>
        <button className="admin-btn admin-subscription-add-btn" onClick={handleAddSubscription}>
          Add Subscription
        </button>
      </div>

      <div className="admin-grid-2">
        {plans.map((plan) => (
          <section key={plan.name} className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>{plan.name} Plan</h3>
                <p>{plan.notes}</p>
              </div>
              <div className="admin-panel-tags">
                {hasActiveBetaTesters(plan.name) && <span className="admin-pill beta">Beta</span>}
                <span className={`admin-pill ${plan.status === 'Current' ? 'green' : plan.status === 'Popular' ? 'yellow' : 'red'}`}>{plan.status}</span>
              </div>
            </div>
            <h2 style={{ margin: '0 0 10px', color: '#2c4a3e' }}>{plan.price}</h2>
            <div className="admin-button-row">
              <button className="admin-btn">View Details</button>
              <button className="admin-btn-secondary">Edit Plan</button>
              <button className="admin-btn-secondary admin-beta-btn" onClick={() => handleOpenBetaModal(plan.name)}>
                Beta Testing
              </button>
            </div>
          </section>
        ))}
      </div>

      {betaModalPlan && (
        <div className="admin-modal-backdrop" onClick={handleCloseBetaModal}>
          <div className="admin-modal admin-beta-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>Beta Testing - {betaModalPlan} Plan</h3>
                <p>All registered user emails with Active or Inactive beta tester status.</p>
              </div>
              <button className="admin-btn-secondary" onClick={handleCloseBetaModal}>
                Close
              </button>
            </div>

            <div className="admin-list">
              {allUsers.map((betaUser) => {
                const isActive = betaStatusByPlan[betaModalPlan]?.[betaUser.email]

                return (
                <div key={betaUser.email} className="admin-list-item admin-beta-user-item">
                  <div>
                    <h4>{betaUser.name}</h4>
                    <p>{betaUser.email}</p>
                  </div>
                  <div className="admin-beta-user-actions">
                    <span className={`admin-pill ${isActive ? 'green' : 'red'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      className={`admin-btn-secondary admin-beta-toggle-btn ${isActive ? 'admin-beta-toggle-active' : 'admin-beta-toggle-inactive'}`}
                      onClick={() => handleToggleBetaStatus(betaModalPlan, betaUser.email)}
                    >
                      {isActive ? 'Set Inactive' : 'Set Active'}
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
