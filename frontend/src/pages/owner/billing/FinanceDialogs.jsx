import { useState } from 'react'
import { Modal, Field, ErrorBanner, StatusPill } from './FinanceUi'
import { call, openBlob, peso2, fmtDay, fmtPeriod, errMsg, dueText } from './financeApi'
import { today } from '../reports/reportRange'

/* Mark paid (expenses and invoices share it). `methods` is [value, label][]. */
export function MarkPaidModal({ title, subtitle, amount, methods, path, onClose, onDone }) {
  const [paidDate, setPaidDate] = useState(today())
  const [method, setMethod] = useState(methods[0][0])
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [errors, setErrors] = useState({})
  const submit = async (e) => {
    e.preventDefault()
    if (!paidDate) { setErrors({ paid_date: 'Required.' }); return }
    setBusy(true); setBanner('')
    try { onDone(await call(path, { method: 'POST', body: { paid_date: paidDate, payment_method: method, ...(ref.trim() ? { payment_reference: ref.trim() } : {}) } })) } catch (ex) { setErrors(ex.fields || {}); setBanner(errMsg(ex)) } finally { setBusy(false) }
  }
  return (
    <Modal title={title} subtitle={subtitle} wide={false} onClose={onClose} dirty={!!ref}
      footer={<><button type="button" className="fin-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="paid-form" className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : `Mark paid · ${peso2(amount)}`}</button></>}>
      <form id="paid-form" onSubmit={submit} className="fin-form" noValidate>
        <ErrorBanner>{banner}</ErrorBanner>
        <Field label="Paid date" required error={errors.paid_date}>{(id, eid) => <input id={id} data-autofocus type="date" max={today()} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} aria-describedby={eid} />}</Field>
        <Field label="Payment method" required error={errors.payment_method}>{(id) => <select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}</Field>
        <Field label="Reference no." error={errors.payment_reference}>{(id) => <input id={id} value={ref} maxLength={80} onChange={(e) => setRef(e.target.value)} />}</Field>
      </form>
    </Modal>
  )
}

/* Void: never deletes. Needs a reason. */
export function VoidModal({ title, subtitle, warning, path, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (reason.trim().length < 3) { setError('Tell us why (at least 3 characters).'); return }
    setBusy(true); setBanner('')
    try { onDone(await call(path, { method: 'POST', body: { reason: reason.trim() } })) } catch (ex) { setError(ex.fields?.reason || ''); setBanner(errMsg(ex)) } finally { setBusy(false) }
  }
  return (
    <Modal title={title} subtitle={subtitle} wide={false} onClose={onClose} dirty={!!reason}
      footer={<><button type="button" className="fin-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="void-form" className="fin-btn fin-btn-danger" disabled={busy}>{busy ? 'Voiding…' : 'Void'}</button></>}>
      <form id="void-form" onSubmit={submit} className="fin-form" noValidate>
        <ErrorBanner>{banner}</ErrorBanner>
        <p className="fin-note warn">{warning || 'The record is kept for your books but no longer counts in any total. This cannot be undone.'}</p>
        <Field label="Reason" required error={error}>{(id, eid) => <textarea id={id} data-autofocus rows={3} maxLength={300} value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} aria-describedby={eid} />}</Field>
      </form>
    </Modal>
  )
}

const row = (k, v) => (v === null || v === undefined || v === '' ? null : <div className="fin-kv" key={k}><span>{k}</span><strong>{v}</strong></div>)

/* Expense details (read only) + attachments through the authenticated route */
export function ExpenseViewModal({ x, branchName, onClose, onPay, onVoid, onNextRent }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nextRent = async () => {
    setBusy(true); setErr('')
    try { await onNextRent() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const typeLabel = x.expense_type === 'Utility' ? `Utilities · ${x.utility_type}` : x.expense_type === 'Supplies' ? 'Supplies' : x.category || 'Other'
  return (
    <Modal title={x.vendor_name} subtitle={`${x.reference_no} · ${typeLabel}`} onClose={onClose}
      footer={<><button type="button" className="fin-btn" onClick={onClose}>Close</button>{x.record_status === 'Active' && x.is_recurring && x.utility_type === 'Rent' && <button type="button" className="fin-btn fin-btn-outline" onClick={nextRent} disabled={busy}>{busy ? 'Creating…' : 'Create next month’s rent'}</button>}{x.record_status === 'Active' && x.payment_status === 'Unpaid' && <button type="button" className="fin-btn fin-btn-primary" onClick={onPay}>Mark paid</button>}{x.record_status === 'Active' && <button type="button" className="fin-btn fin-btn-danger" onClick={onVoid}>Void</button>}</>}>
      <div className="fin-form">
        <ErrorBanner>{err}</ErrorBanner>
        <div className="fin-viewhead"><strong className="fin-bigamt">{peso2(x.total_amount)}</strong><StatusPill status={x.status} /></div>
        <div className="fin-kvgrid">
          {row('Branch', branchName)}{row('Account no.', x.account_number)}{row('Receipt / OR no.', x.receipt_no)}{row('What for', x.description)}
          {row('Period', x.period_from ? fmtPeriod(x.period_from, x.period_to) : null)}{row('Bill date', fmtDay(x.bill_date))}
          {row('Due', x.due_date ? `${fmtDay(x.due_date)} ${x.payment_status === 'Unpaid' ? `(${dueText(x.due_in_days)})` : ''}` : null)}
          {row('Meter', x.meter ? `${x.meter.previous_reading} → ${x.meter.current_reading} = ${x.meter.consumption} ${x.meter.unit === 'm3' ? 'm³' : x.meter.unit}` : null)}
          {row('Plan', x.utility_details?.plan_name)}{row('Speed', x.utility_details?.speed_mbps ? `${x.utility_details.speed_mbps} Mbps` : null)}{row('Contract ends', x.utility_details?.contract_end_date ? fmtDay(x.utility_details.contract_end_date) : null)}
          {row('Property / unit', x.utility_details?.property_unit)}{row('Lease ends', x.utility_details?.lease_end_date ? fmtDay(x.utility_details.lease_end_date) : null)}{row('Repeats monthly', x.is_recurring ? 'Yes' : null)}
          {row('Reminder', x.reminder_days_before !== null ? `${x.reminder_days_before} days before due` : null)}
          {row('Paid', x.paid_date ? `${fmtDay(x.paid_date)} · ${x.payment_method}${x.payment_reference ? ` · ${x.payment_reference}` : ''}` : null)}
          {row('Void reason', x.void_reason)}
        </div>
        <table className="fin-table small"><thead><tr><th scope="col">{x.expense_type === 'Supplies' ? 'Item' : 'Charge'}</th><th scope="col" className="r">Qty</th><th scope="col" className="r">Unit</th><th scope="col" className="r">Amount</th></tr></thead>
          <tbody>{x.line_items.map((l, i) => <tr key={i}><td>{l.description}</td><td className="r">{l.quantity}</td><td className="r">{peso2(Number(l.unit_cost))}</td><td className="r">{peso2(Number(l.amount))}</td></tr>)}</tbody>
          <tfoot>{Number(x.delivery_fee) > 0 && <tr><td colSpan={3}>Delivery</td><td className="r">{peso2(x.delivery_fee)}</td></tr>}{Number(x.tax_amount) > 0 && <tr><td colSpan={3}>Tax</td><td className="r">{peso2(x.tax_amount)}</td></tr>}{Number(x.discount) > 0 && <tr><td colSpan={3}>Discount</td><td className="r">− {peso2(x.discount)}</td></tr>}<tr><th colSpan={3}>Total</th><th className="r">{peso2(x.total_amount)}</th></tr></tfoot></table>
        {x.attachments.length > 0 && (
          <div><span className="fin-kicker">FILES</span>
            <ul className="fin-files">{x.attachments.map((a) => <li key={a.index}><button type="button" className="fin-link" onClick={() => openBlob(`expenses/${x.id}/attachments/${a.index}`).catch((e) => setErr(e.message))}>{a.file_name}</button> <span>({Math.ceil(a.size_bytes / 1024)} KB)</span></li>)}</ul></div>
        )}
        {x.notes && <p className="fin-note">{x.notes}</p>}
      </div>
    </Modal>
  )
}

/* Confirm before something is created. Cancel returns to the form with every value kept. */
export function ConfirmDialog({ title, subtitle, confirmLabel, busy = false, onCancel, onConfirm, children }) {
  return (
    <Modal title={title} subtitle={subtitle} wide={false} onClose={onCancel}
      footer={<>
        <button type="button" className="fin-btn" onClick={onCancel} disabled={busy} data-autofocus>Go back</button>
        <button type="button" className="fin-btn fin-btn-primary fin-btn-cta" onClick={onConfirm} disabled={busy}>{busy ? 'Saving…' : confirmLabel}</button>
      </>}>
      <div className="fin-form">{children}</div>
    </Modal>
  )
}

/* Shown after the record is really saved. Closing it (Done, Esc, backdrop) hands control back to the page. */
export function SuccessDialog({ title, subtitle, tone = 'ok', onDone, children }) {
  return (
    <Modal title={title} subtitle={subtitle} wide={false} onClose={onDone}
      footer={<button type="button" className="fin-btn fin-btn-primary fin-btn-cta" onClick={onDone} data-autofocus>Done</button>}>
      <div className="fin-success" role="status">
        <span className={`fin-successicon ${tone}`} aria-hidden="true">{tone === 'ok' ? '✓' : '!'}</span>
        <div className="fin-form">{children}</div>
      </div>
    </Modal>
  )
}

export const SummaryRows = ({ rows }) => (
  <dl className="fin-summary">{rows.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
)
