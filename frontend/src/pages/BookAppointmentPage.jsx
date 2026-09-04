import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import CheckoutModal from '../components/CheckoutModal'
import { logActivity } from '../utils/auditLog'
import { markDateBooked } from '../utils/appointmentBookings'
import './BookAppointmentPage.css'

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
const ChevronIcon = ({ open }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
const CheckLgIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>

/* ─── Session mode icons ─── */
const InPersonIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const CognitiveIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14z"/></svg>
const SpeechIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const BehaviorIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>

/* ─── Constants ─── */
const STEPS = [
  { n: 1, label: 'Personal\nDetails' },
  { n: 2, label: 'Booking\nDetails' },
  { n: 3, label: 'Summary &\nPayment' },
  { n: 4, label: 'Confirmation' },
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
  { id: 'in-person',  label: 'In-Person',  Icon: InPersonIcon  },
  { id: 'cognitive',  label: 'Cognitive',  Icon: CognitiveIcon },
  { id: 'speech',     label: 'Speech',     Icon: SpeechIcon    },
  { id: 'behavioral', label: 'Behavioral', Icon: BehaviorIcon  },
]

const TIME_SLOTS = [
  '8:00 - 9:00 AM', '9:00 - 10:00 AM', '10:00 - 11:00 AM',
  '1:00 - 2:00 PM',  '2:00 - 3:00 PM',  '3:00 - 4:00 PM',
]

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',                desc: 'Pay in cash at the clinic' },
  { id: 'stripe', label: 'Pay Online (Stripe)', desc: 'Card / online banking via Stripe' },
]

const SESSION_FEE = 300
const SERVICE_CHARGE = 50
const TOTAL_DUE = SESSION_FEE + SERVICE_CHARGE

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
  const [sessionMode, setSessionMode]             = useState('in-person')
  const [pickedTime, setPickedTime]               = useState(null)
  const [errors2, setErrors2]                     = useState({})

  /* ── Step 3: Summary & Payment ── */
  const [payMethod, setPayMethod] = useState(null)
  const [errors3, setErrors3]     = useState({})
  const [cashOpen, setCashOpen]   = useState(true)
  const [cash, setCash] = useState({ received: '' })
  const setCashField = (k, v) => { setCash(p => ({ ...p, [k]: v })); setErrors3(p => ({ ...p, [k]: '' })) }
  const cashReceived = parseFloat(cash.received) || 0
  // Change is measured against the per-session rate.
  const cashChange = cashReceived > SESSION_FEE ? cashReceived - SESSION_FEE : 0

  // Pay Online (Stripe): the checkout modal runs before the confirmation screen.
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [onlinePayment, setOnlinePayment] = useState(null) // { method, dateLabel }

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
  const validate3 = () => {
    const e = {}
    if (!payMethod) e.method = 'Please select a payment method'
    if (payMethod === 'cash') {
      if (!String(cash.received).trim()) e.received = 'Required'
      else if (cashReceived < SESSION_FEE) e.received = `Must be at least ₱${SESSION_FEE.toFixed(2)}`
    }
    return e
  }

  const handleNext = () => {
    if (step === 1) { const e = validate1(); if (Object.keys(e).length) { setErrors1(e); return } }
    if (step === 2) { const e = validate2(); if (Object.keys(e).length) { setErrors2(e); return } }
    if (step === 3) {
      const e = validate3()
      if (Object.keys(e).length) { setErrors3(e); if (e.received) setCashOpen(true); return }
      // Pay Online → run the Stripe checkout first; advance only once it's paid.
      if (payMethod === 'stripe' && !onlinePayment) { setCheckoutOpen(true); return }
    }
    setStep(s => Math.min(s + 1, 4))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCheckoutDone = () => {
    setCheckoutOpen(false)
    setStep(4)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleBack = () => {
    if (step === 1) { navigate('/appointments'); return }
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* Derived */
  const therapistObj = THERAPISTS.find(t => t.id === selectedTherapist)
  const sessionModeObj = SESSION_MODES.find(m => m.id === sessionMode)
  const fullName = `${form1.firstName} ${form1.lastName}`.trim() || '—'

  /* Confirmation email status: null | 'sending' | 'sent' | 'error' */
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailError, setEmailError]   = useState('')

  /* Record the booking in the audit log + email a confirmation once the
     confirmation step is reached. Runs exactly once. */
  const loggedBookingRef = useRef(false)
  useEffect(() => {
    if (step !== 4 || loggedBookingRef.current) return
    loggedBookingRef.current = true

    // Persist the booked day so the Appointments calendar shows it as "booked"
    // for everyone on this browser — permanently, across reloads.
    markDateBooked(preselectedYear, preselectedMonth, preselectedDate)

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

    // Email the confirmation to the address entered on the form. The booking is
    // already done, so a mail hiccup must not block the success screen — but the
    // outcome is surfaced on the confirmation card so a silent failure is visible.
    const to = form1.email.trim()
    if (!to) return
    setEmailStatus('sending')
    fetch('/api/send-appointment-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: to,
        guardianName: `${form1.guardianFirst} ${form1.guardianLast}`.trim(),
        patient: fullName,
        condition: form1.condition,
        therapist: therapistObj?.name || '',
        therapistRole: therapistObj?.role || '',
        sessionMode: sessionModeObj?.label || '',
        date: bookingDateLabel,
        time: pickedTime || '',
        payment: PAYMENT_METHODS.find(p => p.id === payMethod)?.label || '',
        total: TOTAL_DUE,
        ...(payMethod === 'cash' && cashReceived > 0
          ? { amountReceived: cashReceived, amountChange: cashChange }
          : {}),
      }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          const msg =
            body.error ||
            (r.status === 404
              ? 'Email service not reachable — run the app with `vercel dev`.'
              : `HTTP ${r.status}`)
          console.warn('Appointment confirmation email was not sent:', msg)
          setEmailStatus('error')
          setEmailError(msg)
        } else {
          setEmailStatus('sent')
        }
      })
      .catch((e) => {
        console.warn('Appointment confirmation email request failed:', e)
        setEmailStatus('error')
        setEmailError(e.message || 'Request failed')
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
          {STEPS.map(s => (
            <div
              key={s.n}
              className={`step-item ${step >= s.n ? 'line-done' : ''}`}
            >
              <div className={`step-circle ${step > s.n ? 'step-done' : ''} ${step === s.n ? 'step-active' : ''}`}>
                {step > s.n ? <CheckIcon /> : s.n}
              </div>
              <div className={`step-label-text ${step === s.n ? 'label-active' : ''}`}>
                {s.label.split('\n').map((l, i) => <span key={i}>{l}</span>)}
              </div>
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
                    <span>300.00 / Session</span>
                  </div>
                </div>
              </div>

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

          {/* ══ STEP 3: Booking Summary & Payment ══ */}
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
                <div className="summary-row total-row"><span>Rate</span><strong>₱300.00 / Session</strong></div>
              </div>

              {/* ── Payment (combined into the summary step) ── */}
              <h3 className="book-section-title" style={{ marginTop: '22px' }}>
                Select Payment Method <span className="req">*</span>
              </h3>
              {errors3.method && <div className="step-error">{errors3.method}</div>}
              <div className="payment-methods">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id}
                    className={`pay-option ${payMethod === pm.id ? 'selected' : ''}`}
                    onClick={() => { setPayMethod(pm.id); setErrors3({}) }}
                  >
                    <span className={`pay-check ${payMethod === pm.id ? 'visible' : ''}`}><CheckIcon /></span>
                    <span className="pay-label">{pm.label}</span>
                    <span className="pay-desc">{pm.desc}</span>
                  </button>
                ))}
              </div>

              {/* ── Cash payment details (shown when Cash is selected) ── */}
              {payMethod === 'cash' && (
                <div className="pay-details">
                  <button
                    type="button"
                    className="pay-details-toggle"
                    onClick={() => setCashOpen(o => !o)}
                    aria-expanded={cashOpen}
                  >
                    <ChevronIcon open={cashOpen} />
                    Cash payment details
                  </button>

                  {cashOpen && (
                    <div className="pay-details-body">
                      <div className="book-field">
                        <label>Amount received <span className="req">*</span></label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={cash.received}
                          onChange={e => setCashField('received', e.target.value)}
                          placeholder="0.00"
                          className={errors3.received ? 'err' : ''}
                        />
                        {errors3.received && <span className="field-err">{errors3.received}</span>}

                        <div className="cash-compute">
                          <span className="cc-row">
                            <span>Amount received</span>
                            <span>₱{cashReceived.toFixed(2)}</span>
                          </span>
                          <span className="cc-row">
                            <span>Less: Rate per Session</span>
                            <span>− ₱{SESSION_FEE.toFixed(2)}</span>
                          </span>
                          <span className="cc-row cc-total">
                            <span>Amount change</span>
                            <span>₱{cashChange.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══ STEP 4: Confirmation ══ */}
          {step === 4 && (
            <>
              <div className="confirm-check-wrap">
                <div className="confirm-check-circle"><CheckLgIcon /></div>
              </div>
              <h2 className="book-heading" style={{ textAlign: 'center' }}>Appointment Booked!</h2>
              <p className="confirm-sub">Your appointment has been successfully scheduled. We'll send a reminder before your session.</p>

              {emailStatus === 'sending' && (
                <p className="confirm-email-note">Sending a confirmation to {form1.email}…</p>
              )}
              {emailStatus === 'sent' && (
                <p className="confirm-email-note ok">✓ Confirmation email sent to {form1.email}</p>
              )}
              {emailStatus === 'error' && (
                <p className="confirm-email-note err">
                  Couldn't email the confirmation to {form1.email}. {emailError}
                </p>
              )}

              <div className="summary-block">
                <div className="summary-block-title">Appointment Summary</div>
                <div className="summary-row"><span>Patient</span><strong>{fullName}</strong></div>
                <div className="summary-row"><span>Condition</span><strong>{form1.condition}</strong></div>
                <div className="summary-row"><span>Therapist</span><strong>{therapistObj?.name || '—'}</strong></div>
                <div className="summary-row"><span>Session Mode</span><strong>{sessionModeObj?.label || '—'}</strong></div>
                <div className="summary-row"><span>Date</span><strong>{bookingDateLabel}</strong></div>
                <div className="summary-row"><span>Time</span><strong>{pickedTime || '—'}</strong></div>
                <div className="summary-row"><span>Payment</span><strong>{PAYMENT_METHODS.find(p => p.id === payMethod)?.label || '—'}</strong></div>
                <div className="summary-row total-row"><span>Total</span><strong>₱{TOTAL_DUE.toFixed(2)}</strong></div>
                {payMethod === 'cash' && cashReceived > 0 && (
                  <>
                    <div className="summary-row"><span>Amount Received</span><strong>₱{cashReceived.toFixed(2)}</strong></div>
                    <div className="summary-row"><span>Amount Change</span><strong>₱{cashChange.toFixed(2)}</strong></div>
                  </>
                )}
                {onlinePayment && (
                  <>
                    <div className="summary-row"><span>Payment Status</span><strong>Paid online · {onlinePayment.method}</strong></div>
                    <div className="summary-row"><span>Paid On</span><strong>{onlinePayment.dateLabel}</strong></div>
                  </>
                )}
              </div>

              <button className="book-done-btn" onClick={() => navigate('/appointments')}>
                Back to Appointments
              </button>
            </>
          )}
        </div>

        {/* ── Action Buttons ── */}
        {step < 4 && (
          <div className="book-actions">
            <button className="book-cancel-btn" onClick={handleBack}>
              {step === 1 ? 'CANCEL' : 'BACK'}
            </button>
            <button className="book-continue-btn" onClick={handleNext}>
              {step === 2 ? 'PROCEED TO SUMMARY' : step === 3 ? 'CONFIRM BOOKING' : 'CONTINUE'}
              <ArrowRight />
            </button>
          </div>
        )}
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        merchantName={`TherapyPro · ${sessionModeObj?.label || 'Session'} with ${therapistObj?.name || 'Therapist'}`}
        amountCentavos={SESSION_FEE * 100}
        lineItems={[
          { name: `Therapy Session (${sessionModeObj?.label || 'Session'})`, qty: 1, unitCentavos: SESSION_FEE * 100 },
        ]}
        redirectSeconds={5}
        onSuccess={(meta) => setOnlinePayment(meta)}
        onRedirect={handleCheckoutDone}
      />
    </div>
  )
}
