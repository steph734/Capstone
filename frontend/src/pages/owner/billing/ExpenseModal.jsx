import { useEffect, useMemo, useState } from 'react'
import { Modal, Field, Section, Chips, Toggle, ErrorBanner, VendorSelect } from './FinanceUi'
import { call, upload, peso2, parsePesos, lineAmount, fmtDay, dueText, errMsg, roundHalfAway } from './financeApi'
import { today, diffDays } from '../reports/reportRange'

const DRAFT_KEY = 'therapypro.expenseDraft.v1'
const METHODS = ['Clinic cash', 'GCash', 'Card', 'Bank transfer', 'Staff paid - reimburse']
const SUPPLY_CATS = ['Therapy materials', 'Office supplies', 'Cleaning supplies', 'Equipment', 'Other']
const OTHER_CATS = ['Repairs', 'Maintenance', 'Marketing', 'Professional fees', 'Other']
const MAX_FILES = 5
const MAX_BYTES = 5 * 1024 * 1024

// What each utility looks like (images 5-9). Electricity and water share the meter layout.
const UTIL = {
  Electricity: { sec2: 'Biller & billing period', biller: 'Utility / biller', acct: 'Account number', meter: { unit: 'kWh', label: 'kWh' }, vendor: { vendor_type: 'Utility', utility_type: 'Electricity' }, newVT: 'Utility', defaultVendor: 'Davao Light', sec3: 'Meter reading & charges', first: 'Energy charge', second: 'Taxes and fees' },
  Water: { sec2: 'Biller & billing period', biller: 'Utility / biller', acct: 'Account / meter no.', meter: { unit: 'm3', label: 'm³' }, vendor: { vendor_type: 'Utility', utility_type: 'Water' }, newVT: 'Utility', defaultVendor: 'Davao City Water District', sec3: 'Meter reading & charges', first: 'Water charge', second: 'Other charges' },
  Internet: { sec2: 'Provider & billing period', biller: 'Provider', acct: 'Account number', vendor: { vendor_type: 'Utility', utility_type: 'Internet' }, newVT: 'Utility', sec3: 'Plan & charges', first: 'Monthly plan', second: 'Add-ons' },
  Rent: { sec2: 'Landlord & rental period', biller: 'Landlord / lessor', vendor: { vendor_type: 'Landlord' }, newVT: 'Landlord', sec3: 'Rent & charges', first: 'Monthly rent', second: 'Association dues' },
  Other: { sec2: 'Vendor & details', biller: 'Vendor / payee', vendor: { vendor_type: 'Other' }, newVT: 'Other', sec3: 'Charges', first: '', second: '' },
}
const TYPE_LABEL = { Utility: 'Utility bill', Supplies: 'Supplies & materials', Other: 'Other expense' }
const SUBTITLE = {
  Utility: 'Record a bill the clinic pays. It is a business expense, never sent to a patient.',
  Supplies: 'Record supplies, equipment or cleaning products bought for the clinic. It is a business expense, never sent to a patient.',
  Other: 'Record any other cost the clinic pays. It is a business expense, never sent to a patient.',
}

const blankLine = (description = '', qty = '1') => ({ description, qty, unit: '' })
function defaultLines(type, util) {
  if (type === 'Supplies') return [blankLine()]
  if (type === 'Other') return [blankLine()]
  const c = UTIL[util]
  return c.first ? [blankLine(c.first), blankLine(c.second)] : [blankLine()]
}

function initial(branchId) {
  const t = today()
  return {
    expense_type: 'Utility', utility_type: 'Electricity', branch_id: branchId || '', vendor_id: null, vendor_name: '', account_number: '', receipt_no: '', description: '', category: '',
    period_from: '', period_to: '', bill_date: t, due_date: '', remind: true, remind_days: '3', is_recurring: false,
    prev: '', curr: '', plan_name: '', speed: '', contract_end: '', property_unit: '', lease_end: '', purchased_by: '', add_to_inventory: false,
    delivery: '', discount: '', tax: '', lines: defaultLines('Utility', 'Electricity'),
    payment_status: 'Unpaid', paid_date: t, payment_method: 'Clinic cash', payment_reference: '', notes: '',
  }
}

// ── money preview (the server recomputes all of this) ──
function compute(f) {
  const meter = f.expense_type === 'Utility' && UTIL[f.utility_type].meter
  const consumption = meter && f.prev !== '' && f.curr !== '' ? Math.round((Number(f.curr) - Number(f.prev)) * 1000) / 1000 : null
  const lines = f.lines.map((l, i) => {
    const isMeterLine = meter && i === 0
    const qty = isMeterLine ? consumption : l.qty === '' ? null : Number(l.qty)
    const unit = parsePesos(l.unit)
    const ok = qty !== null && Number.isFinite(qty) && qty > 0 && unit !== null && !Number.isNaN(unit) && unit >= 0
    return { ...l, isMeterLine, qty, unitC: unit, amount: ok ? lineAmount(qty, unit) : 0, ok }
  })
  const sub = lines.reduce((n, l) => n + l.amount, 0)
  const c = (v) => { const p = parsePesos(v); return p === null || Number.isNaN(p) ? 0 : p }
  const delivery = f.expense_type === 'Supplies' ? c(f.delivery) : 0
  const total = sub + delivery + c(f.tax) - c(f.discount)
  return { meter, consumption, lines, sub, delivery, discount: c(f.discount), tax: c(f.tax), total }
}

function clientErrors(f, calc) {
  const e = {}
  const t = f.expense_type
  const u = t === 'Utility' ? f.utility_type : null
  if (!f.branch_id) e.branch_id = 'Choose a branch.'
  if (!f.vendor_name.trim()) e.vendor_name = t === 'Supplies' ? 'Enter the supplier or store.' : 'Enter the biller / vendor.'
  if (u && u !== 'Other' && !f.account_number.trim() && u !== 'Rent') e.account_number = 'Required.'
  if (u === 'Other' || t === 'Other') if (!f.description.trim()) e.description = 'Say what this is for.'
  if (t === 'Supplies') { if (!f.receipt_no.trim()) e.receipt_no = 'Required.'; if (!f.category) e.category = 'Choose a category.' }
  if (u && u !== 'Other') { if (!f.period_from) e.period_from = 'Required.'; if (!f.period_to) e.period_to = 'Required.'; if (!f.due_date) e.due_date = 'Required.' }
  if (u !== 'Rent' && !f.bill_date) e.bill_date = 'Required.'
  if (f.period_from && f.period_to && f.period_from > f.period_to) e.period_to = 'Must not be before the start.'
  if (u !== 'Rent' && f.bill_date && f.due_date && f.due_date < f.bill_date) e.due_date = 'Cannot be before the bill date.' // rent has no bill date field
  if (calc.meter) {
    if (f.prev === '') e.prev = 'Required.'
    if (f.curr === '') e.curr = 'Required.'
    if (calc.consumption !== null && calc.consumption < 0) e.curr = 'Cannot be lower than the previous reading.'
  }
  if (u === 'Rent' && !f.property_unit.trim()) e.property_unit = 'Required.'
  if (f.payment_status === 'Paid') { if (!f.paid_date) e.paid_date = 'Required.'; if (!f.payment_method) e.payment_method = 'Required.' }
  const badLine = calc.lines.findIndex((l) => !l.description.trim() || !l.ok)
  if (badLine >= 0) e.lines = 'Every line needs a description and a valid amount.'
  else if (calc.total <= 0) e.lines = 'The total must be above ₱0.'
  return e
}

function toPayload(f, calc) {
  const t = f.expense_type
  const u = t === 'Utility' ? f.utility_type : null
  const body = {
    branch_id: f.branch_id, expense_type: t, vendor_name: f.vendor_name.trim(), ...(f.vendor_id ? { vendor_id: f.vendor_id } : {}),
    line_items: calc.lines.map((l) => ({ description: l.description.trim(), quantity: l.qty, unit_cost: l.unitC })),
    tax_amount: calc.tax, discount: calc.discount, ...(t === 'Supplies' ? { delivery_fee: calc.delivery } : {}),
    payment_status: f.payment_status, notes: f.notes,
  }
  if (u) body.utility_type = u
  if (f.account_number.trim()) body.account_number = f.account_number.trim()
  if (f.description.trim()) body.description = f.description.trim()
  if (f.bill_date && u !== 'Rent') body.bill_date = f.bill_date
  if (f.due_date) body.due_date = f.due_date
  if (f.period_from) body.period_from = f.period_from
  if (f.period_to) body.period_to = f.period_to
  if (f.remind && f.due_date && f.remind_days !== '') body.reminder_days_before = parseInt(f.remind_days, 10)
  if (calc.meter) body.meter = { previous_reading: Number(f.prev), current_reading: Number(f.curr) }
  if (u === 'Internet') body.utility_details = { plan_name: f.plan_name.trim() || undefined, speed_mbps: f.speed ? parseInt(f.speed, 10) : undefined, contract_end_date: f.contract_end || undefined }
  if (u === 'Rent') { body.utility_details = { property_unit: f.property_unit.trim(), lease_end_date: f.lease_end || undefined }; body.is_recurring = f.is_recurring }
  if (t === 'Supplies') { body.receipt_no = f.receipt_no.trim(); body.category = f.category; body.add_to_inventory = f.add_to_inventory; if (f.purchased_by) body.purchased_by = f.purchased_by }
  if (t === 'Other' && f.category) body.category = f.category
  if (f.payment_status === 'Paid') { body.paid_date = f.paid_date; body.payment_method = f.payment_method; if (f.payment_reference.trim()) body.payment_reference = f.payment_reference.trim() }
  return JSON.parse(JSON.stringify(body)) // drops undefined
}

// fields that only make sense for one type; used to decide whether switching type needs a confirmation
const typeSpecificFilled = (f) => !!(f.account_number || f.receipt_no || f.description || f.category || f.prev || f.curr || f.plan_name || f.speed || f.contract_end || f.property_unit || f.lease_end
  || f.delivery || f.discount || f.tax || f.purchased_by || f.period_from || f.period_to || f.lines.some((l) => l.unit || (l.description && !Object.values(UTIL).some((c) => c.first === l.description || c.second === l.description))))

export default function ExpenseModal({ branches, clinic, staff, onClose, onSaved }) {
  const [f, setF] = useState(() => initial(branches[0]?.id))
  const [dirty, setDirty] = useState(false)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErr, setServerErr] = useState({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [pendingType, setPendingType] = useState(null)
  const [prevBill, setPrevBill] = useState(null)
  const [draft, setDraft] = useState(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null } })
  const [changeBranch, setChangeBranch] = useState(false)

  const t = f.expense_type
  const u = t === 'Utility' ? f.utility_type : null
  const cfg = u ? UTIL[u] : null
  const calc = useMemo(() => compute(f), [f])
  const local = useMemo(() => clientErrors(f, calc), [f, calc])
  const err = (k) => serverErr[k] || ((touched[k] || submitted) ? local[k] : undefined)
  const branch = branches.find((b) => b.id === f.branch_id)

  const set = (patch) => { setF((p) => ({ ...p, ...patch })); setDirty(true); setServerErr({}) }
  const blur = (k) => setTouched((p) => ({ ...p, [k]: true }))

  // default biller for electricity / water (Davao Light, Davao City Water District)
  useEffect(() => {
    if (!cfg?.defaultVendor || f.vendor_name) return
    let live = true
    call('vendors', { query: cfg.vendor }).then((d) => { const v = d.vendors.find((x) => x.vendor_name === cfg.defaultVendor); if (v && live) setF((p) => (p.vendor_name ? p : { ...p, vendor_id: v.id, vendor_name: v.vendor_name })) }).catch(() => {})
    return () => { live = false }
  }, [cfg, f.vendor_name])

  // consumption comparison with the previous bill of the same utility at this branch (hidden when there is none)
  useEffect(() => {
    setPrevBill(null)
    if (!cfg?.meter || !f.branch_id) return undefined
    let live = true
    call('expenses/previous-bill', { query: { utility_type: u, branch_id: f.branch_id, before: f.bill_date || undefined } }).then((d) => { if (live) setPrevBill(d.previous) }).catch(() => {})
    return () => { live = false }
  }, [u, f.branch_id, f.bill_date, cfg])

  const applyType = (next) => {
    setF((p) => {
      const keep = { branch_id: p.branch_id, vendor_id: p.vendor_id, vendor_name: p.vendor_name, bill_date: p.bill_date, due_date: p.due_date, payment_status: p.payment_status, paid_date: p.paid_date, payment_method: p.payment_method, payment_reference: p.payment_reference, notes: p.notes }
      const base = { ...initial(p.branch_id), ...keep, expense_type: next.type, utility_type: next.util || 'Electricity' }
      return { ...base, lines: defaultLines(next.type, next.util || 'Electricity') }
    })
    setPendingType(null); setServerErr({}); setTouched({}); setSubmitted(false); setDirty(true)
  }
  const requestSwitch = (next) => {
    if (next.type === t && (next.type !== 'Utility' || next.util === u)) return
    if (typeSpecificFilled(f)) setPendingType(next); else applyType(next)
  }

  const setLine = (i, patch) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const addLine = () => set({ lines: [...f.lines, blankLine()] })
  const delLine = (i) => set({ lines: f.lines.filter((_, j) => j !== i) })

  const addFiles = (list) => {
    const next = [...files]
    for (const file of list) {
      if (next.length >= MAX_FILES) { setBanner(`You can attach up to ${MAX_FILES} files.`); break }
      if (file.size > MAX_BYTES) { setBanner(`${file.name} is larger than 5 MB.`); continue }
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) { setBanner(`${file.name}: only PDF, JPG or PNG files.`); continue }
      next.push(file)
    }
    setFiles(next); setDirty(true)
  }

  const saveDraft = () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, savedAt: Date.now() })); setBanner(''); setDirty(false); setDraft({ f }); onSaved({ draftSaved: true }) } catch { setBanner('Could not save the draft in this browser.') }
  }

  const submit = async (e) => {
    e?.preventDefault()
    setSubmitted(true)
    if (Object.keys(local).length) { setBanner('Please fix the highlighted fields.'); document.querySelector('.fin-field.has-error input, .fin-field.has-error select')?.focus(); return }
    setBusy(true); setBanner('')
    try {
      const { expense } = await call('expenses', { method: 'POST', body: toPayload(f, calc)})
      const failed = []
      for (const file of files) { try { await upload(`expenses/${expense.id}/attachments`, file) } catch (ex) { failed.push(`${file.name}: ${ex.message}`) } }
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      onSaved({ expense, failedFiles: failed })
    } catch (ex) {
      setServerErr(ex.fields || {})
      setBanner(errMsg(ex)) // the user's input is kept
    } finally { setBusy(false) }
  }

  const due = f.due_date ? diffDays(today(), f.due_date) : null
  const rest = calc.sub - (calc.lines[0]?.amount || 0)
  const summary = t === 'Supplies'
    ? <>Items <b>{peso2(calc.sub)}</b> · Delivery <b>{peso2(calc.delivery)}</b> · Discount <b>{peso2(calc.discount)}</b></>
    : u === 'Rent' ? <>Rent <b>{peso2(calc.lines[0]?.amount || 0)}</b> · Dues <b>{peso2(rest)}</b></>
      : u === 'Internet' ? <>Plan <b>{peso2(calc.lines[0]?.amount || 0)}</b> · Add-ons <b>{peso2(rest)}</b></>
        : u === 'Electricity' ? <>Energy <b>{peso2(calc.lines[0]?.amount || 0)}</b> · Other charges <b>{peso2(rest)}</b></>
          : u === 'Water' ? <>Water <b>{peso2(calc.lines[0]?.amount || 0)}</b> · Other charges <b>{peso2(rest)}</b></>
            : <>Charges <b>{peso2(calc.sub)}</b></>
  const footDate = t === 'Supplies' ? <>Purchased <b>{fmtDay(f.bill_date)}</b>{f.payment_status === 'Paid' ? ` · paid ${f.payment_method.toLowerCase().replace(' - reimburse', ', reimburse')}` : ''}</> : f.due_date ? <>Due <b>{fmtDay(f.due_date)}</b> ({dueText(due)})</> : null

  const D = (key, label, opts = {}) => (
    <Field label={label} required={opts.req} error={err(key)} className={opts.cls}>
      {(id, eid) => <input id={id} type="date" value={f[key]} min={opts.min} max={opts.max} onChange={(e) => set({ [key]: e.target.value })} onBlur={() => blur(key)} aria-invalid={!!err(key) || undefined} aria-describedby={eid} />}
    </Field>
  )
  const T = (key, label, opts = {}) => (
    <Field label={label} required={opts.req} error={err(key)} hint={opts.hint} className={opts.cls}>
      {(id, eid) => <input id={id} value={f[key]} inputMode={opts.num ? 'decimal' : undefined} placeholder={opts.ph} disabled={opts.disabled} onChange={(e) => set({ [key]: e.target.value })} onBlur={() => blur(key)} aria-invalid={!!err(key) || undefined} aria-describedby={eid} />}
    </Field>
  )
  const vendorBlock = (label) => (
    <VendorSelect label={label} required value={f.vendor_name} vendorId={f.vendor_id} error={err('vendor_name') || err('vendor_id')} filter={t === 'Supplies' ? { vendor_type: 'Supplier' } : t === 'Other' ? { vendor_type: 'Other' } : cfg.vendor}
      newVendorType={t === 'Supplies' ? 'Supplier' : t === 'Other' ? 'Other' : cfg.newVT} newUtilityType={u && ['Electricity', 'Water', 'Internet'].includes(u) ? u : undefined}
      onPick={(v) => set({ vendor_id: v.id || null, vendor_name: v.vendor_name })} onError={setBanner} />
  )

  const refPrefix = u === 'Internet' ? 'INT' : u === 'Rent' ? 'RENT' : t === 'Supplies' ? 'SUP' : t === 'Other' ? 'EXP' : 'BILL'

  return (
    <Modal
      title="Add expense" titleSuffix={TYPE_LABEL[t]} subtitle={SUBTITLE[t]} onClose={onClose} dirty={dirty}
      topbar={<Chips label="EXPENSE TYPE" value={t} onChange={(v) => requestSwitch({ type: v, util: 'Electricity' })} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />}
      footer={(
        <>
          <div className="fin-foot-sum"><div>{summary}</div><div>{footDate}</div></div>
          <div className="fin-foot-total"><span>{t === 'Supplies' ? 'PURCHASE TOTAL' : 'BILL TOTAL'}</span><strong>{peso2(calc.total)}</strong></div>
          <button type="button" className="fin-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="fin-btn fin-btn-outline" onClick={saveDraft} disabled={busy}>Save draft</button>
          <button type="submit" form="expense-form" className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
        </>
      )}
    >
      <form id="expense-form" onSubmit={submit} noValidate className="fin-form">
        <ErrorBanner>{banner}</ErrorBanner>
        {draft && !dirty && (
          <div className="fin-note" role="status">
            You have a saved draft.{' '}
            <button type="button" className="fin-link" onClick={() => { setF(draft.f); setDraft(null); setDirty(true) }}>Resume draft</button>{' '}
            <button type="button" className="fin-link" onClick={() => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } setDraft(null) }}>Discard</button>
          </div>
        )}
        {pendingType && (
          <div className="fin-note warn" role="alertdialog" aria-label="Switch expense type?">
            Switching type clears the fields that only apply to {TYPE_LABEL[t].toLowerCase()}. Vendor, dates and branch are kept.{' '}
            <button type="button" className="fin-btn fin-btn-danger" onClick={() => applyType(pendingType)}>Switch and clear</button>{' '}
            <button type="button" className="fin-btn" onClick={() => setPendingType(null)}>Keep editing</button>
          </div>
        )}

        <Section n="1" title="Clinic" aside={null}>
          <div className="fin-clinicrow">
            <span><strong>{clinic?.clinic_name || 'Clinic'}</strong> · {branch?.branch_name || 'Choose a branch'}{clinic?.business_tin ? ` · TIN ${clinic.business_tin}` : ''}</span>
            {changeBranch ? (
              <select aria-label="Branch" value={f.branch_id} onChange={(e) => { set({ branch_id: e.target.value }); setChangeBranch(false) }} onBlur={() => setChangeBranch(false)} autoFocus>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            ) : <button type="button" className="fin-link" onClick={() => setChangeBranch(true)}>Change branch ⌄</button>}
          </div>
          {err('branch_id') && <small className="fin-err" role="alert">{err('branch_id')}</small>}
        </Section>

        {t === 'Utility' && (
          <Section n="2" title={cfg.sec2}>
            <Chips label="UTILITY TYPE" value={u} onChange={(v) => requestSwitch({ type: 'Utility', util: v })} options={['Electricity', 'Water', 'Internet', 'Rent', 'Other']} />
            {u === 'Other' ? (
              <div className="fin-grid3">
                {T('description', 'What is this for?', { req: true, ph: 'e.g. Security service' })}
                {vendorBlock('Vendor / payee')}
                {T('receipt_no', 'Reference / OR no.')}
                {D('bill_date', 'Bill / service date', { req: true })}
                {D('due_date', 'Due date', { min: f.bill_date })}
                <Field label="Branch"><input value={branch?.branch_name || ''} disabled aria-label="Branch" /></Field>
              </div>
            ) : (
              <div className="fin-grid3">
                {vendorBlock(cfg.biller)}
                {u !== 'Rent' ? T('account_number', cfg.acct, { req: true }) : (
                  <Field label="Property / unit" required error={err('property_unit')}>{(id, eid) => <input id={id} value={f.property_unit} onChange={(e) => set({ property_unit: e.target.value })} onBlur={() => blur('property_unit')} aria-invalid={!!err('property_unit') || undefined} aria-describedby={eid} placeholder="e.g. Main Clinic · Unit 2B" />}</Field>
                )}
                <Field label="Bill reference"><input value={`${refPrefix}-#### (auto)`} disabled aria-label="Bill reference, assigned when saved" /></Field>
                {D('period_from', u === 'Rent' ? 'Rental period from' : 'Billing period from', { req: true })}
                {D('period_to', u === 'Rent' ? 'Rental period to' : 'Billing period to', { req: true, min: f.period_from })}
                {u !== 'Rent' ? D('bill_date', 'Bill date', { req: true }) : D('due_date', 'Due date', { req: true })}
                {u !== 'Rent' && D('due_date', 'Due date', { req: true, min: f.bill_date })}
                <Field label="Branch"><input value={branch?.branch_name || ''} disabled aria-label="Branch" /></Field>
                {u === 'Rent' && D('lease_end', 'Lease ends')}
                <div className="fin-toggles">
                  {u === 'Rent'
                    ? <Toggle checked={f.is_recurring} onChange={(v) => set({ is_recurring: v })}>Repeat every month</Toggle>
                    : <Toggle checked={f.remind} onChange={(v) => set({ remind: v })}>Remind me <input className="fin-inline-num" aria-label="Days before due" inputMode="numeric" value={f.remind_days} onChange={(e) => set({ remind_days: e.target.value.replace(/\D/g, '').slice(0, 2) })} /> days before due</Toggle>}
                </div>
              </div>
            )}
            {u === 'Rent' && <div className="fin-toggles"><Toggle checked={f.remind} onChange={(v) => set({ remind: v })}>Remind me <input className="fin-inline-num" aria-label="Days before due" inputMode="numeric" value={f.remind_days} onChange={(e) => set({ remind_days: e.target.value.replace(/\D/g, '').slice(0, 2) })} /> days before due</Toggle></div>}
          </Section>
        )}

        {t === 'Supplies' && (
          <Section n="2" title="Supplier & purchase">
            <div className="fin-grid3">
              {vendorBlock('Supplier / store')}
              {T('receipt_no', 'Receipt / OR number', { req: true })}
              {D('bill_date', 'Purchase date', { req: true, max: today() })}
              <Field label="Category" required error={err('category')}>{(id, eid) => <select id={id} value={f.category} onChange={(e) => set({ category: e.target.value })} onBlur={() => blur('category')} aria-invalid={!!err('category') || undefined} aria-describedby={eid}><option value="">Choose…</option>{SUPPLY_CATS.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
              <Field label="Branch"><input value={branch?.branch_name || ''} disabled aria-label="Branch" /></Field>
              <Field label="Purchased by" error={err('purchased_by')}>{(id) => <select id={id} value={f.purchased_by} onChange={(e) => set({ purchased_by: e.target.value })}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}</Field>
            </div>
          </Section>
        )}

        {t === 'Other' && (
          <Section n="2" title="Vendor & details">
            <div className="fin-grid3">
              {T('description', 'What is this for?', { req: true, ph: 'e.g. Aircon cleaning & repair' })}
              {vendorBlock('Vendor / payee')}
              {T('receipt_no', 'Reference / OR no.')}
              {D('bill_date', 'Bill / service date', { req: true })}
              {D('due_date', 'Due date', { min: f.bill_date })}
              <Field label="Category">{(id) => <select id={id} value={f.category} onChange={(e) => set({ category: e.target.value })}><option value="">—</option>{OTHER_CATS.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            </div>
          </Section>
        )}

        {/* 3: meter / plan details + charges or items */}
        <Section n="3" title={t === 'Supplies' ? 'Items purchased' : t === 'Other' ? 'Charges' : cfg.sec3}>
          {calc.meter && (
            <>
              <div className="fin-grid3">
                <Field label={`Previous reading (${cfg.meter.label})`} required error={err('prev')}>{(id, eid) => <input id={id} inputMode="decimal" value={f.prev} onChange={(e) => set({ prev: e.target.value.replace(/[^\d.]/g, '') })} onBlur={() => blur('prev')} aria-invalid={!!err('prev') || undefined} aria-describedby={eid} />}</Field>
                <Field label={`Current reading (${cfg.meter.label})`} required error={err('curr')}>{(id, eid) => <input id={id} inputMode="decimal" value={f.curr} onChange={(e) => set({ curr: e.target.value.replace(/[^\d.]/g, '') })} onBlur={() => blur('curr')} aria-invalid={!!err('curr') || undefined} aria-describedby={eid} />}</Field>
                <Field label="Consumption"><input disabled value={calc.consumption !== null && calc.consumption >= 0 ? `${calc.consumption.toLocaleString('en-PH')} ${cfg.meter.label}` : ''} aria-label="Consumption, calculated" /></Field>
              </div>
              {prevBill && calc.consumption !== null && calc.consumption >= 0 && prevBill.consumption !== null && prevBill.consumption > 0 && (
                <p className="fin-compare" role="status">
                  {(() => { const pct = roundHalfAway(((calc.consumption - prevBill.consumption) / prevBill.consumption) * 100); return `${calc.consumption.toLocaleString('en-PH')} ${cfg.meter.label} is ${pct === 0 ? 'the same as' : `${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than`} your last ${u.toLowerCase()} bill (${prevBill.reference_no}, ${prevBill.consumption.toLocaleString('en-PH')} ${cfg.meter.label}, ${fmtDay(prevBill.bill_date)}).` })()}
                </p>
              )}
            </>
          )}
          {u === 'Internet' && (
            <div className="fin-grid3">
              {T('plan_name', 'Plan', { ph: 'e.g. Fibr Unli 1699' })}
              <Field label="Speed (Mbps)">{(id) => <input id={id} inputMode="numeric" value={f.speed} onChange={(e) => set({ speed: e.target.value.replace(/\D/g, '').slice(0, 6) })} />}</Field>
              {D('contract_end', 'Contract ends')}
            </div>
          )}

          <div className="fin-lines" role="table" aria-label={t === 'Supplies' ? 'Items purchased' : 'Charges'}>
            <div className="fin-line head" role="row"><span role="columnheader">{t === 'Supplies' ? 'ITEM' : 'CHARGE'}</span><span role="columnheader">{t === 'Supplies' ? 'QTY' : 'BASIS'}</span><span role="columnheader">{t === 'Supplies' ? 'UNIT COST' : calc.meter ? 'RATE / AMOUNT' : 'UNIT / AMOUNT'}</span><span role="columnheader" className="r">AMOUNT</span><span /></div>
            {calc.lines.map((l, i) => (
              <div className="fin-line" role="row" key={i}>
                <input aria-label={`Line ${i + 1} description`} value={f.lines[i].description} placeholder={t === 'Supplies' ? 'Item' : 'Charge'} onChange={(e) => setLine(i, { description: e.target.value })} />
                {l.isMeterLine
                  ? <span className="fin-basis">{l.qty !== null && l.qty >= 0 ? `${l.qty.toLocaleString('en-PH')} ${cfg.meter.label} ×` : `${cfg.meter.label} ×`}</span>
                  : <input aria-label={`Line ${i + 1} quantity`} className="fin-qty" inputMode="decimal" value={f.lines[i].qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d.]/g, '') })} />}
                <input aria-label={`Line ${i + 1} ${l.isMeterLine ? 'rate per unit' : 'unit cost'} in pesos`} inputMode="decimal" placeholder="₱" value={f.lines[i].unit} onChange={(e) => setLine(i, { unit: e.target.value.replace(/[^\d.]/g, '') })} />
                <strong className="r">{l.ok ? peso2(l.amount) : '—'}</strong>
                {f.lines.length > 1 && !l.isMeterLine ? <button type="button" className="fin-del" onClick={() => delLine(i)} aria-label={`Remove line ${i + 1}`}>✕</button> : <span />}
              </div>
            ))}
          </div>
          {err('lines') && <small className="fin-err" role="alert">{err('lines')}</small>}
          <button type="button" className="fin-link" onClick={addLine}>+ Add {t === 'Supplies' ? 'item' : 'charge'}</button>

          {t === 'Supplies' && (
            <div className="fin-grid3">
              <Field label="Delivery fee">{(id) => <input id={id} inputMode="decimal" placeholder="₱0" value={f.delivery} onChange={(e) => set({ delivery: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
              <Field label="Discount">{(id) => <input id={id} inputMode="decimal" placeholder="₱0" value={f.discount} onChange={(e) => set({ discount: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
              <Field label="Tax">{(id) => <input id={id} inputMode="decimal" placeholder="₱0" value={f.tax} onChange={(e) => set({ tax: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
            </div>
          )}
          {t === 'Supplies' && <Toggle checked={f.add_to_inventory} onChange={(v) => set({ add_to_inventory: v })}>Add these items to inventory</Toggle>}
          {t === 'Supplies' && f.add_to_inventory && <small className="fin-hint">Inventory tracking is not set up yet, so this only records your choice on the expense.</small>}
        </Section>

        <Section n="4" title="Payment & files">
          <Chips label={t === 'Supplies' ? 'PAID?' : 'STATUS'} value={f.payment_status} onChange={(v) => set({ payment_status: v })} options={['Unpaid', 'Paid']} />
          {f.payment_status === 'Paid' && (
            <div className="fin-grid3">
              {D('paid_date', 'Paid date', { req: true, max: today() })}
              <Field label="Paid with" required error={err('payment_method')}>{(id) => <select id={id} value={f.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
              {T('payment_reference', 'Reference no.')}
            </div>
          )}
          <Field label={t === 'Supplies' ? 'Receipt copy' : u === 'Rent' ? 'Receipt or lease copy' : 'Bill copy'} hint={`PDF, JPG or PNG · up to 5 MB each · max ${MAX_FILES} files`}>
            {(id) => <input id={id} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => { addFiles([...e.target.files]); e.target.value = '' }} />}
          </Field>
          {files.length > 0 && <ul className="fin-files">{files.map((x, i) => <li key={`${x.name}${i}`}>{x.name} <span>({Math.ceil(x.size / 1024)} KB)</span> <button type="button" className="fin-del" onClick={() => { setFiles(files.filter((_, j) => j !== i)) }} aria-label={`Remove ${x.name}`}>✕</button></li>)}</ul>}
          <Field label="Notes">{(id) => <textarea id={id} rows={2} maxLength={1000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        </Section>
      </form>
    </Modal>
  )
}

// exported for tests
export { compute as computeExpense, clientErrors as expenseErrors, toPayload as expensePayload, initial as initialExpense, defaultLines as defaultExpenseLines }
