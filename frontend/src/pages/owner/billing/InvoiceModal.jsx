import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Field, Section, Chips, Toggle, ErrorBanner } from './FinanceUi'
import { call, newKey, peso2, parsePesos, pesosText, lineAmount, fmtDay, errMsg } from './financeApi'
import { today, addDays } from '../reports/reportRange'

const TERMS = [['Due on receipt', 0], ['Net 7', 7], ['Net 15', 15], ['Net 30', 30], ['Custom', null]]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const blank = (clinic) => ({
  invoice_type: 'Session', patient: null, guardian: false, bc: { name: '', phone: '', email: '', address: '' },
  lines: [], from: addDays(today(), -30), to: today(), issue_date: today(), terms: 'Net 7', due_date: '', discount: '', tax: '',
  notes: '', instructions: clinic?.payment_instructions || '',
})
const fromInvoice = (inv) => ({
  invoice_type: inv.invoice_type,
  patient: { id: inv.patient_id, name: inv.patient_name, record_no: inv.patient_record_no, contact: null, guardian: null },
  guardian: !!inv.billing_contact?.is_guardian, bc: { name: inv.billing_contact?.name || '', phone: inv.billing_contact?.phone || '', email: inv.billing_contact?.email || '', address: inv.billing_contact?.address || '' },
  lines: inv.line_items.map((l) => ({ service_date: l.service_date || '', description: l.description, qty: String(l.quantity), unit: pesosText(l.unit_price), appointment_id: l.appointment_id || null })),
  from: addDays(today(), -30), to: today(), issue_date: inv.issue_date, terms: inv.payment_terms, due_date: inv.due_date, discount: pesosText(inv.discount_amount), tax: pesosText(inv.tax_amount),
  notes: inv.notes || '', instructions: inv.payment_instructions || '',
})

function compute(f) {
  const lines = f.lines.map((l) => {
    const qty = l.qty === '' ? null : Number(l.qty)
    const unit = parsePesos(l.unit)
    const ok = qty !== null && Number.isFinite(qty) && qty > 0 && unit !== null && !Number.isNaN(unit)
    return { ...l, qtyN: qty, unitC: unit, ok, amount: ok ? lineAmount(qty, unit) : 0 }
  })
  const sub = lines.reduce((n, l) => n + l.amount, 0)
  const c = (v) => { const p = parsePesos(v); return p === null || Number.isNaN(p) ? 0 : p }
  const termDays = TERMS.find(([k]) => k === f.terms)?.[1]
  const due = f.terms === 'Custom' ? f.due_date : f.issue_date ? addDays(f.issue_date, termDays) : ''
  return { lines, sub, discount: c(f.discount), tax: c(f.tax), total: sub - c(f.discount) + c(f.tax), due }
}

function check(f, calc, send) {
  const e = {}
  if (!f.patient) e.patient = 'Choose a patient.'
  if (!f.bc.name.trim()) e.bc_name = 'Enter who to bill.'
  if (f.bc.email && !EMAIL_RE.test(f.bc.email.trim())) e.bc_email = 'Enter a valid email address.'
  if (send && !f.bc.email.trim()) e.bc_email = 'An email address is required to send the invoice.'
  if (!f.issue_date) e.issue_date = 'Required.'
  if (f.terms === 'Custom' && !f.due_date) e.due_date = 'Required.'
  if (calc.due && f.issue_date && calc.due < f.issue_date) e.due_date = 'The due date must be on or after the issue date.'
  if (!calc.lines.length) e.lines = f.invoice_type === 'Session' ? 'Import the completed sessions to bill.' : 'Add at least one line.'
  else if (calc.lines.some((l) => !l.description.trim() || !l.ok)) e.lines = 'Every line needs a description, quantity and price.'
  if (calc.discount > calc.sub) e.discount = 'The discount cannot be more than the subtotal.'
  if (send && calc.total <= 0) e.lines = 'The total must be above ₱0 to send.'
  return e
}

export default function InvoiceModal({ clinic, invoice, onClose, onSaved }) {
  const nav = useNavigate()
  const editing = !!invoice
  const [f, setF] = useState(() => (invoice ? fromInvoice(invoice) : blank(clinic)))
  const [dirty, setDirty] = useState(false)
  const [submitted, setSubmitted] = useState(null) // 'draft' | 'send'
  const [serverErr, setServerErr] = useState({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [pOpen, setPOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const keys = useRef({})
  const calc = useMemo(() => compute(f), [f])
  const errs = useMemo(() => ({ ...check(f, calc, submitted === 'send'), ...serverErr }), [f, calc, submitted, serverErr])
  const show = (k) => (submitted || serverErr[k] ? errs[k] : undefined)

  const set = (patch) => { setF((p) => ({ ...p, ...patch })); setDirty(true); setServerErr({}); keys.current = {} } // edited: next submit is a new attempt

  useEffect(() => {
    if (!pOpen) return undefined
    let live = true
    const t = setTimeout(() => call('invoices/patients', { query: { q: search } }).then((d) => { if (live) setResults(d.patients) }).catch(() => {}), 200)
    return () => { live = false; clearTimeout(t) }
  }, [search, pOpen])

  const pickPatient = (p) => {
    const c = f.guardian && p.guardian ? p.guardian : p.contact
    set({ patient: p, bc: { name: c.name, phone: c.phone, email: c.email, address: c.address }, lines: f.invoice_type === 'Session' ? [] : f.lines })
    setSearch(''); setPOpen(false)
  }
  const toggleGuardian = (on) => {
    const c = f.patient && (on ? f.patient.guardian : f.patient.contact)
    set({ guardian: on, ...(c ? { bc: { name: c.name, phone: c.phone, email: c.email, address: c.address } } : {}) })
  }
  const switchType = (t) => { if (t !== f.invoice_type) set({ invoice_type: t, lines: [] }) }

  const importSessions = async () => {
    if (!f.patient) { setSubmitted((s) => s || 'draft'); return }
    setImporting(true); setBanner('')
    try {
      const { sessions } = await call(`patients/${f.patient.id}/billable-sessions`, { query: { from: f.from, to: f.to } })
      const have = new Set(f.lines.map((l) => l.appointment_id))
      const add = sessions.filter((s) => !have.has(s.appointment_id)).map((s) => ({ service_date: s.service_date, description: s.description, qty: String(s.quantity), unit: pesosText(s.unit_price), appointment_id: s.appointment_id }))
      set({ lines: [...f.lines, ...add] })
      if (!sessions.length) setBanner('No completed, unbilled sessions in that date range.')
      else if (sessions.some((s) => !s.unit_price)) setBanner('Some sessions have no price on record. Enter their price before saving.')
    } catch (ex) { setBanner(errMsg(ex)) } finally { setImporting(false) }
  }
  const setLine = (i, patch) => set({ lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  const payload = (send) => ({
    patient_id: f.patient.id, invoice_type: f.invoice_type, billing_contact: { name: f.bc.name.trim(), phone: f.bc.phone.trim(), email: f.bc.email.trim(), address: f.bc.address.trim(), is_guardian: f.guardian },
    issue_date: f.issue_date, payment_terms: f.terms, ...(f.terms === 'Custom' ? { due_date: f.due_date } : {}),
    line_items: calc.lines.map((l) => ({ ...(l.service_date ? { service_date: l.service_date } : {}), description: l.description.trim(), quantity: l.qtyN, unit_price: l.unitC, ...(l.appointment_id ? { appointment_id: l.appointment_id } : {}) })),
    discount_amount: calc.discount, tax_amount: calc.tax, payment_instructions: f.instructions, notes: f.notes, ...(send ? { send: true } : {}),
  })

  const submit = async (mode) => {
    setSubmitted(mode)
    if (Object.keys(check(f, calc, mode === 'send')).length) { setBanner('Please fix the highlighted fields.'); return }
    setBusy(mode); setBanner('')
    try {
      let result
      if (editing) {
        const r = await call(`invoices/${invoice.id}`, { method: 'PATCH', body: payload(false) })
        result = mode === 'send' ? await call(`invoices/${invoice.id}/send`, { method: 'POST' }) : r
      } else {
        keys.current[mode] ||= newKey() // same key for a retry of the same attempt: a double submit returns the original invoice
        result = await call('invoices', { method: 'POST', body: payload(mode === 'send'), headers: { 'Idempotency-Key': keys.current[mode] } })
      }
      onSaved(result, mode)
    } catch (ex) {
      const fields = {}
      for (const [k, v] of Object.entries(ex.fields || {})) fields[k.startsWith('line_items') ? 'lines' : k === 'billing_contact.email' ? 'bc_email' : k === 'billing_contact.name' ? 'bc_name' : k] = v
      setServerErr(fields)
      setBanner(ex.code === 'SESSION_ALREADY_BILLED' ? 'One of these sessions is already on another invoice. Remove it and try again.' : errMsg(ex)) // input is kept
    } finally { setBusy('') }
  }

  const termLabel = f.terms === 'Custom' ? 'Custom' : f.terms
  const pf = clinic || {}

  return (
    <Modal
      title={editing ? `Edit draft ${invoice.invoice_no}` : 'New invoice'} subtitle="Clinic details are filled in from your settings." onClose={onClose} dirty={dirty}
      topbar={<Chips label="TYPE" value={f.invoice_type} onChange={switchType} options={[{ value: 'Session', label: 'Session invoice' }, { value: 'Custom', label: 'Custom' }]} />}
      footer={(
        <>
          <div className="fin-foot-sum">
            <div>Subtotal <b>{peso2(calc.sub)}</b> · Discount <b className="good">− {peso2(calc.discount)}</b> · Tax <b>{peso2(calc.tax)}</b></div>
            <div>Due <b>{calc.due ? fmtDay(calc.due) : '—'}</b> ({termLabel}{calc.due && f.issue_date ? '' : ''})</div>
          </div>
          <div className="fin-foot-total"><span>TOTAL AMOUNT DUE</span><strong>{peso2(calc.total)}</strong></div>
          <button type="button" className="fin-btn" onClick={onClose} disabled={!!busy}>Cancel</button>
          <button type="button" className="fin-btn fin-btn-outline" onClick={() => submit('draft')} disabled={!!busy}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="fin-btn fin-btn-primary" onClick={() => submit('send')} disabled={!!busy}>{busy === 'send' ? 'Sending…' : 'Create & send'}</button>
        </>
      )}
    >
      <form className="fin-form" noValidate onSubmit={(e) => e.preventDefault()}>
        <ErrorBanner>{banner}</ErrorBanner>

        <Section n="1" title="Clinic information" aside={<button type="button" className="fin-link right" onClick={() => nav('/owner/billing/settings')}>Edit in Settings</button>}>
          <div className="fin-cliniccard">
            <div className="fin-logo" aria-hidden="true">{(pf.clinic_name || 'T').slice(0, 1)}</div>
            <div className="fin-grid2">
              <Field label="Clinic name"><input disabled value={pf.clinic_name || ''} /></Field>
              <Field label="Business / tax ID (TIN)"><input disabled value={pf.business_tin || ''} placeholder="Not set" /></Field>
              <Field label="Address"><input disabled value={pf.address || ''} placeholder="Set on the branch" /></Field>
              <Field label="Phone"><input disabled value={pf.phone || ''} placeholder="Not set" /></Field>
              <Field label="Email"><input disabled value={pf.email || ''} placeholder="Not set" /></Field>
              <Field label="Website"><input disabled value={pf.website || ''} placeholder="Not set" /></Field>
            </div>
          </div>
        </Section>

        <Section n="2" title="Patient & billing contact">
          <div className="fin-grid2">
            <Field label="Patient" required error={show('patient')}>
              {(id, eid) => (
                <div className="fin-combo">
                  <input id={id} role="combobox" aria-expanded={pOpen} aria-autocomplete="list" aria-invalid={!!show('patient') || undefined} aria-describedby={eid} autoComplete="off" disabled={editing}
                    value={pOpen ? search : f.patient ? `${f.patient.name}${f.patient.age != null ? ` · ${f.patient.age} yrs` : ''}` : search} placeholder="Search patients…"
                    onFocus={() => { setPOpen(true); setSearch('') }} onChange={(e) => { setSearch(e.target.value); setPOpen(true) }} onBlur={() => setTimeout(() => setPOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Escape') setPOpen(false) }} />
                  {pOpen && (
                    <ul className="fin-listbox" role="listbox">
                      {results.map((p) => <li key={p.id} role="option" aria-selected={f.patient?.id === p.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickPatient(p)}>{p.name}{p.age != null ? ` · ${p.age} yrs` : ''} <small>{p.record_no}</small></button></li>)}
                      {!results.length && <li className="fin-listempty">No patients found.</li>}
                    </ul>
                  )}
                </div>
              )}
            </Field>
            <Field label="Patient ID / record no."><input disabled value={f.patient?.record_no || ''} /></Field>
          </div>
          <Toggle checked={f.guardian} onChange={toggleGuardian}>Bill someone else (guardian)</Toggle>
          {f.guardian && f.patient && !f.patient.guardian && f.patient.contact && <small className="fin-hint">This patient has no guardian on file. Enter the billing contact below.</small>}
          <div className="fin-grid3">
            <Field label="Billing contact" required error={show('bc_name')}>{(id, eid) => <input id={id} aria-invalid={!!show('bc_name') || undefined} aria-describedby={eid} value={f.bc.name} onChange={(e) => set({ bc: { ...f.bc, name: e.target.value } })} />}</Field>
            <Field label="Phone">{(id) => <input id={id} type="tel" value={f.bc.phone} onChange={(e) => set({ bc: { ...f.bc, phone: e.target.value } })} />}</Field>
            <Field label="Email" error={show('bc_email')} hint="Required to send">{(id, eid) => <input id={id} type="email" aria-invalid={!!show('bc_email') || undefined} aria-describedby={eid} value={f.bc.email} onChange={(e) => set({ bc: { ...f.bc, email: e.target.value } })} />}</Field>
          </div>
          <Field label="Billing address">{(id) => <input id={id} value={f.bc.address} onChange={(e) => set({ bc: { ...f.bc, address: e.target.value } })} />}</Field>
        </Section>

        <Section n="3" title={f.invoice_type === 'Session' ? 'Sessions to bill' : 'Line items'}>
          {f.invoice_type === 'Session' && (
            <div className="fin-importrow">
              <Field label="From">{(id) => <input id={id} type="date" value={f.from} max={f.to} onChange={(e) => setF((p) => ({ ...p, from: e.target.value }))} />}</Field>
              <Field label="To">{(id) => <input id={id} type="date" value={f.to} min={f.from} onChange={(e) => setF((p) => ({ ...p, to: e.target.value }))} />}</Field>
              <button type="button" className="fin-btn fin-btn-outline" onClick={importSessions} disabled={importing || !f.patient || !f.from || !f.to || f.from > f.to}>{importing ? 'Importing…' : 'Import completed sessions'}</button>
            </div>
          )}
          <div className="fin-lines inv" role="table" aria-label="Invoice lines">
            <div className="fin-line head" role="row"><span role="columnheader">DATE</span><span role="columnheader">DESCRIPTION</span><span role="columnheader">QTY</span><span role="columnheader">PRICE</span><span role="columnheader" className="r">AMOUNT</span><span /></div>
            {calc.lines.map((l, i) => (
              <div className="fin-line" role="row" key={i}>
                <input type="date" aria-label={`Line ${i + 1} service date`} value={f.lines[i].service_date} onChange={(e) => setLine(i, { service_date: e.target.value })} disabled={!!l.appointment_id} />
                <input aria-label={`Line ${i + 1} description`} value={f.lines[i].description} onChange={(e) => setLine(i, { description: e.target.value })} />
                <input aria-label={`Line ${i + 1} quantity`} className="fin-qty" inputMode="decimal" value={f.lines[i].qty} disabled={!!l.appointment_id} onChange={(e) => setLine(i, { qty: e.target.value.replace(/[^\d.]/g, '') })} />
                <input aria-label={`Line ${i + 1} price in pesos`} inputMode="decimal" placeholder="₱" value={f.lines[i].unit} onChange={(e) => setLine(i, { unit: e.target.value.replace(/[^\d.]/g, '') })} />
                <strong className="r">{l.ok ? peso2(l.amount) : '—'}</strong>
                <button type="button" className="fin-del" aria-label={`Remove line ${i + 1}`} onClick={() => set({ lines: f.lines.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            {!calc.lines.length && <div className="fin-line empty">{f.invoice_type === 'Session' ? 'No sessions added yet.' : 'No lines yet.'}</div>}
          </div>
          {show('lines') && <small className="fin-err" role="alert">{show('lines')}</small>}
          {f.invoice_type === 'Custom' && <button type="button" className="fin-link" onClick={() => set({ lines: [...f.lines, { service_date: '', description: '', qty: '1', unit: '', appointment_id: null }] })}>+ Add line</button>}
        </Section>

        <Section n="4" title="Dates, terms & totals">
          <div className="fin-grid3">
            <Field label="Issue date" required error={show('issue_date')}>{(id, eid) => <input id={id} type="date" aria-describedby={eid} value={f.issue_date} onChange={(e) => set({ issue_date: e.target.value })} />}</Field>
            <Field label="Payment terms">{(id) => <select id={id} value={f.terms} onChange={(e) => set({ terms: e.target.value })}>{TERMS.map(([k]) => <option key={k}>{k}</option>)}</select>}</Field>
            <Field label="Due date" required={f.terms === 'Custom'} error={show('due_date')}>{(id, eid) => <input id={id} type="date" aria-describedby={eid} min={f.issue_date} value={f.terms === 'Custom' ? f.due_date : calc.due} disabled={f.terms !== 'Custom'} onChange={(e) => set({ due_date: e.target.value })} />}</Field>
            <Field label="Discount" error={show('discount')}>{(id, eid) => <input id={id} inputMode="decimal" placeholder="₱0" aria-describedby={eid} value={f.discount} onChange={(e) => set({ discount: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
            <Field label="Tax">{(id) => <input id={id} inputMode="decimal" placeholder="₱0" value={f.tax} onChange={(e) => set({ tax: e.target.value.replace(/[^\d.]/g, '') })} />}</Field>
          </div>
          <Field label="Payment instructions">{(id) => <textarea id={id} rows={2} maxLength={500} value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} />}</Field>
          <Field label="Notes">{(id) => <textarea id={id} rows={2} maxLength={1000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
        </Section>
      </form>
    </Modal>
  )
}

// exported for tests
export { compute as computeInvoice, check as invoiceErrors, blank as blankInvoice }
