import { useState } from 'react'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import PatientSidebar from '../../components/PatientSidebar'
import StripeSubscribeForm from '../../components/StripeSubscribeForm'
import './OwnerPaymentPage.css'

// Only monthly Stripe Prices exist so far (see api/_lib/createSubscription.js).
const STRIPE_BILLING_PERIODS = new Set(['monthly'])

function ArrowLeftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
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

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export default function OwnerPaymentPage({ user, onLogout, selectedTier, onBack, betaTier }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [paymentData, setPaymentData] = useState({
    fullName: '',
    countryRegion: 'Philippines',
    address: '',
    zipCode: '',
    useShippingAddress: false,
    businessTax: false,
    phoneNumber: ''
  })
  const [paymentStatus, setPaymentStatus] = useState(null) // null | 'success'

  const currentUser = user || { 
    name: 'Owner', 
    role: 'Owner', 
    avatar: '/therapy-pro-logo.png',
    email: 'owner@gmail.com'
  }

  // Default to Silver tier if none selected
  const tier = selectedTier || {
    id: 'silver',
    name: 'THERAPYPRO: SILVER',
    price: '₱299',
    monthlyPrice: 299,
    yearlyPrice: 3000
  }

  const isMonthly = billingPeriod === 'monthly'
  const price = isMonthly ? tier.monthlyPrice : tier.yearlyPrice
  const savings = isMonthly ? 0 : Math.round(((tier.monthlyPrice * 12) - tier.yearlyPrice) / (tier.monthlyPrice * 12) * 100)

  const handleInputChange = (field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const stripeReady = STRIPE_BILLING_PERIODS.has(billingPeriod)

  const handleSubscribeSuccess = () => {
    setPaymentStatus('success')
  }

  const handleGoBack = () => {
    if (onBack) {
      onBack()
    }
  }

  return (
    <div className="payment-layout">
      <PatientSidebar
        user={currentUser}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={getOwnerMenuItems(betaTier)}
        bottomMenuItems={[]}
        profileRoleLabel="Owner"
      />

      <div className="payment-main">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <div className="payment-container">
          <div className="payment-header">
            <button className="back-button" onClick={handleGoBack}>
              <ArrowLeftIcon />
            </button>
            <h1 className="payment-title">{tier.name.split(': ')[1]} plan</h1>
          </div>

          <div className="payment-content">
            {/* Left Column - Form */}
            <div className="payment-form-column">
              {/* Billing Period Selection */}
              <div className="billing-period-section">
                <h3 className="section-title">Choose billing period</h3>
                <div className="billing-options">
                  <button
                    className={`billing-option ${billingPeriod === 'monthly' ? 'selected' : ''}`}
                    onClick={() => setBillingPeriod('monthly')}
                  >
                    <div className="billing-option-content">
                      <span className="billing-period">Monthly</span>
                      <span className="billing-price">₱{tier.monthlyPrice}.00/month</span>
                    </div>
                  </button>
                  
                  <button
                    className={`billing-option ${billingPeriod === 'yearly' ? 'selected' : ''}`}
                    onClick={() => setBillingPeriod('yearly')}
                  >
                    {savings > 0 && <span className="savings-badge">Save {savings}%</span>}
                    <div className="billing-option-content">
                      <span className="billing-period">Yearly</span>
                      <span className="billing-price">₱{tier.yearlyPrice}.00/year</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Payment Form */}
              {paymentStatus === 'success' ? (
                <div className="payment-form">
                  <h3 className="section-title">Subscription active!</h3>
                  <p className="field-description">
                    Your {tier.name.split(': ')[1]} plan (₱{price}.00/{isMonthly ? 'month' : 'year'}) is now active and billed by Stripe.
                  </p>
                  <button type="button" className="submit-button" onClick={handleGoBack}>
                    Back to Subscription
                  </button>
                </div>
              ) : (
                <div className="payment-form">
                  <h3 className="section-title">Payment information</h3>

                  <div className="form-group">
                    <label htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      type="text"
                      value={paymentData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="countryRegion">Country or region</label>
                    <select
                      id="countryRegion"
                      value={paymentData.countryRegion}
                      onChange={(e) => handleInputChange('countryRegion', e.target.value)}
                    >
                      <option value="Philippines">Philippines</option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <input
                      id="address"
                      type="text"
                      value={paymentData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter your address"
                      required
                    />
                  </div>

                  <div className="form-group checkbox-group">
                    <input
                      id="useShippingAddress"
                      type="checkbox"
                      checked={paymentData.useShippingAddress}
                      onChange={(e) => handleInputChange('useShippingAddress', e.target.checked)}
                    />
                    <label htmlFor="useShippingAddress">Use a different billing address</label>
                  </div>

                  <div className="form-group">
                    <label>Business tax ID (Optional)</label>
                    <p className="field-description">
                      For businesses only—Display your tax ID on your monthly invoice should you need it for business claims.
                    </p>
                    <div className="form-group">
                      <label htmlFor="phoneNumber">Philippines tax identification Number</label>
                      <input
                        id="phoneNumber"
                        type="text"
                        value={paymentData.phoneNumber}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        placeholder="123456789012"
                      />
                    </div>
                  </div>

                  <div className="form-group checkbox-group">
                    <input
                      id="businessTax"
                      type="checkbox"
                      checked={paymentData.businessTax}
                      onChange={(e) => handleInputChange('businessTax', e.target.checked)}
                    />
                    <label htmlFor="businessTax">
                      You agree that the payment of this charge does not constitute receipt of funds, and that the amount will be charged in full by a credit card company.
                    </label>
                  </div>

                  <h3 className="section-title">Card details</h3>
                  {stripeReady ? (
                    <StripeSubscribeForm
                      tierId={tier.id}
                      billingPeriod={billingPeriod}
                      submitLabel={`Subscribe — ₱${price}.00/month`}
                      billingEmail={currentUser.email}
                      billingName={paymentData.fullName || currentUser.name}
                      onSuccess={handleSubscribeSuccess}
                    />
                  ) : (
                    <p className="field-description">
                      Yearly billing isn't set up yet — please choose Monthly to subscribe right now.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="order-details-section">
              <h3 className="section-title">Order summary</h3>
              <div className="order-details">
                <div className="order-line">
                  <div className="order-item">
                    <span className="item-name">{tier.name.split(': ')[1]} plan</span>
                    <span className="item-period">{isMonthly ? 'Monthly' : 'Yearly'}</span>
                  </div>
                  <span className="item-price">₱{price}</span>
                </div>
                
                <div className="order-line total">
                  <span className="label">Total due today</span>
                  <span className="price">₱{price}.00</span>
                </div>
              </div>

              <div className="renewal-info">
                <InfoIcon />
                <span>
                  Charged and auto-renewed by Stripe every {isMonthly ? 'month' : 'year'} at
                  {' '}₱{price}.00 — no additional tax is added.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}