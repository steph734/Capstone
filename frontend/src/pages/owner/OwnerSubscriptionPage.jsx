import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function DiamondIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M2 9h20" />
      <path d="m10 3-2 6 4 12 4-12-2-6" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function OwnerSubscriptionPage({ user, onLogout, betaTier, activePlan, onPlanActivate }) {
  const navigate = useNavigate()
  const tiersRef = useRef(null)
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

  const activeTier = subscriptionTiers.find((tier) => tier.id === activeTierId) || subscriptionTiers[0]
  const isPaidPlan = activeTierId !== 'free'
  // "THERAPYPRO: GOLD" -> "Gold"
  const planShortName = (activeTier.name.split(': ')[1] || activeTier.name)
  const planLabel = planShortName.charAt(0) + planShortName.slice(1).toLowerCase()
  const nextBillDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const handleSelectPlan = (planId) => {
    const selectedTier = subscriptionTiers.find(tier => tier.id === planId)
    if (selectedTier && !selectedTier.current) {
      setSelectedTierForPayment(selectedTier)
    }
  }

  const handleBackFromPayment = () => {
    setSelectedTierForPayment(null)
  }

  const scrollToTiers = () => {
    tiersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleEditPersonalInfo = () => {
    navigate('/owner/profile')
  }

  const handleUpdatePayment = () => {
    setActiveModal('update-payment')
  }

  const handlePaymentHistory = () => {
    setActiveModal('payment-history')
  }

  const handleCancelSubscription = () => {
    if (window.confirm('Cancel your subscription and move back to the Free plan?')) {
      onPlanActivate && onPlanActivate(null)
    }
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
            <button className="add-subscription-btn" onClick={scrollToTiers}>
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
        <section className="plan-overview">
          <div className="plan-hero">
            <span className="plan-hero-badge">Your plan</span>
            <div className="plan-hero-brand">
              <img src="/therapy-pro-logo.png" alt="" />
              <span>THERAPYPRO</span>
            </div>
            <h2 className="plan-hero-name">{planLabel}</h2>
            {isPaidPlan ? (
              <>
                <p className="plan-hero-meta">
                  Your next bill is for <strong>₱{activeTier.monthlyPrice}.00</strong> on {nextBillDate}.
                </p>
                <p className="plan-hero-payment">Billed to {billingEmail}</p>
              </>
            ) : (
              <p className="plan-hero-meta">You&rsquo;re on the Free plan &mdash; no billing.</p>
            )}
          </div>

          <div className="plan-hero-actions">
            <button className="plan-hero-action" onClick={handleEditPersonalInfo}>
              <PencilIcon />
              <span>Edit personal info</span>
            </button>
            {isPaidPlan && (
              <button className="plan-hero-action" onClick={handleUpdatePayment}>
                <CreditCardIcon />
                <span>Update card</span>
              </button>
            )}
          </div>
        </section>

        <section className="plan-links-section">
          <h2 className="section-title">Your {planLabel}</h2>
          <div className="plan-links">
            <button className="plan-link-row" onClick={scrollToTiers}>
              <span className="plan-link-icon"><DiamondIcon /></span>
              <span className="plan-link-label">Available subscriptions</span>
              <ChevronRightIcon />
            </button>
            <button className="plan-link-row" onClick={handlePaymentHistory}>
              <span className="plan-link-icon"><ClockIcon /></span>
              <span className="plan-link-label">Manage your subscription</span>
              <ChevronRightIcon />
            </button>
            {isPaidPlan ? (
              <button className="plan-link-row danger" onClick={handleCancelSubscription}>
                <span className="plan-link-icon"><XIcon /></span>
                <span className="plan-link-label">Cancel subscription</span>
                <ChevronRightIcon />
              </button>
            ) : (
              <button className="plan-link-row" onClick={scrollToTiers}>
                <span className="plan-link-icon"><PlusIcon /></span>
                <span className="plan-link-label">Upgrade your plan</span>
                <ChevronRightIcon />
              </button>
            )}
          </div>
        </section>

        <section className="tiers-section" ref={tiersRef}>
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
