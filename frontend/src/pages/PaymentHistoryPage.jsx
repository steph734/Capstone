import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PatientSidebar from '../components/PatientSidebar'
import './PaymentHistoryPage.css'

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
      <line x1="13" y1="15" x2="16" y2="15" />
    </svg>
  )
}

const ALL_TRANSACTIONS = [
  { id: 'TXN-20260601', date: '2026-06-01', description: 'TherapyPro Silver – Monthly', amount: 299, status: 'paid', method: 'Visa •••• 4242', plan: 'Silver' },
  { id: 'TXN-20260501', date: '2026-05-01', description: 'TherapyPro Silver – Monthly', amount: 299, status: 'paid', method: 'Visa •••• 4242', plan: 'Silver' },
  { id: 'TXN-20260401', date: '2026-04-01', description: 'TherapyPro Gold – Monthly',   amount: 499, status: 'paid', method: 'Mastercard •••• 8823', plan: 'Gold' },
  { id: 'TXN-20260301', date: '2026-03-01', description: 'TherapyPro Gold – Monthly',   amount: 499, status: 'paid', method: 'Mastercard •••• 8823', plan: 'Gold' },
  { id: 'TXN-20260201', date: '2026-02-01', description: 'TherapyPro Silver – Monthly', amount: 299, status: 'failed', method: 'Visa •••• 4242', plan: 'Silver' },
  { id: 'TXN-20260101', date: '2026-01-01', description: 'TherapyPro Silver – Monthly', amount: 299, status: 'paid', method: 'Visa •••• 4242', plan: 'Silver' },
  { id: 'TXN-20251201', date: '2025-12-01', description: 'TherapyPro Free – Signup',    amount: 0,   status: 'free', method: '—', plan: 'Free' },
]

const STATUS_LABELS = { paid: 'Paid', failed: 'Failed', free: 'Free', refunded: 'Refunded' }
const PLAN_FILTERS  = ['All', 'Free', 'Silver', 'Gold']
const STATUS_FILTERS = ['All', 'paid', 'failed', 'free', 'refunded']

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PaymentHistoryPage({ user, onLogout }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser] = useState(user || { name: 'Alvrin', role: 'Patient', avatar: '/therapy-pro-logo.png' })

  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = ALL_TRANSACTIONS.filter(tx => {
    const matchSearch = tx.id.toLowerCase().includes(search.toLowerCase()) ||
                        tx.description.toLowerCase().includes(search.toLowerCase())
    const matchPlan   = planFilter   === 'All' || tx.plan   === planFilter
    const matchStatus = statusFilter === 'All' || tx.status === statusFilter
    return matchSearch && matchPlan && matchStatus
  })

  const totalPaid = ALL_TRANSACTIONS
    .filter(tx => tx.status === 'paid')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const handleDownload = (tx) => {
    const content = [
      '===================================',
      '     THERAPYPRO PAYMENT RECEIPT    ',
      '===================================',
      `Transaction ID : ${tx.id}`,
      `Date           : ${formatDate(tx.date)}`,
      `Description    : ${tx.description}`,
      `Plan           : ${tx.plan}`,
      `Amount         : ₱${tx.amount.toLocaleString()}`,
      `Status         : ${STATUS_LABELS[tx.status]}`,
      `Payment Method : ${tx.method}`,
      '===================================',
      'Thank you for using TherapyPro!',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${tx.id}-receipt.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ph-layout">
      <PatientSidebar user={currentUser} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="ph-main">
        <button className="mobile-menu-btn3" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>

        {/* Header */}
        <div className="ph-header">
          <div className="ph-header-left">
            <button className="back-btn2" onClick={() => navigate('/subscription')}>
              <ArrowLeftIcon />
            </button>
            <div>
              <h1 className="ph-title">Payment History</h1>
              <p className="ph-subtitle">Track all your billing transactions</p>
            </div>
          </div>
          <div className="user-badge3">
            <img src={currentUser.avatar} alt={currentUser.name} />
            <span>{currentUser.name}</span>
          </div>
        </div>

        <div className="ph-content">

          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card green-card">
              <span className="summary-label">Total Spent</span>
              <span className="summary-value">₱{totalPaid.toLocaleString()}</span>
              <span className="summary-sub">All time</span>
            </div>
            <div className="summary-card blue-card">
              <span className="summary-label">Transactions</span>
              <span className="summary-value">{ALL_TRANSACTIONS.length}</span>
              <span className="summary-sub">Total records</span>
            </div>
            <div className="summary-card amber-card">
              <span className="summary-label">Failed</span>
              <span className="summary-value">{ALL_TRANSACTIONS.filter(t => t.status === 'failed').length}</span>
              <span className="summary-sub">Needs attention</span>
            </div>
          </div>

          {/* Filters */}
          <div className="ph-filters-bar">
            <div className="search-wrap">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by ID or description…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ph-search"
              />
            </div>

            <div className="filter-group">
              <FilterIcon />
              <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="ph-select">
                {PLAN_FILTERS.map(p => <option key={p} value={p}>{p === 'All' ? 'All Plans' : p}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ph-select">
                {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Status' : STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="ph-table-wrap">
            {filtered.length === 0 ? (
              <div className="ph-empty">
                <EmptyIcon />
                <p>No transactions found</p>
              </div>
            ) : (
              <table className="ph-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr
                      key={tx.id}
                      className={`ph-row ${expandedId === tx.id ? 'row-expanded' : ''}`}
                      onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                    >
                      <td className="tx-id">{tx.id}</td>
                      <td className="tx-date">{formatDate(tx.date)}</td>
                      <td className="tx-desc">{tx.description}</td>
                      <td>
                        <span className={`plan-chip plan-${tx.plan.toLowerCase()}`}>{tx.plan}</span>
                      </td>
                      <td className="tx-amount">
                        {tx.amount === 0 ? <span className="free-tag">Free</span> : `₱${tx.amount.toLocaleString()}`}
                      </td>
                      <td>
                        <span className={`status-chip status-${tx.status}`}>{STATUS_LABELS[tx.status]}</span>
                      </td>
                      <td>
                        {tx.status !== 'free' && (
                          <button
                            className="dl-btn"
                            onClick={e => { e.stopPropagation(); handleDownload(tx) }}
                            aria-label="Download receipt"
                            title="Download receipt"
                          >
                            <DownloadIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="ph-footer-note">Click any row to view full transaction details. Receipts are available for paid transactions.</p>
        </div>
      </div>
    </div>
  )
}
