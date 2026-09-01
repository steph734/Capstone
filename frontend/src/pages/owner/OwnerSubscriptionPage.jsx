import { useState } from 'react'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import PatientSidebar from '../../components/PatientSidebar'
import OwnerPaymentPage from './OwnerPaymentPage'
import PaymentHistoryModal from '../../components/PaymentHistoryModal'
import UpdatePaymentMethodModal from '../../components/UpdatePaymentMethodModal'
import '../SubscriptionPage.css'

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function OwnerSubscriptionPage({ user, onLogout, betaTier, onBetaActivate, activePlan, onPlanActivate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTierForPayment, setSelectedTierForPayment] = useState(null)
  const [activeModal, setActiveModal] = useState(null) // null | 'update-payment' | 'payment-history'
  const currentUser = user || { name: 'Owner', role: 'Owner', avatar: '/therapy-pro-logo.png', email: 'owner@gmail.com' }
  const billingEmail = currentUser.email

  // 'free' is the plan when no paid subscription is active.
  const activeTierId = activePlan || 'free'

  const subscriptionTiersRaw = [
    {
      id: 'free',
      name: 'THERAPYPRO: FREE',
      price: 'FREE',
      period: '/ forever',
      color: 'blue',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        'Appointment Booking',
        'Online Payments',
        'SOAP Notes / Documentation',
        'Note-taking Tools'
      ],
      current: true
    },
    {
      id: 'silver',
      name: 'THERAPYPRO: SILVER',
      price: '₱299',
      period: '/month',
      color: 'silver',
      monthlyPrice: 299,
      yearlyPrice: 3000,
      features: [
        'Appointment Booking',
        'Online Payments',
        'SOAP Notes / Documentation',
        'Note-taking Tools',
        'Voice Assisted Speech to Text',
        'Text to Speech'
      ],
      current: false
    },
    {
      id: 'gold',
      name: 'THERAPYPRO: GOLD',
      price: '₱499',
      period: '/month',
      color: 'gold',
      monthlyPrice: 499,
      yearlyPrice: 5000,
      features: [
        'Appointment Booking',
        'Online Payments',
        'SOAP Notes / Documentation',
        'Note-taking Tools',
        'Voice Assisted Speech to Text',
        'Text to Speech',
        'Gamified Interactive Exercises',
        'Avatar Customization',
        'Priority Goal Setting'
      ],
      current: false
    }
  ]

  // The active plan drives which card shows as "current" / unlocked.
  const subscriptionTiers = subscriptionTiersRaw.map((tier) => ({
    ...tier,
    current: tier.id === activeTierId,
  }))

  const betaFeatures = {
    silver: [
      { id: 'speech-to-text', label: 'Speech to Text', icon: '🎤' },
      { id: 'text-to-speech', label: 'Text to Speech', icon: '🔊' },
    ],
    gold: [
      { id: 'speech-to-text', label: 'Speech to Text', icon: '🎤' },
      { id: 'text-to-speech', label: 'Text to Speech', icon: '🔊' },
    ],
  }

  const handleSelectPlan = (planId) => {
    const selectedTier = subscriptionTiers.find(tier => tier.id === planId)
    if (selectedTier && !selectedTier.current) {
      setSelectedTierForPayment(selectedTier)
    }
  }

  const handleBackFromPayment = () => {
    setSelectedTierForPayment(null)
  }

  const handleAddSubscription = () => {
    console.log('Add subscription')
  }

  const handleUpdatePayment = () => {
    setActiveModal('update-payment')
  }

  const handlePaymentHistory = () => {
    setActiveModal('payment-history')
  }

  const closeModal = () => setActiveModal(null)

  // If a tier is selected for payment, show the payment page
  if (selectedTierForPayment) {
    return (
      <OwnerPaymentPage
        user={user}
        onLogout={onLogout}
        selectedTier={selectedTierForPayment}
        onBack={handleBackFromPayment}
        betaTier={betaTier}
        activePlan={activePlan}
        onPlanActivate={onPlanActivate}
      />
    )
  }

  return (
    <div className="subscription-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={getOwnerMenuItems(betaTier, activePlan)}
        bottomMenuItems={[]}
        profileRoleLabel="Owner"
      />

      <div className="subscription-main">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <div className="subscription-header">
          <div>
            <h1 className="subscription-title">Subscription</h1>
            <p className="subscription-subtitle">Manage your subscription plan</p>
          </div>
          <div className="header-actions">
            <button className="add-subscription-btn" onClick={handleAddSubscription}>
              <PlusIcon />
              <span>Add Subscription</span>
            </button>
            <div className="user-badge">
              <img src={currentUser.avatar} alt={currentUser.name} />
              <span>{currentUser.name}</span>
            </div>
          </div>
        </div>

        <div className="subscription-content">
        <section className="tiers-section">
          <h2 className="section-title">Subscription Tiers</h2>

          <div className="tiers-grid">
            {subscriptionTiers.map((tier) => (
              <div
                key={tier.id}
                className={`tier-card tier-${tier.color} ${tier.current ? 'current-tier' : ''}`}
              >
                {tier.badge && (
                  <div className="tier-badge">{tier.badge}</div>
                )}
                {!activePlan && betaTier === tier.id && (
                  <div className="tier-beta-tag">BETA</div>
                )}
                {!tier.current && (
                  <div className="tier-lock-badge">
                    <span>Locked</span>
                  </div>
                )}

                <div className="tier-header">
                  <h3 className="tier-name">{tier.name}</h3>
                  <div className="tier-price">
                    <span className="price-amount">{tier.price}</span>
                    <span className="price-period">{tier.period}</span>
                  </div>
                </div>

                <ul className="tier-features">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="tier-feature">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!activePlan && !tier.current && betaFeatures[tier.id] && (
                  <button
                    className={`beta-button ${betaTier === tier.id ? 'beta-button-active' : ''}`}
                    onClick={() => onBetaActivate && onBetaActivate(betaTier === tier.id ? null : tier.id)}
                  >
                    {betaTier === tier.id ? 'Beta Active ✓' : 'Beta Testing'}
                  </button>
                )}
                {tier.current ? (
                  <button className="tier-button current-button" disabled>
                    {tier.id === 'free' ? 'Current Plan' : 'Active Plan'}
                  </button>
                ) : (
                  <button
                    className="tier-button select-button"
                    onClick={() => handleSelectPlan(tier.id)}
                  >
                    Select Plan
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="manage-section">
          <h2 className="section-title">Manage Subscriptions</h2>

          <div className="manage-actions">
            <button className="manage-btn" onClick={handleUpdatePayment}>
              <div className="manage-btn-icon">
                <CreditCardIcon />
              </div>
              <span className="manage-btn-text">Update Payment Method</span>
              <ChevronRightIcon />
            </button>

            <button className="manage-btn" onClick={handlePaymentHistory}>
              <div className="manage-btn-icon">
                <ClockIcon />
              </div>
              <span className="manage-btn-text">Payment History</span>
              <ChevronRightIcon />
            </button>
          </div>
        </section>
      </div>
    </div>

    {activeModal === 'update-payment' && (
      <UpdatePaymentMethodModal
        email={billingEmail}
        name={currentUser.name}
        onClose={closeModal}
      />
    )}

    {activeModal === 'payment-history' && (
      <PaymentHistoryModal email={billingEmail} onClose={closeModal} />
    )}
    </div>
  )
}
