import { useState, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { logActivity } from '../../utils/auditLog'
import './TherapistReportPage.css'

// ── Static demo data ────────────────────────────────────────────────────────
const APPOINTMENTS_DATA = [
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

const REPORT_TYPES = [
  { id: 'appointments', label: 'Appointments Report',   icon: '📅', desc: 'All scheduled and completed appointments' },
  { id: 'progress',     label: 'Patient Progress Report', icon: '📈', desc: 'Per-patient session progress and status' },
  { id: 'sessions',     label: 'Session Summary Report',  icon: '📊', desc: 'Monthly session counts and completion rates' },
]

const COLS = {
  appointments: ['Date', 'Patient', 'Therapy Type', 'Status', 'Duration'],
  progress:     ['Patient', 'Condition', 'Sessions', 'Progress (%)', 'Status'],
  sessions:     ['Month', 'Total', 'Completed', 'Cancelled', 'Avg Duration'],
}

function rowsFor(type, data) {
  if (type === 'appointments') return data.map(r => [r.date, r.patient, r.type, r.status, r.duration])
  if (type === 'progress')     return data.map(r => [r.patient, r.condition, r.sessions, `${r.progress}%`, r.status])
  if (type === 'sessions')     return data.map(r => [r.month, r.total, r.completed, r.cancelled, r.avgDuration])
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function TherapistReportPage({ user, onLogout, betaTier }) {
  const [reportType, setReportType] = useState('appointments')
  const [dateRange, setDateRange] = useState({ from: '2026-07-01', to: '2026-07-31' })
  const [toast, setToast] = useState('')

  const rawData = useMemo(() => {
    if (reportType === 'appointments') {
      return APPOINTMENTS_DATA.filter(r => r.date >= dateRange.from && r.date <= dateRange.to)
    }
    if (reportType === 'progress') return PROGRESS_DATA
    return SESSION_DATA
  }, [reportType, dateRange])

  const cols = COLS[reportType]
  const rows = rowsFor(reportType, rawData)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const selected = REPORT_TYPES.find(r => r.id === reportType)

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
              <span className="rpt-type-icon">{r.icon}</span>
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
            <div>
              <h2 className="rpt-main-title">{selected?.icon} {selected?.label}</h2>
              <p className="rpt-main-sub">{selected?.desc}</p>
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
                <label>From</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} />
              </div>
              <div className="rpt-filter-group">
                <label>To</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} />
              </div>
              <div className="rpt-filter-meta">
                <span className="rpt-count-pill">{rawData.length} record{rawData.length !== 1 ? 's' : ''} found</span>
              </div>
            </div>
          )}

          {/* Summary KPIs */}
          <div className="rpt-kpi-row">
            {reportType === 'appointments' && <>
              <KPITile label="Total"     value={rawData.length} color="teal" />
              <KPITile label="Confirmed" value={rawData.filter(r=>r.status==='Confirmed').length} color="green" />
              <KPITile label="Completed" value={rawData.filter(r=>r.status==='Completed').length} color="blue" />
              <KPITile label="Cancelled" value={rawData.filter(r=>r.status==='Cancelled').length} color="red" />
            </>}
            {reportType === 'progress' && <>
              <KPITile label="Patients"        value={rawData.length} color="teal" />
              <KPITile label="On Track"        value={rawData.filter(r=>r.status==='On Track').length} color="green" />
              <KPITile label="Needs Attention" value={rawData.filter(r=>r.status==='Needs Attention').length} color="amber" />
              <KPITile label="Critical"        value={rawData.filter(r=>r.status==='Critical').length} color="red" />
            </>}
            {reportType === 'sessions' && <>
              <KPITile label="Months Covered" value={rawData.length} color="teal" />
              <KPITile label="Total Sessions" value={rawData.reduce((s,r)=>s+r.total,0)} color="blue" />
              <KPITile label="Completed"      value={rawData.reduce((s,r)=>s+r.completed,0)} color="green" />
              <KPITile label="Cancelled"      value={rawData.reduce((s,r)=>s+r.cancelled,0)} color="red" />
            </>}
          </div>

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

function KPITile({ label, value, color }) {
  return (
    <div className={`rpt-kpi rpt-kpi-${color}`}>
      <span className="rpt-kpi-val">{value}</span>
      <span className="rpt-kpi-lbl">{label}</span>
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
