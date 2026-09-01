import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import PatientSidebar from '../../components/PatientSidebar'
import OwnerPaymentPage from './OwnerPaymentPage'
import PaymentHistoryModal from '../../components/PaymentHistoryModal'
import UpdatePaymentMethodModal from '../../components/UpdatePaymentMethodModal'
import '../SubscriptionPage.css'

// "Possible" next billing date = one calendar month after a given date.
function addOneMonth(date) {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + 1)
  if (d.getDate() < day) d.setDate(0) // clamp Jan 31 -> Feb 28/29
  return d
}

function formatLongDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "THERAPYPRO: GOLD" -> "Gold"
function planLabelFor(tier) {
  const name = tier.name.split(': ')[1] || tier.name
  return name.charAt(0) + name.slice(1).toLowerCase()
}

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

function GiftIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

export default function OwnerSubscriptionPage({ user, onLogout, betaTier, activePlan, planTrialEnds, onPlanActivate }) {
  const navigate = useNavigate()
  const tiersRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTierForPayment, setSelectedTierForPayment] = useState(null)
  const [activeModal, setActiveModal] = useState(null) // null | 'update-payment' | 'payment-history' | 'cancel' | 'trial'
  const [trialTier, setTrialTier] = useState(null) // tier object pending in the trial modal
  const [paymentsState, setPaymentsState] = useState({ status: 'loading', payments: [], error: '' })
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [trialNoticeDismissed, setTrialNoticeDismissed] = useState(false)
  const currentUser = user || { name: 'Owner', role: 'Owner', avatar: '/therapy-pro-logo.png', email: 'owner@gmail.com' }
  const billingEmail = currentUser.email

  // Re-evaluate the trial clock each minute so the "ending soon" notice appears
  // and the plan lapses without needing a page reload.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Pull every Stripe payment on record for this billing email.
  useEffect(() => {
    let cancelled = false
    setPaymentsState({ status: 'loading', payments: [], error: '' })

    fetch(`/api/payment-history?email=${encodeURIComponent(billingEmail)}`)
      .then(async (res) => {
        let data
        try {
          data = await res.json()
        } catch {
          throw new Error('Could not reach the payment server.')
        }
        if (!res.ok) throw new Error(data.error || 'Could not load payment history')
        if (!cancelled) setPaymentsState({ status: 'ready', payments: data.payments || [], error: '' })
      })
      .catch((err) => {
        if (!cancelled) setPaymentsState({ status: 'error', payments: [], error: err.message })
      })

    return () => { cancelled = true }
  }, [billingEmail])

  // The tier the user signed up for ('free' when nothing is active).
  const storedTierId = activePlan || 'free'

  // Trial clock. A lapsed trial (past its end date, no payment made) re-locks the
  // plan — the user is treated as back on Free until they pay the regular price.
  const trialEndMs = planTrialEnds ? new Date(planTrialEnds).getTime() : null
  const isTrialExpired = Boolean(trialEndMs) && trialEndMs <= nowMs
  const isTrialing = Boolean(trialEndMs) && trialEndMs > nowMs
  const trialDaysLeft = isTrialing ? Math.ceil((trialEndMs - nowMs) / (24 * 60 * 60 * 1000)) : 0
  const trialEndingSoon = isTrialing && trialDaysLeft <= 2

  // What the page treats as the live plan (Free once a trial lapses).
  const activeTierId = isTrialExpired ? 'free' : storedTierId

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
  // The tier signed up for — used for "trial ended" messaging even after it lapses.
  const signedUpTier = subscriptionTiersRaw.find((tier) => tier.id === storedTierId) || subscriptionTiersRaw[0]
  const isPaidPlan = activeTierId !== 'free'
  const isOnFreePlan = activeTierId === 'free'
  const trialEndsLabel = trialEndMs ? formatLongDate(new Date(trialEndMs)) : ''
  const planLabel = planLabelFor(activeTier)

  // Possible next billing = one month after the most recent successful charge
  // (or one month from today if Stripe has no payments on file yet). While on a
  // free trial, billing starts when the trial ends.
  const lastSucceeded = paymentsState.payments.find((p) => p.status === 'succeeded')
  const lastPaidAt = lastSucceeded ? new Date(lastSucceeded.created * 1000) : new Date()
  const nextBillingDate = isTrialing ? new Date(trialEndMs) : addOneMonth(lastPaidAt)
  const nextBillDate = formatLongDate(nextBillingDate)

  // The trial is a one-time offer — once used (even if it later lapsed), Select
  // Plan goes straight to payment.
  const trialUsed = Boolean(planTrialEnds)

  const handleSelectPlan = (planId) => {
    const selectedTier = subscriptionTiers.find(tier => tier.id === planId)
    if (!selectedTier || selectedTier.current) return
    // From the free plan (and never trialed), offer the 7-day trial first.
    if (isOnFreePlan && !trialUsed) {
      setTrialTier(selectedTier)
      setActiveModal('trial')
    } else {
      setSelectedTierForPayment(selectedTier)
    }
  }

  const handleStartTrial = () => {
    if (trialTier) onPlanActivate && onPlanActivate(trialTier.id, { trial: true })
    setActiveModal(null)
    setTrialTier(null)
  }

  const handleSkipTrialToPayment = () => {
    const tier = trialTier
    setActiveModal(null)
    setTrialTier(null)
    if (tier) setSelectedTierForPayment(tier)
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
    setActiveModal('cancel')
  }

  // Convert the trial (ending or already lapsed) into a paid subscription.
  const handleSubscribeTrialPlan = () => {
    setSelectedTierForPayment(signedUpTier)
  }

  const confirmCancelSubscription = () => {
    onPlanActivate && onPlanActivate(null)
    setActiveModal(null)
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
            <div className="user-badge">
              <img src={currentUser.avatar} alt={currentUser.name} />
              <span>{currentUser.name}</span>
            </div>
          </div>
        </div>

        <div className="subscription-content">
        {trialEndingSoon && !trialNoticeDismissed && (
          <div className="trial-banner warn" role="status">
            <span className="trial-banner-text">
              Your <strong>{planLabelFor(signedUpTier)}</strong> free trial ends in{' '}
              <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}</strong> on{' '}
              <strong>{trialEndsLabel}</strong>. Subscribe now to keep your features — you&rsquo;ll be
              charged ₱{signedUpTier.monthlyPrice}.00/month.
            </span>
            <div className="trial-banner-actions">
              <button type="button" className="trial-banner-btn primary" onClick={handleSubscribeTrialPlan}>
                Subscribe now
              </button>
              <button
                type="button"
                className="trial-banner-btn ghost"
                onClick={() => setTrialNoticeDismissed(true)}
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {isTrialExpired && (
          <div className="trial-banner danger" role="alert">
            <span className="trial-banner-text">
              Your <strong>{planLabelFor(signedUpTier)}</strong> free trial ended on{' '}
              <strong>{trialEndsLabel}</strong>. Premium features are locked. Subscribe for{' '}
              <strong>₱{signedUpTier.monthlyPrice}.00/month</strong> to restore them.
            </span>
            <div className="trial-banner-actions">
              <button type="button" className="trial-banner-btn primary" onClick={handleSubscribeTrialPlan}>
                Subscribe for ₱{signedUpTier.monthlyPrice}.00/mo
              </button>
            </div>
          </div>
        )}

        <section className="plan-overview">
          <div className="plan-hero">
            <span className="plan-hero-badge">Your plan</span>
            <div className="plan-hero-brand">
              <img src="/therapy-pro-logo.png" alt="" />
              <span>THERAPYPRO</span>
            </div>
            <h2 className="plan-hero-name">{planLabel}</h2>
            {isPaidPlan && isTrialing && (
              <span className="plan-hero-trial-tag">7-day free trial</span>
            )}
            {isPaidPlan ? (
              <>
                <p className="plan-hero-meta">
                  {isTrialing ? (
                    <>Your free trial ends on <strong>{trialEndsLabel}</strong> — then <strong>₱{activeTier.monthlyPrice}.00</strong>/month.</>
                  ) : (
                    <>Your next bill is for <strong>₱{activeTier.monthlyPrice}.00</strong> on {nextBillDate}.</>
                  )}
                </p>
                <p className="plan-hero-payment">Billed to {billingEmail}</p>
              </>
            ) : isTrialExpired ? (
              <p className="plan-hero-meta">
                Your {planLabelFor(signedUpTier)} free trial has ended &mdash; subscribe to reactivate it.
              </p>
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

        {isPaidPlan && (
          <section className="payments-section">
            <h2 className="section-title">Billing</h2>
            <div className="next-billing-card">
              <div className="next-billing-info">
                <span className="next-billing-label">Possible next billing</span>
                <span className="next-billing-date">{nextBillDate}</span>
              </div>
              <span className="next-billing-amount">₱{activeTier.monthlyPrice}.00</span>
            </div>
          </section>
        )}

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
                    {tier.id === 'free' ? 'Current Plan' : isTrialing ? 'Trial Active' : 'Active Plan'}
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

    {activeModal === 'trial' && trialTier && (
      <div
        className="cancel-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-modal-title"
        onClick={closeModal}
      >
        <div className="trial-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="trial-modal-close" onClick={closeModal} aria-label="Close">
            <XIcon />
          </button>
          <div className="trial-modal-icon">
            <GiftIcon />
          </div>
          <span className="trial-modal-eyebrow">7-day free trial</span>
          <h2 id="trial-modal-title" className="trial-modal-title">
            Try {planLabelFor(trialTier)} free for 7 days
          </h2>
          <p className="trial-modal-text">
            Unlock every feature below now. We won&rsquo;t charge you until{' '}
            <strong>{formatLongDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}</strong>, then it&rsquo;s{' '}
            <strong>₱{trialTier.monthlyPrice}.00/month</strong>. Cancel anytime before then and you pay nothing.
          </p>
          <ul className="trial-modal-features">
            {trialTier.features.map((feature, index) => (
              <li key={index}><CheckIcon /><span>{feature}</span></li>
            ))}
          </ul>
          <div className="trial-modal-actions">
            <button type="button" className="trial-modal-btn primary" onClick={handleStartTrial}>
              Start free trial
            </button>
            <button type="button" className="trial-modal-btn secondary" onClick={handleSkipTrialToPayment}>
              Skip trial &mdash; subscribe now
            </button>
          </div>
        </div>
      </div>
    )}

    {activeModal === 'cancel' && (
      <div
        className="cancel-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        onClick={closeModal}
      >
        <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
          <div className="cancel-modal-icon">
            <XIcon />
          </div>
          <h2 id="cancel-modal-title" className="cancel-modal-title">Cancel subscription?</h2>
          <p className="cancel-modal-text">
            Your {planLabel} plan will end and you&rsquo;ll move back to the Free plan.
            Premium features will be locked.
          </p>
          <div className="cancel-modal-actions">
            <button type="button" className="cancel-modal-btn keep" onClick={closeModal}>
              Keep my plan
            </button>
            <button type="button" className="cancel-modal-btn confirm" onClick={confirmCancelSubscription}>
              Cancel subscription
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
