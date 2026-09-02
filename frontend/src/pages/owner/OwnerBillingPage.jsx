import { useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { TrendChart } from './ReportCharts'
import './OwnerBillingPage.css'

const peso = (n) => `₱${Number(n).toLocaleString('en-US')}`

// Revenue over the last 8 months (₱, in thousands for the axis).
const REVENUE_MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
const REVENUE_TREND = [42, 61, 74, 90, 82, 118, 156, 190]

// Mock transaction ledger. Dates land across Aug–Sep 2026 so the month filters
// have something to bite on.
const TRANSACTIONS = [
  { id: 't1', name: 'Appointment — Jane D.', date: '2026-09-01', amount: 4500, status: 'paid' },
  { id: 't2', name: 'Appointment — Mark R.', date: '2026-09-01', amount: 4500, status: 'pending' },
  { id: 't3', name: 'Subscription — Silver', date: '2026-08-30', amount: 299, status: 'paid' },
  { id: 't4', name: 'Appointment — Liza P.', date: '2026-08-28', amount: 4500, status: 'pending' },
  { id: 't5', name: 'Appointment — Noah K.', date: '2026-08-25', amount: 4500, status: 'paid' },
  { id: 't6', name: 'Appointment — Ava M.', date: '2026-08-21', amount: 4500, status: 'overdue' },
  { id: 't7', name: 'Appointment — Ethan S.', date: '2026-08-18', amount: 4500, status: 'overdue' },
  { id: 't8', name: 'Subscription — Gold', date: '2026-08-15', amount: 499, status: 'paid' },
  { id: 't9', name: 'Appointment — Mia T.', date: '2026-08-12', amount: 4500, status: 'paid' },
  { id: 't10', name: 'Appointment — Leo B.', date: '2026-08-09', amount: 4500, status: 'pending' },
  { id: 't11', name: 'Appointment — Zoe W.', date: '2026-08-05', amount: 4500, status: 'paid' },
  { id: 't12', name: 'Appointment — Sam H.', date: '2026-08-02', amount: 4500, status: 'overdue' },
]

const AVATAR_COLORS = ['#4a6b5d', '#2a9d8f', '#3b82f6', '#8b5cf6', '#ef8f3b', '#e05b73']
const avatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
const initials = (name) => {
  const clean = name.replace(/^[^-—]*[-—]\s*/, '') // drop the "Appointment — " prefix
  const parts = clean.split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
}
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'overdue', label: 'Overdue' },
]

export default function OwnerBillingPage({ user, onLogout, betaTier }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // all | this | last

  // "This month" = the newest transaction's month; "last month" = the one before.
  const refDate = new Date(TRANSACTIONS[0].date)
  const thisM = { m: refDate.getMonth(), y: refDate.getFullYear() }
  const prev = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
  const lastM = { m: prev.getMonth(), y: prev.getFullYear() }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return TRANSACTIONS.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.status.includes(q)) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (dateFilter !== 'all') {
        const d = new Date(t.date)
        const target = dateFilter === 'this' ? thisM : lastM
        if (d.getMonth() !== target.m || d.getFullYear() !== target.y) return false
      }
      return true
    })
  }, [search, statusFilter, dateFilter, thisM.m, thisM.y, lastM.m, lastM.y])

  const totals = useMemo(() => {
    const sum = (s) =>
      TRANSACTIONS.filter((t) => t.status === s).reduce((acc, t) => acc + t.amount, 0)
    const revenue = sum('paid')
    const pending = sum('pending')
    const overdue = sum('overdue')
    const avg = Math.round(
      TRANSACTIONS.reduce((acc, t) => acc + t.amount, 0) / TRANSACTIONS.length,
    )
    return { revenue, pending, overdue, avg }
  }, [])

  const handleExport = () => {
    const rows = [
      ['Name', 'Date', 'Amount', 'Status'],
      ...filtered.map((t) => [t.name, t.date, t.amount, t.status]),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Sales & Billing Analytics"
      subtitle="Financial Performance Overview"
      icon="💰"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="sba-grid">
        {/* Left column */}
        <div className="sba-left">
          <section className="sba-card">
            <div className="sba-card-head">
              <div>
                <h3 className="sba-card-title">Revenue Trend</h3>
                <p className="sba-card-sub">Last 90 days</p>
              </div>
            </div>
            <div className="sba-chart-wrap">
              <TrendChart
                months={REVENUE_MONTHS}
                trend={REVENUE_TREND}
                color="#2a9d8f"
                valueFormatter={(v) => `₱${v}k`}
                height={230}
              />
            </div>
          </section>

          <div className="sba-stat-row">
            <div className="sba-stat revenue">
              <span className="sba-stat-label">Total Revenue</span>
              <span className="sba-stat-value">{peso(totals.revenue)}</span>
            </div>
            <div className="sba-stat pending">
              <span className="sba-stat-label">Pending Payments</span>
              <span className="sba-stat-value">{peso(totals.pending)}</span>
            </div>
            <div className="sba-stat overdue">
              <span className="sba-stat-label">Overdue Invoices</span>
              <span className="sba-stat-value">{peso(totals.overdue)}</span>
            </div>
          </div>

          <div className="sba-avg">
            <span className="sba-stat-label">Avg. Transaction Value</span>
            <span className="sba-avg-value">{peso(totals.avg)}</span>
          </div>
        </div>

        {/* Recent transactions */}
        <section className="sba-card">
          <div className="sba-card-head">
            <h3 className="sba-card-title">Recent Transactions</h3>
            <button type="button" className="sba-export" onClick={handleExport}>
              ⬇ Export
            </button>
          </div>

          <input
            className="sba-search"
            type="search"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="sba-filters">
            <div className="sba-filter-group">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`sba-chip ${statusFilter === f.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="sba-filter-group right">
              <button
                type="button"
                className={`sba-chip ${dateFilter === 'last' ? 'active' : ''}`}
                onClick={() => setDateFilter((v) => (v === 'last' ? 'all' : 'last'))}
              >
                Last Month
              </button>
              <button
                type="button"
                className={`sba-chip ${dateFilter === 'this' ? 'active' : ''}`}
                onClick={() => setDateFilter((v) => (v === 'this' ? 'all' : 'this'))}
              >
                This Month
              </button>
            </div>
          </div>

          <div className="sba-txn-list">
            {filtered.length === 0 && <div className="sba-empty">No transactions match your filters.</div>}
            {filtered.map((t) => (
              <div key={t.id} className="sba-txn">
                <span className="sba-avatar" style={{ background: avatarColor(t.name) }}>
                  {initials(t.name).toUpperCase()}
                </span>
                <div className="sba-txn-main">
                  <div className="sba-txn-name">{t.name}</div>
                  <div className="sba-txn-date">{fmtDate(t.date)}</div>
                </div>
                <span className="sba-txn-amount">{peso(t.amount)}</span>
                <span className={`sba-status ${t.status}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </OwnerPageShell>
  )
}
