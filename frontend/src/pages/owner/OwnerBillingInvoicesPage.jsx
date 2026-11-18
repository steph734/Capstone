import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { apiGet } from '../../utils/api'
import { BillingTabs, DateRangeMenu, Modal, ErrorBanner, Pager, RowMenu, Skeleton, StatusPill, useToast } from './billing/FinanceUi'
import InvoiceModal from './billing/InvoiceModal'
import { MarkPaidModal, VoidModal } from './billing/FinanceDialogs'
import { call, openBlob, peso, peso2, fmtDay, dueText, errMsg } from './billing/financeApi'
import './billing/OwnerFinance.css'

const SEGMENTS = [['', 'All', 'all'], ['Paid', 'Paid', 'paid'], ['Pending', 'Pending', 'pending'], ['Overdue', 'Overdue', 'overdue']]
const PAY_METHODS = [['cash', 'Cash'], ['gcash', 'GCash'], ['bank_transfer', 'Bank transfer'], ['card', 'Card'], ['paymaya', 'Maya']]
const EMPTY = { segment: '', q: '', issued: { from: '', to: '' }, due: { from: '', to: '' }, type: '', page: 1 }

function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

function InvoiceView({ inv, onClose, onSend, onRemind, onPay, onVoid, busy, banner }) {
  const open = inv.status === 'Pending'
  return (
    <Modal title={inv.invoice_no} subtitle={`${inv.patient_name} · ${inv.invoice_type} invoice`} onClose={onClose}
      footer={<>
        <button type="button" className="fin-btn" onClick={onClose}>Close</button>
        <button type="button" className="fin-btn" onClick={() => openBlob(`invoices/${inv.id}/pdf`, { download: true })}>Download PDF</button>
        {inv.status === 'Draft' && <button type="button" className="fin-btn fin-btn-primary" onClick={onSend} disabled={busy}>Send</button>}
        {open && <button type="button" className="fin-btn" onClick={onRemind} disabled={busy}>Remind</button>}
        {open && <button type="button" className="fin-btn fin-btn-primary" onClick={onPay}>Mark paid</button>}
        {(inv.status === 'Draft' || open) && <button type="button" className="fin-btn fin-btn-danger" onClick={onVoid}>Void</button>}
      </>}>
      <div className="fin-form">
        <ErrorBanner>{banner}</ErrorBanner>
        <div className="fin-viewhead"><strong className="fin-bigamt">{peso2(inv.total_amount)}</strong><StatusPill status={inv.display_status} /></div>
        {inv.email_failed && <p className="fin-note warn" role="status">Not sent — the email could not be delivered. <button type="button" className="fin-link" onClick={onSend} disabled={busy}>Retry</button></p>}
        <div className="fin-kvgrid">
          <div className="fin-kv"><span>Bill to</span><strong>{inv.billing_contact.name}{inv.billing_contact.is_guardian ? ' (guardian)' : ''}</strong></div>
          <div className="fin-kv"><span>Email</span><strong>{inv.billing_contact.email || '—'}</strong></div>
          <div className="fin-kv"><span>Issued</span><strong>{fmtDay(inv.issue_date)}</strong></div>
          <div className="fin-kv"><span>Due</span><strong>{fmtDay(inv.due_date)} {inv.status === 'Pending' ? `(${dueText(inv.due_in_days)})` : ''}</strong></div>
          <div className="fin-kv"><span>Terms</span><strong>{inv.payment_terms}</strong></div>
          <div className="fin-kv"><span>Sent</span><strong>{inv.sent_at ? `${fmtDay(inv.sent_at.slice(0, 10))} to ${inv.sent_to}` : 'Not sent'}</strong></div>
          {inv.paid_at && <div className="fin-kv"><span>Paid</span><strong>{fmtDay(inv.paid_at.slice(0, 10))} · {inv.payment_method}{inv.payment_reference ? ` · ${inv.payment_reference}` : ''}</strong></div>}
          {inv.void_reason && <div className="fin-kv"><span>Void reason</span><strong>{inv.void_reason}</strong></div>}
        </div>
        <table className="fin-table small">
          <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col" className="r">Qty</th><th scope="col" className="r">Price</th><th scope="col" className="r">Amount</th></tr></thead>
          <tbody>{inv.line_items.map((l, i) => <tr key={i}><td>{l.service_date ? fmtDay(l.service_date) : ''}</td><td>{l.description}</td><td className="r">{l.quantity}</td><td className="r">{peso2(l.unit_price)}</td><td className="r">{peso2(l.amount)}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={4}>Subtotal</td><td className="r">{peso2(inv.subtotal)}</td></tr>
            {inv.discount_amount > 0 && <tr><td colSpan={4}>Discount</td><td className="r">− {peso2(inv.discount_amount)}</td></tr>}
            <tr><td colSpan={4}>Tax</td><td className="r">{peso2(inv.tax_amount)}</td></tr>
            <tr><th colSpan={4}>Balance due</th><th className="r">{peso2(inv.balance_due)}</th></tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  )
}

export default function OwnerBillingInvoicesPage({ user, onLogout, betaTier }) {
  const [filters, setFilters] = useState(EMPTY)
  const q = useDebounced(filters.q)
  const [list, setList] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)
  const [clinic, setClinic] = useState(null)
  const [modal, setModal] = useState(null) // { kind: 'new'|'edit'|'view'|'pay'|'void', inv }
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const [toastEl, toast] = useToast()
  const seq = useRef(0)

  const query = useMemo(() => ({
    status: filters.segment, q, issued_from: filters.issued.from, issued_to: filters.issued.to, due_from: filters.due.from, due_to: filters.due.to, invoice_type: filters.type,
  }), [filters.segment, q, filters.issued, filters.due, filters.type])

  useEffect(() => { call('clinic').then((d) => setClinic(d.clinic)).catch(() => {}) }, [])
  useEffect(() => {
    const id = ++seq.current
    const ctrl = new AbortController()
    setLoading(true); setError('')
    const { status, ...noStatus } = query
    Promise.all([
      call('invoices', { query: { ...query, page: filters.page, limit: 20 }, signal: ctrl.signal }),
      call('invoices/summary', { query: noStatus, signal: ctrl.signal }),
    ]).then(([l, s]) => { if (id === seq.current) { setList(l); setSummary(s) } })
      .catch((e) => { if (e.name !== 'AbortError' && id === seq.current) setError(e.message) })
      .finally(() => { if (id === seq.current) setLoading(false) })
    return () => ctrl.abort()
  }, [query, filters.page, nonce])

  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const anyFilter = filters.q || filters.issued.from || filters.issued.to || filters.due.from || filters.due.to || filters.type || filters.segment
  const counts = summary?.counts

  const act = async (fn, okMsg, inv) => {
    setBusy(true); setBanner('')
    try { const r = await fn(); reload(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, r?.emailed === false ? 'error' : 'ok'); return r } catch (ex) { toast(errMsg(ex), 'error'); setBanner(errMsg(ex)); return null } finally { setBusy(false) }
  }
  const remind = (inv) => act(() => call(`invoices/${inv.id}/remind`, { method: 'POST' }), `Reminder sent to ${inv.billing_contact.email || inv.patient_name}`, inv)
  const send = async (inv) => {
    const r = await act(() => call(`invoices/${inv.id}/send`, { method: 'POST' }), (x) => (x.emailed ? `${inv.invoice_no} sent to ${x.invoice.sent_to}` : `${inv.invoice_no} saved, but the email was not sent. Try again.`), inv)
    if (r && modal?.kind === 'view') setModal({ kind: 'view', inv: r.invoice })
  }

  return (
    <OwnerPageShell
      user={user} onLogout={onLogout} title="Sales / Billing" subtitle="Everything about money in one place — revenue, invoices, payouts, and how you get paid."
      menuItems={getOwnerMenuItems(betaTier)}
      headerActions={<button type="button" className="fin-btn fin-btn-primary" onClick={() => setModal({ kind: 'new' })}>+ New invoice</button>}
    >
      <div className="fin-page">
        <BillingTabs />
        <p className="fin-lead">Invoices you send to patients and guardians. Clinic costs such as bills and supplies are under Expenses.</p>

        <div className={`fin-kpis ${loading && summary ? 'is-loading' : ''}`}>
          <div className="fin-kpi"><span>Total billed</span><strong>{summary ? peso(summary.billed) : '—'}</strong><small>Sent invoices</small></div>
          <div className="fin-kpi"><span>Collected</span><strong className="good">{summary ? peso(summary.collected) : '—'}</strong><small>{counts ? `${counts.paid} paid` : ' '}</small></div>
          <div className="fin-kpi"><span>Pending</span><strong>{summary ? peso(summary.pending) : '—'}</strong><small>{counts ? `${counts.pending} not yet due` : ' '}</small></div>
          <div className="fin-kpi"><span>Overdue</span><strong className="bad">{summary ? peso(summary.overdue.amount) : '—'}</strong><small>{summary ? `${summary.overdue.count} invoice${summary.overdue.count === 1 ? '' : 's'} need action` : ' '}</small></div>
        </div>

        <div className="fin-toolbar">
          <div className="fin-seg" role="group" aria-label="Invoice status">
            {SEGMENTS.map(([v, label, k]) => <button key={label} type="button" className={`fin-segbtn ${filters.segment === v ? 'on' : ''}`} aria-pressed={filters.segment === v} onClick={() => set({ segment: v })}>{label} <span>{counts ? counts[k] : ''}</span></button>)}
          </div>
          <div className="fin-search"><span aria-hidden="true">🔍</span><input type="search" aria-label="Search patient or invoice number" placeholder="Search patient or invoice no…" value={filters.q} onChange={(e) => set({ q: e.target.value })} /></div>
        </div>
        <div className="fin-filters">
          <DateRangeMenu label="Issued" value={filters.issued} onChange={(issued) => set({ issued })} />
          <DateRangeMenu label="Due" value={filters.due} onChange={(due) => set({ due })} />
          <label className="fin-select">Type: <select value={filters.type} onChange={(e) => set({ type: e.target.value })}><option value="">All</option><option value="Session">Session</option><option value="Custom">Custom</option></select></label>
          {anyFilter && <button type="button" className="fin-link right" onClick={() => setFilters(EMPTY)}>Clear filters</button>}
        </div>

        <section className={`fin-card ${loading && list ? 'is-loading' : ''}`} aria-busy={loading}>
          {error && <div className="fin-banner" role="alert">Couldn’t load invoices. {error} <button type="button" className="fin-btn" onClick={reload}>Retry</button></div>}
          {!list && loading ? <Skeleton /> : list && (
            <div className="fin-tablewrap">
              <table className="fin-table">
                <thead><tr><th scope="col">PATIENT / INVOICE</th><th scope="col">ISSUED</th><th scope="col">DUE</th><th scope="col" className="r">AMOUNT</th><th scope="col">STATUS</th><th scope="col"><span className="fin-sr">Actions</span></th></tr></thead>
                <tbody>
                  {list.items.length === 0 && <tr><td colSpan={6} className="fin-empty">{anyFilter ? 'No invoices match these filters.' : 'No invoices yet. Use “+ New invoice” to bill a patient.'}</td></tr>}
                  {list.items.map((inv) => (
                    <tr key={inv.id}>
                      <td><strong>{inv.patient_name}</strong><div className="fin-sub">{inv.invoice_no} · <span className="fin-tag">{inv.invoice_type}</span>{inv.email_failed && <span className="fin-tag warn"> Not sent, retry</span>}</div></td>
                      <td>{fmtDay(inv.issue_date)}</td>
                      <td>{fmtDay(inv.due_date)}{inv.status === 'Pending' && <div className={`fin-sub ${inv.display_status === 'Overdue' ? 'bad' : ''}`}>{dueText(inv.due_in_days)}</div>}</td>
                      <td className="r"><strong>{peso(inv.total_amount)}</strong></td>
                      <td><StatusPill status={inv.display_status} /></td>
                      <td className="fin-rowact">
                        {inv.status === 'Pending' && <><button type="button" className="fin-btn" onClick={() => remind(inv)} disabled={busy}>Remind</button><button type="button" className="fin-btn fin-btn-primary" onClick={() => setModal({ kind: 'pay', inv })}>Mark paid</button></>}
                        {inv.status === 'Draft' && <button type="button" className="fin-btn fin-btn-primary" onClick={() => send(inv)} disabled={busy}>Send</button>}
                        {(inv.status === 'Paid' || inv.status === 'Void') && <button type="button" className="fin-btn" onClick={() => setModal({ kind: 'view', inv })}>View</button>}
                        <RowMenu label={`More actions for ${inv.invoice_no}`} items={[
                          { label: 'View', onClick: () => setModal({ kind: 'view', inv }) },
                          { label: 'Download PDF', onClick: () => openBlob(`invoices/${inv.id}/pdf`, { download: true }).catch((e) => toast(e.message, 'error')) },
                          inv.status === 'Draft' && { label: 'Edit draft', onClick: () => setModal({ kind: 'edit', inv }) },
                          (inv.status === 'Draft' || inv.status === 'Pending') && { label: 'Void', danger: true, onClick: () => setModal({ kind: 'void', inv }) },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list && <Pager page={list.page} pages={list.pages} total={list.total} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} />}
        </section>
      </div>

      {(modal?.kind === 'new' || modal?.kind === 'edit') && (
        <InvoiceModal clinic={clinic} invoice={modal.kind === 'edit' ? modal.inv : null} onClose={() => setModal(null)}
          onSaved={(r, mode) => { setModal(null); reload(); const inv = r.invoice; toast(mode === 'draft' ? `Draft ${inv.invoice_no} saved` : r.emailed === false ? `${inv.invoice_no} saved, but the email was not sent. Open it and retry.` : `${inv.invoice_no} created and sent`, mode === 'send' && r.emailed === false ? 'error' : 'ok') }} />
      )}
      {modal?.kind === 'view' && <InvoiceView inv={modal.inv} busy={busy} banner={banner} onClose={() => { setModal(null); setBanner('') }} onSend={() => send(modal.inv)} onRemind={async () => { const r = await remind(modal.inv); if (r) setModal({ kind: 'view', inv: r.invoice }) }} onPay={() => setModal({ kind: 'pay', inv: modal.inv })} onVoid={() => setModal({ kind: 'void', inv: modal.inv })} />}
      {modal?.kind === 'pay' && <MarkPaidModal title="Mark paid" subtitle={`${modal.inv.invoice_no} · ${modal.inv.patient_name}`} amount={modal.inv.balance_due} methods={PAY_METHODS} path={`invoices/${modal.inv.id}/mark-paid`} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); toast(`${modal.inv.invoice_no} marked as paid`) }} />}
      {modal?.kind === 'void' && <VoidModal title="Void this invoice?" subtitle={`${modal.inv.invoice_no} · ${peso2(modal.inv.total_amount)}`} warning="The invoice is kept for your records but no longer counts. Any sessions on it can be billed again." path={`invoices/${modal.inv.id}/void`} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); toast(`${modal.inv.invoice_no} voided`) }} />}
      {toastEl}
    </OwnerPageShell>
  )
}
