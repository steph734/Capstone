import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import './SubscriptionPage.css'

// SVG Icons
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

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function GiftIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  )
}

export default function SubscriptionPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser] = useState(user || {
    name: 'Alvrin',
    role: 'Patient',
    avatar: '/therapy-pro-logo.png'
  })

  const [currentPlan] = useState('free')
  const [childrenCount] = useState(3)

  const subscriptionTiers = [
    {
      id: 'free',
      name: 'THERAPYPRO: FREE',
      price: 'FREE',
      period: '/ forever',
      color: 'blue',
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
      features: [
        'Voice Assisted Speech to Text',
        'Text to Speech',
        'SOAP Notes / Documentation',
        'Note-taking Tools'
      ],
      current: false
    },
    {
      id: 'gold',
      name: 'THERAPYPRO: GOLD',
      price: '₱499',
      period: '/month',
      badge: 'Special Offer',
      color: 'gold',
      features: [
        'Voice Assisted Speech to Text',
        'Gamified Interactive Exercises',
        'Avatar Customization',
        'Priority Goal Setting'
      ],
      current: false
    }
  ]

  const handleSelectPlan = (planId) => {
    console.log('Selected plan:', planId)
    // In production: Navigate to payment or upgrade flow
  }

  const handleUpdatePayment = () => {
    navigate('/subscription/update-payment')
  }

  const handlePaymentHistory = () => {
    navigate('/subscription/payment-history')
  }

  const handleManageProfiles = () => {
    console.log('Manage family profiles')
    // In production: Navigate to family profiles page
  }

  const handleAddFamilyMember = () => {
    console.log('Add family member')
    // In production: Open add family member modal
  }

  return (
    <div className="subscription-layout">
      <PatientSidebar 
        user={currentUser} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
          <div className="user-badge">
            <img src={currentUser.avatar} alt={currentUser.name} />
            <span>{currentUser.name}</span>
          </div>
        </div>

        <div className="subscription-content">
          {/* Subscription Tiers */}
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
                  {!tier.current && (
                    <div className="tier-lock-badge">
                      <LockIcon />
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
                      Current Plan
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

          {/* Current Plan Details */}
          <section className="plan-details-section">
            <div className="plan-details-card">
              <div className="plan-details-content">
                <h2 className="plan-details-title">Current Plan Details</h2>
                <p className="plan-details-text">Current usage of the Free Plan</p>
                <p className="plan-details-amount">Amount: <strong>FREE</strong></p>
              </div>
              <div className="plan-details-icon">
                <GiftIcon />
                <button className="explore-btn">Explore Gold</button>
              </div>
            </div>
          </section>

          {/* Manage Subscriptions */}
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

          {/* Family Access */}
          <section className="family-section">
            <h2 className="section-title">Family Access</h2>
            
            <div className="family-card">
              <div className="family-info">
                <div className="family-count">
                  <UsersIcon />
                  <div>
                    <h3>{childrenCount} Children Profiles</h3>
                    <p>Manage access for your family</p>
                  </div>
                </div>
                <button className="manage-profiles-btn" onClick={handleManageProfiles}>
                  Manage Profiles
                </button>
              </div>

              <button className="add-family-btn" onClick={handleAddFamilyMember}>
                <div className="family-avatars">
                  <span className="avatar-icon">👧</span>
                  <span className="avatar-icon">👦</span>
                  <span className="avatar-icon">👶</span>
                </div>
                <div className="add-family-text">
                  <h4>Add Family Member</h4>
                  <p>Up to 5 profiles total</p>
                </div>
                <ChevronRightIcon />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
