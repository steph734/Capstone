import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import CheckoutModal from '../components/CheckoutModal'
import { SESSION_MODES } from '../data/sessionModes'
import { logActivity } from '../utils/auditLog'
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
const UploadIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const CameraIcon  = ({ size = 15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
const TrashSmIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z"/><path d="M10 11v6M14 11v6"/></svg>
const UserCircleIcon = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19a6 6 0 0 1 11 0"/></svg>

/* ─── Constants ─── */
const STEPS = [
  { n: 1, label: 'Personal\nDetails' },
  { n: 2, label: 'Summary &\nPayment' },
  { n: 3, label: 'Confirmation' },
]

const CHILD_CONDITIONS = [
  'Speech Delay', 'Autism Spectrum Disorder', 'ADHD', 'Down Syndrome',
  'Cerebral Palsy', 'Developmental Delay', 'Learning Disability', 'Other'
]
const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other']

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',                desc: 'Pay in cash at the clinic' },
  { id: 'stripe', label: 'Pay Online (Stripe)', desc: 'Card / online banking via Stripe' },
]

const SESSION_FEE = 300
const SERVICE_CHARGE = 50
const TOTAL_DUE = SESSION_FEE + SERVICE_CHARGE

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

/* ─── Child's photo: pick/drop → validate → center-crop to a square →
   resize to 512×512 → compress to WebP (JPEG if the browser can't encode
   WebP) — all before anything is sent, so the upload is normally 30–120KB. ─── */
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_PHOTO_SOURCE_BYTES = 5 * 1024 * 1024

function canEncodeWebp() {
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

async function processPhotoFile(file) {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPG, PNG, WEBP, or HEIC photo.')
  }
  if (file.size > MAX_PHOTO_SOURCE_BYTES) {
    throw new Error('That photo is larger than 5 MB — please choose a smaller one.')
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This device can't read that photo format. Try a JPG, PNG, or WEBP instead.")
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 512, 512)
  bitmap.close?.()

  const mimeType = canEncodeWebp() ? 'image/webp' : 'image/jpeg'
  const dataUrl = canvas.toDataURL(mimeType, 0.85)
  const blob = await (await fetch(dataUrl)).blob()

  return { dataUrl, blob, mimeType }
}

/* ─── Component ─── */
export default function BookAppointmentPage({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedDate  = location.state?.selectedDate || new Date().getDate()
  const preselectedMonth = location.state?.month        ?? new Date().getMonth()
  const preselectedYear  = location.state?.year         ?? new Date().getFullYear()
  const bookingDateLabel = `${MONTHS[preselectedMonth]} ${preselectedDate}, ${preselectedYear}`

  // Therapist, session mode and time slot are all picked on the Appointments
  // calendar page before getting here — this page only displays them. If
  // they're missing (e.g. the URL was opened directly), bounce back there.
  const therapistObj  = location.state?.therapist || null
  const sessionMode   = location.state?.sessionMode || 'in-person'
  const pickedTime    = location.state?.pickedTime || null
  const sessionModeObj = SESSION_MODES.find(m => m.id === sessionMode)

  const [step, setStep]             = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const birthdateRef = useRef(null)

  useEffect(() => {
    if (!therapistObj || !pickedTime) navigate('/appointments', { replace: true })
  }, []) // eslint-disable-line

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
  // Auto-capitalizes just the first character as the guardian types — used on
  // every step-1 text field except the dropdowns (gender/condition/relationship)
  // and email, which shouldn't be case-mangled.
  const capitalizeFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
  const setF1Cap = (k, v) => setF1(k, capitalizeFirst(v))

  /* Child's profile photo — optional, processed entirely client-side. */
  const [photo, setPhoto] = useState(null) // { dataUrl, previewUrl, mimeType, sizeBytes, fileName }
  const [photoError, setPhotoError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState(false)
  const uploadInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => () => { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl) }, []) // eslint-disable-line

  const handlePhotoFile = async (file) => {
    if (!file) return
    setPhotoError('')
    setPhotoBusy(true)
    try {
      const { dataUrl, blob, mimeType } = await processPhotoFile(file)
      const previewUrl = URL.createObjectURL(blob)
      setPhoto((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return { dataUrl, previewUrl, mimeType, sizeBytes: blob.size, fileName: file.name }
      })
    } catch (err) {
      setPhotoError(err.message || 'Could not use that photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const clearPhoto = () => {
    setPhoto((prev) => { if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl); return null })
    setPhotoError('')
    if (uploadInputRef.current) uploadInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  /* ── Step 2: Summary & Payment ── */
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
    if (step === 2) {
      const e = validate3()
      if (Object.keys(e).length) { setErrors3(e); if (e.received) setCashOpen(true); return }
      // Pay Online → run the Stripe checkout first; advance only once it's paid.
      if (payMethod === 'stripe' && !onlinePayment) { setCheckoutOpen(true); return }
    }
    setStep(s => Math.min(s + 1, 3))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCheckoutDone = () => {
    setCheckoutOpen(false)
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const handleBack = () => {
    if (step === 1) { navigate('/appointments'); return }
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* Derived */
  const fullName = `${form1.firstName} ${form1.lastName}`.trim() || '—'

  /* Confirmation email status: null | 'sending' | 'sent' | 'error' */
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailError, setEmailError]   = useState('')

  /* Confirmation SMS status: null | 'sending' | 'sent' | 'error' */
  const [smsStatus, setSmsStatus] = useState(null)
  const [smsError, setSmsError]   = useState('')

  /* MongoDB save status: null | 'saving' | 'saved' | 'error' */
  const [saveStatus, setSaveStatus] = useState(null)
  const [saveError, setSaveError]   = useState('')

  /* Record the booking in the audit log + email a confirmation once the
     confirmation step is reached. Runs exactly once. */
  const loggedBookingRef = useRef(false)
  useEffect(() => {
    if (step !== 3 || loggedBookingRef.current) return
    loggedBookingRef.current = true

    // Save the appointment (and a patient record) to MongoDB via the serverless
    // function. Non-blocking — the success screen shows regardless; the outcome
    // is surfaced on the confirmation card.
    setSaveStatus('saving')
    fetch('/api/appointments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient: {
          firstName: form1.firstName,
          lastName: form1.lastName,
          nickname: form1.nickname,
          gender: form1.gender,
          birthdate: form1.birthdate,
          address: form1.address,
          condition: form1.condition,
          guardianFirst: form1.guardianFirst,
          guardianLast: form1.guardianLast,
          relationship: form1.relationship,
          contactNumber: form1.contactNumber,
          email: form1.email,
        },
        therapist: { id: therapistObj?.id || '', name: therapistObj?.name || '', role: therapistObj?.role || '' },
        session: {
          mode: sessionMode,
          timeSlot: pickedTime || '',
          year: preselectedYear,
          month: preselectedMonth,
          day: preselectedDate,
        },
        payment: {
          method: payMethod,
          // For 'stripe', the checkout modal lets the payer pick card vs. a QR
          // wallet (GCash/Maya) — onlinePayment.method carries which one, e.g.
          // "Card" or "GCash QR", so the payments collection can record the
          // real method instead of a generic "Stripe".
          onlineMethod: onlinePayment?.method || undefined,
          sessionFee: SESSION_FEE,
          serviceCharge: SERVICE_CHARGE,
          total: TOTAL_DUE,
          amountReceived: payMethod === 'cash' ? cashReceived : undefined,
        },
        bookedBy: { id: user?.id, email: user?.email },
        photo: photo?.dataUrl || null,
      }),
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          const msg = body.error || (r.status === 404
            ? 'API not reachable — run the app with `vercel dev`.'
            : `HTTP ${r.status}`)
          console.warn('Appointment was not saved to MongoDB:', msg)
          setSaveStatus('error')
          setSaveError(msg)
        } else {
          setSaveStatus('saved')
        }
      })
      .catch((e) => {
        console.warn('Appointment save request failed:', e)
        setSaveStatus('error')
        setSaveError(e.message || 'Request failed')
      })

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

    // Email the confirmation to the address entered on the form, and text it
    // to the guardian's contact number. The booking is already done, so a
    // delivery hiccup on either channel must not block the success screen —
    // each is independent and its outcome is surfaced on the confirmation card.
    const to = form1.email.trim()
    if (to) {
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
    }

    const phone = form1.contactNumber.trim()
    if (phone) {
      setSmsStatus('sending')
      fetch('/api/send-appointment-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          patient: fullName,
          therapist: therapistObj?.name || '',
          date: bookingDateLabel,
          time: pickedTime || '',
        }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) {
            const msg = body.error || (r.status === 404
              ? 'SMS service not reachable — run the app with `vercel dev`.'
              : `HTTP ${r.status}`)
            console.warn('Appointment confirmation SMS was not sent:', msg)
            setSmsStatus('error')
            setSmsError(msg)
          } else {
            setSmsStatus('sent')
          }
        })
        .catch((e) => {
          console.warn('Appointment confirmation SMS request failed:', e)
          setSmsStatus('error')
          setSmsError(e.message || 'Request failed')
        })
    }
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

              <div className="reschedule-note" style={{ marginTop: '10px', marginBottom: '20px' }}>
                <InfoIcon />
                <p>
                  Booking with <strong>{therapistObj?.name || '—'}</strong> ({therapistObj?.role || '—'}) ·{' '}
                  {sessionModeObj?.label || '—'} session · {pickedTime || '—'}
                </p>
              </div>

              <h3 className="book-section-title">Personal Details</h3>

              <div
                className={`photo-upload-box ${photoDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true) }}
                onDragLeave={() => setPhotoDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setPhotoDragOver(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) handlePhotoFile(file)
                }}
              >
                <div className="photo-avatar-wrap">
                  <div className="photo-avatar">
                    {photo ? <img src={photo.previewUrl} alt="Child's photo preview" /> : <UserCircleIcon />}
                  </div>
                  <span className="photo-avatar-badge"><CameraIcon size={13} /></span>
                </div>

                <div className="photo-upload-info">
                  <div className="photo-upload-title">Child's Photo <span className="opt">(Optional)</span></div>
                  {photo ? (
                    <div className="photo-upload-filename">
                      <CheckIcon /> {photo.fileName} · {Math.max(1, Math.round(photo.sizeBytes / 1024))} KB
                    </div>
                  ) : (
                    <div className="photo-upload-hint">Drag and drop a photo here, or use a button below.</div>
                  )}

                  <div className="photo-upload-actions">
                    {!photo ? (
                      <>
                        <button type="button" className="photo-btn" onClick={() => uploadInputRef.current?.click()} disabled={photoBusy}>
                          <UploadIcon /> {photoBusy ? 'Processing…' : 'Upload photo'}
                        </button>
                        <button type="button" className="photo-btn" onClick={() => cameraInputRef.current?.click()} disabled={photoBusy}>
                          <CameraIcon /> Take photo
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="photo-btn" onClick={() => uploadInputRef.current?.click()} disabled={photoBusy}>
                          <UploadIcon /> Change photo
                        </button>
                        <button type="button" className="photo-btn photo-btn-danger" onClick={clearPhoto} disabled={photoBusy}>
                          <TrashSmIcon /> Remove
                        </button>
                      </>
                    )}
                  </div>
                  {photoError && <span className="field-err">{photoError}</span>}
                </div>

                <input
                  ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = '' }}
                />
                <input
                  ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = '' }}
                />
              </div>

              <div className="book-row">
                <div className="book-field">
                  <label>Child's First Name <span className="req">*</span></label>
                  <div className="input-icon-wrap">
                    <UserIcon />
                    <input value={form1.firstName} onChange={e => setF1Cap('firstName', e.target.value)}
                      placeholder="Juan" className={errors1.firstName ? 'err' : ''} />
                  </div>
                  {errors1.firstName && <span className="field-err">{errors1.firstName}</span>}
                </div>
                <div className="book-field">
                  <label>Child's Last Name <span className="req">*</span></label>
                  <input value={form1.lastName} onChange={e => setF1Cap('lastName', e.target.value)}
                    placeholder="Maglisang" className={errors1.lastName ? 'err' : ''} />
                  {errors1.lastName && <span className="field-err">{errors1.lastName}</span>}
                </div>
              </div>

              <div className="book-row three-col">
                <div className="book-field">
                  <label>Child's Nickname <span className="opt">(Optional)</span></label>
                  <input value={form1.nickname} onChange={e => setF1Cap('nickname', e.target.value)} placeholder="Berto" />
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
                    <input value={form1.address} onChange={e => setF1Cap('address', e.target.value)}
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
                  <input value={form1.guardianFirst} onChange={e => setF1Cap('guardianFirst', e.target.value)}
                    placeholder="Maria" className={errors1.guardianFirst ? 'err' : ''} />
                  {errors1.guardianFirst && <span className="field-err">{errors1.guardianFirst}</span>}
                </div>
                <div className="book-field">
                  <label>Parent/Guardian Last Name <span className="req">*</span></label>
                  <input value={form1.guardianLast} onChange={e => setF1Cap('guardianLast', e.target.value)}
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
                  <input value={form1.contactNumber} onChange={e => setF1Cap('contactNumber', e.target.value)}
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

          {/* ══ STEP 2: Booking Summary & Payment ══ */}
          {step === 2 && (
            <>
              <h2 className="book-heading">Booking Summary</h2>
              <h3 className="book-section-title">Review your details</h3>

              <div className="summary-block">
                <div className="summary-block-title">Patient Information</div>
                {photo && (
                  <div className="summary-photo-row">
                    <img src={photo.previewUrl} alt={fullName} className="summary-photo-thumb" />
                  </div>
                )}
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

          {/* ══ STEP 3: Confirmation ══ */}
          {step === 3 && (
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

              {smsStatus === 'sending' && (
                <p className="confirm-email-note">Texting a confirmation to {form1.contactNumber}…</p>
              )}
              {smsStatus === 'sent' && (
                <p className="confirm-email-note ok">✓ Confirmation text sent to {form1.contactNumber}</p>
              )}
              {smsStatus === 'error' && (
                <p className="confirm-email-note err">
                  Couldn't text the confirmation to {form1.contactNumber}. {smsError}
                </p>
              )}

              {saveStatus === 'saving' && (
                <p className="confirm-email-note">Saving your appointment…</p>
              )}
              {saveStatus === 'saved' && (
                <p className="confirm-email-note ok">✓ Appointment saved to your records</p>
              )}
              {saveStatus === 'error' && (
                <p className="confirm-email-note err">
                  Couldn't save the appointment to the database. {saveError}
                </p>
              )}

              <div className="summary-block">
                <div className="summary-block-title">Appointment Summary</div>
                {photo && (
                  <div className="summary-photo-row">
                    <img src={photo.previewUrl} alt={fullName} className="summary-photo-thumb" />
                  </div>
                )}
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
        {step < 3 && (
          <div className="book-actions">
            <button className="book-cancel-btn" onClick={handleBack}>
              {step === 1 ? 'CANCEL' : 'BACK'}
            </button>
            <button className="book-continue-btn" onClick={handleNext}>
              {step === 2 ? 'CONFIRM BOOKING' : 'CONTINUE'}
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
        metadata={{
          booking_type: 'appointment',
          patient: fullName,
          therapist: therapistObj?.name || '',
          session_mode: sessionModeObj?.label || '',
          appointment_date: bookingDateLabel,
          appointment_time: pickedTime || '',
        }}
        redirectSeconds={5}
        onSuccess={(meta) => setOnlinePayment(meta)}
        onRedirect={handleCheckoutDone}
      />
    </div>
  )
}
