import { useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { NewInvoiceButton, BILLING_SUBTITLE, peso, fmtDate } from './OwnerBillingShared'
import './OwnerBillingPage.css'

const INITIAL_INVOICES = [
  { id: 'INV-1042', name: 'Jane D.', amount: 4500, issued: '2026-09-01', due: '2026-09-08', status: 'paid' },
  { id: 'INV-1043', name: 'Mark R.', amount: 4500, issued: '2026-09-01', due: '2026-09-08', status: 'pending' },
  { id: 'INV-1039', name: 'Liza P.', amount: 4500, issued: '2026-08-28', due: '2026-09-04', status: 'pending' },
  { id: 'INV-1030', name: 'Ava M.', amount: 4500, issued: '2026-08-22', due: '2026-08-29', status: 'overdue' },
  { id: 'INV-1027', name: 'Noah K.', amount: 4500, issued: '2026-08-25', due: '2026-09-01', status: 'paid' },
]

const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue']

const EMPTY_FORM = { name: '', amount: '4500', due: '' }

export default function OwnerBillingInvoicesPage({ user, onLogout, betaTier }) {
  const [invoices, setInvoices] = useState(INITIAL_INVOICES)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toast, setToast] = useState('')

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const filtered = useMemo(
    () => invoices.filter((inv) => statusFilter === 'all' || inv.status === statusFilter),
    [invoices, statusFilter],
  )

  const markPaid = (id) => {
    setInvoices((list) => list.map((inv) => (inv.id === id ? { ...inv, status: 'paid' } : inv)))
    flash(`${id} marked as paid`)
  }

  const remind = (inv) => flash(`Reminder sent to ${inv.name}`)

  const nextInvoiceNo = () => {
    const max = invoices.reduce((m, inv) => {
      const n = Number(inv.id.replace(/\D/g, ''))
      return n > m ? n : m
    }, 1042)
    return `INV-${max + 1}`
  }

  const submitInvoice = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const today = new Date()
    const due = form.due || new Date(today.getTime() + 7 * 864e5).toISOString().slice(0, 10)
    setInvoices((list) => [
      {
        id: nextInvoiceNo(),
        name: form.name.trim(),
        amount: Number(form.amount) || 0,
        issued: today.toISOString().slice(0, 10),
        due,
        status: 'pending',
      },
      ...list,
    ])
    setForm(EMPTY_FORM)
    setShowModal(false)
    flash('Invoice created')
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Sales / Billing"
      subtitle={BILLING_SUBTITLE}
      icon="💰"
      menuItems={getOwnerMenuItems(betaTier)}
      headerActions={<NewInvoiceButton onClick={() => setShowModal(true)} />}
    >
      {toast && <div className="sb-toast">{toast}</div>}

      <div className="sba-filters" style={{ marginBottom: 16 }}>
        <div className="sba-filter-group">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`sba-chip ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <section className="sba-card inv-card">
        <div className="inv-row inv-head">
          <span>Patient / Invoice</span>
          <span>Amount</span>
          <span>Issued</span>
          <span>Due</span>
          <span>Status</span>
          <span aria-hidden="true" />
        </div>

        {filtered.length === 0 && <div className="sba-empty">No invoices match this filter.</div>}

        {filtered.map((inv) => (
          <div key={inv.id} className="inv-row">
            <span className="inv-patient">
              <strong>{inv.name}</strong>
              <span className="inv-no">{inv.id}</span>
            </span>
            <span className="inv-amount">{peso(inv.amount)}</span>
            <span className="inv-muted">{fmtDate(inv.issued)}</span>
            <span className="inv-muted">{fmtDate(inv.due)}</span>
            <span>
              <span className={`sba-status ${inv.status}`}>{inv.status}</span>
            </span>
            <span className="inv-actions">
              {inv.status === 'paid' ? (
                <button type="button" className="inv-btn ghost" onClick={() => remind(inv)}>
                  View
                </button>
              ) : (
                <>
                  <button type="button" className="inv-btn ghost" onClick={() => remind(inv)}>
                    Remind
                  </button>
                  <button type="button" className="inv-btn solid" onClick={() => markPaid(inv.id)}>
                    Mark Paid
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </section>

      {showModal && (
        <div className="sb-modal-overlay" onClick={() => setShowModal(false)}>
          <form className="sb-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitInvoice}>
            <h3>New Invoice</h3>
            <label className="sb-field">
              <span>Patient name</span>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jane D."
              />
            </label>
            <label className="sb-field">
              <span>Amount (₱)</span>
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="sb-field">
              <span>Due date</span>
              <input
                type="date"
                value={form.due}
                onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
              />
            </label>
            <div className="sb-modal-actions">
              <button type="button" className="inv-btn ghost" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="inv-btn solid">
                Create Invoice
              </button>
            </div>
          </form>
        </div>
      )}
    </OwnerPageShell>
  )
}
