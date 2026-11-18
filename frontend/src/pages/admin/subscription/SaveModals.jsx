import { Check, EyeOff, ArrowRight } from 'lucide-react'

// Confirm-before-save and "Changes saved" dialogs for Edit plan.
const pesoFull = (n) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

// One formatter for both the client-side preview diff and the server-computed diff ({ field, label, before, after }).
export function fmtChangeValue(field, v) {
  if (field === 'priceMonthly' || field === 'priceYearly') return v == null ? 'Not set' : pesoFull(v)
  if (field === 'trialDays') return !v ? 'No trial' : `${v} day${v === 1 ? '' : 's'}`
  if (field.startsWith('limits.')) return v == null ? 'Unlimited' : String(v)
  return v == null || v === '' ? '—' : String(v)
}

// What the admin is about to change, computed from the loaded plan and the form (the server recomputes it on save).
export function previewChanges(plan, form, featureKeys, featureLabel) {
  const out = []
  const add = (field, label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field, label, before: a, after: b }) }
  const status = { live: 'Live', beta: 'Beta', hidden: 'Hidden' }
  add('status', 'Status', status[plan.status], status[form.status])
  add('name', 'Plan name', plan.name, form.name.trim())
  add('tagline', 'Tagline', plan.tagline || null, form.tagline.trim() || null)
  add('priceMonthly', 'Monthly price', plan.priceMonthly, Number(form.priceMonthly))
  add('priceYearly', 'Yearly price', plan.priceYearly ?? null, form.priceYearly.trim() === '' ? null : Number(form.priceYearly))
  add('trialDays', 'Free trial', plan.trialDays, Number(form.trialDays || 0))
  for (const [k, label] of [['branches', 'Branches limit'], ['therapists', 'Therapists limit'], ['patients', 'Patients limit']]) {
    add(`limits.${k}`, label, plan.limits[k] ?? null, form.limits[k] === '' ? null : Number(form.limits[k]))
  }
  const had = new Set(plan.featureKeys); const has = new Set(featureKeys)
  const added = featureKeys.filter((k) => !had.has(k)).map(featureLabel)
  const removed = plan.featureKeys.filter((k) => !has.has(k)).map(featureLabel)
  if (added.length || removed.length) out.push({ field: 'features', label: 'Features', before: removed.length ? `Removed: ${removed.join(', ')}` : null, after: added.length ? `Added: ${added.join(', ')}` : null })
  else if (JSON.stringify(plan.featureKeys) !== JSON.stringify(featureKeys)) out.push({ field: 'features', label: 'Feature order', before: null, after: 'Reordered' })
  add('icon', 'Icon', plan.icon, form.icon)
  add('color', 'Color', plan.color, form.color)
  return out
}

function Shell({ label, icon, tone = 'ok', title, subtitle, children }) {
  return (
    <div className="pcx-sm-layer" role="alertdialog" aria-modal="true" aria-label={label}>
      <div className="pcx-sm">
        <span className={`pcx-sm-icon ${tone}`} aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
        <p className="pcx-sm-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

function ChangeRows({ rows, showBefore = true }) {
  return (
    <div className="pcx-sm-panel">
      {showBefore && <p className="pcx-sm-eyebrow">What will change</p>}
      {rows.map((c) => (
        <div key={c.field} className="pcx-sm-row">
          <span>{c.label}</span>
          <span className="pcx-sm-vals">
            {showBefore && <><s>{fmtChangeValue(c.field, c.before)}</s><ArrowRight size={13} aria-hidden="true" /></>}
            <strong>{fmtChangeValue(c.field, c.after)}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

export function ConfirmSaveModal({ plan, changes, asHidden, busy, error, onCancel, onConfirm }) {
  const hiding = asHidden && plan.status !== 'hidden'
  const priceChanged = changes.some((c) => c.field === 'priceMonthly' || c.field === 'priceYearly')
  const noop = changes.length === 0
  return (
    <Shell
      label={hiding ? 'Save as hidden' : 'Save changes'}
      tone={hiding ? 'gray' : 'ok'}
      icon={hiding ? <EyeOff size={30} /> : <Check size={30} />}
      title={hiding ? `Save ${plan.name} Plan as hidden?` : `Save changes to ${plan.name} Plan?`}
      subtitle={hiding ? 'Your edits are saved, but clinics will no longer see this plan.'
        : plan.status === 'live' ? 'The plan is Live, so clinics will see these changes.' : `The plan is ${plan.status === 'beta' ? 'in Beta' : 'Hidden'}, so only the people who can see it will notice.`}
    >
      {noop ? <p className="pcx-sm-sub">Nothing has changed yet.</p> : <ChangeRows rows={changes} />}
      {hiding && (
        <ul className="pcx-sm-checks">
          <li><Check size={14} aria-hidden="true" /> <span>Removed from <b>Available subscriptions</b> and <b>Subscription Tiers</b> for new sign-ups</span></li>
          <li><Check size={14} aria-hidden="true" /> <span>Clinics already on {plan.name} keep their plan and renewals continue</span></li>
          <li><Check size={14} aria-hidden="true" /> <span>You can switch it back to <b>Live</b> anytime</span></li>
        </ul>
      )}
      {priceChanged && !hiding && <p className="pcx-sm-warn"><b>Heads up:</b> price changes apply to new subscribers and renewals, not retroactively.</p>}
      {error && <p className="br-form-error" role="alert">{error}</p>}
      <div className="pcx-sm-actions">
        <button type="button" className="br-btn btn-line" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
        <button type="button" className="br-btn primary" onClick={onConfirm} disabled={busy || noop}>{busy ? 'Saving…' : hiding ? 'Yes, save as hidden' : 'Yes, save changes'}</button>
      </div>
    </Shell>
  )
}

export function SavedModal({ plan, saved, onDone, onMakeLive, busy }) {
  const hidden = saved.plan.status === 'hidden'
  const wasHiddenNow = hidden && plan.status !== 'hidden'
  const statusLabel = { live: 'Live', beta: 'Beta', hidden: 'Hidden' }[saved.plan.status]
  return (
    <Shell
      label={hidden ? 'Saved as hidden' : 'Changes saved'}
      tone={hidden ? 'gray' : 'ok'}
      icon={hidden ? <EyeOff size={30} /> : <Check size={30} />}
      title={hidden ? 'Saved as hidden' : 'Changes saved'}
      subtitle={hidden
        ? <>{saved.plan.name} Plan is now <b>Hidden</b>. New clinics can’t see or choose it.</>
        : <>{saved.plan.name} Plan was updated and is <b className="pcx-sm-live">{statusLabel}</b>.</>}
    >
      <div className="pcx-sm-panel">
        {hidden && wasHiddenNow ? (
          <>
            <div className="pcx-sm-row"><span>Status</span><strong>Hidden</strong></div>
            <div className="pcx-sm-row"><span>Current subscribers</span><strong>Keep {saved.plan.name}</strong></div>
          </>
        ) : saved.changes.map((c) => (
          <div key={c.field} className="pcx-sm-row"><span>{c.label}</span><strong>{fmtChangeValue(c.field, c.after)}</strong></div>
        ))}
      </div>
      <p className="pcx-sm-foot">Updated just now · Audit log entry added</p>
      <div className="pcx-sm-actions">
        {hidden && <button type="button" className="br-btn btn-line" onClick={onMakeLive} disabled={busy}>{busy ? 'Working…' : 'Make Live'}</button>}
        <button type="button" className="br-btn primary" onClick={onDone} disabled={busy} autoFocus>Done</button>
      </div>
    </Shell>
  )
}
