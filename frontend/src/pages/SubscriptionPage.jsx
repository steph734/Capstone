import { useState } from 'react'
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

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  )
}

export default function SubscriptionPage({ user, onLogout, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contactOwnerModalOpen, setContactOwnerModalOpen] = useState(false)
  const [currentUser] = useState(user || {
    name: 'Alvrin',
    role: 'Patient',
    avatar: '/therapy-pro-logo.png',
    email: 'patient@gmail.com'
  })

  const subscriptionTiers = [
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
      monthlyPrice: 499,
      yearlyPrice: 5000,
      features: [
        'Voice Assisted Speech to Text',
        'Gamified Interactive Exercises',
        'Avatar Customization',
        'Priority Goal Setting'
      ],
      current: false
    }
  ]

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
      setContactOwnerModalOpen(true)
    }
  }

  return (
    <div className="subscription-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        betaTier={betaTier}
        profilePath="/patient/profile"
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
                  {betaTier === tier.id && (
                    <div className="tier-beta-tag">BETA</div>
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
        </div>
      </div>

      {contactOwnerModalOpen && (
        <div className="beta-modal-overlay" onClick={() => setContactOwnerModalOpen(false)}>
          <div className="beta-modal" onClick={(event) => event.stopPropagation()}>
            <div className="beta-modal-header">
              <div>
                <p className="beta-modal-eyebrow">Upgrade Restricted</p>
                <h3 className="beta-modal-title">Contact the Clinic Owner</h3>
                <p className="beta-modal-subtitle">
                  Only the clinic owner can enable beta testing and purchase a subscription tier for this account.
                </p>
              </div>
              <button
                className="beta-modal-close"
                onClick={() => setContactOwnerModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="beta-modal-body">
              <p style={{ margin: 0, color: '#2c4a3e', fontSize: '14px', lineHeight: 1.6 }}>
                Please reach out to your clinic owner to request an upgrade to this plan.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
