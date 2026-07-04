import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import './UpdatePaymentPage.css'

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="4" width="22" height="16" rx="3" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

const SAVED_CARDS = [
  { id: 1, brand: 'Visa', last4: '4242', expiry: '12/27', holder: 'Alvrin Santos', isDefault: true },
  { id: 2, brand: 'Mastercard', last4: '8823', expiry: '09/26', holder: 'Alvrin Santos', isDefault: false },
]

function CardBrandLogo({ brand }) {
  if (brand === 'Visa') {
    return (
      <div className="brand-logo visa-logo">
        <span>VISA</span>
      </div>
    )
  }
  return (
    <div className="brand-logo mc-logo">
      <span className="mc-left">●</span>
      <span className="mc-right">●</span>
    </div>
  )
}

export default function UpdatePaymentPage({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser] = useState(user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' })

  const [savedCards, setSavedCards] = useState(SAVED_CARDS)
  const [showAddForm, setShowAddForm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [formData, setFormData] = useState({
    cardNumber: '',
    holder: '',
    expiry: '',
    cvv: '',
    setDefault: false,
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const formatCardNumber = (val) => {
    return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
    return digits
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    let formatted = value
    if (name === 'cardNumber') formatted = formatCardNumber(value)
    if (name === 'expiry') formatted = formatExpiry(value)
    if (name === 'cvv') formatted = value.replace(/\D/g, '').slice(0, 4)
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : formatted }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    const raw = formData.cardNumber.replace(/\s/g, '')
    if (raw.length < 16) e.cardNumber = 'Enter a valid 16-digit card number.'
    if (!formData.holder.trim()) e.holder = 'Cardholder name is required.'
    if (!/^\d{2}\/\d{2}$/.test(formData.expiry)) e.expiry = 'Enter expiry as MM/YY.'
    if (formData.cvv.length < 3) e.cvv = 'CVV must be 3–4 digits.'
    return e
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setTimeout(() => {
      const raw = formData.cardNumber.replace(/\s/g, '')
      const newCard = {
        id: Date.now(),
        brand: raw.startsWith('4') ? 'Visa' : 'Mastercard',
        last4: raw.slice(-4),
        expiry: formData.expiry,
        holder: formData.holder,
        isDefault: formData.setDefault,
      }
      setSavedCards(prev => {
        const updated = formData.setDefault
          ? prev.map(c => ({ ...c, isDefault: false }))
          : prev
        return [...updated, newCard]
      })
      setFormData({ cardNumber: '', holder: '', expiry: '', cvv: '', setDefault: false })
      setShowAddForm(false)
      setSubmitting(false)
      setSuccessMsg('Card added successfully!')
      setTimeout(() => setSuccessMsg(''), 3500)
    }, 1200)
  }

  const handleSetDefault = (id) => {
    setSavedCards(prev => prev.map(c => ({ ...c, isDefault: c.id === id })))
    setSuccessMsg('Default card updated!')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleRemove = (id) => {
    setSavedCards(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="upm-layout">
      <PatientSidebar user={currentUser} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} betaTier={betaTier} profilePath="/patient/profile" />

      <div className="upm-main">
        <button className="mobile-menu-btn2" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>

        {/* Header */}
        <div className="upm-header">
          <div className="upm-header-left">
            <button className="back-btn" onClick={() => navigate('/subscription')}>
              <ArrowLeftIcon />
            </button>
            <div>
              <h1 className="upm-title">Update Payment Method</h1>
              <p className="upm-subtitle">Manage your saved cards and billing details</p>
            </div>
          </div>
          <div className="user-badge2">
            <img src={currentUser.avatar} alt={currentUser.name} />
            <span>{currentUser.name}</span>
          </div>
        </div>

        <div className="upm-content">
          {/* Success Toast */}
          {successMsg && (
            <div className="success-toast">
              <CheckCircleIcon />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Saved Cards */}
          <section className="upm-section">
            <div className="section-head">
              <h2 className="upm-section-title">Saved Cards</h2>
              <button className="add-card-btn" onClick={() => setShowAddForm(v => !v)}>
                {showAddForm ? '✕ Cancel' : '+ Add New Card'}
              </button>
            </div>

            <div className="cards-list">
              {savedCards.length === 0 && (
                <div className="no-cards">No saved cards. Add one below.</div>
              )}
              {savedCards.map(card => (
                <div key={card.id} className={`card-item ${card.isDefault ? 'card-default' : ''}`}>
                  <div className="card-visual">
                    <CardBrandLogo brand={card.brand} />
                    <div className="card-info">
                      <span className="card-brand-name">{card.brand}</span>
                      <span className="card-number-masked">•••• •••• •••• {card.last4}</span>
                      <span className="card-meta">{card.holder} &nbsp;|&nbsp; Expires {card.expiry}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    {card.isDefault ? (
                      <span className="default-badge">✓ Default</span>
                    ) : (
                      <button className="set-default-btn" onClick={() => handleSetDefault(card.id)}>
                        Set Default
                      </button>
                    )}
                    {!card.isDefault && (
                      <button className="remove-btn" onClick={() => handleRemove(card.id)} aria-label="Remove card">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Add Card Form */}
          {showAddForm && (
            <section className="upm-section add-form-section">
              <h2 className="upm-section-title">
                <CreditCardIcon /> Add New Card
              </h2>

              <form className="payment-form" onSubmit={handleSubmit} noValidate>
                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="cardNumber">Card Number</label>
                    <div className="input-wrap">
                      <input
                        id="cardNumber"
                        name="cardNumber"
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={formData.cardNumber}
                        onChange={handleChange}
                        className={errors.cardNumber ? 'input-error' : ''}
                        inputMode="numeric"
                        autoComplete="cc-number"
                      />
                    </div>
                    {errors.cardNumber && <span className="field-error">{errors.cardNumber}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label htmlFor="holder">Cardholder Name</label>
                    <input
                      id="holder"
                      name="holder"
                      type="text"
                      placeholder="Full name on card"
                      value={formData.holder}
                      onChange={handleChange}
                      className={errors.holder ? 'input-error' : ''}
                      autoComplete="cc-name"
                    />
                    {errors.holder && <span className="field-error">{errors.holder}</span>}
                  </div>
                </div>

                <div className="form-row two-col">
                  <div className="form-group">
                    <label htmlFor="expiry">Expiry Date</label>
                    <input
                      id="expiry"
                      name="expiry"
                      type="text"
                      placeholder="MM/YY"
                      value={formData.expiry}
                      onChange={handleChange}
                      className={errors.expiry ? 'input-error' : ''}
                      inputMode="numeric"
                      autoComplete="cc-exp"
                    />
                    {errors.expiry && <span className="field-error">{errors.expiry}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="cvv">CVV</label>
                    <div className="input-wrap">
                      <input
                        id="cvv"
                        name="cvv"
                        type="password"
                        placeholder="•••"
                        value={formData.cvv}
                        onChange={handleChange}
                        className={errors.cvv ? 'input-error' : ''}
                        autoComplete="cc-csc"
                      />
                      <span className="input-icon"><LockIcon /></span>
                    </div>
                    {errors.cvv && <span className="field-error">{errors.cvv}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="setDefault"
                      checked={formData.setDefault}
                      onChange={handleChange}
                    />
                    <span>Set as default payment method</span>
                  </label>
                </div>

                <div className="secure-note">
                  <LockIcon /> Your card details are encrypted and stored securely.
                </div>

                <button type="submit" className="save-card-btn" disabled={submitting}>
                  {submitting ? <span className="btn-spinner"></span> : null}
                  {submitting ? 'Saving...' : 'Save Card'}
                </button>
              </form>
            </section>
          )}

          {/* Accepted Cards */}
          <section className="upm-section accepted-section">
            <h2 className="upm-section-title">Accepted Payment Methods</h2>
            <div className="accepted-cards">
              <div className="accepted-chip visa-chip">VISA</div>
              <div className="accepted-chip mc-chip"><span>●</span><span>●</span> Mastercard</div>
              <div className="accepted-chip gcash-chip">GCash</div>
              <div className="accepted-chip maya-chip">Maya</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
