import { useEffect, useMemo, useRef, useState } from 'react'
import { UserPlus, User, Upload, Camera, MapPin, Mail, Phone, Banknote, CreditCard, Check, Loader2, AlertTriangle, CalendarPlus } from 'lucide-react'
import { Dialog, DateInput } from './ui'
import PayModal from './PayModal'
import { patientsApi } from './api'
import {
  EMPTY_FORM, GENDERS, RELATIONSHIPS, CONDITIONS, REQUIRED_KEYS, validateForm, completeCount, isDirty, conditionOf, normalizePhone, prettyPhone,
  processPhoto, newKey, peso,
} from './format'

const SERVER_KEY = { guardianFirst: 'gFirst', guardianLast: 'gLast' }
const STEP1_KEYS = ['firstName', 'lastName', 'gender', 'birthdate', 'address', 'condition', 'gFirst', 'gLast', 'relationship', 'contact', 'email', 'photo']

function Field({ id, label, required, optional, error, children, className = '' }) {
  return (
    <div className={`pm-field ${className}`}>
      <label htmlFor={id} className="pm-label">{label}{required && <span className="pm-req" aria-hidden="true"> *</span>}{optional && <span className="pm-opt"> (Optional)</span>}</label>
      {children}
      {error && <p className="pm-field-error" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  )
}
const Icon = ({ as: I }) => <I className="pm-input-icon" size={16} aria-hidden="true" />

function Stepper({ step }) {
  const items = ['Personal Details', 'Summary & Payment', 'Confirmation']
  return (
    <ol className="pm-stepper" aria-label="Add patient steps">
      {items.map((label, i) => {
        const n = i + 1; const state = step > n ? 'done' : step === n ? 'current' : 'todo'
        return (
          <li key={label} className={`pm-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="pm-step-dot">{state === 'done' ? <Check size={16} aria-hidden="true" /> : n}</span>
            <span className="pm-step-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function AddPatientModal({ fee, therapist, onClose, onCreated, onOpenExisting, onBookFirst }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM) // the draft survives Back
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [method, setMethod] = useState('') // '' | 'cash' | 'online'
  const [payOpen, setPayOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(null)
  const [result, setResult] = useState(null)
  const [discardAsk, setDiscardAsk] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [drag, setDrag] = useState(false)
  const keyRef = useRef(newKey()) // one idempotency key for this whole attempt
  const fileRef = useRef(null)
  const camRef = useRef(null)

  const errors = useMemo(() => ({ ...validateForm(form), ...serverErrors }), [form, serverErrors])
  const done = completeCount(form)
  const valid = done === REQUIRED_KEYS.length && !Object.keys(serverErrors).length
  const show = (k) => (touched[k] || touched.all ? errors[k] : undefined)
  const set = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); setServerErrors((s) => (s[k] ? { ...s, [k]: undefined } : s)); setDuplicate(null) }
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }))
  const amount = fee?.pesos ?? 300
  const titleSub = step === 1 ? 'Fields marked * are required' : step === 2 ? 'Register the patient and settle the first-session fee' : 'Registration complete'

  useEffect(() => {
    if (!sending) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' } // a refresh mid-send: the endpoint is idempotent, but warn anyway
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sending])

  const requestClose = () => {
    if (sending) return
    if (step === 3) { onClose(); return }
    if (isDirty(form)) setDiscardAsk(true); else onClose()
  }

  const takePhoto = async (file) => {
    if (!file) return
    setPhotoError('')
    try { const dataUrl = await processPhoto(file); setForm((f) => ({ ...f, photo: dataUrl })) } catch (e) { setPhotoError(e.message) }
  }

  const goNext = () => {
    setTouched({ all: true })
    if (!valid) { document.querySelector('.pm-dlg-body [aria-invalid="true"]')?.focus(); return }
    setStep(2)
  }

  const bodyFor = (payment) => ({
    patient: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), nickname: form.nickname.trim(), gender: form.gender, birthdate: form.birthdate, address: form.address.trim(), condition: conditionOf(form), photo: form.photo },
    guardian: { firstName: form.gFirst.trim(), lastName: form.gLast.trim(), relationship: form.relationship, contact: form.contact, email: form.email.trim() },
    payment, send_invite: form.sendInvite,
  })

  // Cash saves straight away; Pay Online sends the proof from PayModal. Either way the SERVER decides the amount and the status.
  const submit = async (payment) => {
    if (sending) return false
    setSending(true); setError(''); setDuplicate(null)
    try {
      const r = await patientsApi.create(bodyFor(payment), keyRef.current)
      setResult(r); setStep(3); setPayOpen(false); onCreated?.(r)
      return true
    } catch (e) {
      if (e.code === 'duplicate_patient') { setDuplicate(e.data?.patientId || true); setPayOpen(false) }
      else if (e.fields) {
        const mapped = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [SERVER_KEY[k] || k, v]))
        setServerErrors(mapped)
        if (Object.keys(mapped).some((k) => STEP1_KEYS.includes(k))) { setStep(1); setPayOpen(false); setTouched({ all: true }) }
        setError(e.message)
      } else setError(e.message)
      return false
    } finally { setSending(false) }
  }

  const onContinue = () => { if (method === 'cash') submit({ method: 'cash' }); else if (method === 'online') { setError(''); setPayOpen(true) } }

  /* ───────── step 1 ───────── */
  const step1 = (
    <form className="pm-form" onSubmit={(e) => { e.preventDefault(); goNext() }} noValidate>
      <p className="pm-section">Personal details</p>
      <div className={`pm-photo${drag ? ' drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); takePhoto(e.dataTransfer.files?.[0]) }}>
        <span className="pm-photo-pic">{form.photo ? <img src={form.photo} alt="Child’s photo preview" /> : <User size={30} aria-hidden="true" />}</span>
        <div className="pm-photo-text">
          <strong>Child’s Photo <span className="pm-opt">(Optional)</span></strong>
          <span>Drag and drop a photo here, or use a button below.</span>
          <div className="pm-photo-btns">
            <button type="button" className="pm-btn light sm" onClick={() => fileRef.current?.click()}><Upload size={14} aria-hidden="true" /> Upload photo</button>
            <button type="button" className="pm-btn light sm" onClick={() => camRef.current?.click()}><Camera size={14} aria-hidden="true" /> Take photo</button>
            {form.photo && <button type="button" className="pm-link-btn" onClick={() => setForm((f) => ({ ...f, photo: '' }))}>Remove</button>}
          </div>
          {(photoError || serverErrors.photo) && <p className="pm-field-error" role="alert">{photoError || serverErrors.photo}</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { takePhoto(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { takePhoto(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      <div className="pm-grid-2">
        <Field id="pm-first" label="Child’s first name" required error={show('firstName')}><span className="pm-input-wrap"><Icon as={User} /><input id="pm-first" className="pm-input with-icon" value={form.firstName} onChange={set('firstName')} onBlur={blur('firstName')} placeholder="e.g. Juan" autoComplete="off" aria-invalid={Boolean(show('firstName')) || undefined} aria-describedby={show('firstName') ? 'pm-first-err' : undefined} /></span></Field>
        <Field id="pm-last" label="Child’s last name" required error={show('lastName')}><input id="pm-last" className="pm-input" value={form.lastName} onChange={set('lastName')} onBlur={blur('lastName')} placeholder="e.g. Dela Cruz" autoComplete="off" aria-invalid={Boolean(show('lastName')) || undefined} /></Field>
      </div>
      <div className="pm-grid-3">
        <Field id="pm-nick" label="Child’s nickname" optional><input id="pm-nick" className="pm-input" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Berto" autoComplete="off" /></Field>
        <Field id="pm-gender" label="Gender" required error={show('gender')}>
          <select id="pm-gender" className="pm-input" value={form.gender} onChange={set('gender')} onBlur={blur('gender')} aria-invalid={Boolean(show('gender')) || undefined}><option value="">Select gender</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>
        </Field>
        <Field id="pm-bd" label="Birthdate" required error={show('birthdate')}><DateInput id="pm-bd" className="pm-input" value={form.birthdate} max={new Date().toISOString().slice(0, 10)} onChange={set('birthdate')} onBlur={blur('birthdate')} aria-invalid={Boolean(show('birthdate')) || undefined} /></Field>
      </div>
      <div className="pm-grid-2">
        <Field id="pm-addr" label="Address" required error={show('address')}><span className="pm-input-wrap"><Icon as={MapPin} /><input id="pm-addr" className="pm-input with-icon" value={form.address} onChange={set('address')} onBlur={blur('address')} placeholder="House no., street, city" autoComplete="off" aria-invalid={Boolean(show('address')) || undefined} /></span></Field>
        <Field id="pm-cond" label="Child condition" required error={show('condition')}>
          <select id="pm-cond" className="pm-input" value={form.conditionPick} onChange={set('conditionPick')} onBlur={blur('condition')} aria-invalid={Boolean(show('condition')) || undefined}><option value="">e.g. Speech Delay, ADHD</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
          {form.conditionPick === 'Other' && <input className="pm-input mt" value={form.conditionOther} onChange={set('conditionOther')} onBlur={blur('condition')} placeholder="Describe the condition" aria-label="Other condition" />}
        </Field>
      </div>

      <p className="pm-section">Contact person / emergency</p>
      <div className="pm-grid-2">
        <Field id="pm-gf" label="Parent / guardian first name" required error={show('gFirst')}><input id="pm-gf" className="pm-input" value={form.gFirst} onChange={set('gFirst')} onBlur={blur('gFirst')} placeholder="e.g. Maria" autoComplete="off" aria-invalid={Boolean(show('gFirst')) || undefined} /></Field>
        <Field id="pm-gl" label="Parent / guardian last name" required error={show('gLast')}><input id="pm-gl" className="pm-input" value={form.gLast} onChange={set('gLast')} onBlur={blur('gLast')} placeholder="e.g. Dela Cruz" autoComplete="off" aria-invalid={Boolean(show('gLast')) || undefined} /></Field>
      </div>
      <div className="pm-grid-3">
        <Field id="pm-rel" label="Relationship with the child" required error={show('relationship')}>
          <select id="pm-rel" className="pm-input" value={form.relationship} onChange={set('relationship')} onBlur={blur('relationship')} aria-invalid={Boolean(show('relationship')) || undefined}><option value="">Select relationship</option>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field id="pm-tel" label="Contact number" required error={show('contact')}><span className="pm-input-wrap"><Icon as={Phone} /><input id="pm-tel" className="pm-input with-icon" inputMode="tel" value={form.contact} onChange={set('contact')} onBlur={blur('contact')} placeholder="09XX XXX XXXX" autoComplete="off" aria-invalid={Boolean(show('contact')) || undefined} /></span></Field>
        <Field id="pm-mail" label="Email address" required error={show('email')}><span className="pm-input-wrap"><Icon as={Mail} /><input id="pm-mail" type="email" className="pm-input with-icon" value={form.email} onChange={set('email')} onBlur={blur('email')} placeholder="name@example.com" autoComplete="off" aria-invalid={Boolean(show('email')) || undefined} /></span></Field>
      </div>
      <label className="pm-invite"><input type="checkbox" checked={form.sendInvite} onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))} /><span>Email the guardian an invite to the TherapyPro app so they can see sessions and progress</span></label>
      {duplicate && (
        <div className="pm-error-box" role="alert"><AlertTriangle size={18} aria-hidden="true" /> <span>This patient may already exist.{typeof duplicate === 'string' && <> <button type="button" className="pm-inline-link" onClick={() => { onClose(); onOpenExisting(duplicate) }}>Open the existing patient</button></>}</span></div>
      )}
      {error && !duplicate && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
  )

  /* ───────── step 2 ───────── */
  const pr = (label, value) => value ? <div className="pm-sum-row"><span>{label}</span><strong>{value}</strong></div> : null
  const step2 = (
    <div>
      <div className="pm-grid-2 tight">
        <section className="pm-card"><h3>Patient</h3>
          {pr('Full name', `${form.firstName.trim()}${form.nickname.trim() ? ` “${form.nickname.trim()}”` : ''} ${form.lastName.trim()}`)}
          {pr('Birthdate', new Date(`${form.birthdate}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }))}
          {pr('Gender', form.gender)}{pr('Condition', conditionOf(form))}{pr('Address', form.address.trim())}
        </section>
        <section className="pm-card"><h3>Guardian / emergency</h3>
          {pr('Guardian', `${form.gFirst.trim()} ${form.gLast.trim()}`)}{pr('Relationship', form.relationship)}
          {pr('Contact', prettyPhone(normalizePhone(form.contact)))}{pr('Email', form.email.trim())}
        </section>
      </div>
      <div className="pm-fee">
        <div><span className="pm-fee-label">First session fee</span><span className="pm-fee-sub">Cognitive session · {therapist?.name || 'Your therapist'}{therapist?.position ? ` (${therapist.position})` : ''}</span></div>
        <strong>{peso(amount)}</strong>
      </div>
      <p className="pm-section">Select payment method <span className="pm-req">*</span></p>
      <div className="pm-methods" role="radiogroup" aria-label="Payment method">
        <button type="button" role="radio" aria-checked={method === 'cash'} className={`pm-method${method === 'cash' ? ' on' : ''}`} onClick={() => setMethod('cash')}>
          <span className="pm-method-ico"><Banknote size={20} aria-hidden="true" /></span><span><strong>Cash</strong><em>Collect {peso(amount).replace('.00', '')} at the clinic</em></span><i className="pm-radio" aria-hidden="true" />
        </button>
        <button type="button" role="radio" aria-checked={method === 'online'} className={`pm-method${method === 'online' ? ' on' : ''}`} onClick={() => setMethod('online')}>
          <span className="pm-method-ico"><CreditCard size={20} aria-hidden="true" /></span><span><strong>Pay Online</strong><em>GCash / Maya QR with reference number</em></span><i className="pm-radio" aria-hidden="true" />
        </button>
      </div>
      {error && <p className="pm-form-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
    </div>
  )

  /* ───────── step 3 ───────── */
  const r = result
  const payLabel = r && (r.payment.method === 'cash' ? 'Cash' : r.payment.method === 'paymaya' ? 'Maya QR' : 'GCash QR')
  const statusTone = r?.payment.status === 'awaiting_verification' ? 'amber' : r?.payment.status === 'completed' ? 'green' : 'plain'
  const step3 = r && (
    <div className="pm-done">
      <span className="pm-done-icon" aria-hidden="true"><Check size={34} /></span>
      <h3>Patient added</h3>
      <p className="pm-muted">
        {r.inviteStatus === 'sent' && <>An invite was sent to <b>{r.patient.guardianEmail}</b>. </>}
        {r.inviteStatus === 'failed' && <>The patient was added, but the invite email could not be sent. You can resend it from the patient’s profile. </>}
        {r.holdHours ? <>Your first session is held for {r.holdHours} hrs.</> : null}
      </p>
      <div className="pm-grid-2 tight left">
        <section className="pm-card"><h3>Patient</h3>
          {pr('Name', r.patient.nickname ? `${r.patient.name.split(' ')[0]} “${r.patient.nickname}” ${r.patient.name.split(' ').slice(1).join(' ')}` : r.patient.name)}
          {pr('Patient ID', r.patient.patientCode)}{pr('Guardian', r.patient.guardianName)}
        </section>
        <section className="pm-card"><h3>Payment</h3>
          {pr('Method', payLabel)}{pr('Amount', peso(r.payment.amount))}
          <div className="pm-sum-row"><span>Status</span><strong className={`pm-status ${statusTone}`}>{r.payment.statusLabel}</strong></div>
        </section>
      </div>
      {r.payment.status === 'awaiting_verification' && <p className="pm-note amber">Online payments are confirmed once you verify the reference number and receipt in <b>Payments</b>. Cash is marked paid when you collect it.</p>}
      {r.payment.status === 'pending' && <p className="pm-note amber">Collect {peso(r.payment.amount)} at the clinic. It stays pending until you mark it paid.</p>}
    </div>
  )

  const footer = step === 1 ? (
    <>
      <span className="pm-foot-note" aria-live="polite">{done} of {REQUIRED_KEYS.length} required fields complete</span>
      <button type="button" className="pm-btn light" onClick={requestClose}>Cancel</button>
      <button type="button" className="pm-btn primary" onClick={goNext} disabled={!valid}>Continue</button>
    </>
  ) : step === 2 ? (
    <>
      <span className="pm-foot-note">{method ? '' : 'Select a payment method to continue'}</span>
      <button type="button" className="pm-btn light" onClick={() => { setStep(1); setError('') }} disabled={sending}>Back</button>
      <button type="button" className="pm-btn primary" onClick={onContinue} disabled={!method || sending}>{sending ? <><Loader2 size={15} className="pm-spin" aria-hidden="true" /> Adding…</> : method === 'cash' ? 'Add patient' : 'Continue to payment'}</button>
    </>
  ) : (
    <>
      <span className="pm-foot-note">{r?.payment.reference ? `Reference ${r.payment.reference}` : ''}</span>
      <button type="button" className="pm-btn light" onClick={onClose}>Done</button>
      <button type="button" className="pm-btn primary" onClick={() => { onClose(); onBookFirst(r.patient) }}><CalendarPlus size={16} aria-hidden="true" /> Book first session</button>
    </>
  )

  return (
    <>
      <Dialog wide icon={UserPlus} title="Add new patient" subtitle={titleSub} onClose={requestClose} locked={sending} footer={footer} labelId="pm-add-title">
        <Stepper step={step} />
        {step === 1 ? step1 : step === 2 ? step2 : step3}
      </Dialog>

      {payOpen && (
        <PayModal
          amount={amount} patientName={`${form.firstName.trim()} ${form.lastName.trim()}`} sending={sending} error={error}
          onBack={() => { if (!sending) setPayOpen(false) }} onSubmit={submit}
        />
      )}

      {discardAsk && (
        <Dialog narrow icon={AlertTriangle} tone="danger" title="Discard this patient?" subtitle="What you entered will be lost." onClose={() => setDiscardAsk(false)} labelId="pm-discard-title"
          footer={(<><button type="button" className="pm-btn light" onClick={() => setDiscardAsk(false)} data-autofocus>Keep editing</button><button type="button" className="pm-btn danger" onClick={() => { setDiscardAsk(false); onClose() }}>Discard</button></>)}>
          <p className="pm-muted">Nothing has been saved yet.</p>
        </Dialog>
      )}
    </>
  )
}

