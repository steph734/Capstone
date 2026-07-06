<<<<<<< HEAD
import { lazy, Suspense, useRef, useState } from 'react'
=======
import { useEffect, useRef, useState } from 'react'
>>>>>>> frontend
import { useNavigate, useLocation } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import { logActivity } from '../utils/auditLog'
import './BookAppointmentPage.css'

const StripePaymentModal = lazy(() => import('../components/StripePaymentModal'))

/* ─── Icons ─── */
const MenuIcon    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const BellIcon    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
const UserIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const PinIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
const MailIcon    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/></svg>
const CalIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const ShieldIcon  = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a9e6b" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
const InfoIcon    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4a9e6b" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const ArrowRight  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const CheckIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
const CheckLgIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>

/* ─── Constants ─── */
const STEPS = [
  { n: 1, label: 'Personal\nDetails' },
  { n: 2, label: 'Booking\nDetails' },
  { n: 3, label: 'Booking\nSummary' },
  { n: 4, label: 'Payment' },
  { n: 5, label: 'Confirmation' },
]

const CHILD_CONDITIONS = [
  'Speech Delay', 'Autism Spectrum Disorder', 'ADHD', 'Down Syndrome',
  'Cerebral Palsy', 'Developmental Delay', 'Learning Disability', 'Other'
]
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other']

const THERAPISTS = [
  { id: 1, name: 'Marco Reyes',   role: 'Speech Therapist',        initials: 'MR', color: '#93c5fd', textColor: '#1e3a8a', available: true },
  { id: 2, name: 'Jade Tan',      role: 'Physical Therapist',      initials: 'JT', color: '#c4b5fd', textColor: '#4c1d95', available: false },
  { id: 3, name: 'Andre Lim',     role: 'Behavior Therapist',      initials: 'AL', color: '#6ee7b7', textColor: '#064e3b', available: true },
  { id: 4, name: 'Carmen Dizon',  role: 'Occupational Therapist',  initials: 'CD', color: '#f9a8d4', textColor: '#9d174d', available: true },
  { id: 5, name: 'Paolo Ramos',   role: 'Developmental Therapist', initials: 'PR', color: '#fde68a', textColor: '#92400e', available: true },
  { id: 6, name: 'Grace Uy',      role: 'Psychologist',            initials: 'GU', color: '#fecdd3', textColor: '#9f1239', available: true },
]

const SESSION_MODES = [
  { id: 'occupational', label: 'Occupational Therapy' },
  { id: 'speech',        label: 'Speech Therapy' },
  { id: 'physical',      label: 'Physical Therapy' },
  { id: 'cognitive',     label: 'Cognitive Therapy' },
]

const TIME_SLOTS = [
  '8:00 - 9:00 AM', '9:00 - 10:00 AM', '10:00 - 11:00 AM',
  '1:00 - 2:00 PM',  '2:00 - 3:00 PM',  '3:00 - 4:00 PM',
]

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',           icon: '💵', desc: 'Pay via a cash payment center and enter your reference number' },
  { id: 'online', label: 'Online Payment', icon: '📱', desc: 'Pay securely via GCash, Maya, or bank transfer' },
  { id: 'card',   label: 'Credit Card',    icon: '💳', desc: 'Pay securely with your credit or debit card' },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

/* ─── Pricing ─── */
const SESSION_RATE      = 1000
const DOWNPAYMENT_RATE  = 0.5
const DOWNPAYMENT       = SESSION_RATE * DOWNPAYMENT_RATE
const SERVICE_CHARGE    = 50
const REMAINING_BALANCE = SESSION_RATE - DOWNPAYMENT
const TOTAL_DUE_NOW     = DOWNPAYMENT + SERVICE_CHARGE
const fmtPeso = (n) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const AGREEMENT_TERMS = [
  'All patient information shared during registration and therapy sessions is kept strictly confidential in accordance with our clinic’s privacy policy and applicable data privacy laws.',
  `A downpayment of ${fmtPeso(DOWNPAYMENT)} is required to confirm and secure this appointment slot. This downpayment is non-refundable if the appointment is cancelled less than 24 hours before the scheduled session.`,
  'Appointments may be rescheduled up to 24 hours before the scheduled session at no additional cost.',
  'Please arrive at least 10 minutes before the scheduled session. Late arrivals may result in a shortened session.',
  `The remaining balance of ${fmtPeso(REMAINING_BALANCE)} must be settled on the day of the session with clinic staff.`,
  'You confirm that the information provided during booking is accurate to the best of your knowledge, to help ensure proper care for the patient.',
]

/* ─── Component ─── */
export default function BookAppointmentPage({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedDate  = location.state?.selectedDate || new Date().getDate()
  const preselectedMonth = location.state?.month        ?? new Date().getMonth()
  const preselectedYear  = location.state?.year         ?? new Date().getFullYear()
  const bookingDateLabel = `${MONTHS[preselectedMonth]} ${preselectedDate}, ${preselectedYear}`

  const [step, setStep]             = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const availableTherapists = THERAPISTS.filter(t => t.available)
  const birthdateRef = useRef(null)

  /* ── Step 1: Personal Details ── */
  const [form1, setForm1] = useState({
    firstName: '', lastName: '', nickname: '',
    gender: 'Male', birthdate: '',
    address: '', condition: 'Speech Delay',
    guardianFirst: '', guardianLast: '',
    relationship: 'Mother', contactNumber: '', email: '',
  })
  const [errors1, setErrors1] = useState({})
  const setF1 = (k, v) => { setForm1(p => ({ ...p, [k]: v })); setErrors1(p => ({ ...p, [k]: '' })) }

  /* ── Step 2: Booking Details ── */
  const [selectedTherapist, setSelectedTherapist] = useState(null)
  const [sessionMode, setSessionMode]             = useState('occupational')
  const [pickedTime, setPickedTime]               = useState(null)
  const [errors2, setErrors2]                     = useState({})

  /* ── Booking Agreement modal (gates Step 2 -> Step 3) ── */
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  /* ── Step 4: Payment ── */
  const [payMethod, setPayMethod] = useState(null)
  const [errors4, setErrors4]     = useState({})
  const [cashDetails, setCashDetails] = useState({ amountPaid: '', referenceNumber: '' })
  const setCashField = (k, v) => { setCashDetails(p => ({ ...p, [k]: v })); setErrors4(p => ({ ...p, [k]: '' })) }
  const [showStripeModal, setShowStripeModal] = useState(false)
  const [onlinePaymentRef, setOnlinePaymentRef] = useState('')

  /* ── Validation ── */
  const validate1 = () => {
    const e = {}
    if (!form1.firstName.trim())     e.firstName     = 'Required'
    if (!form1.lastName.trim())      e.lastName      = 'Required'
    if (!form1.birthdate)            e.birthdate     = 'Required'
    if (!form1.address.trim())       e.address       = 'Required'
    if (!form1.guardianFirst.trim()) e.guardianFirst = 'Required'
    if (!form1.guardianLast.trim())  e.guardianLast  = 'Required'
    if (!form1.contactNumber.trim()) e.contactNumber = 'Required'
    if (!form1.email.trim())              e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form1.email.trim())) e.email = 'Invalid email'
    return e
  }
  const validate2 = () => {
    const e = {}
    if (!selectedTherapist) e.therapist = 'Please select a therapist'
    if (!pickedTime)        e.time      = 'Please select a time slot'
    return e
  }
  const validate4 = () => {
    const e = {}
    if (!payMethod) e.method = 'Please select a payment method'
    if (payMethod === 'cash') {
      if (!cashDetails.amountPaid || Number(cashDetails.amountPaid) <= 0) e.amountPaid = 'Enter the amount paid'
      if (!cashDetails.referenceNumber.trim()) e.referenceNumber = 'Enter your reference number'
    }
    return e
  }

  const handleNext = () => {
    if (step === 1) { const e = validate1(); if (Object.keys(e).length) { setErrors1(e); return } }
    if (step === 2) {
      const e = validate2()
      if (Object.keys(e).length) { setErrors2(e); return }
      // Show the booking agreement instead of advancing straight to the summary.
      setAgreedToTerms(false)
      setShowAgreement(true)
      return
    }
    if (step === 4) {
      const e = validate4()
      if (Object.keys(e).length) { setErrors4(e); return }
      if (payMethod === 'online') { setShowStripeModal(true); return }
    }
    setStep(s => Math.min(s + 1, 5))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleStripeSuccess = (paymentIntentId) => {
    setOnlinePaymentRef(paymentIntentId)
    setShowStripeModal(false)
    setStep(5)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleBack = () => {
    if (step === 1) { navigate('/appointments'); return }
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleAgreeAndProceed = () => {
    if (!agreedToTerms) return
    setShowAgreement(false)
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* Derived */
  const therapistObj = THERAPISTS.find(t => t.id === selectedTherapist)
  const sessionModeObj = SESSION_MODES.find(m => m.id === sessionMode)
  const fullName = `${form1.firstName} ${form1.lastName}`.trim() || '—'

  /* Record the booking in the audit log once the confirmation step is reached */
  const loggedBookingRef = useRef(false)
  useEffect(() => {
    if (step !== 5 || loggedBookingRef.current) return
    loggedBookingRef.current = true
    logActivity({
      role: 'Patient',
      user: user?.name || 'Patient',
      email: user?.email || '—',
      actionIcon: '📅',
      action: 'Appointment',
      description: `Booked ${sessionModeObj?.label || 'a session'} with ${therapistObj?.name || 'a therapist'} for ${fullName}`,
      entity: `Appointment · ${bookingDateLabel}`,
      status: 'Success',
    })
  }, [step]) // eslint-disable-line

  return (
    <div className="book-layout">
      <PatientSidebar
        user={user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' }}
        onLogout={() => {}}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        profilePath="/patient/profile"
      />
      <div className="book-page">

        {/* ── Top Bar ── */}
        <div className="book-topbar">
          <button className="book-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu"><MenuIcon /></button>
          <h1 className="book-topbar-title">Appointment</h1>
          <button className="book-bell-btn" aria-label="Notifications">
            <BellIcon /><span className="book-bell-dot" />
          </button>
        </div>

        {/* ── Logo ── */}
        <div className="book-logo-wrap">
          <img src="/therapy-pro-logo.png" alt="TherapyPro" className="book-logo" />
        </div>

        {/* ── Step Indicator ── */}
        <div className="step-bar">
          {STEPS.map((s, idx) => (
            <div key={s.n} className="step-item">
              <div className={`step-circle ${step > s.n ? 'step-done' : ''} ${step === s.n ? 'step-active' : ''}`}>
                {step > s.n ? <CheckIcon /> : s.n}
              </div>
              {idx < STEPS.length - 1 && <div className={`step-line ${step > s.n ? 'line-done' : ''}`} />}
            </div>
          ))}
        </div>
        <div className="step-labels">
          {STEPS.map(s => (
            <div key={s.n} className={`step-label-text ${step === s.n ? 'label-active' : ''}`}>
              {s.label.split('\n').map((l, i) => <span key={i}>{l}</span>)}
            </div>
          ))}
        </div>

        {/* ── Form Card ── */}
        <div className="book-card">

          {/* ══ STEP 1: Personal Details ══ */}
          {step === 1 && (
            <>
              <h2 className="book-heading">Book your appointment!</h2>
              <h3 className="book-section-title">Personal Details</h3>

              <div className="book-row">
                <div className="book-field">
                  <label>Child's First Name <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <UserIcon />
                    <input value={form1.firstName} onChange={e => setF1('firstName', e.target.value)}
                      placeholder="Juan" className={errors1.firstName ? 'err' : ''} />
                  </div>
                  {errors1.firstName && <span className="field-err">{errors1.firstName}</span>}
                </div>
                <div className="book-field">
                  <label>Child's Last Name <span className="req">*</span></label>
                  <input value={form1.lastName} onChange={e => setF1('lastName', e.target.value)}
                    placeholder="Maglisang" className={errors1.lastName ? 'err' : ''} />
                  {errors1.lastName && <span className="field-err">{errors1.lastName}</span>}
                </div>
              </div>

              <div className="book-row three-col">
                <div className="book-field">
                  <label>Child's Nickname <span className="opt">(Optional)</span></label>
                  <input value={form1.nickname} onChange={e => setF1('nickname', e.target.value)} placeholder="Berto" />
                </div>
                <div className="book-field">
                  <label>Gender <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <UserIcon />
                    <select value={form1.gender} onChange={e => setF1('gender', e.target.value)}>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="book-field">
                  <label>Birthdate <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <CalIcon />
                    <input
                      ref={birthdateRef}
                      type="date"
                      value={form1.birthdate}
                      onClick={e => e.currentTarget.showPicker?.()}
                      onFocus={e => e.currentTarget.showPicker?.()}
                      onChange={e => setF1('birthdate', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className={errors1.birthdate ? 'err' : ''}
                    />
                  </div>
                  {errors1.birthdate && <span className="field-err">{errors1.birthdate}</span>}
                </div>
              </div>

              <div className="book-row">
                <div className="book-field">
                  <label>Address <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <PinIcon />
                    <input value={form1.address} onChange={e => setF1('address', e.target.value)}
                      placeholder="67 St., Davao City" className={errors1.address ? 'err' : ''} />
                  </div>
                  {errors1.address && <span className="field-err">{errors1.address}</span>}
                </div>
                <div className="book-field">
                  <label>Child Condition <span className="req">*</span></label>
                  <select value={form1.condition} onChange={e => setF1('condition', e.target.value)}>
                    {CHILD_CONDITIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <h3 className="book-section-title" style={{ marginTop: '20px' }}>Contact Person / Emergency</h3>

              <div className="book-row">
                <div className="book-field">
                  <label>Parent/Guardian First Name <span className="req">*</span></label>
                  <input value={form1.guardianFirst} onChange={e => setF1('guardianFirst', e.target.value)}
                    placeholder="Maria" className={errors1.guardianFirst ? 'err' : ''} />
                  {errors1.guardianFirst && <span className="field-err">{errors1.guardianFirst}</span>}
                </div>
                <div className="book-field">
                  <label>Parent/Guardian Last Name <span className="req">*</span></label>
                  <input value={form1.guardianLast} onChange={e => setF1('guardianLast', e.target.value)}
                    placeholder="Dela Cruz" className={errors1.guardianLast ? 'err' : ''} />
                  {errors1.guardianLast && <span className="field-err">{errors1.guardianLast}</span>}
                </div>
              </div>

              <div className="book-row three-col">
                <div className="book-field">
                  <label>Relationship with the Child <span className="req">*</span></label>
                  <select value={form1.relationship} onChange={e => setF1('relationship', e.target.value)}>
                    {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="book-field">
                  <label>Contact Number <span className="req">*</span></label>
                  <input value={form1.contactNumber} onChange={e => setF1('contactNumber', e.target.value)}
                    placeholder="0921 059 9762" className={errors1.contactNumber ? 'err' : ''} />
                  {errors1.contactNumber && <span className="field-err">{errors1.contactNumber}</span>}
                </div>
                <div className="book-field">
                  <label>Email Address <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <MailIcon />
                    <input type="email" value={form1.email} onChange={e => setF1('email', e.target.value)}
                      placeholder="maria@email.com" className={errors1.email ? 'err' : ''} />
                  </div>
                  {errors1.email && <span className="field-err">{errors1.email}</span>}
                </div>
              </div>

              <div className="privacy-note">
                <ShieldIcon />
                <p>Your information is safe with us.<br />We'll only use it to book and manage appointments.</p>
              </div>
            </>
          )}

          {/* ══ STEP 2: Booking Details ══ */}
          {step === 2 && (
            <>
              <h2 className="book-heading">Book your appointment!</h2>
              <h3 className="book-section-title">Booking Details</h3>

              {/* Date & Rate Info Card */}
              <div className="booking-info-card">
                <div className="booking-info-item">
                  <span className="bii-label">Booking Date</span>
                  <div className="bii-value">
                    <CalIcon />
                    <span>{bookingDateLabel}</span>
                  </div>
                </div>
                <div className="booking-info-divider" />
                <div className="booking-info-item">
                  <span className="bii-label">Booking Rate</span>
                  <div className="bii-value">
                    <span className="peso-sign">₱</span>
                    <span>{SESSION_RATE.toLocaleString('en-US', { minimumFractionDigits: 2 })} / Session</span>
                  </div>
                </div>
              </div>
              <p className="downpayment-hint">
                A {fmtPeso(DOWNPAYMENT)} downpayment is required to confirm your booking. Details in the agreement before the summary step.
              </p>

              {/* ── Select Therapist ── */}
              <h3 className="book-section-title" style={{ marginTop: '18px' }}>Select your therapist</h3>
              {errors2.therapist && <div className="step-error">{errors2.therapist}</div>}
              <div className="book-field booking-dropdown-field">
                <label htmlFor="therapist-select">Therapist <span className="req">*</span></label>
                <select
                  id="therapist-select"
                  value={selectedTherapist ?? ''}
                  onChange={e => {
                    const value = e.target.value ? Number(e.target.value) : null
                    setSelectedTherapist(value)
                    setErrors2(p => ({ ...p, therapist: '' }))
                  }}
                  className={errors2.therapist ? 'err' : ''}
                >
                  <option value="" disabled>Select your therapist</option>
                  {availableTherapists.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.role} (Available)
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Session Mode ── */}
              <h3 className="book-section-title" style={{ marginTop: '18px' }}>Session Mode</h3>
              <div className="book-field booking-dropdown-field">
                <label htmlFor="session-mode-select">Choose session mode</label>
                <select
                  id="session-mode-select"
                  value={sessionMode}
                  onChange={e => setSessionMode(e.target.value)}
                >
                  {SESSION_MODES.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* ── Time Slots ── */}
              <h3 className="book-section-title" style={{ marginTop: '18px' }}>Select Time Slot</h3>
              {errors2.time && <div className="step-error">{errors2.time}</div>}
              <div className="book-field booking-dropdown-field">
                <label htmlFor="time-slot-select">Available time slots <span className="req">*</span></label>
                <select
                  id="time-slot-select"
                  value={pickedTime ?? ''}
                  onChange={e => {
                    setPickedTime(e.target.value)
                    setErrors2(p => ({ ...p, time: '' }))
                  }}
                  className={errors2.time ? 'err' : ''}
                >
                  <option value="" disabled>Select a time slot</option>
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Reschedule Note */}
              <div className="reschedule-note">
                <InfoIcon />
                <p>You can reschedule or cancel your appointment up to 24 hours before the session.</p>
              </div>
            </>
          )}

          {/* ══ STEP 3: Booking Summary ══ */}
          {step === 3 && (
            <>
              <h2 className="book-heading">Booking Summary</h2>
              <h3 className="book-section-title">Review your details</h3>

              <div className="summary-block">
                <div className="summary-block-title">Patient Information</div>
                <div className="summary-row"><span>Full Name</span><strong>{fullName}</strong></div>
                <div className="summary-row"><span>Birthdate</span><strong>{form1.birthdate || '—'}</strong></div>
                <div className="summary-row"><span>Gender</span><strong>{form1.gender}</strong></div>
                <div className="summary-row"><span>Condition</span><strong>{form1.condition}</strong></div>
                <div className="summary-row"><span>Address</span><strong>{form1.address || '—'}</strong></div>
              </div>

              <div className="summary-block">
                <div className="summary-block-title">Guardian / Emergency</div>
                <div className="summary-row"><span>Guardian</span><strong>{`${form1.guardianFirst} ${form1.guardianLast}`.trim() || '—'}</strong></div>
                <div className="summary-row"><span>Relationship</span><strong>{form1.relationship}</strong></div>
                <div className="summary-row"><span>Contact</span><strong>{form1.contactNumber || '—'}</strong></div>
                <div className="summary-row"><span>Email</span><strong>{form1.email || '—'}</strong></div>
              </div>

              <div className="summary-block">
                <div className="summary-block-title">Appointment Details</div>
                <div className="summary-row"><span>Date</span><strong>{bookingDateLabel}</strong></div>
                <div className="summary-row"><span>Time</span><strong>{pickedTime || '—'}</strong></div>
                <div className="summary-row"><span>Therapist</span><strong>{therapistObj?.name || '—'}</strong></div>
                <div className="summary-row"><span>Role</span><strong>{therapistObj?.role || '—'}</strong></div>
                <div className="summary-row"><span>Session Mode</span><strong>{sessionModeObj?.label || '—'}</strong></div>
                <div className="summary-row"><span>Session Rate</span><strong>{fmtPeso(SESSION_RATE)} / Session</strong></div>
                <div className="summary-row total-row"><span>Downpayment Due</span><strong>{fmtPeso(DOWNPAYMENT)}</strong></div>
              </div>
            </>
          )}

          {/* ══ STEP 4: Payment ══ */}
          {step === 4 && (
            <>
              <h2 className="book-heading">Payment Method</h2>
              <h3 className="book-section-title">Appointment Summary</h3>

              <div className="summary-block">
                <div className="summary-row"><span>Therapist</span><strong>{therapistObj?.name || '—'}</strong></div>
                <div className="summary-row"><span>Service</span><strong>{sessionModeObj?.label || '—'}</strong></div>
                <div className="summary-row"><span>Date &amp; Time</span><strong>{bookingDateLabel} • {pickedTime || '—'}</strong></div>
                <div className="summary-row"><span>Rate</span><strong>{fmtPeso(SESSION_RATE)} / session</strong></div>
              </div>

              <div className="payment-total-box">
                <div className="payment-total-row">
                  <span>Total Amount</span>
                  <strong>{fmtPeso(SESSION_RATE)}</strong>
                </div>
                <div className="payment-due-row">
                  <span>Due Today</span>
                  <span className="due-today-pill">{fmtPeso(TOTAL_DUE_NOW)}</span>
                </div>
                <p className="pricing-note">
                  This secures your booking. The remaining {fmtPeso(REMAINING_BALANCE)} balance is payable on your session day.
                </p>
              </div>

              <h3 className="book-section-title" style={{ marginTop: '20px' }}>Choose Payment Method</h3>
              {errors4.method && <div className="step-error">{errors4.method}</div>}
              <div className="payment-methods-grid">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id}
                    className={`payment-method-card ${payMethod === pm.id ? 'selected' : ''}`}
                    onClick={() => { setPayMethod(pm.id); setErrors4({}) }}
                  >
                    <span className="pmc-icon">{pm.icon}</span>
                    <span className="pmc-label">{pm.label}</span>
                    <span className="pmc-desc">{pm.desc}</span>
                  </button>
                ))}
              </div>

              {payMethod === 'cash' && (
                <div className="cash-details-card">
                  <h4>Cash Payment Details</h4>
                  <div className="book-field">
                    <label>Payment Paid <span className="req">*</span></label>
                    <div className="amount-input-wrap">
                      <span className="amount-prefix">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashDetails.amountPaid}
                        onChange={e => setCashField('amountPaid', e.target.value)}
                        placeholder={TOTAL_DUE_NOW.toFixed(2)}
                        className={errors4.amountPaid ? 'err' : ''}
                      />
                    </div>
                    {errors4.amountPaid && <span className="field-err">{errors4.amountPaid}</span>}
                  </div>
                  <div className="book-field">
                    <label>Total Amount of Therapy Session</label>
                    <div className="cash-readonly-value">{fmtPeso(SESSION_RATE)}</div>
                  </div>
                  <div className="book-field">
                    <label>Reference Number <span className="req">*</span></label>
                    <input
                      value={cashDetails.referenceNumber}
                      onChange={e => setCashField('referenceNumber', e.target.value)}
                      placeholder="e.g. 123456789012"
                      className={errors4.referenceNumber ? 'err' : ''}
                    />
                    {errors4.referenceNumber && <span className="field-err">{errors4.referenceNumber}</span>}
                  </div>
                </div>
              )}

              <div className="privacy-note">
                <ShieldIcon />
                <p>Your payment information is secure and encrypted.<br />We do not store your card details.</p>
              </div>
            </>
          )}

          {/* ══ STEP 5: Confirmation ══ */}
          {step === 5 && (
            <>
              <div className="confirm-check-wrap">
                <div className="confirm-check-circle"><CheckLgIcon /></div>
              </div>
              <h2 className="book-heading" style={{ textAlign: 'center' }}>Appointment Booked!</h2>
              <p className="confirm-sub">Your appointment has been successfully scheduled. We'll send a reminder before your session.</p>

              <div className="summary-block">
                <div className="summary-block-title">Appointment Summary</div>
                <div className="summary-row"><span>Patient</span><strong>{fullName}</strong></div>
                <div className="summary-row"><span>Condition</span><strong>{form1.condition}</strong></div>
                <div className="summary-row"><span>Therapist</span><strong>{therapistObj?.name || '—'}</strong></div>
                <div className="summary-row"><span>Session Mode</span><strong>{sessionModeObj?.label || '—'}</strong></div>
                <div className="summary-row"><span>Date</span><strong>{bookingDateLabel}</strong></div>
                <div className="summary-row"><span>Time</span><strong>{pickedTime || '—'}</strong></div>
                <div className="summary-row"><span>Payment</span><strong>{PAYMENT_METHODS.find(p => p.id === payMethod)?.label || '—'}</strong></div>
                {payMethod === 'cash' && (
                  <div className="summary-row"><span>Reference Number</span><strong>{cashDetails.referenceNumber || '—'}</strong></div>
                )}
                {payMethod === 'online' && (
                  <div className="summary-row"><span>Payment Reference</span><strong>{onlinePaymentRef || '—'}</strong></div>
                )}
                <div className="summary-row"><span>Downpayment Paid</span><strong>{fmtPeso(TOTAL_DUE_NOW)}</strong></div>
                <div className="summary-row total-row"><span>Remaining Balance</span><strong>{fmtPeso(REMAINING_BALANCE)} (due on session day)</strong></div>
              </div>

              <button className="book-done-btn" onClick={() => navigate('/appointments')}>
                Back to Appointments
              </button>
            </>
          )}
        </div>

        {/* ── Action Buttons ── */}
        {step < 5 && (
          <div className="book-actions">
            <button className="book-cancel-btn" onClick={handleBack}>
              {step === 1 ? 'CANCEL' : 'BACK'}
            </button>
            <button className="book-continue-btn" onClick={handleNext}>
              {step === 2 ? 'PROCEED TO SUMMARY' : step === 3 ? 'GO TO PAYMENT' : step === 4 ? 'CONFIRM' : 'CONTINUE'}
              <ArrowRight />
            </button>
          </div>
        )}
      </div>

      {/* ── Booking Agreement Modal ── */}
      {showAgreement && (
        <div className="book-modal-backdrop" onClick={() => setShowAgreement(false)}>
          <div className="book-modal" onClick={e => e.stopPropagation()}>
            <div className="book-modal-header">
              <ShieldIcon />
              <div>
                <h3>Booking Agreement</h3>
                <p>Please review our clinic policy before proceeding</p>
              </div>
            </div>

            <div className="book-modal-body">
              <ol className="agreement-list">
                {AGREEMENT_TERMS.map((term, i) => (
                  <li key={i}>{term}</li>
                ))}
              </ol>
            </div>

            <label className="agreement-checkbox">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
              />
              <span className={`agreement-checkmark ${agreedToTerms ? 'checked' : ''}`}>
                {agreedToTerms && <CheckIcon />}
              </span>
              <span className="agreement-checkbox-text">I have read and agree to the terms above</span>
            </label>

            <div className="book-modal-actions">
              <button className="book-cancel-btn" onClick={() => setShowAgreement(false)}>
                CANCEL
              </button>
              <button
                className="book-continue-btn"
                onClick={handleAgreeAndProceed}
                disabled={!agreedToTerms}
              >
                AGREE &amp; PROCEED
                <ArrowRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stripe Online Payment Modal ── */}
      {showStripeModal && (
        <Suspense fallback={null}>
          <StripePaymentModal
            amountLabel={fmtPeso(TOTAL_DUE_NOW)}
            onSuccess={handleStripeSuccess}
            onClose={() => setShowStripeModal(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
