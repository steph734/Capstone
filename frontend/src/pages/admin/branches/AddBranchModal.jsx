import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Building2, Check, Info, Mail, Map as MapIcon, MapPin, Phone, Stethoscope, UserPlus, X,
} from 'lucide-react'
import { authFetch } from '../../../utils/session'
import { DAYS, PROVINCES, SERVICES, defaultHours, isEmail, isPhPhone } from './branchConstants'

const STEPS = ['Branch details', 'Owner', 'Services & hours']

// Which step each server-side field error belongs to.
const stepOfField = (key) => {
  if (key === 'owner') return 1
  if (key === 'services' || key === 'hours' || key.startsWith('hours.')) return 2
  return 0
}

function formFromBranch(b) {
  return {
    name: b?.name || '',
    city: b?.city || '',
    province: b?.province || '',
    street: b?.street || '',
    phone: b?.phone || '',
    email: b?.email || '',
    capacity: b?.capacity ?? '',
    status: b && (b.status === 'Active' || b.status === 'Under review') ? b.status : 'Under review',
    ownerMode: b?.owner?.pending ? 'invite' : 'existing',
    ownerId: b?.owner?.id || '',
    inviteEmail: b?.owner?.pending ? b.owner.email : '',
    services: b?.services || [],
    hours: b?.hours || defaultHours(),
  }
}

function validateStep(step, f, { takenNames, isDraftOrNew }) {
  const e = {}
  if (step === 0) {
    const name = f.name.trim()
    if (!name) e.name = 'Branch name is required.'
    else if (takenNames.has(name.toLowerCase())) e.name = 'A branch with this name already exists.'
    if (!f.city.trim()) e.city = 'City or municipality is required.'
    if (!f.province) e.province = 'Choose a province.'
    if (!f.street.trim()) e.street = 'Street address is required.'
    if (!f.phone.trim()) e.phone = 'Contact number is required.'
    else if (!isPhPhone(f.phone)) e.phone = 'Use a Philippine number, e.g. 0917 123 4567 or (033) 000 0000.'
    if (f.email.trim() && !isEmail(f.email)) e.email = 'Enter a valid email address.'
    const cap = Number(f.capacity)
    if (f.capacity === '' || f.capacity == null) e.capacity = 'Therapist capacity is required.'
    else if (!Number.isInteger(cap) || cap < 1 || cap > 500) e.capacity = 'Capacity must be a whole number from 1 to 500.'
  }
  if (step === 1) {
    if (f.ownerMode === 'invite' && f.inviteEmail.trim() && !isEmail(f.inviteEmail)) e.owner = 'Enter a valid email address to invite.'
    const hasOwner = f.ownerMode === 'existing' ? Boolean(f.ownerId) : Boolean(f.inviteEmail.trim())
    if (isDraftOrNew && f.status === 'Active' && !hasOwner) e.owner = 'An active branch needs an owner. Pick or invite one.'
  }
  if (step === 2) {
    if (!f.services.length) e.services = 'Select at least one service.'
    if (!DAYS.some((d) => f.hours[d.key]?.open)) e.hours = 'Open at least one day.'
    for (const d of DAYS) {
      const h = f.hours[d.key]
      if (h?.open && !(h.from && h.to && h.from < h.to)) e[`hours.${d.key}`] = 'Closing time must be after opening time.'
    }
  }
  return e
}

function Field({ label, optional, error, hint, children, htmlFor }) {
  return (
    <div className="br-field">
      <div className="br-field-head">
        <label htmlFor={htmlFor}>{label}</label>
        {optional && <span className="br-optional">optional</span>}
      </div>
      {children}
      {error ? <p className="br-error" role="alert">{error}</p> : hint ? <p className="br-hint">{hint}</p> : null}
    </div>
  )
}

function IconInput({ icon: Icon, error, ...props }) {
  return (
    <div className={`br-input${error ? ' has-error' : ''}`}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      <input {...props} aria-invalid={Boolean(error)} />
    </div>
  )
}

export default function AddBranchModal({ branch, owners, existingBranches, onClose, onSaved }) {
  const editing = Boolean(branch)
  const isDraftOrNew = !editing || branch.status === 'Draft'
  const initial = useMemo(() => formFromBranch(branch), [branch])
  const initialJson = useMemo(() => JSON.stringify(initial), [initial])
  const [form, setForm] = useState(initial)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dialogRef = useRef(null)

  const dirty = JSON.stringify(form) !== initialJson
  const takenNames = useMemo(
    () => new Set(existingBranches.filter((b) => b.id !== branch?.id).map((b) => b.name.toLowerCase())),
    [existingBranches, branch]
  )

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }

  const requestClose = () => {
    if (saving) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (confirmDiscard) setConfirmDiscard(false)
      else requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => { dialogRef.current?.focus() }, [])

  const payload = (draft) => ({
    name: form.name.trim(),
    city: form.city.trim(),
    province: form.province,
    street: form.street.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    capacity: form.capacity === '' ? null : Number(form.capacity),
    status: form.status,
    services: form.services,
    hours: form.hours,
    owner: form.ownerMode === 'existing'
      ? (form.ownerId ? { id: form.ownerId } : null)
      : (form.inviteEmail.trim() ? { inviteEmail: form.inviteEmail.trim() } : null),
    draft,
  })

  const send = async (draft) => {
    setSaving(true)
    setFormError('')
    try {
      const data = await authFetch(editing ? `/api/admin/branches/${branch.id}` : '/api/admin/branches', {
        method: editing ? 'PATCH' : 'POST',
        body: payload(draft),
      })
      onSaved(data.branch, draft ? 'draft' : editing ? 'updated' : 'created')
    } catch (err) {
      if (err.fields && Object.keys(err.fields).length) {
        setErrors((cur) => ({ ...cur, ...err.fields }))
        setStep(Math.min(...Object.keys(err.fields).map(stepOfField)))
      }
      setFormError(err.message)
      setSaving(false)
    }
  }

  const goNext = () => {
    const e = validateStep(step, form, { takenNames, isDraftOrNew })
    setErrors(e)
    if (Object.keys(e).length) return
    setStep((s) => s + 1)
  }

  const submit = () => {
    const all = {}
    for (let s = 0; s < STEPS.length; s += 1) Object.assign(all, validateStep(s, form, { takenNames, isDraftOrNew }))
    setErrors(all)
    const keys = Object.keys(all)
    if (keys.length) { setStep(Math.min(...keys.map(stepOfField))); return }
    send(false)
  }

  const saveDraft = () => {
    const name = form.name.trim()
    if (!name) { setStep(0); setErrors({ name: 'Give the draft a name first.' }); return }
    if (takenNames.has(name.toLowerCase())) { setStep(0); setErrors({ name: 'A branch with this name already exists.' }); return }
    send(true)
  }

  const toggleService = (s) => set('services', form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s])
  const setHours = (day, patch) => {
    setForm((f) => ({ ...f, hours: { ...f.hours, [day]: { ...f.hours[day], ...patch } } }))
    setErrors((e) => ({ ...e, [`hours.${day}`]: undefined, hours: undefined }))
  }

  const last = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="br-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="br-modal" role="dialog" aria-modal="true" aria-labelledby="br-modal-title" tabIndex={-1} ref={dialogRef}>
        <header className="br-modal-head">
          <span className="br-tile dark"><Building2 size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="br-modal-title">{editing ? (branch.status === 'Draft' ? 'Finish draft' : 'Edit branch') : 'Add branch'}</h2>
            <p>{editing ? branch.name : 'Register a new clinic location'}</p>
          </div>
          <button type="button" className="br-close" onClick={requestClose} aria-label="Close"><X size={18} /></button>
        </header>

        <nav className="br-steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <div key={label} className={`br-step${i === step ? ' current' : ''}${i < step ? ' done' : ''}`} aria-current={i === step ? 'step' : undefined}>
              <span className="br-step-dot">{i < step ? <Check size={13} /> : i + 1}</span>
              <span className="br-step-label">{label}</span>
            </div>
          ))}
        </nav>
        <div className="br-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div style={{ width: `${progress}%` }} />
        </div>

        <div className="br-modal-body">
          {step === 0 && (
            <>
              <p className="br-eyebrow">Branch details</p>
              <Field label="Branch name" htmlFor="br-name" error={errors.name} hint="Shown to owners, therapists and patients.">
                <IconInput icon={Building2} id="br-name" value={form.name} error={errors.name} autoFocus
                  onChange={(e) => set('name', e.target.value)} placeholder="Therapy Pro – Iloilo Branch" maxLength={80} />
              </Field>
              <div className="br-grid-2">
                <Field label="City / municipality" htmlFor="br-city" error={errors.city}>
                  <IconInput icon={MapPin} id="br-city" value={form.city} error={errors.city} onChange={(e) => set('city', e.target.value)} placeholder="Iloilo City" />
                </Field>
                <Field label="Province" htmlFor="br-province" error={errors.province}>
                  <div className={`br-input${errors.province ? ' has-error' : ''}`}>
                    <select id="br-province" value={form.province} onChange={(e) => set('province', e.target.value)} aria-invalid={Boolean(errors.province)}>
                      <option value="">Select province</option>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <Field label="Street address" htmlFor="br-street" error={errors.street}>
                <IconInput icon={MapIcon} id="br-street" value={form.street} error={errors.street} onChange={(e) => set('street', e.target.value)} placeholder="e.g. 2F Atrium Bldg, Gen. Luna St." />
              </Field>
              <div className="br-grid-2">
                <Field label="Contact number" htmlFor="br-phone" error={errors.phone}>
                  <IconInput icon={Phone} id="br-phone" type="tel" value={form.phone} error={errors.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(033) 000 0000" />
                </Field>
                <Field label="Branch email" optional htmlFor="br-email" error={errors.email}>
                  <IconInput icon={Mail} id="br-email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} placeholder="iloilo@therapypro.ph" />
                </Field>
              </div>
              <div className="br-grid-2">
                <Field label="Therapist capacity" htmlFor="br-capacity" error={errors.capacity} hint="Assigned therapists are counted automatically.">
                  <IconInput icon={Stethoscope} id="br-capacity" type="number" min="1" max="500" value={form.capacity} error={errors.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="10" />
                </Field>
                {isDraftOrNew && (
                  <Field label="Status" error={errors.status}>
                    <div className="br-seg" role="radiogroup" aria-label="Status">
                      {['Under review', 'Active'].map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={form.status === s}
                          className={form.status === s ? 'on' : ''} onClick={() => set('status', s)}>{s}</button>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
              <p className="br-note"><Info size={16} aria-hidden="true" /> Next, choose or invite the branch owner. The owner can then add therapists from their Staff page.</p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="br-eyebrow">Branch owner</p>
              <div className="br-seg wide" role="radiogroup" aria-label="Owner type">
                <button type="button" role="radio" aria-checked={form.ownerMode === 'existing'} className={form.ownerMode === 'existing' ? 'on' : ''}
                  onClick={() => set('ownerMode', 'existing')}>Existing owner</button>
                <button type="button" role="radio" aria-checked={form.ownerMode === 'invite'} className={form.ownerMode === 'invite' ? 'on' : ''}
                  onClick={() => set('ownerMode', 'invite')}>Invite by email</button>
              </div>
              {form.ownerMode === 'existing' ? (
                <Field label="Owner account" htmlFor="br-owner" error={errors.owner}
                  hint={owners.length ? 'Owners can manage this branch and its therapists.' : 'No owner accounts yet. Invite one by email instead.'}>
                  <div className={`br-input${errors.owner ? ' has-error' : ''}`}>
                    <select id="br-owner" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                      <option value="">No owner yet</option>
                      {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
                    </select>
                  </div>
                </Field>
              ) : (
                <Field label="Owner email" htmlFor="br-invite" error={errors.owner} hint="We email the owner so they know they were assigned. An owner is required before the branch can go Active.">
                  <IconInput icon={UserPlus} id="br-invite" type="email" value={form.inviteEmail} error={errors.owner} onChange={(e) => set('inviteEmail', e.target.value)} placeholder="owner@example.com" />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p className="br-eyebrow">Services offered</p>
              <div className="br-chips" role="group" aria-label="Services offered">
                {SERVICES.map((s) => (
                  <button key={s} type="button" aria-pressed={form.services.includes(s)} className={form.services.includes(s) ? 'on' : ''} onClick={() => toggleService(s)}>
                    {form.services.includes(s) && <Check size={14} aria-hidden="true" />} {s}
                  </button>
                ))}
              </div>
              {errors.services && <p className="br-error" role="alert">{errors.services}</p>}

              <p className="br-eyebrow" style={{ marginTop: 18 }}>Operating hours</p>
              <div className="br-hours">
                {DAYS.map((d) => {
                  const h = form.hours[d.key]
                  const err = errors[`hours.${d.key}`]
                  return (
                    <div key={d.key} className={`br-hours-row${h.open ? '' : ' closed'}`}>
                      <label className="br-switch">
                        <input type="checkbox" checked={h.open} onChange={(e) => setHours(d.key, { open: e.target.checked })} />
                        <span>{d.label}</span>
                      </label>
                      {h.open ? (
                        <div className="br-times">
                          <input type="time" value={h.from} aria-label={`${d.label} opens`} onChange={(e) => setHours(d.key, { from: e.target.value })} />
                          <span>to</span>
                          <input type="time" value={h.to} aria-label={`${d.label} closes`} onChange={(e) => setHours(d.key, { to: e.target.value })} />
                        </div>
                      ) : <span className="br-closed">Closed</span>}
                      {err && <p className="br-error" role="alert">{err}</p>}
                    </div>
                  )
                })}
              </div>
              {errors.hours && <p className="br-error" role="alert">{errors.hours}</p>}
            </>
          )}

          {formError && <p className="br-form-error" role="alert">{formError}</p>}
        </div>

        <footer className="br-modal-foot">
          {step > 0 && (
            <button type="button" className="br-btn ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}><ArrowLeft size={16} /> Back</button>
          )}
          <span className="br-spacer" />
          <button type="button" className="br-btn outline" onClick={requestClose} disabled={saving}>Cancel</button>
          {isDraftOrNew && (
            <button type="button" className="br-btn outline" onClick={saveDraft} disabled={saving}>Save as draft</button>
          )}
          {last ? (
            <button type="button" className="br-btn primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : editing && branch.status !== 'Draft' ? 'Save changes' : 'Create branch'}
            </button>
          ) : (
            <button type="button" className="br-btn primary" onClick={goNext} disabled={saving}>
              Next: {STEPS[step + 1].split(' ')[0]} <ArrowRight size={16} />
            </button>
          )}
        </footer>

        {confirmDiscard && (
          <div className="br-confirm-layer" role="alertdialog" aria-labelledby="br-discard-title">
            <div className="br-confirm">
              <h3 id="br-discard-title">Discard changes?</h3>
              <p>You have unsaved changes. If you close now they will be lost.</p>
              <div className="br-confirm-actions">
                <button type="button" className="br-btn outline" onClick={() => setConfirmDiscard(false)} autoFocus>Keep editing</button>
                <button type="button" className="br-btn danger" onClick={onClose}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
