import { useState, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import OwnerPageShell from './OwnerPageShell'
import { getOwnerMenuItems } from './ownerSidebarConfig'
import { Sparkline, TrendChart, BreakdownChart } from './ReportCharts'
import { logActivity } from '../../utils/auditLog'
import './OwnerReportsPage.css'

const fmtPeso = (n) => `₱${n.toLocaleString()}`
const fmtPct = (n) => `${Math.round(n)}%`
const fmtNum = (n) => n.toLocaleString()

const MONTHS = ['Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026']
const BRANCHES = ['Main', 'North', 'Cebu']

const REPORT_COLORS = {
  revenue: '#2a9d8f',
  attendance: '#3b82f6',
  growth: '#16a34a',
  service: '#8b5cf6',
  retention: '#f59e0b',
  efficiency: '#ec4899',
}

// ── Monthly Revenue ──────────────────────────────────────────
const REVENUE_DATA = [
  { month: 'Feb 2026', gross: 62000, paid: 57800, outstanding: 4200, growth: '—' },
  { month: 'Mar 2026', gross: 68000, paid: 63500, outstanding: 4500, growth: '+9.7%' },
  { month: 'Apr 2026', gross: 71000, paid: 66900, outstanding: 4100, growth: '+4.4%' },
  { month: 'May 2026', gross: 75000, paid: 70200, outstanding: 4800, growth: '+5.6%' },
  { month: 'Jun 2026', gross: 80000, paid: 74600, outstanding: 5400, growth: '+6.7%' },
  { month: 'Jul 2026', gross: 86000, paid: 78900, outstanding: 7100, growth: '+7.5%' },
]
const totalGross = REVENUE_DATA.reduce((s, r) => s + r.gross, 0)
const totalPaid = REVENUE_DATA.reduce((s, r) => s + r.paid, 0)
const totalOutstanding = REVENUE_DATA.reduce((s, r) => s + r.outstanding, 0)

// ── Attendance Rate (mirrors Staff page roster) ─────────────
const ATTENDANCE_DATA = [
  { name: 'Marco Reyes', branch: 'Main', present: 21, late: 1, absent: 1 },
  { name: 'Jade Tan', branch: 'North', present: 17, late: 0, absent: 3 },
  { name: 'Andre Lim', branch: 'Cebu', present: 22, late: 0, absent: 0 },
  { name: 'Carmen Dizon', branch: 'Main', present: 20, late: 2, absent: 0 },
  { name: 'Paolo Ramos', branch: 'North', present: 19, late: 1, absent: 2 },
  { name: 'Grace Uy', branch: 'Cebu', present: 22, late: 0, absent: 0 },
].map((s) => {
  const total = s.present + s.late + s.absent
  const rate = total ? Math.round(((s.present + s.late * 0.5) / total) * 100) : 100
  return { ...s, rate }
})
const avgAttendance = Math.round(ATTENDANCE_DATA.reduce((s, r) => s + r.rate, 0) / ATTENDANCE_DATA.length)
const ATTENDANCE_TREND = [89, 90, 92, 93, 93, avgAttendance]

// ── Patient Growth ───────────────────────────────────────────
const GROWTH_DATA = [
  { month: 'Feb 2026', newPatients: 15, total: 198, growth: '—' },
  { month: 'Mar 2026', newPatients: 15, total: 213, growth: '+7.6%' },
  { month: 'Apr 2026', newPatients: 9, total: 222, growth: '+4.2%' },
  { month: 'May 2026', newPatients: 12, total: 234, growth: '+5.4%' },
  { month: 'Jun 2026', newPatients: 10, total: 244, growth: '+4.3%' },
  { month: 'Jul 2026', newPatients: 18, total: 262, growth: '+7.4%' },
]
const totalPatients = GROWTH_DATA[GROWTH_DATA.length - 1].total
const newThisMonth = GROWTH_DATA[GROWTH_DATA.length - 1].newPatients

// ── Service Popularity ───────────────────────────────────────
const SERVICE_BOOKINGS = {
  'Speech Therapy': { Main: 34, North: 21, Cebu: 18 },
  'Occupational Therapy': { Main: 22, North: 26, Cebu: 14 },
  'Physical Therapy': { Main: 15, North: 19, Cebu: 12 },
  'Behavior Therapy': { Main: 12, North: 9, Cebu: 16 },
  'Developmental Therapy': { Main: 10, North: 14, Cebu: 8 },
  Psychology: { Main: 8, North: 6, Cebu: 11 },
}
const SERVICE_POPULARITY_DATA = Object.entries(SERVICE_BOOKINGS).flatMap(([service, byBranch]) =>
  BRANCHES.map((branch) => ({ service, branch, bookings: byBranch[branch] }))
)
const totalBookings = SERVICE_POPULARITY_DATA.reduce((s, r) => s + r.bookings, 0)
const SERVICE_TREND = [210, 228, 241, 252, 265, totalBookings]

// ── Retention / Churn ─────────────────────────────────────────
const RETENTION_DATA = MONTHS.map((month, i) => {
  const retained = [182, 196, 205, 214, 224, 236][i]
  const lost = [14, 12, 10, 11, 9, 8][i]
  return { month, retained, lost, rate: Math.round((retained / (retained + lost)) * 100) }
})

// ── Staff Efficiency (session completion rate) ───────────────
const STAFF_EFFICIENCY_DATA = [
  { name: 'Marco Reyes', branch: 'Main', scheduled: 26, completed: 24 },
  { name: 'Jade Tan', branch: 'North', scheduled: 20, completed: 17 },
  { name: 'Andre Lim', branch: 'Cebu', scheduled: 22, completed: 22 },
  { name: 'Carmen Dizon', branch: 'Main', scheduled: 22, completed: 20 },
  { name: 'Paolo Ramos', branch: 'North', scheduled: 21, completed: 18 },
  { name: 'Grace Uy', branch: 'Cebu', scheduled: 22, completed: 21 },
].map((s) => ({ ...s, rate: Math.round((s.completed / s.scheduled) * 100) }))
const avgEfficiency = Math.round(STAFF_EFFICIENCY_DATA.reduce((s, r) => s + r.rate, 0) / STAFF_EFFICIENCY_DATA.length)
const STAFF_EFFICIENCY_TREND = [86, 87, 89, 90, 91, avgEfficiency]

const REVENUE_STATS = [
  { icon: 'coins', color: 'blue', value: fmtPeso(totalGross), label: 'Total Collected (6mo)' },
  { icon: 'check', color: 'green', value: fmtPeso(totalPaid), label: 'Paid' },
  { icon: 'clock', color: 'amber', value: fmtPeso(totalOutstanding), label: 'Outstanding' },
  { icon: 'trend', color: 'purple', value: REVENUE_DATA[REVENUE_DATA.length - 1].growth, label: 'Latest Growth' },
]
const PEOPLE_STATS = [
  { icon: 'people', color: 'pink', value: totalPatients, label: 'Total Patients' },
  { icon: 'chart', color: 'blue', value: `${avgAttendance}%`, label: 'Avg Staff Attendance' },
  { icon: 'calendar', color: 'indigo', value: newThisMonth, label: 'New Patients This Month' },
  { icon: 'staff', color: 'green', value: ATTENDANCE_DATA.length, label: 'Total Staff' },
]

// ── Unified report definitions ───────────────────────────────
// type 'monthly'  -> rows are one-per-month; date range slices rows directly
// type 'snapshot' -> rows are one-per-entity; date range only trims the trend chart,
//                    branch/staff filters trim the rows + breakdown chart
const REPORTS = [
  {
    id: 'revenue', icon: '💰', title: 'Revenue Report',
    detail: 'Export all monthly revenue transactions.',
    type: 'monthly', valueFormatter: fmtPeso,
    months: MONTHS, trend: REVENUE_DATA.map((r) => r.gross),
    statLabel: 'Months Covered', statValue: REVENUE_DATA.length,
    cols: ['Month', 'Gross Sales', 'Paid', 'Outstanding', 'Growth'],
    rows: REVENUE_DATA,
    toRow: (r) => [r.month, fmtPeso(r.gross), fmtPeso(r.paid), fmtPeso(r.outstanding), r.growth],
    filters: [],
  },
  {
    id: 'attendance', icon: '🕒', title: 'Attendance Report',
    detail: 'Export monthly staff attendance records.',
    type: 'snapshot', valueFormatter: fmtPct,
    months: MONTHS, trend: ATTENDANCE_TREND,
    statLabel: 'Staff Tracked', statValue: ATTENDANCE_DATA.length,
    cols: ['Staff', 'Branch', 'Present', 'Late', 'Absent', 'Rate'],
    rows: ATTENDANCE_DATA,
    toRow: (r) => [r.name, r.branch, r.present, r.late, r.absent, `${r.rate}%`],
    filters: ['branch', 'staff'],
    entityKey: 'name', entityValueKey: 'rate',
  },
  {
    id: 'growth', icon: '📈', title: 'Patient Growth Report',
    detail: 'Export new patient intake and roster growth.',
    type: 'monthly', valueFormatter: fmtNum,
    months: MONTHS, trend: GROWTH_DATA.map((r) => r.total),
    statLabel: 'Roster Today', statValue: totalPatients,
    cols: ['Month', 'New Patients', 'Total Roster', 'Growth'],
    rows: GROWTH_DATA,
    toRow: (r) => [r.month, r.newPatients, r.total, r.growth],
    filters: [],
  },
  {
    id: 'service', icon: '🧩', title: 'Service Popularity Report',
    detail: 'See which therapy services are most requested.',
    type: 'snapshot', valueFormatter: fmtNum,
    months: MONTHS, trend: SERVICE_TREND,
    statLabel: 'Total Bookings', statValue: totalBookings,
    cols: ['Service', 'Branch', 'Bookings'],
    rows: SERVICE_POPULARITY_DATA,
    toRow: (r) => [r.service, r.branch, r.bookings],
    filters: ['branch'],
    entityKey: 'service', entityValueKey: 'bookings',
  },
  {
    id: 'retention', icon: '🔁', title: 'Retention Rate Report',
    detail: 'Track patient retention versus churn over time.',
    type: 'monthly', valueFormatter: fmtPct,
    months: MONTHS, trend: RETENTION_DATA.map((r) => r.rate),
    statLabel: 'Latest Rate', statValue: `${RETENTION_DATA[RETENTION_DATA.length - 1].rate}%`,
    cols: ['Month', 'Retained', 'Lost', 'Rate'],
    rows: RETENTION_DATA,
    toRow: (r) => [r.month, r.retained, r.lost, `${r.rate}%`],
    filters: [],
  },
  {
    id: 'efficiency', icon: '⚙️', title: 'Staff Efficiency Report',
    detail: 'Session completion rate per therapist.',
    type: 'snapshot', valueFormatter: fmtPct,
    months: MONTHS, trend: STAFF_EFFICIENCY_TREND,
    statLabel: 'Avg Completion', statValue: `${avgEfficiency}%`,
    cols: ['Staff', 'Branch', 'Scheduled', 'Completed', 'Rate'],
    rows: STAFF_EFFICIENCY_DATA,
    toRow: (r) => [r.name, r.branch, r.scheduled, r.completed, `${r.rate}%`],
    filters: ['branch', 'staff'],
    entityKey: 'name', entityValueKey: 'rate',
  },
]

// ── Export helpers ────────────────────────────────────────────
function csvStringFor(cols, rows) {
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows])
  return XLSX.utils.sheet_to_csv(ws)
}

function buildPDFDoc(title, cols, rows) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(18)
  doc.setTextColor(44, 74, 62)
  doc.text('TherapyPro – ' + title, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26)
  autoTable(doc, {
    head: [cols], body: rows, startY: 32,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [74, 107, 93], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    margin: { left: 14, right: 14 },
  })
  return doc
}

function buildCombinedPDFDoc(reports) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(18)
  doc.setTextColor(44, 74, 62)
  doc.text('TherapyPro – Full Report', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26)
  let startY = 32
  reports.forEach((r) => {
    if (startY > 170) { doc.addPage(); startY = 20 }
    doc.setFontSize(13)
    doc.setTextColor(44, 74, 62)
    doc.text(r.title, 14, startY)
    autoTable(doc, {
      head: [r.cols], body: r.rows.map(r.toRow), startY: startY + 4,
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [74, 107, 93], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 250, 248] },
      margin: { left: 14, right: 14 },
    })
    startY = doc.lastAutoTable.finalY + 14
  })
  return doc
}

function downloadAndRecord(blob, filename, title, format, setDownloads) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setDownloads((prev) => {
    const next = [{ id: `${Date.now()}-${Math.random()}`, filename, title, format, timestamp: new Date(), url }, ...prev]
    if (next.length > 8) {
      next.slice(8).forEach((d) => URL.revokeObjectURL(d.url))
      return next.slice(0, 8)
    }
    return next
  })
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return date.toLocaleDateString()
}

/* ── Drill-down modal ─────────────────────────────────────── */
function DrilldownModal({ report, onClose, onExport }) {
  const color = REPORT_COLORS[report.id]
  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx] = useState(report.months.length - 1)
  const [branch, setBranch] = useState('All')
  const [staff, setStaff] = useState('All')

  const staffOptions = useMemo(() => {
    if (!report.filters.includes('staff')) return []
    return [...new Set(report.rows.map((r) => r[report.entityKey]))]
  }, [report])

  const filteredMonths = report.months.slice(fromIdx, toIdx + 1)
  const filteredTrend = report.trend.slice(fromIdx, toIdx + 1)

  const filteredRows = useMemo(() => {
    if (report.type === 'monthly') return report.rows.slice(fromIdx, toIdx + 1)
    return report.rows.filter((r) => {
      const matchBranch = branch === 'All' || r.branch === branch
      const matchStaff = staff === 'All' || r[report.entityKey] === staff
      return matchBranch && matchStaff
    })
  }, [report, fromIdx, toIdx, branch, staff])

  const handleCSV = () => {
    const csv = csvStringFor(report.cols, filteredRows.map(report.toRow))
    downloadAndRecord(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${report.id}-filtered.csv`, report.title, 'CSV', onExport)
  }
  const handlePDF = () => {
    const doc = buildPDFDoc(report.title, report.cols, filteredRows.map(report.toRow))
    downloadAndRecord(doc.output('blob'), `${report.id}-filtered.pdf`, report.title, 'PDF', onExport)
  }

  return (
    <div className="orp-modal-backdrop" onClick={onClose}>
      <div className="orp-modal orp-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="orp-modal-header">
          <div>
            <h3>{report.icon} {report.title}</h3>
            <p>{report.detail}</p>
          </div>
          <button className="orp-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="orp-modal-body">
          <div className="orp-filter-row">
            <div className="orp-filter-group">
              <label>From</label>
              <select value={fromIdx} onChange={(e) => setFromIdx(Math.min(Number(e.target.value), toIdx))}>
                {report.months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="orp-filter-group">
              <label>To</label>
              <select value={toIdx} onChange={(e) => setToIdx(Math.max(Number(e.target.value), fromIdx))}>
                {report.months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            {report.filters.includes('branch') && (
              <div className="orp-filter-group">
                <label>Branch</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="All">All Branches</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            {report.filters.includes('staff') && (
              <div className="orp-filter-group">
                <label>Staff</label>
                <select value={staff} onChange={(e) => setStaff(e.target.value)}>
                  <option value="All">All Staff</option>
                  {staffOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <p className="orp-chart-caption">Trend — {filteredMonths[0]} to {filteredMonths[filteredMonths.length - 1]}</p>
          <TrendChart months={filteredMonths} trend={filteredTrend} color={color} valueFormatter={report.valueFormatter} />

          {report.type === 'snapshot' && (
            filteredRows.length === 0 ? (
              <div className="orp-empty-state">No data available for the selected filters.</div>
            ) : (
              <>
                <p className="orp-chart-caption">Breakdown by {report.entityKey === 'name' ? 'staff' : report.entityKey}</p>
                <BreakdownChart
                  labels={filteredRows.map((r) => r[report.entityKey])}
                  values={filteredRows.map((r) => r[report.entityValueKey])}
                  color={color}
                  valueFormatter={report.valueFormatter}
                />
              </>
            )
          )}

          {filteredRows.length === 0 && report.type === 'monthly' ? (
            <div className="orp-empty-state">No data available for the selected range.</div>
          ) : (
            <div className="orp-table-wrap">
              <div className="orp-table-scroll">
                <table className="orp-table">
                  <thead><tr>{report.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {filteredRows.map(report.toRow).map((row, i) => (
                      <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="orp-card-actions" style={{ marginTop: 16 }}>
            <button className="orp-btn orp-btn-csv" onClick={handleCSV} disabled={filteredRows.length === 0}>CSV</button>
            <button className="orp-btn orp-btn-pdf" onClick={handlePDF} disabled={filteredRows.length === 0}>PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Custom Report Builder ────────────────────────────────── */
function CustomReportBuilder({ onExport }) {
  const [selected, setSelected] = useState(['revenue', 'attendance', 'growth'])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const chosen = REPORTS.filter((r) => selected.includes(r.id))

  const handleCSV = () => {
    const sections = chosen.map((r) => `${r.title}\n${csvStringFor(r.cols, r.rows.map(r.toRow))}`)
    downloadAndRecord(new Blob([sections.join('\n\n')], { type: 'text/csv;charset=utf-8;' }), 'custom-report.csv', 'Custom Report', 'CSV', onExport)
  }
  const handlePDF = () => {
    const doc = buildCombinedPDFDoc(chosen)
    downloadAndRecord(doc.output('blob'), 'custom-report.pdf', 'Custom Report', 'PDF', onExport)
  }

  return (
    <div className="orp-fullexport-card">
      <div className="orp-fullexport-head">
        <span className="orp-card-head-icon">🛠️</span>
        <h3 className="orp-fullexport-title">Custom Report Builder</h3>
      </div>
      <p className="orp-fullexport-detail">Pick the metrics to combine into a single file — mix staff performance, revenue, or any report above.</p>
      <div className="orp-checkbox-row">
        {REPORTS.map((r) => (
          <label key={r.id} className={`orp-checkbox-chip ${selected.includes(r.id) ? 'checked' : ''}`}>
            <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
            {r.icon} {r.title}
          </label>
        ))}
      </div>
      {selected.length === 0 && <p className="orp-hint">Select at least one metric to generate a report.</p>}
      <div className="orp-fullexport-actions">
        <button className="orp-btn-lg orp-btn-csv-lg" disabled={selected.length === 0} onClick={handleCSV}>Generate CSV</button>
        <button className="orp-btn-lg orp-btn-pdf-lg" disabled={selected.length === 0} onClick={handlePDF}>Generate PDF</button>
      </div>
    </div>
  )
}

/* ── Scheduled Reports (local demo — no backend/email wired up) ── */
function ScheduledReports() {
  const [schedules, setSchedules] = useState([])
  const [reportId, setReportId] = useState(REPORTS[0].id)
  const [frequency, setFrequency] = useState('Monthly')
  const [day, setDay] = useState('1')
  const [email, setEmail] = useState('')

  const addSchedule = () => {
    if (!email.trim()) return
    setSchedules((prev) => [
      { id: Date.now(), reportId, frequency, day, email: email.trim(), active: true },
      ...prev,
    ])
    setEmail('')
  }

  const toggleActive = (id) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)))
  }
  const remove = (id) => setSchedules((prev) => prev.filter((s) => s.id !== id))

  const dayOptions = frequency === 'Weekly'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : Array.from({ length: 28 }, (_, i) => String(i + 1))

  return (
    <div className="orp-fullexport-card">
      <div className="orp-fullexport-head">
        <span className="orp-card-head-icon">⏰</span>
        <h3 className="orp-fullexport-title">Scheduled Reports</h3>
      </div>
      <p className="orp-fullexport-detail">Automatically generate a report on a recurring schedule and email it to yourself or your team.</p>

      <div className="orp-schedule-form">
        <div className="orp-filter-group">
          <label>Report</label>
          <select value={reportId} onChange={(e) => setReportId(e.target.value)}>
            {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </div>
        <div className="orp-filter-group">
          <label>Frequency</label>
          <select value={frequency} onChange={(e) => { setFrequency(e.target.value); setDay(e.target.value === 'Weekly' ? 'Mon' : '1') }}>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
        <div className="orp-filter-group">
          <label>{frequency === 'Weekly' ? 'Day' : 'Day of Month'}</label>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="orp-filter-group orp-filter-grow">
          <label>Email</label>
          <input type="email" placeholder="owner@therapypro.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="orp-btn orp-btn-add-schedule" onClick={addSchedule} disabled={!email.trim()}>+ Add Schedule</button>
      </div>

      {schedules.length > 0 && (
        <ul className="orp-schedule-list">
          {schedules.map((s) => {
            const r = REPORTS.find((x) => x.id === s.reportId)
            return (
              <li key={s.id} className="orp-schedule-row">
                <span className="orp-schedule-desc">
                  <strong>{r?.title}</strong> — {s.frequency} on {s.frequency === 'Weekly' ? s.day : `day ${s.day}`} → {s.email}
                </span>
                <div className="orp-schedule-controls">
                  <label className="orp-toggle">
                    <input type="checkbox" checked={s.active} onChange={() => toggleActive(s.id)} />
                    <span>{s.active ? 'Active' : 'Paused'}</span>
                  </label>
                  <button className="orp-icon-btn-sm" onClick={() => remove(s.id)} aria-label="Remove schedule">✕</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="orp-hint">Demo simulation — schedules are stored locally in this session only. Connect a backend job and email service to send these automatically.</p>
    </div>
  )
}

/* ── Recent Downloads ─────────────────────────────────────── */
function RecentDownloads({ downloads }) {
  if (downloads.length === 0) return null
  return (
    <div className="orp-fullexport-card">
      <div className="orp-fullexport-head">
        <span className="orp-card-head-icon">🗂️</span>
        <h3 className="orp-fullexport-title">Recent Downloads</h3>
      </div>
      <ul className="orp-downloads-list">
        {downloads.map((d) => (
          <li key={d.id} className="orp-download-row">
            <span className={`orp-download-badge ${d.format === 'PDF' ? 'pdf' : 'csv'}`}>{d.format}</span>
            <div className="orp-download-info">
              <span className="orp-download-title">{d.title}</span>
              <span className="orp-download-time">{d.filename} · {timeAgo(d.timestamp)}</span>
            </div>
            <a className="orp-download-link" href={d.url} download={d.filename}>Download again</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function OwnerReportsPage({ user, onLogout, betaTier }) {
  const [toast, setToast] = useState('')
  const [viewing, setViewing] = useState(null)
  const [downloads, setDownloads] = useState([])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const logExport = (title, format) => {
    logActivity({
      role: 'Owner',
      user: user?.name || 'Owner',
      email: user?.email || '—',
      actionIcon: '📤',
      action: 'Report',
      description: `Exported ${title} as ${format}`,
      entity: `Report · ${title}`,
      status: 'Success',
    })
  }

  const handleCardCSV = (report) => {
    const csv = csvStringFor(report.cols, report.rows.map(report.toRow))
    downloadAndRecord(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${report.id}-report.csv`, report.title, 'CSV', setDownloads)
    showToast(`${report.title} exported as CSV`)
    logExport(report.title, 'CSV')
  }
  const handleCardPDF = (report) => {
    const doc = buildPDFDoc(report.title, report.cols, report.rows.map(report.toRow))
    downloadAndRecord(doc.output('blob'), `${report.id}-report.pdf`, report.title, 'PDF', setDownloads)
    showToast(`${report.title} exported as PDF`)
    logExport(report.title, 'PDF')
  }
  const handleFullCSV = () => {
    const sections = REPORTS.map((r) => `${r.title}\n${csvStringFor(r.cols, r.rows.map(r.toRow))}`)
    downloadAndRecord(new Blob([sections.join('\n\n')], { type: 'text/csv;charset=utf-8;' }), 'therapypro-full-report.csv', 'Full Report', 'CSV', setDownloads)
    showToast('Full report exported as CSV')
    logExport('Full Report', 'CSV')
  }
  const handleFullPDF = () => {
    const doc = buildCombinedPDFDoc(REPORTS)
    downloadAndRecord(doc.output('blob'), 'therapypro-full-report.pdf', 'Full Report', 'PDF', setDownloads)
    showToast('Full report exported as PDF')
    logExport('Full Report', 'PDF')
  }

  return (
    <OwnerPageShell
      user={user}
      onLogout={onLogout}
      title="Reports"
      subtitle="See performance summaries and trends"
      icon="📑"
      menuItems={getOwnerMenuItems(betaTier)}
    >
      <p className="orp-section-label">Revenue Overview</p>
      <div className="orp-stats-grid">
        {REVENUE_STATS.map((s) => (
          <div key={s.label} className="orp-stat-card">
            <div className={`orp-stat-icon ${s.color}`}><StatIcon name={s.icon} /></div>
            <div className="orp-stat-info">
              <span className="orp-stat-value">{s.value}</span>
              <span className="orp-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="orp-section-label">Patients &amp; Staff</p>
      <div className="orp-stats-grid">
        {PEOPLE_STATS.map((s) => (
          <div key={s.label} className="orp-stat-card">
            <div className={`orp-stat-icon ${s.color}`}><StatIcon name={s.icon} /></div>
            <div className="orp-stat-info">
              <span className="orp-stat-value">{s.value}</span>
              <span className="orp-stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="orp-section-label">Reports</p>
      <div className="orp-grid">
        {REPORTS.map((report) => (
          <section key={report.id} className="orp-card">
            <div className="orp-card-head">
              <span className="orp-card-head-icon">{report.icon}</span>
              <h3 className="orp-card-title">{report.title}</h3>
            </div>
            <p className="orp-card-detail">{report.detail}</p>

            <Sparkline trend={report.trend} color={REPORT_COLORS[report.id]} />

            <div className="orp-stat-row">
              <span className="orp-stat-row-label">{report.statLabel}</span>
              <span className="orp-stat-row-value">{report.statValue}</span>
            </div>

            <div className="orp-card-actions">
              <button className="orp-btn orp-btn-view" onClick={() => setViewing(report)}>View Report</button>
              <button className="orp-btn orp-btn-csv" onClick={() => handleCardCSV(report)}>CSV</button>
              <button className="orp-btn orp-btn-pdf" onClick={() => handleCardPDF(report)}>PDF</button>
            </div>
          </section>
        ))}
      </div>

      <div className="orp-fullexport-card">
        <div className="orp-fullexport-head">
          <span className="orp-card-head-icon">📤</span>
          <h3 className="orp-fullexport-title">Full Export</h3>
        </div>
        <p className="orp-fullexport-detail">Download a comprehensive report including revenue, attendance, patient growth, service popularity, retention, and staff efficiency.</p>
        <div className="orp-fullexport-actions">
          <button className="orp-btn-lg orp-btn-csv-lg" onClick={handleFullCSV}>Export Complete CSV</button>
          <button className="orp-btn-lg orp-btn-pdf-lg" onClick={handleFullPDF}>Export Complete PDF</button>
        </div>
      </div>

      <CustomReportBuilder onExport={setDownloads} />
      <ScheduledReports />
      <RecentDownloads downloads={downloads} />

      {viewing && (
        <DrilldownModal report={viewing} onClose={() => setViewing(null)} onExport={setDownloads} />
      )}

      {toast && <div className="orp-toast">{toast}</div>}
    </OwnerPageShell>
  )
}

function StatIcon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'coins':
      return <svg {...common}><circle cx="9" cy="9" r="6" /><path d="M14.5 8a6 6 0 1 1 0 8" /></svg>
    case 'check':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
    case 'trend':
      return <svg {...common}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
    case 'people':
      return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" /><path d="M16 5.2a3 3 0 0 1 0 5.8" /><path d="M21 20c0-2.8-1.8-5-4.5-5.7" /></svg>
    case 'chart':
      return <svg {...common}><path d="M4 19V9M10 19V5M16 19v-7M4 19h16" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    case 'staff':
      return <svg {...common}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" /></svg>
    default:
      return null
  }
}
