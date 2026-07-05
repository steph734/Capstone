import { useNavigate } from 'react-router-dom'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { CategoryBarChart, TrendLineChart, DonutChart } from './DashboardCharts'
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

// ── Data ───────────────────────────────────────────────
const KPI_DATA = [
  {
    label: 'Appointments Today',
    value: '34',
    meta: '6 pending confirmation',
    trend: '+9% vs yesterday',
    trendTone: 'up',
    color: 'teal',
    Icon: CalendarIcon,
    path: '/owner/appointments',
  },
  {
    label: 'Active Patients',
    value: '218',
    meta: '18 new intakes this month',
    trend: '+14 this week',
    trendTone: 'up',
    color: 'blue',
    Icon: PatientsIcon,
    path: '/owner/patients',
  },
  {
    label: 'Staff Online',
    value: '19',
    meta: '4 currently in session',
    trend: 'On par with avg',
    trendTone: 'flat',
    color: 'purple',
    Icon: StaffIcon,
    path: '/owner/staff',
  },
  {
    label: 'Gross Sales',
    value: '₱86K',
    meta: 'This month',
    trend: '+8% vs last month',
    trendTone: 'up',
    color: 'amber',
    Icon: SalesIcon,
    path: '/owner/billing',
  },
]

const revenueTrend = [
  { label: 'Feb', value: 62 },
  { label: 'Mar', value: 68 },
  { label: 'Apr', value: 71 },
  { label: 'May', value: 75 },
  { label: 'Jun', value: 80 },
  { label: 'Jul', value: 86 },
]

const weeklyAppointments = [
  { label: 'Mon', value: 28 },
  { label: 'Tue', value: 31 },
  { label: 'Wed', value: 30 },
  { label: 'Thu', value: 34, isToday: true },
  { label: 'Fri', value: 33 },
  { label: 'Sat', value: 21 },
  { label: 'Sun', value: 9 },
]

const patientMix = [
  { label: 'Active', value: 218, color: '#4a6b5d' },
  { label: 'New this month', value: 18, color: 'var(--viz-series-blue)' },
  { label: 'Inactive', value: 26, color: 'var(--viz-series-amber)' },
]

const ACTION_ITEMS = [
  { text: 'Follow up on ₱7,400 in outstanding invoices', priority: 'high' },
  { text: '6 appointments awaiting confirmation today', priority: 'medium' },
  { text: 'Staffing gap tomorrow, 2:00–4:00 PM shift', priority: 'medium' },
  { text: 'Review Q3 subscription renewal terms', priority: 'low' },
]

const ACTIVITY = [
  { time: '1h ago', text: 'Invoice paid — ₱54,200 collected', icon: '💳' },
  { time: '3h ago', text: 'New patient intake completed — Lily Santos', icon: '👤' },
  { time: '4h ago', text: '19 staff clocked in for today’s shift', icon: '🧑‍⚕️' },
  { time: 'Yesterday', text: 'Payment retry resolved — no failed cards', icon: '✅' },
]

// ── Main Component ─────────────────────────────────────
export default function OwnerDashboard({ user, onLogout, betaTier }) {
  const navigate = useNavigate()

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
        {/* ── KPI Cards ── */}
        <div className="viz-kpi-grid">
          {KPI_DATA.map(({ label, value, meta, trend, trendTone, color, Icon, path }) => (
            <div
              key={label}
              className={`viz-kpi-card ${color} viz-kpi-clickable`}
              onClick={() => navigate(path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(path)}
            >
              <div className="viz-kpi-top">
                <div className="viz-kpi-icon"><Icon /></div>
                <span className={`viz-kpi-trend ${trendTone}`}>
                  {trendTone === 'up' && <TrendUpIcon />}
                  {trendTone === 'down' && <TrendDownIcon />}
                  {trend}
                </span>
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
                <TrendLineChart data={revenueTrend} formatValue={(v) => `₱${v}K`} />
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Weekly Appointments</h3>
                  <p>Busiest day: Thursday, 34 booked</p>
                </div>
              </div>
              <div className="viz-panel-body">
                <CategoryBarChart data={weeklyAppointments} markToday />
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
              <DonutChart data={patientMix} centerValue="262" centerSub="Patients" />
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h3>Today's Operations</h3>
                  <p>Live status across the clinic</p>
                </div>
              </div>
              <div className="admin-list">
                <div className="admin-list-item"><div><h4>Morning sessions fully booked</h4><p>Bookings at 92% capacity</p></div><span className="admin-pill green">Good</span></div>
                <div className="admin-list-item"><div><h4>Payment processing healthy</h4><p>No failed card retries</p></div><span className="admin-pill green">OK</span></div>
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
              {ACTION_ITEMS.map((t, i) => (
                <div key={i} className="viz-task-row">
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
              {ACTIVITY.map((a, i) => (
                <div key={i} className="viz-activity-row">
                  <div className="viz-activity-icon">{a.icon}</div>
                  <div className="viz-activity-info">
                    <div className="viz-activity-text">{a.text}</div>
                    <div className="viz-activity-time">{a.time}</div>
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
