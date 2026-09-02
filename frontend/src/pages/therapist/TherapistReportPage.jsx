import { useState, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import { TrendChart, BreakdownChart } from '../owner/ReportCharts'
import './TherapistReportPage.css'

// ── Static demo data ────────────────────────────────────────────────────────
const HISTORY_PATIENTS = ['Aira Lopez', 'Noah Cruz', 'Mika Santos', 'Lily Santos', 'Jasper Reyes', 'Carlos Buen']
const HISTORY_TYPES = ['Speech Therapy', 'Developmental', 'Articulation', 'Physical Therapy', 'Occupational Therapy']

// Generates deterministic past-month appointment history (Jan 2025 – Jun 2026)
// so the Daily/Monthly/Annual views each have real breadth to aggregate over.
function generateAppointmentHistory() {
  const rows = []
  const months = []
  for (let y = 2025; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m >= 7) continue // Jul 2026 onward covered by the current-month rows below
      months.push({ y, m })
    }
  }
  months.forEach(({ y, m }, idx) => {
    const count = 3 + (idx % 3) // 3–5 appointments per month
    for (let i = 0; i < count; i++) {
      const day = String(2 + ((i * 6 + idx * 3) % 26)).padStart(2, '0')
      const monthStr = String(m).padStart(2, '0')
      const patient = HISTORY_PATIENTS[(idx + i) % HISTORY_PATIENTS.length]
      const type = HISTORY_TYPES[(idx + i * 2) % HISTORY_TYPES.length]
      const status = i % 5 === 0 ? 'Cancelled' : 'Completed'
      rows.push({ date: `${y}-${monthStr}-${day}`, patient, type, status, duration: '50 min' })
    }
  })
  return rows
}

const APPOINTMENTS_DATA = [
  ...generateAppointmentHistory(),
  { date: '2026-07-04', patient: 'Aira Lopez',   type: 'Speech Therapy',       status: 'Confirmed', duration: '50 min' },
  { date: '2026-07-04', patient: 'Noah Cruz',     type: 'Developmental',        status: 'Pending',   duration: '50 min' },
  { date: '2026-07-04', patient: 'Mika Santos',   type: 'Articulation',         status: 'Confirmed', duration: '50 min' },
  { date: '2026-07-04', patient: 'Lily Santos',   type: 'Speech Therapy',       status: 'Confirmed', duration: '50 min' },
  { date: '2026-07-04', patient: 'Jasper Reyes',  type: 'Physical Therapy',     status: 'Pending',   duration: '50 min' },
  { date: '2026-07-09', patient: 'Aira Lopez',    type: 'Speech Therapy',       status: 'Completed', duration: '50 min' },
  { date: '2026-07-09', patient: 'Noah Cruz',     type: 'Developmental',        status: 'Completed', duration: '50 min' },
  { date: '2026-07-09', patient: 'Mika Santos',   type: 'Articulation',         status: 'Cancelled', duration: '50 min' },
  { date: '2026-07-15', patient: 'Lily Santos',   type: 'Speech Therapy',       status: 'Completed', duration: '50 min' },
  { date: '2026-07-15', patient: 'Jasper Reyes',  type: 'Physical Therapy',     status: 'Completed', duration: '50 min' },
  { date: '2026-07-17', patient: 'Aira Lopez',    type: 'Speech Therapy',       status: 'Confirmed', duration: '50 min' },
  { date: '2026-07-17', patient: 'Noah Cruz',     type: 'Developmental',        status: 'Confirmed', duration: '50 min' },
]

const PROGRESS_DATA = [
  { patient: 'Aira Lopez',   condition: 'Speech Delay',         sessions: 12, progress: 78, status: 'On Track'        },
  { patient: 'Noah Cruz',    condition: 'Autism Spectrum',       sessions: 8,  progress: 54, status: 'Needs Attention' },
  { patient: 'Mika Santos',  condition: 'Articulation Disorder', sessions: 15, progress: 91, status: 'On Track'        },
  { patient: 'Lily Santos',  condition: 'Language Delay',        sessions: 6,  progress: 43, status: 'Needs Attention' },
  { patient: 'Jasper Reyes', condition: 'Motor Delay',           sessions: 10, progress: 62, status: 'On Track'        },
  { patient: 'Carlos Buen',  condition: 'Hearing Impairment',    sessions: 4,  progress: 30, status: 'Critical'        },
]

const SESSION_DATA = [
  { month: 'May 2026',  total: 38, completed: 34, cancelled: 4, avgDuration: '48 min' },
  { month: 'Jun 2026',  total: 45, completed: 40, cancelled: 5, avgDuration: '50 min' },
  { month: 'Jul 2026',  total: 12, completed: 8,  cancelled: 1, avgDuration: '50 min' },
]

const EXERCISE_DATA = [
  { patient: 'Aira Lopez',   exercise: 'Tongue Twisters',    assigned: 20, completed: 17, accuracy: 84, status: 'On Track'        },
  { patient: 'Noah Cruz',    exercise: 'Breathing Drills',   assigned: 15, completed: 8,  accuracy: 61, status: 'Needs Attention' },
  { patient: 'Mika Santos',  exercise: 'Articulation Cards', assigned: 24, completed: 23, accuracy: 92, status: 'On Track'        },
  { patient: 'Lily Santos',  exercise: 'Sound Matching',     assigned: 12, completed: 5,  accuracy: 44, status: 'Needs Attention' },
  { patient: 'Jasper Reyes', exercise: 'Balance Steps',      assigned: 18, completed: 14, accuracy: 73, status: 'On Track'        },
  { patient: 'Carlos Buen',  exercise: 'Listening Games',    assigned: 10, completed: 3,  accuracy: 30, status: 'Critical'        },
]

// ── Icons ───────────────────────────────────────────────────────────────────
const icoProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
const IcCalendar = () => <svg {...icoProps}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
const IcTrend = () => <svg {...icoProps}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
const IcDoc = () => <svg {...icoProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
const IcDumbbell = () => <svg {...icoProps}><path d="M6.5 6.5l11 11M4 9l-1 1a2.1 2.1 0 0 0 0 3l1 1M20 15l1-1a2.1 2.1 0 0 0 0-3l-1-1M7 4L6 5a2.1 2.1 0 0 0 0 3l1 1M17 20l1-1a2.1 2.1 0 0 0 0-3l-1-1" /></svg>
const IcCheckCircle = () => <svg {...icoProps}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
const IcCheckBadge = () => <svg {...icoProps}><path d="M12 2l2.4 1.8 3 .2.2 3L21.6 12 19.6 15l-.2 3-3 .2L12 22l-2.4-1.8-3-.2-.2-3L4.4 15 6.4 12 4.4 9l.2-3 3-.2z" /><path d="M9 12l2 2 4-4" /></svg>
const IcXCircle = () => <svg {...icoProps}><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
const IcUsers = () => <svg {...icoProps}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" /><path d="M16 5.2a3 3 0 0 1 0 5.8" /><path d="M21 20c0-2.8-1.8-5-4.5-5.7" /></svg>
const IcAlert = () => <svg {...icoProps}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
const IcLayers = () => <svg {...icoProps}><path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /></svg>
const IcTarget = () => <svg {...icoProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>

const REPORT_TYPES = [
  { id: 'appointments', label: 'Appointments Report',      icon: <IcCalendar />, tint: '#e6f5f2', color: '#159a72', desc: 'All scheduled and completed appointments', headline: 'Overview of all scheduled and completed appointments' },
  { id: 'progress',     label: 'Patient Progress Report',  icon: <IcTrend />,    tint: '#eef2ff', color: '#6366f1', desc: 'Per-patient session progress and status' },
  { id: 'sessions',     label: 'Session Summary Report',   icon: <IcDoc />,      tint: '#eff6ff', color: '#3b82f6', desc: 'Monthly session counts and completion rates' },
  { id: 'exercise',     label: 'Exercise Performance Report', icon: <IcDumbbell />, tint: '#fff4ed', color: '#ea6a1e', desc: 'Performance analytics for assigned exercises' },
]

const COLS = {
  appointments: ['Date', 'Patient', 'Therapy Type', 'Status', 'Duration'],
  progress:     ['Patient', 'Condition', 'Sessions', 'Progress (%)', 'Status'],
  sessions:     ['Month', 'Total', 'Completed', 'Cancelled', 'Avg Duration'],
  exercise:     ['Patient', 'Exercise', 'Assigned', 'Completed', 'Accuracy (%)', 'Status'],
}

function rowsFor(type, data) {
  if (type === 'appointments') return data.map(r => [r.date, r.patient, r.type, r.status, r.duration])
  if (type === 'progress')     return data.map(r => [r.patient, r.condition, r.sessions, `${r.progress}%`, r.status])
  if (type === 'sessions')     return data.map(r => [r.month, r.total, r.completed, r.cancelled, r.avgDuration])
  if (type === 'exercise')     return data.map(r => [r.patient, r.exercise, r.assigned, r.completed, `${r.accuracy}%`, r.status])
  return []
}

const STATUS_CLASS = {
  'Confirmed': 'rpt-status-confirmed',
  'Completed': 'rpt-status-completed',
  'Pending':   'rpt-status-pending',
  'Cancelled': 'rpt-status-cancelled',
  'On Track':        'rpt-status-confirmed',
  'Needs Attention': 'rpt-status-pending',
  'Critical':        'rpt-status-cancelled',
}

// ── PDF Export ───────────────────────────────────────────────────────────────
function exportPDF(type, rows, cols, dateRange) {
  const doc = new jsPDF({ orientation: 'landscape' })
  const title = REPORT_TYPES.find(r => r.id === type)?.label || 'Report'

  doc.setFontSize(18)
  doc.setTextColor(44, 74, 62)
  doc.text('TherapyPro – ' + title, 14, 18)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Period: ${dateRange.from} to ${dateRange.to}`, 14, 26)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32)

  autoTable(doc, {
    head: [cols],
    body: rows,
    startY: 38,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [74, 107, 93], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${type}-report-${dateRange.from}.pdf`)
}

// ── Excel Export ─────────────────────────────────────────────────────────────
function exportExcel(type, rows, cols, dateRange) {
  const title = REPORT_TYPES.find(r => r.id === type)?.label || 'Report'
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows])
  ws['!cols'] = cols.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, `${type}-report-${dateRange.from}.xlsx`)
}

const GRANULARITIES = [
  { id: 'daily',   label: 'Daily',   range: { from: '2026-07-01', to: '2026-07-31' } },
  { id: 'monthly', label: 'Monthly', range: { from: '2026-01-01', to: '2026-07-31' } },
  { id: 'annual',  label: 'Annual',  range: { from: '2025-01-01', to: '2026-07-31' } },
]

const STATUS_WINDOWS = [
  { id: 'month', label: 'This Month', range: { from: '2026-07-01', to: '2026-07-31' } },
  { id: 'range', label: 'Selected Range' },
  { id: 'all',   label: 'All Time' },
]

function groupKey(dateStr, granularity) {
  if (granularity === 'monthly') return dateStr.slice(0, 7) // YYYY-MM
  if (granularity === 'annual') return dateStr.slice(0, 4)  // YYYY
  return dateStr
}

function groupLabel(key, granularity) {
  if (granularity === 'monthly') {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
  }
  return key
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TherapistReportPage({ user, onLogout, betaTier }) {
  const [reportType, setReportType] = useState('appointments')
  const [dateRange, setDateRange] = useState({ from: '2026-07-01', to: '2026-07-31' })
  const [granularity, setGranularity] = useState('daily')
  const [statusWindow, setStatusWindow] = useState('month')
  const [toast, setToast] = useState('')

  const rawData = useMemo(() => {
    if (reportType === 'appointments') {
      return APPOINTMENTS_DATA.filter(r => r.date >= dateRange.from && r.date <= dateRange.to)
    }
    if (reportType === 'progress') return PROGRESS_DATA
    if (reportType === 'exercise') return EXERCISE_DATA
    return SESSION_DATA
  }, [reportType, dateRange])

  const statusData = useMemo(() => {
    if (reportType !== 'appointments') return rawData
    const win = STATUS_WINDOWS.find(w => w.id === statusWindow)
    if (statusWindow === 'all') return APPOINTMENTS_DATA
    if (win?.range) return APPOINTMENTS_DATA.filter(r => r.date >= win.range.from && r.date <= win.range.to)
    return rawData
  }, [reportType, statusWindow, rawData])

  const cols = COLS[reportType]
  const rows = rowsFor(reportType, rawData)

  const charts = useMemo(() => {
    if (reportType === 'appointments') {
      const byKey = {}
      rawData.forEach(r => {
        const k = groupKey(r.date, granularity)
        byKey[k] = (byKey[k] || 0) + 1
      })
      const keys = Object.keys(byKey).sort()
      const labels = keys.map(k => groupLabel(k, granularity))
      const statuses = ['Confirmed', 'Completed', 'Pending', 'Cancelled']
      return {
        left: {
          title: `Appointments per ${granularity === 'daily' ? 'Day' : granularity === 'monthly' ? 'Month' : 'Year'}`,
          type: 'trend',
          months: labels,
          trend: keys.map(k => byKey[k]),
          color: '#159a72',
        },
        right: {
          title: 'Appointments by Status',
          type: 'breakdown',
          labels: statuses,
          values: statuses.map(s => statusData.filter(r => r.status === s).length),
          color: ['#16a34a', '#0284c7', '#d97706', '#dc2626'],
        },
      }
    }
    if (reportType === 'progress') {
      return {
        left: {
          title: 'Progress by Patient (%)',
          type: 'breakdown',
          labels: rawData.map(r => r.patient),
          values: rawData.map(r => r.progress),
          color: '#159a72',
        },
        right: {
          title: 'Sessions Completed by Patient',
          type: 'breakdown',
          labels: rawData.map(r => r.patient),
          values: rawData.map(r => r.sessions),
          color: '#0284c7',
        },
      }
    }
    if (reportType === 'exercise') {
      return {
        left: {
          title: 'Accuracy by Patient (%)',
          type: 'breakdown',
          labels: rawData.map(r => r.patient),
          values: rawData.map(r => r.accuracy),
          color: '#ea6a1e',
        },
        right: {
          title: 'Exercises Completed by Patient',
          type: 'breakdown',
          labels: rawData.map(r => r.patient),
          values: rawData.map(r => r.completed),
          color: '#16a34a',
        },
      }
    }
    return {
      left: {
        title: 'Total Sessions Trend',
        type: 'trend',
        months: rawData.map(r => r.month),
        trend: rawData.map(r => r.total),
        color: '#159a72',
      },
      right: {
        title: 'Completed Sessions by Month',
        type: 'breakdown',
        labels: rawData.map(r => r.month),
        values: rawData.map(r => r.completed),
        color: '#16a34a',
      },
    }
  }, [reportType, rawData, statusData, granularity])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const selected = REPORT_TYPES.find(r => r.id === reportType)

  const kpis = (() => {
    if (reportType === 'appointments') return [
      { label: 'Total Appointments', value: rawData.length, color: 'teal', icon: <IcCalendar /> },
      { label: 'Confirmed', value: rawData.filter(r => r.status === 'Confirmed').length, color: 'green', icon: <IcCheckCircle /> },
      { label: 'Completed', value: rawData.filter(r => r.status === 'Completed').length, color: 'blue', icon: <IcCheckBadge /> },
      { label: 'Cancelled', value: rawData.filter(r => r.status === 'Cancelled').length, color: 'red', icon: <IcXCircle /> },
    ]
    if (reportType === 'progress') return [
      { label: 'Patients', value: rawData.length, color: 'teal', icon: <IcUsers /> },
      { label: 'On Track', value: rawData.filter(r => r.status === 'On Track').length, color: 'green', icon: <IcCheckCircle /> },
      { label: 'Needs Attention', value: rawData.filter(r => r.status === 'Needs Attention').length, color: 'amber', icon: <IcAlert /> },
      { label: 'Critical', value: rawData.filter(r => r.status === 'Critical').length, color: 'red', icon: <IcXCircle /> },
    ]
    if (reportType === 'exercise') return [
      { label: 'Patients', value: rawData.length, color: 'teal', icon: <IcUsers /> },
      { label: 'Avg Accuracy', value: `${Math.round(rawData.reduce((s, r) => s + r.accuracy, 0) / rawData.length)}%`, color: 'blue', icon: <IcTarget /> },
      { label: 'Exercises Done', value: rawData.reduce((s, r) => s + r.completed, 0), color: 'green', icon: <IcCheckCircle /> },
      { label: 'Critical', value: rawData.filter(r => r.status === 'Critical').length, color: 'red', icon: <IcXCircle /> },
    ]
    return [
      { label: 'Months Covered', value: rawData.length, color: 'teal', icon: <IcCalendar /> },
      { label: 'Total Sessions', value: rawData.reduce((s, r) => s + r.total, 0), color: 'blue', icon: <IcLayers /> },
      { label: 'Completed', value: rawData.reduce((s, r) => s + r.completed, 0), color: 'green', icon: <IcCheckCircle /> },
      { label: 'Cancelled', value: rawData.reduce((s, r) => s + r.cancelled, 0), color: 'red', icon: <IcXCircle /> },
    ]
  })()

  const logExport = (format) => {
    logActivity({
      role: 'Therapist',
      user: user?.name || 'Therapist',
      email: user?.email || '—',
      actionIcon: '📤',
      action: 'Report',
      description: `Exported ${selected?.label || 'report'} as ${format} (${dateRange.from} to ${dateRange.to})`,
      entity: `Report · ${reportType}`,
      status: 'Success',
    })
  }

  const handlePDF = () => {
    exportPDF(reportType, rows, cols, dateRange)
    showToast('PDF exported successfully!')
    logExport('PDF')
  }

  const handleExcel = () => {
    exportExcel(reportType, rows, cols, dateRange)
    showToast('Excel file exported successfully!')
    logExport('Excel')
  }

  return (
    <TherapistPageShell
      user={user}
      onLogout={onLogout}
      title="Reports"
      subtitle="Generate and export therapy reports"
      icon="📋"
      menuItems={getTherapistMenuItems(betaTier)}
    >
      <div className="rpt-layout">

        {/* ── Left: type selector ── */}
        <div className="rpt-sidebar">
          <p className="rpt-sidebar-label">Report Type</p>
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              className={`rpt-type-btn ${reportType === r.id ? 'active' : ''}`}
              onClick={() => setReportType(r.id)}
            >
              <span className="rpt-type-icon" style={{ background: r.tint, color: r.color }}>{r.icon}</span>
              <span className="rpt-type-info">
                <span className="rpt-type-name">{r.label}</span>
                <span className="rpt-type-desc">{r.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {/* ── Right: filters + table + export ── */}
        <div className="rpt-main">

          {/* Header */}
          <div className="rpt-main-head">
            <div className="rpt-main-heading">
              <span className="rpt-main-title-icon" style={{ background: selected?.tint, color: selected?.color }}>{selected?.icon}</span>
              <div>
                <h2 className="rpt-main-title">{selected?.label}</h2>
                <p className="rpt-main-sub">{selected?.headline || selected?.desc}</p>
              </div>
            </div>
            <div className="rpt-export-btns">
              <button className="rpt-btn rpt-btn-excel" onClick={handleExcel}>
                <ExcelIcon /> Export Excel
              </button>
              <button className="rpt-btn rpt-btn-pdf" onClick={handlePDF}>
                <PDFIcon /> Export PDF
              </button>
            </div>
          </div>

          {/* Filters */}
          {reportType === 'appointments' && (
            <div className="rpt-filters">
              <div className="rpt-filter-group">
                <label>Date Range</label>
                <div className="rpt-daterange-inputs">
                  <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} />
                  <span className="rpt-daterange-sep">–</span>
                  <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} />
                </div>
              </div>
              <div className="rpt-filter-group">
                <label>View</label>
                <div className="rpt-granularity">
                  {GRANULARITIES.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={`rpt-granularity-btn ${granularity === g.id ? 'active' : ''}`}
                      onClick={() => { setGranularity(g.id); setDateRange(g.range) }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rpt-filter-meta">
                <span className="rpt-count-pill">{rawData.length} record{rawData.length !== 1 ? 's' : ''} found</span>
              </div>
            </div>
          )}

          {/* Summary KPIs */}
          <div className="rpt-kpi-row">
            {kpis.map(k => <KPITile key={k.label} {...k} />)}
          </div>

          {/* Charts */}
          {rawData.length > 0 && (
            <div className="rpt-charts-row">
              <div className="rpt-chart-card">
                <div className="rpt-chart-head">
                  <p className="rpt-chart-title">{charts.left.title}</p>
                  {reportType === 'appointments' && (
                    <select
                      className="rpt-chart-select"
                      value={granularity}
                      onChange={e => { setGranularity(e.target.value); setDateRange(GRANULARITIES.find(g => g.id === e.target.value).range) }}
                    >
                      {GRANULARITIES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  )}
                </div>
                {charts.left.type === 'trend' ? (
                  <TrendChart months={charts.left.months} trend={charts.left.trend} color={charts.left.color} />
                ) : (
                  <BreakdownChart labels={charts.left.labels} values={charts.left.values} color={charts.left.color} showValueLabels />
                )}
              </div>
              <div className="rpt-chart-card">
                <div className="rpt-chart-head">
                  <p className="rpt-chart-title">{charts.right.title}</p>
                  {reportType === 'appointments' && (
                    <select
                      className="rpt-chart-select"
                      value={statusWindow}
                      onChange={e => setStatusWindow(e.target.value)}
                    >
                      {STATUS_WINDOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                    </select>
                  )}
                </div>
                {charts.right.type === 'trend' ? (
                  <TrendChart months={charts.right.months} trend={charts.right.trend} color={charts.right.color} />
                ) : (
                  <BreakdownChart labels={charts.right.labels} values={charts.right.values} color={charts.right.color} showValueLabels />
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rpt-table-wrap">
            {rawData.length === 0 ? (
              <div className="rpt-empty">
                <div className="rpt-empty-icon">🔍</div>
                <p>No records found for the selected filters.</p>
              </div>
            ) : (
              <table className="rpt-table">
                <thead>
                  <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rawData.map((row, i) => (
                    <tr key={i}>
                      {reportType === 'appointments' && <>
                        <td>{row.date}</td>
                        <td><strong>{row.patient}</strong></td>
                        <td>{row.type}</td>
                        <td><span className={`rpt-status ${STATUS_CLASS[row.status]}`}>{row.status}</span></td>
                        <td>{row.duration}</td>
                      </>}
                      {reportType === 'progress' && <>
                        <td><strong>{row.patient}</strong></td>
                        <td>{row.condition}</td>
                        <td>{row.sessions}</td>
                        <td>
                          <div className="rpt-progress-cell">
                            <div className="rpt-progress-bar"><div className="rpt-progress-fill" style={{ width: `${row.progress}%` }} /></div>
                            <span>{row.progress}%</span>
                          </div>
                        </td>
                        <td><span className={`rpt-status ${STATUS_CLASS[row.status]}`}>{row.status}</span></td>
                      </>}
                      {reportType === 'sessions' && <>
                        <td><strong>{row.month}</strong></td>
                        <td>{row.total}</td>
                        <td>{row.completed}</td>
                        <td>{row.cancelled}</td>
                        <td>{row.avgDuration}</td>
                      </>}
                      {reportType === 'exercise' && <>
                        <td><strong>{row.patient}</strong></td>
                        <td>{row.exercise}</td>
                        <td>{row.assigned}</td>
                        <td>{row.completed}</td>
                        <td>
                          <div className="rpt-progress-cell">
                            <div className="rpt-progress-bar"><div className="rpt-progress-fill" style={{ width: `${row.accuracy}%` }} /></div>
                            <span>{row.accuracy}%</span>
                          </div>
                        </td>
                        <td><span className={`rpt-status ${STATUS_CLASS[row.status]}`}>{row.status}</span></td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      {toast && <div className="rpt-toast">{toast}</div>}
    </TherapistPageShell>
  )
}

function KPITile({ label, value, color, icon }) {
  return (
    <div className={`rpt-kpi rpt-kpi-${color}`}>
      <div className="rpt-kpi-top">
        <span className="rpt-kpi-icon">{icon}</span>
        <div className="rpt-kpi-text">
          <span className="rpt-kpi-val">{value}</span>
          <span className="rpt-kpi-lbl">{label}</span>
        </div>
      </div>
      <svg className="rpt-kpi-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,26 C22,12 40,34 64,24 C88,14 108,32 132,22 C156,12 178,30 200,20 L200,40 L0,40 Z" fill="currentColor" />
      </svg>
    </div>
  )
}

function PDFIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8 17h8v1.5H8V17zm0-3h8v1.5H8V14zm0-3h4v1.5H8V11z"/>
    </svg>
  )
}

function ExcelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM7 12l2.5 3.5L7 19h1.8l1.7-2.5L12.2 19H14l-2.5-3.5L14 12h-1.8l-1.5 2.3L9.2 12H7z"/>
    </svg>
  )
}
