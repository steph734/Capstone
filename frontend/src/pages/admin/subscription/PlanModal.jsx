import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CreditCard, Eye, EyeOff, FlaskConical, CircleCheck, GripVertical, Infinity as InfinityIcon, Info, Plus, X } from 'lucide-react'
import { authFetch } from '../../../utils/session'
import PlanCard from './PlanCard'
import { COLORS, ICON_LABEL, ICON_MAP, STATUS_LABEL, tierTag, yearlyDeal } from './planConstants'

const LIMIT_KEYS = [['branches', 'Branches'], ['therapists', 'Therapists'], ['patients', 'Patients']]
const STATUS_ICON = { live: CircleCheck, beta: FlaskConical, hidden: EyeOff }
const STATUS_NOTE = {
  live: 'Live plans are offered to every clinic.',
  beta: "Beta plans are only visible to selected beta testers. Switch to Live when you're ready to offer it to all clinics.",
  hidden: 'Hidden plans are not offered to anyone. Existing subscribers keep their plan.',
}

function initialForm(plan, features) {
  const chosen = plan?.featureKeys || []
  const rest = features.map((f) => f.key).filter((k) => !chosen.includes(k))
  const limit = (v) => (v == null ? '' : String(v))
  return {
    name: plan?.name || '',
    tagline: plan?.tagline || '',
    priceMonthly: plan ? String(plan.priceMonthly) : '',
    priceYearly: plan?.priceYearly != null ? String(plan.priceYearly) : '',
    trialDays: plan ? String(plan.trialDays) : '0',
    status: plan?.status || 'live',
    limits: { branches: limit(plan?.limits.branches), therapists: limit(plan?.limits.therapists), patients: limit(plan?.limits.patients) },
    icon: plan?.icon || 'rocket',
    color: plan?.color || COLORS[0].value,
    order: [...chosen, ...rest],
    checked: chosen,
  }
}

function validate(f, takenNames) {
  const e = {}
  const name = f.name.trim()
  if (!name) e.name = 'Plan name is required.'
  else if (name.length > 30) e.name = 'Keep the name to 30 characters.'
  else if (takenNames.has(name.toLowerCase())) e.name = 'A plan with this name already exists.'
  if (f.tagline.trim().length > 60) e.tagline = 'Keep the tagline to 60 characters.'
  const price = f.priceMonthly.trim()
  if (price === '' || Number.isNaN(Number(price))) e.priceMonthly = 'Monthly price is required.'
  else if (Number(price) < 0) e.priceMonthly = 'Enter a price of ₱0 or more.'
  if (f.priceYearly.trim() !== '' && (Number.isNaN(Number(f.priceYearly)) || Number(f.priceYearly) < 0)) e.priceYearly = 'Enter a yearly price of ₱0 or more.'
  const t = Number(f.trialDays === '' ? 0 : f.trialDays)
  if (!Number.isInteger(t) || t < 0 || t > 60) e.trialDays = 'Free trial must be 0 to 60 days.'
  for (const [k, label] of LIMIT_KEYS) {
    const v = f.limits[k]
    if (v !== '' && (!/^\d+$/.test(v) || Number(v) < 1 || Number(v) > 100000)) e[`limits.${k}`] = `${label}: whole number from 1, or unlimited.`
  }
  return e
}

function Field({ label, note, error, htmlFor, children }) {
  return (
    <div className="br-field">
      <div className="br-field-head"><label htmlFor={htmlFor}>{label}</label>{note && <span className="br-optional">{note}</span>}</div>
      {children}
      {error && <p className="br-error" role="alert">{error}</p>}
    </div>
  )
}

export default function PlanModal({ plan, plans, features: initialFeatures, onClose, onSaved }) {
  const editing = Boolean(plan)
  const [features, setFeatures] = useState(initialFeatures)
  const [form, setForm] = useState(() => initialForm(plan, initialFeatures))
  const initialJson = useRef(JSON.stringify(form))
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [tab, setTab] = useState('form') // mobile: 'form' | 'preview'
  const [addingFeature, setAddingFeature] = useState(false)
  const [newFeature, setNewFeature] = useState('')
  const [featureError, setFeatureError] = useState('')
  const [dragKey, setDragKey] = useState(null)
  const [overKey, setOverKey] = useState(null)
  const dialogRef = useRef(null)

  const dirty = JSON.stringify(form) !== initialJson.current
  const takenNames = useMemo(() => new Set(plans.filter((p) => p.id !== plan?.id).map((p) => p.name.toLowerCase())), [plans, plan])
  const errors = useMemo(() => ({ ...validate(form, takenNames), ...serverErrors }), [form, takenNames, serverErrors])
  const valid = Object.keys(errors).length === 0
  const show = (key) => (touched[key] || touched.all ? errors[key] : undefined)
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }))
  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setServerErrors((s) => (s[key] ? { ...s, [key]: undefined } : s)) }

  const requestClose = () => { if (saving) return; if (dirty) setConfirmDiscard(true); else onClose() }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (confirmDiscard) setConfirmDiscard(false); else requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => { dialogRef.current?.focus() }, [])

  const byKey = useMemo(() => new Map(features.map((f) => [f.key, f])), [features])
  const featureKeys = form.order.filter((k) => form.checked.includes(k))
  const previewPlan = {
    id: 'preview', slug: 'preview', name: form.name.trim(), tagline: form.tagline.trim(),
    priceMonthly: Number(form.priceMonthly) || 0, priceYearly: form.priceYearly.trim() === '' ? null : Number(form.priceYearly),
    trialDays: Number(form.trialDays) || 0, status: form.status, limits: {}, icon: form.icon, color: form.color, featureKeys,
    betaTesters: [], subscribers: 0, revenue: 0, share: 0, mostPopular: false,
  }

  const toggleFeature = (key) => set('checked', form.checked.includes(key) ? form.checked.filter((k) => k !== key) : [...form.checked, key])
  const move = (from, to) => {
    if (to < 0 || to >= form.order.length || from === to) return
    const next = [...form.order]
    next.splice(to, 0, next.splice(from, 1)[0])
    set('order', next)
  }
  const onDrop = (key) => {
    if (dragKey && dragKey !== key) move(form.order.indexOf(dragKey), form.order.indexOf(key))
    setDragKey(null); setOverKey(null)
  }

  const addFeature = async () => {
    setFeatureError('')
    try {
      const { feature } = await authFetch('/api/admin/plan-features', { method: 'POST', body: { label: newFeature } })
      setFeatures((cur) => [...cur, feature])
      setForm((f) => ({ ...f, order: [...f.order, feature.key], checked: [...f.checked, feature.key] }))
      setNewFeature(''); setAddingFeature(false)
    } catch (err) {
      setFeatureError(err.fields?.label || err.message)
    }
  }

  const save = async (asHidden) => {
    setTouched({ all: true })
    if (!valid) { setTab('form'); return }
    setSaving(true); setFormError('')
    const body = {
      name: form.name.trim(), tagline: form.tagline.trim(), priceMonthly: Number(form.priceMonthly),
      priceYearly: form.priceYearly.trim() === '' ? null : Number(form.priceYearly), trialDays: Number(form.trialDays || 0),
      status: asHidden ? 'hidden' : form.status, saveHidden: asHidden,
      limits: Object.fromEntries(LIMIT_KEYS.map(([k]) => [k, form.limits[k] === '' ? null : Number(form.limits[k])])),
      icon: form.icon, color: form.color, featureKeys,
    }
    try {
      const data = await authFetch(editing ? `/api/admin/plans/${plan.id}` : '/api/admin/plans', { method: editing ? 'PATCH' : 'POST', body })
      onSaved(editing ? 'Plan updated.' : asHidden ? 'Plan saved as hidden.' : 'Plan created.', data.warning)
    } catch (err) {
      if (err.fields) { setServerErrors(err.fields); setTab('form') }
      setFormError(err.message)
      setSaving(false)
    }
  }

  const deal = yearlyDeal(Number(form.priceMonthly), form.priceYearly.trim() === '' ? null : Number(form.priceYearly))

  return (
    <div className="br-backdrop pcx-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="pcx-modal" role="dialog" aria-modal="true" aria-labelledby="pcx-modal-title" tabIndex={-1} ref={dialogRef}>
        <header className="br-modal-head">
          <span className="br-tile dark"><CreditCard size={22} aria-hidden="true" /></span>
          <div>
            <h2 id="pcx-modal-title">{editing ? 'Edit plan' : 'Add plan'}</h2>
            <p>{editing ? `${plan.name} Plan` : 'Create a new subscription plan for clinics'}</p>
          </div>
          <button type="button" className="br-close" onClick={requestClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="pcx-tabs" role="tablist" aria-label="Plan editor">
          <button type="button" role="tab" aria-selected={tab === 'form'} className={tab === 'form' ? 'on' : ''} onClick={() => setTab('form')}>Details</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}><Eye size={15} /> Preview</button>
        </div>

        <div className="pcx-modal-body">
          <div className={`pcx-form${tab === 'form' ? ' active' : ''}`}>
            <p className="br-eyebrow">Basics</p>
            <div className="br-grid-2">
              <Field label="Plan name" htmlFor="pcx-name" error={show('name')}>
                <div className={`br-input${show('name') ? ' has-error' : ''}`}>
                  <input id="pcx-name" value={form.name} maxLength={40} autoFocus onChange={(e) => set('name', e.target.value)} onBlur={() => touch('name')} placeholder="Platinum" aria-invalid={Boolean(show('name'))} />
                </div>
              </Field>
              <Field label="Tagline" note="shown under the name" htmlFor="pcx-tagline" error={show('tagline')}>
                <div className={`br-input${show('tagline') ? ' has-error' : ''}`}>
                  <input id="pcx-tagline" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} onBlur={() => touch('tagline')} placeholder="Priority support and analytics" />
                </div>
              </Field>
            </div>

            <p className="br-eyebrow">Price</p>
            <div className="pcx-grid-3">
              <Field label="Monthly price" htmlFor="pcx-monthly" error={show('priceMonthly')}>
                <div className={`br-input${show('priceMonthly') ? ' has-error' : ''}`}>
                  <span aria-hidden="true">₱</span>
                  <input id="pcx-monthly" type="number" min="0" step="0.01" inputMode="decimal" value={form.priceMonthly} onChange={(e) => set('priceMonthly', e.target.value)} onBlur={() => touch('priceMonthly')} placeholder="699" />
                </div>
              </Field>
              <Field label="Yearly price" note="optional" htmlFor="pcx-yearly" error={show('priceYearly')}>
                <div className={`br-input${show('priceYearly') ? ' has-error' : ''}`}>
                  <span aria-hidden="true">₱</span>
                  <input id="pcx-yearly" type="number" min="0" step="0.01" inputMode="decimal" value={form.priceYearly} onChange={(e) => set('priceYearly', e.target.value)} onBlur={() => touch('priceYearly')} placeholder="6990" />
                </div>
                {deal && !show('priceYearly') && <p className="br-hint">2 months free</p>}
              </Field>
              <Field label="Free trial" htmlFor="pcx-trial" error={show('trialDays')}>
                <div className={`br-input${show('trialDays') ? ' has-error' : ''}`}>
                  <input id="pcx-trial" type="number" min="0" max="60" value={form.trialDays} onChange={(e) => set('trialDays', e.target.value)} onBlur={() => touch('trialDays')} />
                  <span aria-hidden="true">days</span>
                </div>
              </Field>
            </div>

            <div className="br-grid-2">
              <div className="br-field">
                <div className="br-field-head"><label id="pcx-status-label">Status</label></div>
                <div className="pcx-segment" role="radiogroup" aria-labelledby="pcx-status-label">
                  {['live', 'beta', 'hidden'].map((s) => {
                    const I = STATUS_ICON[s]
                    return (
                      <button key={s} type="button" role="radio" aria-checked={form.status === s} className={form.status === s ? 'on' : ''} onClick={() => set('status', s)}>
                        <I size={15} aria-hidden="true" /> {STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="br-field">
                <div className="br-field-head"><label id="pcx-limits-label">Limits</label><span className="br-optional">empty = unlimited</span></div>
                <div className="pcx-limits" role="group" aria-labelledby="pcx-limits-label">
                  {LIMIT_KEYS.map(([k, label]) => {
                    const unlimited = form.limits[k] === ''
                    return (
                      <div key={k} className={`pcx-limit${errors[`limits.${k}`] ? ' has-error' : ''}`}>
                        <label htmlFor={`pcx-limit-${k}`}>{label}</label>
                        <input id={`pcx-limit-${k}`} inputMode="numeric" value={form.limits[k]} placeholder="∞" onChange={(e) => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: e.target.value.replace(/\D/g, '') } }))} />
                        <button type="button" className={unlimited ? 'on' : ''} aria-pressed={unlimited} aria-label={`${label}: unlimited`}
                          onClick={() => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: unlimited ? '1' : '' } }))}><InfinityIcon size={15} /></button>
                      </div>
                    )
                  })}
                </div>
                {LIMIT_KEYS.map(([k]) => errors[`limits.${k}`] && <p key={k} className="br-error" role="alert">{errors[`limits.${k}`]}</p>)}
              </div>
            </div>

            <p className="br-eyebrow">Look</p>
            <div className="br-grid-2">
              <div className="br-field">
                <div className="br-field-head"><label id="pcx-icon-label">Icon</label></div>
                <div className="pcx-icons" role="radiogroup" aria-labelledby="pcx-icon-label">
                  {Object.entries(ICON_MAP).map(([k, I]) => (
                    <button key={k} type="button" role="radio" aria-checked={form.icon === k} aria-label={ICON_LABEL[k]} title={ICON_LABEL[k]} className={form.icon === k ? 'on' : ''} onClick={() => set('icon', k)}><I size={20} /></button>
                  ))}
                </div>
              </div>
              <div className="br-field">
                <div className="br-field-head"><label id="pcx-color-label">Color</label></div>
                <div className="pcx-swatches" role="radiogroup" aria-labelledby="pcx-color-label">
                  {COLORS.map((c) => (
                    <button key={c.value} type="button" role="radio" aria-checked={form.color === c.value} aria-label={c.label} title={c.label} className={form.color === c.value ? 'on' : ''} style={{ background: c.value }} onClick={() => set('color', c.value)}>
                      {form.color === c.value && <Check size={14} color="#fff" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="br-eyebrow">Features <span className="pcx-eyebrow-note">· tick what this plan includes, drag to reorder</span></p>
            <ul className="pcx-feature-list">
              {form.order.map((key, i) => {
                const f = byKey.get(key)
                if (!f) return null
                return (
                  <li key={key} className={`${dragKey === key ? 'dragging' : ''}${overKey === key && dragKey !== key ? ' over' : ''}`}
                    draggable onDragStart={() => setDragKey(key)} onDragOver={(e) => { e.preventDefault(); setOverKey(key) }} onDrop={() => onDrop(key)} onDragEnd={() => { setDragKey(null); setOverKey(null) }}>
                    <button type="button" className="pcx-grip" aria-label={`Reorder ${f.label}. Use arrow up or down.`}
                      onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1) } else if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1) } }}>
                      <GripVertical size={16} />
                    </button>
                    <label className="pcx-check">
                      <input type="checkbox" checked={form.checked.includes(key)} onChange={() => toggleFeature(key)} />
                      <span className="pcx-box" aria-hidden="true"><Check size={13} /></span>
                      <span className="pcx-feature-label">{f.label}</span>
                    </label>
                    <span className="pcx-tier">{tierTag(f, plans)}</span>
                  </li>
                )
              })}
              <li className="pcx-add-row">
                {addingFeature ? (
                  <div className="pcx-add-feature">
                    <div className={`br-input${featureError ? ' has-error' : ''}`}>
                      <input value={newFeature} autoFocus maxLength={60} placeholder="Feature name" aria-label="New feature name" onChange={(e) => { setNewFeature(e.target.value); setFeatureError('') }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }} />
                    </div>
                    <button type="button" className="br-btn primary sm" onClick={addFeature}>Add</button>
                    <button type="button" className="br-btn ghost sm" onClick={() => { setAddingFeature(false); setNewFeature(''); setFeatureError('') }}>Cancel</button>
                    {featureError && <p className="br-error" role="alert">{featureError}</p>}
                  </div>
                ) : (
                  <button type="button" className="pcx-add-btn" onClick={() => setAddingFeature(true)}><Plus size={16} /> Add custom feature</button>
                )}
              </li>
            </ul>
            {formError && <p className="br-form-error" role="alert">{formError}</p>}
          </div>

          <aside className={`pcx-side${tab === 'preview' ? ' active' : ''}`} aria-label="Live preview">
            <div className="pcx-side-inner">
              <p className="pcx-live"><Eye size={14} aria-hidden="true" /> LIVE PREVIEW · what clinics will see</p>
              <PlanCard plan={previewPlan} features={features} variant="preview" />
              <p className="pcx-note"><Info size={15} aria-hidden="true" /> {STATUS_NOTE[form.status]}</p>
            </div>
          </aside>
        </div>

        <footer className="pcx-modal-foot">
          <p>{editing ? 'Price changes apply to new subscribers and renewals, not retroactively.' : 'Price changes never affect current subscribers until they renew.'}</p>
          <div className="pcx-foot-actions">
            <button type="button" className="br-btn btn-line" onClick={requestClose} disabled={saving}>Cancel</button>
            <button type="button" className="br-btn btn-line" onClick={() => save(true)} disabled={saving || !valid}><EyeOff size={16} /> Save as hidden</button>
            <button type="button" className="br-btn primary" onClick={() => save(false)} disabled={saving || !valid}><Check size={16} /> {saving ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}</button>
          </div>
        </footer>

        {confirmDiscard && (
          <div className="br-confirm-layer" role="alertdialog" aria-labelledby="pcx-discard-title">
            <div className="br-confirm">
              <h3 id="pcx-discard-title">Discard changes?</h3>
              <p>You have unsaved changes. If you close now they will be lost.</p>
              <div className="br-confirm-actions">
                <button type="button" className="br-btn btn-line" onClick={() => setConfirmDiscard(false)} autoFocus>Keep editing</button>
                <button type="button" className="br-btn danger" onClick={onClose}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

