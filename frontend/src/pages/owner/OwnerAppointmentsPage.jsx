import { useEffect, useMemo, useState } from 'react'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { authFetch } from '../../utils/session'
import './OwnerAppointmentsPage.css'
import { PaymentQueuePanel, VerifyPaymentModal } from './PaymentCheck'
import { flowApi } from '../../utils/bookingFlowApi'
import { STAGE_LABELS } from '../../../api/_lib/bookingFlowRules'

const STATUSES = ['Confirmed', 'Pending', 'Completed', 'Cancelled', 'No Show']
// The pill shows where the booking is in the approval flow (always as text, never colour alone).
const STAGE_PILL = { awaiting_payment_check: 'oa-pill-orange', payment_rejected: 'oa-pill-orange', awaiting_therapist: 'oa-pill-yellow', confirmed: 'oa-pill-green', completed: 'oa-pill-gray', declined: 'oa-pill-red', cancelled: 'oa-pill-red', no_show: 'oa-pill-red' }
const stageLabel = (a) => STAGE_LABELS[a.stage] || a.status
const stagePill = (a) => STAGE_PILL[a.stage] || STATUS_PILL[a.status] || 'oa-pill-gray'

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '—')
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

function Avatar({ appt, className }) {
  const [broken, setBroken] = useState(false)
  if (appt.avatar && !broken) return <img src={appt.avatar} alt={appt.patient} className={className} onError={() => setBroken(true)} />
  return <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e8f5f0', color: '#2c4a3e', fontWeight: 800 }} role="img" aria-label={appt.patient}>{initials(appt.patient)}</span>
}

// ── Icons ──────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}
function XCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </svg>
  )
}
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const STATUS_PILL = {
  Confirmed: 'oa-pill-green',
  Pending: 'oa-pill-yellow',
  Completed: 'oa-pill-gray',
  Cancelled: 'oa-pill-red',
  'No Show': 'oa-pill-red',
}

/* ── View Appointment Modal ── */
function ViewModal({ appt, onClose }) {
  return (
    <div className="oa-modal-backdrop" onClick={onClose}>
      <div className="oa-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="oa-profile-hero">
          <button className="oa-profile-close" onClick={onClose} aria-label="Close">✕</button>
          <Avatar appt={appt} className="oa-profile-avatar" />
          <h2 className="oa-profile-name">{appt.patient}</h2>
          <p className="oa-profile-meta">{appt.service}</p>
          <span className={`oa-pill ${stagePill(appt)}`}>{stageLabel(appt)}</span>
        </div>

        <div className="oa-profile-body">
          <h4 className="oa-section-title">Appointment Details</h4>
          <div className="oa-detail-grid">
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Therapist</span>
              <span className="oa-detail-val">{appt.therapist || '—'}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Branch</span>
              <span className="oa-detail-val">{appt.branch || '—'}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Date</span>
              <span className="oa-detail-val">{fmtDate(appt.date)}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Time</span>
              <span className="oa-detail-val">{appt.time || '—'}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Booked On</span>
              <span className="oa-detail-val">{fmtDate(appt.bookedOn)}</span>
            </div>
            <div className="oa-detail-row">
              <span className="oa-detail-lbl">Status</span>
              <span className="oa-detail-val">{stageLabel(appt)}</span>
            </div>
          </div>

          <div className="oa-detail-grid" style={{ marginTop: 12 }}>
            <div className="oa-detail-row"><span className="oa-detail-lbl">Session Mode</span><span className="oa-detail-val">{appt.mode || '—'}</span></div>
            <div className="oa-detail-row"><span className="oa-detail-lbl">Condition</span><span className="oa-detail-val">{appt.condition || '—'}</span></div>
            <div className="oa-detail-row"><span className="oa-detail-lbl">Payment</span><span className="oa-detail-val">{appt.total != null ? `₱${Number(appt.total).toLocaleString('en-PH')}` : '—'}{appt.paymentMethod ? ` · ${appt.paymentMethod}` : ''}</span></div>
            <div className="oa-detail-row"><span className="oa-detail-lbl">Guardian</span><span className="oa-detail-val">{appt.guardian || '—'}</span></div>
            <div className="oa-detail-row"><span className="oa-detail-lbl">Contact</span><span className="oa-detail-val">{appt.contact || '—'}</span></div>
          </div>
          {appt.cancelledReason && <p className="oa-notes-box" style={{ marginTop: 16 }}>Cancelled: {appt.cancelledReason}</p>}
        </div>

        <div className="oa-modal-footer">
          <button className="oa-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function OwnerAppointmentsPage({ user, onLogout, betaTier }) {
  const [appointments, setAppointments] = useState([])
  const [branchNames, setBranchNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [datePreset, setDatePreset] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewing, setViewing] = useState(null)
  const [queue, setQueue] = useState([])
  const [reviewId, setReviewId] = useState(null)
  const [toast, setToast] = useState('')
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t) }, [toast])
  const loadQueue = () => flowApi.ownerQueue().then((d) => setQueue(d.items)).catch((e) => console.error('payment queue:', e.message))
  useEffect(() => {
    loadQueue()
    const id = setInterval(loadQueue, 60000)
    window.addEventListener('focus', loadQueue)
    return () => { clearInterval(id); window.removeEventListener('focus', loadQueue) }
  }, [])
  const reviewed = (id, left) => { // take it off the list at once, then read the real state again
    if (id) setQueue((q) => q.filter((r) => r.id !== id))
    if (!left) setReviewId(null)
    loadQueue(); load(true)
  }

  const applyPreset = (p) => {
    setDatePreset(p)
    if (p === 'all' || p === 'custom') {
      if (p === 'all') { setDateFrom(''); setDateTo('') }
      return
    }
    const today = new Date()
    const ymd = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    const shift = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }
    if (p === 'today') { setDateFrom(ymd(today)); setDateTo(ymd(today)) }
    else if (p === 'next7') { setDateFrom(ymd(today)); setDateTo(ymd(shift(7))) }
    else if (p === 'last7') { setDateFrom(ymd(shift(-7))); setDateTo(ymd(today)) }
    else if (p === 'last30') { setDateFrom(ymd(shift(-30))); setDateTo(ymd(today)) }
    else if (p === 'month') {
      const [y, m] = ymd(today).split('-').map(Number)
      setDateFrom(`${y}-${String(m).padStart(2, '0')}-01`)
      setDateTo(`${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`)
    }
  }

  const load = (quiet) => {
    if (quiet !== true) setLoading(true)
    setError('')
    authFetch('/api/owner/appointments')
      .then((d) => { setAppointments(d.appointments); setBranchNames(d.branches) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const BRANCHES = useMemo(() => branchNames, [branchNames])

  const filtered = appointments.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch = a.patient.toLowerCase().includes(q) || a.therapist.toLowerCase().includes(q) || a.service.toLowerCase().includes(q) || a.guardian.toLowerCase().includes(q)
    const matchBranch = branchFilter === 'All' || a.branch === branchFilter
    const matchStatus = statusFilter === 'All' || a.status === statusFilter
    const apptDay = a.date ? new Date(a.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) : ''
    const matchDate = (!dateFrom || (apptDay && apptDay >= dateFrom)) && (!dateTo || (apptDay && apptDay <= dateTo))
    return matchSearch && matchBranch && matchStatus && matchDate
  })

  const counts = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === 'Confirmed').length,
    toVerify: queue.length,
    waiting: appointments.filter((a) => a.stage === 'awaiting_therapist').length,
    cancelled: appointments.filter((a) => a.status === 'Cancelled').length,
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Appointments"
      subtitle="Monitor bookings and verify payments across all branches"
      icon="🗓️"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      {/* KPI Cards */}
      <div className="oa-kpi-grid">
        <div className="oa-kpi-card teal">
          <div className="oa-kpi-icon"><CalendarIcon /></div>
          <div className="oa-kpi-value">{counts.total}</div>
          <div className="oa-kpi-label">Total Appointments</div>
        </div>
        <div className={`oa-kpi-card orange${counts.toVerify > 0 ? ' hot' : ''}`}>
          <div className="oa-kpi-icon"><ClockIcon /></div>
          <div className="oa-kpi-value">{counts.toVerify}</div>
          <div className="oa-kpi-label">Payments to verify</div>
        </div>
        <div className="oa-kpi-card green">
          <div className="oa-kpi-icon"><CheckCircleIcon /></div>
          <div className="oa-kpi-value">{counts.confirmed}</div>
          <div className="oa-kpi-label">Confirmed</div>
        </div>
        <div className="oa-kpi-card amber">
          <div className="oa-kpi-icon"><ClockIcon /></div>
          <div className="oa-kpi-value">{counts.waiting}</div>
          <div className="oa-kpi-label">Waiting for therapist</div>
        </div>
        <div className="oa-kpi-card red">
          <div className="oa-kpi-icon"><XCircleIcon /></div>
          <div className="oa-kpi-value">{counts.cancelled}</div>
          <div className="oa-kpi-label">Cancelled</div>
        </div>
      </div>

      <PaymentQueuePanel items={queue} onReview={setReviewId} />

      {/* Toolbar */}
      <div className="oa-toolbar">
        <div className="oa-search-wrap">
          <svg className="oa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="oa-search"
            placeholder="Search by patient, therapist, service or guardian…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="oa-branch-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="All">All Branches</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="oa-branch-select" value={datePreset} onChange={(e) => applyPreset(e.target.value)} aria-label="Date range">
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="next7">Next 7 Days</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {datePreset === 'custom' && (
          <div className="oa-date-range">
            <input type="date" className="oa-branch-select" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
            <span>to</span>
            <input type="date" className="oa-branch-select" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
          </div>
        )}
        <div className="oa-filter-tabs">
          {['All', ...STATUSES].map((s) => (
            <button key={s} className={`oa-filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments Table */}
      <section className="admin-table-card oa-table-card">
        <div className="admin-table-scroll">
          <table className="admin-table oa-appts-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Therapist</th>
                <th>Service</th>
                <th>Branch</th>
                <th>Date &amp; Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><p className="oa-empty">Loading appointments…</p></td></tr>
              ) : error ? (
                <tr><td colSpan={7}><p className="oa-empty">{error} <button type="button" className="oa-btn-cancel" onClick={load}>Try again</button></p></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><p className="oa-empty">{appointments.length ? 'No appointments match your search.' : 'No appointments have been recorded yet.'}</p></td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td className="oa-cell-patient" data-label="Patient">
                    <div className="oa-table-person">
                      <Avatar appt={a} className="oa-avatar" />
                      <div>
                        <div className="oa-table-name">{a.patient}</div>
                        <div className="oa-table-sub">Booked {fmtDate(a.bookedOn)}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Therapist">{a.therapist || '—'}</td>
                  <td data-label="Service"><span className="oa-service-badge">{a.service}</span></td>
                  <td data-label="Branch"><span className="oa-branch-badge">{a.branch || '—'}</span></td>
                  <td data-label="Date & Time">
                    <div className="oa-datetime">
                      <span className="oa-date">{fmtDate(a.date)}</span>
                      <span className="oa-time">{a.time}</span>
                    </div>
                  </td>
                  <td data-label="Status"><span className={`oa-pill ${stagePill(a)}`}>{stageLabel(a)}</span></td>
                  <td className="oa-cell-actions" data-label="Actions">
                    <div className="oa-table-actions">
                      <button className="oa-icon-btn oa-icon-view" onClick={() => setViewing(a)} title="View" aria-label={`View ${a.patient}'s appointment`}>
                        <EyeIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewing && <ViewModal appt={viewing} onClose={() => setViewing(null)} />}
      {reviewId && queue.length > 0 && <VerifyPaymentModal items={queue} initialId={reviewId} onClose={() => setReviewId(null)} onDone={reviewed} showToast={setToast} />}
      {toast && <div className="pcq-toast" role="status" aria-live="polite">{toast}</div>}
    </OwnerPageShell>
  )
}
