import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { CategoryBarChart, TrendLineChart, DonutChart } from './DashboardCharts'
import { authFetch } from '../../utils/session'
import './DashboardCharts.css'

// ── Icons ──────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function PatientsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function StaffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" />
      <path d="M16 5.2a3 3 0 0 1 0 5.8" />
      <path d="M21 20c0-2.8-1.8-5-4.5-5.7" />
    </svg>
  )
}
function SalesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8h4a2.5 2.5 0 0 1 0 5H9m0-5v9m0-4h5" />
    </svg>
  )
}
function TrendUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
function TrendDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ── Formatting ─────────────────────────────────────────
const peso = (n) => {
  const v = Number(n) || 0
  if (v >= 10000) return `₱${Math.round(v / 100) / 10}K`
  return `₱${Math.round(v).toLocaleString('en-PH')}`
}

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  const days = Math.round(mins / 1440)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Builds the four KPI cards from the API response. A percentage is only shown when
// the earlier figure is large enough for it to mean something; otherwise the plain change.
function buildKpis(k) {
  const appt = k.appointmentsToday
  const apptDiff = appt.value - appt.yesterday
  const apptTrend = appt.yesterday >= 10 && appt.changePct != null
    ? { text: `${appt.changePct >= 0 ? '+' : ''}${appt.changePct}% vs yesterday`, tone: appt.changePct > 0 ? 'up' : appt.changePct < 0 ? 'down' : 'flat' }
    : { text: apptDiff === 0 ? 'Same as yesterday' : `${apptDiff > 0 ? '+' : '−'}${Math.abs(apptDiff)} vs yesterday`, tone: apptDiff > 0 ? 'up' : apptDiff < 0 ? 'down' : 'flat' }

  const staff = k.staffOnline
  const staffDiff = staff.average == null ? 0 : staff.value - staff.average
  const staffTrend = staff.average == null
    ? { text: 'No average yet', tone: 'flat' }
    : Math.abs(staffDiff) < 1 ? { text: 'On par with avg', tone: 'flat' }
      : { text: `${staffDiff > 0 ? '+' : '−'}${Math.round(Math.abs(staffDiff))} vs avg`, tone: staffDiff > 0 ? 'up' : 'down' }

  const sales = k.grossSales
  const salesDiff = sales.value - sales.lastMonth
  const salesTrend = sales.lastMonth >= 1000 && sales.changePct != null
    ? { text: `${sales.changePct >= 0 ? '+' : ''}${sales.changePct}% vs last month`, tone: sales.changePct > 0 ? 'up' : sales.changePct < 0 ? 'down' : 'flat' }
    : { text: salesDiff === 0 ? 'Same as last month' : `${salesDiff > 0 ? '+' : '−'}${peso(Math.abs(salesDiff))} vs last month`, tone: salesDiff > 0 ? 'up' : salesDiff < 0 ? 'down' : 'flat' }

  return [
    { label: 'Appointments Today', value: String(appt.value), meta: `${appt.pending} pending confirmation`, trend: apptTrend.text, trendTone: apptTrend.tone, color: 'teal', Icon: CalendarIcon, path: '/owner/appointments' },
    { label: 'Active Patients', value: String(k.activePatients.value), meta: `${plural(k.activePatients.newThisMonth, 'new patient', 'new patients')} this month`, trend: `+${k.activePatients.newThisWeek} this week`, trendTone: k.activePatients.newThisWeek > 0 ? 'up' : 'flat', color: 'blue', Icon: PatientsIcon, path: '/owner/patients' },
    { label: 'Staff Online', value: String(staff.value), meta: `${staff.inSession} currently in session`, trend: staffTrend.text, trendTone: staffTrend.tone, color: 'purple', Icon: StaffIcon, path: '/owner/staff' },
    { label: 'Gross Sales', value: peso(sales.value), meta: 'This month', trend: salesTrend.text, trendTone: salesTrend.tone, color: 'amber', Icon: SalesIcon, path: '/owner/billing' },
  ]
}

const PLACEHOLDER_KPIS = ['Appointments Today', 'Active Patients', 'Staff Online', 'Gross Sales'].map((label, i) => ({
  label, value: '—', meta: 'Loading…', trend: '', trendTone: 'flat', color: ['teal', 'blue', 'purple', 'amber'][i], Icon: [CalendarIcon, PatientsIcon, StaffIcon, SalesIcon][i], path: null,
}))

// ── Main Component ─────────────────────────────────────
export default function OwnerDashboard({ user, onLogout, betaTier }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    authFetch('/api/owner/dashboard').then(setData).catch((err) => setError(err.message))
  }, [])
  useEffect(() => { load() }, [load])

  const kpis = data ? buildKpis(data.kpis) : PLACEHOLDER_KPIS
  const mix = data ? data.patientMix : null
  const patientMix = mix ? [
    { label: 'Active', value: mix.active, color: '#4a6b5d' },
    { label: 'New (no sessions)', value: mix.new, color: 'var(--viz-series-blue)' },
    { label: 'Inactive', value: mix.inactive, color: 'var(--viz-series-amber)' },
  ] : []

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Dashboard"
      subtitle="Overview of clinic operations, people, and revenue"
      icon="📈"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <div className="owner-dashboard-charts">
        {error && (
          <div className="admin-list-item" role="alert" style={{ marginBottom: 12 }}>
            <div><h4>Could not load the dashboard</h4><p>{error}</p></div>
            <button type="button" className="admin-btn-secondary" onClick={load}>Try again</button>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div className="viz-kpi-grid">
          {kpis.map(({ label, value, meta, trend, trendTone, color, Icon, path }) => (
            <div
              key={label}
              className={`viz-kpi-card ${color} ${path ? 'viz-kpi-clickable' : ''}`}
              onClick={path ? () => navigate(path) : undefined}
              role={path ? 'button' : undefined}
              tabIndex={path ? 0 : undefined}
              onKeyDown={path ? (e) => e.key === 'Enter' && navigate(path) : undefined}
            >
              <div className="viz-kpi-top">
                <div className="viz-kpi-icon"><Icon /></div>
                {trend && (
                  <span className={`viz-kpi-trend ${trendTone}`}>
                    {trendTone === 'up' && <TrendUpIcon />}
                    {trendTone === 'down' && <TrendDownIcon />}
                    {trend}
                  </span>
                )}
              </div>
              <div className="viz-kpi-value">{value}</div>
              <div className="viz-kpi-label">{label}</div>
              <div className="viz-kpi-meta">{meta}</div>
            </div>
          ))}
        </div>

        {/* ── Charts Row ── */}
        <div className="viz-charts-row">
          <div className="viz-col-stack">
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Revenue Overview</h3>
                  <p>Gross sales, last 6 months</p>
                </div>
              </div>
              <div className="viz-panel-body">
                {data ? <TrendLineChart data={data.revenueTrend} formatValue={peso} /> : <p className="viz-empty">Loading…</p>}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Weekly Appointments</h3>
                  <p>{data?.busiest ? `Busiest day: ${data.busiest.label}, ${data.busiest.value} booked` : 'No appointments booked this week'}</p>
                </div>
              </div>
              <div className="viz-panel-body">
                {data ? <CategoryBarChart data={data.weekly} markToday /> : <p className="viz-empty">Loading…</p>}
              </div>
            </section>
          </div>

          <div className="viz-col-stack">
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Patient Mix</h3>
                  <p>Roster breakdown by status</p>
                </div>
              </div>
              {mix ? <DonutChart data={patientMix} centerValue={String(mix.total)} centerSub="Patients" /> : <p className="viz-empty">Loading…</p>}
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Today's Operations</h3>
                  <p>Live status across the clinic</p>
                </div>
              </div>
              <div className="admin-list">
                {(data?.operations || []).map((o) => (
                  <div key={o.title} className="admin-list-item">
                    <div><h4>{o.title}</h4><p>{o.detail}</p></div>
                    <span className={`admin-pill ${o.tone === 'good' ? 'green' : 'yellow'}`}>{o.pill}</span>
                  </div>
                ))}
                {!data && <p className="viz-empty">Loading…</p>}
              </div>
            </section>
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="viz-bottom-row">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>Action Items</h3>
                <p>Follow-ups that need ownership</p>
              </div>
            </div>
            <div className="viz-task-list">
              {!data && <p className="viz-empty">Loading…</p>}
              {data && data.actionItems.length === 0 && <p className="viz-empty">Nothing needs your attention right now.</p>}
              {(data?.actionItems || []).map((t) => (
                <div key={t.text} className="viz-task-row" role="button" tabIndex={0} style={{ cursor: 'pointer' }}
                  onClick={() => navigate(t.path)} onKeyDown={(e) => e.key === 'Enter' && navigate(t.path)}>
                  <span className={`viz-task-dot ${t.priority}`} />
                  <span className="viz-task-text">{t.text}</span>
                  <span className={`viz-task-pri ${t.priority}`}>
                    {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h3>Recent Activity</h3>
                <p>Latest updates across the clinic</p>
              </div>
            </div>
            <div className="viz-activity-list">
              {!data && <p className="viz-empty">Loading…</p>}
              {data && data.activity.length === 0 && <p className="viz-empty">No activity yet.</p>}
              {(data?.activity || []).map((a, i) => (
                <div key={`${a.at}-${i}`} className="viz-activity-row">
                  <div className="viz-activity-icon">{a.icon}</div>
                  <div className="viz-activity-info">
                    <div className="viz-activity-text">{a.text}</div>
                    <div className="viz-activity-time">{ago(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </OwnerPageShell>
  )
}
