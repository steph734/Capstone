import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { apiGet } from '../../utils/api'
import { BillingTabs, DateRangeMenu, Pager, RowMenu, Skeleton, StatusPill, useToast } from './billing/FinanceUi'
import ExpenseModal from './billing/ExpenseModal'
import { MarkPaidModal, VoidModal, ExpenseViewModal } from './billing/FinanceDialogs'
import { call, peso, peso2, fmtDay, fmtPeriod, dueText } from './billing/financeApi'
import './billing/OwnerFinance.css'

const SEGMENTS = [['', 'All', 'all'], ['Utility', 'Utilities', 'Utility'], ['Supplies', 'Supplies', 'Supplies'], ['Other', 'Other', 'Other']]
const STATUSES = ['Unpaid', 'Paid', 'Overdue']
const CATEGORIES = ['Therapy materials', 'Office supplies', 'Cleaning supplies', 'Equipment', 'Repairs', 'Maintenance', 'Marketing', 'Professional fees', 'Other']
const EXPENSE_METHODS = ['Clinic cash', 'GCash', 'Card', 'Bank transfer', 'Staff paid - reimburse'].map((m) => [m, m])
const EMPTY = { segment: '', q: '', range: { from: '', to: '' }, status: '', category: '', branch_id: '', page: 1 }

function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

export default function OwnerBillingExpensesPage({ user, onLogout, betaTier }) {
  const [filters, setFilters] = useState(EMPTY)
  const q = useDebounced(filters.q)
  const [list, setList] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)
  const [branches, setBranches] = useState([])
  const [clinic, setClinic] = useState(null)
  const [staff, setStaff] = useState([])
  const [modal, setModal] = useState(null) // { kind: 'add' | 'view' | 'pay' | 'void', x }
  const [toastEl, toast] = useToast()
  const seq = useRef(0)

  const query = useMemo(() => ({
    expense_type: filters.segment, q, from: filters.range.from, to: filters.range.to, payment_status: filters.status, category: filters.category, branch_id: filters.branch_id,
  }), [filters.segment, q, filters.range, filters.status, filters.category, filters.branch_id])

  useEffect(() => {
    apiGet('/api/branches').then((d) => setBranches(d.branches || [])).catch(() => {})
    apiGet('/api/employees').then((d) => setStaff((d.employees || []).filter((e) => e.approved_at).map((e) => ({ id: e._id, name: [e.first_name, e.last_name].filter(Boolean).join(' ') })))).catch(() => {})
    call('clinic').then((d) => setClinic(d.clinic)).catch(() => {})
  }, [])

  // list + KPI cards come from the API for the same filters; an older response can never overwrite a newer one
  useEffect(() => {
    const id = ++seq.current
    const ctrl = new AbortController()
    setLoading(true); setError('')
    const { expense_type, ...noSegment } = query
    Promise.all([
      call('expenses', { query: { ...query, page: filters.page, limit: 20 }, signal: ctrl.signal }),
      call('expenses/summary', { query: { ...noSegment, expense_type }, signal: ctrl.signal }),
    ]).then(([l, s]) => { if (id === seq.current) { setList(l); setSummary(s) } })
      .catch((e) => { if (e.name !== 'AbortError' && id === seq.current) setError(e.message) })
      .finally(() => { if (id === seq.current) setLoading(false) })
    return () => ctrl.abort()
  }, [query, filters.page, nonce])

  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const anyFilter = filters.q || filters.range.from || filters.range.to || filters.status || filters.category || filters.branch_id || filters.segment
  const branchName = (id) => branches.find((b) => b.id === id)?.branch_name || ''
  const counts = summary?.counts

  const done = (msg) => (x) => { setModal(null); reload(); toast(msg) } // eslint-disable-line no-unused-vars

  return (
    <OwnerPageShell
      user={user} onLogout={onLogout} title="Sales / Billing" subtitle="Everything about money in one place — revenue, invoices, payouts, and how you get paid."
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="fin-page">
        <BillingTabs action={<button type="button" className="fin-btn fin-btn-primary fin-btn-cta" onClick={() => setModal({ kind: 'add' })}>+ Add expense</button>} />
        <p className="fin-lead">Bills and purchases the clinic pays — utilities, supplies and equipment. These are business expenses, so they never appear on a patient invoice.</p>

        <div className={`fin-kpis ${loading && summary ? 'is-loading' : ''}`}>
          <div className="fin-kpi"><span>Total expenses</span><strong>{summary ? peso(summary.total.amount) : '—'}</strong><small>{summary ? `${summary.total.count} bill${summary.total.count === 1 ? '' : 's'} and purchases` : ' '}</small></div>
          <div className="fin-kpi"><span>Unpaid</span><strong className="bad">{summary ? peso(summary.unpaid.amount) : '—'}</strong><small>{summary ? `${summary.unpaid.count} bill${summary.unpaid.count === 1 ? '' : 's'}${summary.unpaid.next_due_in_days !== null ? ` · ${summary.unpaid.next_due_in_days < 0 ? `${-summary.unpaid.next_due_in_days} days overdue` : `due in ${summary.unpaid.next_due_in_days} days`}` : ''}` : ' '}</small></div>
          <div className="fin-kpi"><span>Paid</span><strong className="good">{summary ? peso(summary.paid.amount) : '—'}</strong><small>{summary ? `${summary.paid.count} paid` : ' '}</small></div>
          <div className="fin-kpi"><span>Utilities</span><strong>{summary ? peso(summary.utilities.amount) : '—'}</strong><small>{summary ? `${summary.utilities.share_pct} % of expenses` : ' '}</small></div>
        </div>

        <div className="fin-toolbar">
          <div className="fin-seg" role="group" aria-label="Expense type">
            {SEGMENTS.filter(([v, , k]) => v === '' || v !== 'Other' || (counts && counts.Other > 0) || filters.segment === 'Other').map(([v, label, k]) => (
              <button key={label} type="button" className={`fin-segbtn ${filters.segment === v ? 'on' : ''}`} aria-pressed={filters.segment === v} onClick={() => set({ segment: v })}>{label} <span>{counts ? counts[k] : ''}</span></button>
            ))}
          </div>
          <div className="fin-search"><span aria-hidden="true">🔍</span><input type="search" aria-label="Search vendor or reference" placeholder="Search vendor or reference…" value={filters.q} onChange={(e) => set({ q: e.target.value })} /></div>
        </div>
        <div className="fin-filters">
          <DateRangeMenu label="Bill date" value={filters.range} onChange={(range) => set({ range })} />
          <label className="fin-select">Status: <select value={filters.status} onChange={(e) => set({ status: e.target.value })}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="fin-select">Category: <select value={filters.category} onChange={(e) => set({ category: e.target.value })}><option value="">All</option>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="fin-select">Branch: <select value={filters.branch_id} onChange={(e) => set({ branch_id: e.target.value })}><option value="">All</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}</select></label>
          {anyFilter && <button type="button" className="fin-link right" onClick={() => setFilters(EMPTY)}>Clear filters</button>}
        </div>

        <section className={`fin-card ${loading && list ? 'is-loading' : ''}`} aria-busy={loading}>
          {error && <div className="fin-banner" role="alert">Couldn’t load expenses. {error} <button type="button" className="fin-btn" onClick={reload}>Retry</button></div>}
          {!list && loading ? <Skeleton /> : list && (
            <div className="fin-tablewrap">
              <table className="fin-table">
                <thead><tr><th scope="col">VENDOR / REFERENCE</th><th scope="col">PERIOD / DATE</th><th scope="col">DUE</th><th scope="col" className="r">AMOUNT</th><th scope="col">STATUS</th><th scope="col"><span className="fin-sr">Actions</span></th></tr></thead>
                <tbody>
                  {list.items.length === 0 && <tr><td colSpan={6} className="fin-empty">{anyFilter ? 'No expenses match these filters.' : 'No expenses yet. Use “+ Add expense” to record your first bill or purchase.'}</td></tr>}
                  {list.items.map((x) => (
                    <tr key={x.id}>
                      <td><strong>{x.vendor_name}</strong><div className="fin-sub">{x.reference_no} · <span className="fin-tag">{x.expense_type === 'Utility' ? `Utilities · ${x.utility_type}` : x.expense_type === 'Supplies' ? 'Supplies' : x.category || 'Other'}</span></div></td>
                      <td>{x.period_from ? fmtPeriod(x.period_from, x.period_to) : fmtDay(x.bill_date)}</td>
                      <td>{x.due_date ? <>{fmtDay(x.due_date)}{x.payment_status === 'Unpaid' && <div className="fin-sub">{dueText(x.due_in_days)}</div>}</> : '—'}</td>
                      <td className="r"><strong>{peso(x.total_amount)}</strong></td>
                      <td><StatusPill status={x.status} /></td>
                      <td className="fin-rowact">
                        {x.payment_status === 'Unpaid' ? <button type="button" className="fin-btn fin-btn-primary" onClick={() => setModal({ kind: 'pay', x })}>Mark paid</button> : <button type="button" className="fin-btn" onClick={() => setModal({ kind: 'view', x })}>View</button>}
                        <RowMenu label={`More actions for ${x.vendor_name} ${x.reference_no}`} items={[{ label: 'View', onClick: () => setModal({ kind: 'view', x }) }, { label: 'Void', danger: true, onClick: () => setModal({ kind: 'void', x }) }]} />
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

      {modal?.kind === 'add' && (
        <ExpenseModal branches={branches} clinic={clinic} staff={staff} onClose={() => setModal(null)}
          onSaved={(r) => { if (r.draftSaved) { toast('Draft saved in this browser.'); return } setModal(null); reload(); toast(r.failedFiles?.length ? `Expense ${r.expense.reference_no} saved, but some files failed: ${r.failedFiles.join('; ')}` : `Expense ${r.expense.reference_no} saved`, r.failedFiles?.length ? 'error' : 'ok') }} />
      )}
      {modal?.kind === 'view' && <ExpenseViewModal x={modal.x} branchName={branchName(modal.x.branch_id)} onClose={() => setModal(null)} onPay={() => setModal({ kind: 'pay', x: modal.x })} onVoid={() => setModal({ kind: 'void', x: modal.x })} onNextRent={async () => { const r = await call(`expenses/${modal.x.id}/next-rent`, { method: 'POST' }); setModal(null); reload(); toast(`Next month’s rent ${r.expense.reference_no} created`) }} />}
      {modal?.kind === 'pay' && <MarkPaidModal title="Mark paid" subtitle={`${modal.x.vendor_name} · ${modal.x.reference_no}`} amount={modal.x.total_amount} methods={EXPENSE_METHODS} path={`expenses/${modal.x.id}/mark-paid`} onClose={() => setModal(null)} onDone={done('Marked as paid')} />}
      {modal?.kind === 'void' && <VoidModal title="Void this expense?" subtitle={`${modal.x.vendor_name} · ${modal.x.reference_no} · ${peso2(modal.x.total_amount)}`} path={`expenses/${modal.x.id}/void`} onClose={() => setModal(null)} onDone={done('Expense voided')} />}
      {toastEl}
    </OwnerPageShell>
  )
}
