import { useMemo, useState } from 'react'
import AdminPageShell from './AdminPageShell'
import { adminMenuItems } from './adminSidebarConfig'

const initialPlans = [
  {
    id: 1,
    name: 'Free',
    price: '₱0',
    notes: 'Core booking and notes access',
    status: 'Current',
    icon: '🌱',
    accent: 'neutral',
    features: ['Core booking & scheduling', 'Session notes', '1 branch included'],
  },
  {
    id: 2,
    name: 'Silver',
    price: '₱299',
    notes: 'Adds voice-assisted support',
    status: 'Locked',
    icon: '🥈',
    accent: 'silver',
    features: ['Everything in Free', 'Voice-assisted support', 'Priority scheduling'],
  },
  {
    id: 3,
    name: 'Gold',
    price: '₱499',
    notes: 'Adds games and avatar tools',
    status: 'Popular',
    icon: '🥇',
    accent: 'gold',
    features: ['Everything in Silver', 'Gamified exercises', 'Custom patient avatars'],
  },
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

const ICON_PRESETS = [
  { value: 'neutral', icon: '🌱', label: 'Sprout — Neutral' },
  { value: 'silver', icon: '🥈', label: 'Silver Medal' },
  { value: 'gold', icon: '🥇', label: 'Gold Medal' },
  { value: 'diamond', icon: '💎', label: 'Diamond' },
]

const emptyForm = { name: '', price: '', notes: '', features: '', status: 'Locked', accent: 'neutral' }

const iconForAccent = (accent) => ICON_PRESETS.find((preset) => preset.value === accent)?.icon || '🌱'

const applyExclusiveStatus = (list, id, status) => {
  if (status !== 'Current' && status !== 'Popular') return list
  return list.map((plan) => (plan.id === id ? plan : plan.status === status ? { ...plan, status: 'Locked' } : plan))
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function FlaskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6l-5.5 9.5A1 1 0 0 0 5.36 20h13.28a1 1 0 0 0 .86-1.5L14 9V3" />
    </svg>
  )
}

export default function AdminSubscriptionPage({ user, onLogout }) {
  const [plans, setPlans] = useState(initialPlans)
  const [betaModalPlan, setBetaModalPlan] = useState(null)
  const [betaStatusByPlan, setBetaStatusByPlan] = useState(buildDefaultBetaStatus)

  const [formMode, setFormMode] = useState(null) // 'add' | 'edit' | null
  const [formTarget, setFormTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [viewTarget, setViewTarget] = useState(null)

  const hasActiveBetaTesters = (planName) => {
    return Object.values(betaStatusByPlan[planName] || {}).some(Boolean)
  }

  const countActiveBetaTesters = (planName) => {
    return Object.values(betaStatusByPlan[planName] || {}).filter(Boolean).length
  }

  const stats = useMemo(() => {
    const currentPlan = plans.find((plan) => plan.status === 'Current')
    const popularPlan = plans.find((plan) => plan.status === 'Popular')
    const totalBetaTesters = Object.values(betaStatusByPlan).reduce(
      (sum, testers) => sum + Object.values(testers).filter(Boolean).length,
      0
    )
    return {
      totalPlans: plans.length,
      currentPlan: currentPlan?.name || '—',
      popularPlan: popularPlan?.name || '—',
      totalBetaTesters,
    }
  }, [plans, betaStatusByPlan])

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

  const openAdd = () => {
    setFormTarget(null)
    setForm(emptyForm)
    setFormMode('add')
  }

  const openEdit = (plan) => {
    setFormTarget(plan)
    setForm({
      name: plan.name,
      price: plan.price,
      notes: plan.notes,
      features: plan.features.join('\n'),
      status: plan.status,
      accent: plan.accent,
    })
    setFormMode('edit')
  }

  const closeForm = () => {
    setFormMode(null)
    setFormTarget(null)
  }

  const openView = (plan) => {
    setViewTarget(plan)
  }

  const closeView = () => {
    setViewTarget(null)
  }

  const savePlan = (event) => {
    event.preventDefault()
    const featureList = form.features
      .split('\n')
      .map((feature) => feature.trim())
      .filter(Boolean)

    const payload = {
      name: form.name.trim(),
      price: form.price.trim(),
      notes: form.notes.trim(),
      features: featureList,
      status: form.status,
      accent: form.accent,
      icon: iconForAccent(form.accent),
    }

    if (formMode === 'edit' && formTarget) {
      setPlans((current) => {
        const updated = current.map((plan) => (plan.id === formTarget.id ? { ...plan, ...payload } : plan))
        return applyExclusiveStatus(updated, formTarget.id, payload.status)
      })
    } else {
      const newId = Date.now()
      setPlans((current) => applyExclusiveStatus([...current, { id: newId, ...payload }], newId, payload.status))
    }
    closeForm()
  }

  const isFormModal = formMode === 'add' || formMode === 'edit'

  return (
    <AdminPageShell
      user={user}
      onLogout={onLogout}
      title="Subscription"
      subtitle="Review active plans and upgrade options"
      icon="💳"
      menuItems={adminMenuItems}
    >
      <div className="admin-stats-grid">
        <section className="admin-stat-card">
          <p className="admin-stat-label">Total Plans</p>
          <h3 className="admin-stat-value">{stats.totalPlans}</h3>
          <p className="admin-stat-meta">Available tiers</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Current Plan</p>
          <h3 className="admin-stat-value">{stats.currentPlan}</h3>
          <p className="admin-stat-meta">Active for this account</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Most Popular</p>
          <h3 className="admin-stat-value">{stats.popularPlan}</h3>
          <p className="admin-stat-meta">Highest adoption</p>
        </section>
        <section className="admin-stat-card">
          <p className="admin-stat-label">Beta Testers</p>
          <h3 className="admin-stat-value">{stats.totalBetaTesters}</h3>
          <p className="admin-stat-meta">Active across all plans</p>
        </section>
      </div>

      <div className="admin-toolbar admin-subscription-toolbar">
        <div>
          <h3 className="admin-subscription-toolbar-title">Plan controls</h3>
          <p className="admin-subscription-toolbar-text">Manage tier access from a single place for all users.</p>
        </div>
        <button className="admin-btn admin-subscription-add-btn" onClick={openAdd}>
          Add Subscription
        </button>
      </div>

      <div className="admin-grid-2 plan-grid">
        {plans.map((plan) => (
          <section
            key={plan.id}
            className={`plan-card admin-panel ${plan.status === 'Current' ? 'plan-card-current' : ''} ${plan.status === 'Popular' ? 'plan-card-popular' : ''} ${plan.status === 'Locked' ? 'plan-card-locked' : ''}`}
          >
            {plan.status === 'Popular' && <span className="plan-ribbon">Most Popular</span>}

            <div className="admin-panel-header">
              <div className="plan-card-heading">
                <span className={`plan-icon-badge plan-icon-${plan.accent}`}>{plan.icon}</span>
                <div>
                  <h3>{plan.name} Plan</h3>
                  <p>{plan.notes}</p>
                </div>
              </div>
              <div className="admin-panel-tags">
                {hasActiveBetaTesters(plan.name) && <span className="admin-pill beta">Beta</span>}
                <span className={`admin-pill ${plan.status === 'Current' ? 'green' : plan.status === 'Popular' ? 'yellow' : 'red'}`}>{plan.status}</span>
              </div>
            </div>

            <div className="plan-price-row">
              <span className="plan-price">{plan.price}</span>
              <span className="plan-price-suffix">/month</span>
            </div>

            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="admin-button-row">
              <button className="admin-btn" onClick={() => openView(plan)}>View Details</button>
              <button className="admin-btn-secondary" onClick={() => openEdit(plan)}>Edit Plan</button>
              <button className="admin-btn-beta" onClick={() => handleOpenBetaModal(plan.name)}>
                <FlaskIcon /> Beta Testing
              </button>
            </div>
          </section>
        ))}
      </div>

      {isFormModal && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className="admin-modal-icon">💳</span>
                <div>
                  <h3>{formMode === 'edit' ? 'Edit Plan' : 'Add Subscription'}</h3>
                  <p>{formMode === 'edit' ? 'Update this plan\'s pricing and features' : 'Create a new subscription tier'}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={closeForm} aria-label="Close">✕</button>
            </div>

            <form className="admin-modal-form" onSubmit={savePlan}>
              <label className="admin-field">
                <span>Plan Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Platinum"
                  required
                />
              </label>

              <label className="admin-field">
                <span>Short Description</span>
                <input
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="e.g. Adds priority support and analytics"
                  required
                />
              </label>

              <div className="admin-field-grid">
                <label className="admin-field">
                  <span>Price</span>
                  <input
                    value={form.price}
                    onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="e.g. ₱699"
                    required
                  />
                </label>
                <label className="admin-field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option>Locked</option>
                    <option>Current</option>
                    <option>Popular</option>
                  </select>
                </label>
              </div>

              <label className="admin-field">
                <span>Icon Theme</span>
                <select
                  value={form.accent}
                  onChange={(event) => setForm((current) => ({ ...current, accent: event.target.value }))}
                >
                  {ICON_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.icon} {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Features (one per line)</span>
                <textarea
                  value={form.features}
                  onChange={(event) => setForm((current) => ({ ...current, features: event.target.value }))}
                  placeholder={'Everything in Gold\nDedicated account manager\nAdvanced analytics'}
                  required
                />
              </label>

              <div className="admin-button-row">
                <button className="admin-btn" type="submit">{formMode === 'edit' ? 'Save Changes' : 'Save Plan'}</button>
                <button className="admin-btn-secondary" type="button" onClick={closeForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewTarget && (
        <div className="admin-modal-backdrop" onClick={closeView}>
          <div className="admin-modal admin-view-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <span className={`plan-icon-badge plan-icon-${viewTarget.accent}`}>{viewTarget.icon}</span>
                <div>
                  <h3>{viewTarget.name} Plan</h3>
                  <p>{viewTarget.notes}</p>
                </div>
              </div>
              <button className="admin-modal-close" onClick={closeView} aria-label="Close">✕</button>
            </div>

            <div className="branch-view-grid">
              <div className="branch-view-field">
                <span className="branch-view-label">Price</span>
                <p>{viewTarget.price} <span style={{ fontSize: '12px', color: '#8a9a92', fontWeight: 600 }}>/month</span></p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Status</span>
                <p><span className={`admin-pill ${viewTarget.status === 'Current' ? 'green' : viewTarget.status === 'Popular' ? 'yellow' : 'red'}`}>{viewTarget.status}</span></p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Beta Testers</span>
                <p>{countActiveBetaTesters(viewTarget.name)} active</p>
              </div>
              <div className="branch-view-field">
                <span className="branch-view-label">Features Included</span>
                <p>{viewTarget.features.length}</p>
              </div>
            </div>

            <ul className="plan-features" style={{ marginTop: '16px' }}>
              {viewTarget.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="admin-button-row admin-view-modal-footer">
              <button className="admin-btn-secondary" type="button" onClick={closeView}>Close</button>
            </div>
          </div>
        </div>
      )}

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
