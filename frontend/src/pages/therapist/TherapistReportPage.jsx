import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Info, RotateCcw, Search, X } from 'lucide-react'
import TherapistPageShell from './TherapistPageShell'
import { getTherapistMenuItems } from './therapistSidebarConfig'
import { authFetch } from '../../utils/session'
import { ChartBody } from './reports/ReportChart.jsx'
import { KpiTile } from './reports/KpiTile.jsx'
import ExportPreview from './reports/ExportPreview.jsx'
import PatientReportView from './reports/PatientReportView.jsx'
import { fmtCell } from './reports/exportReport'
import { PRESETS, REPORT_TYPES, STATUS_CLASS, THERAPY_TYPES, VIEWS, presetRange } from './reports/config.jsx'
import './TherapistReportPage.css'

const PAGE = 20
const BAR_KEYS = new Set(['progress', 'accuracy'])

function Cell({ k, row }) {
  const v = row[k]
  if (k === 'status' || k === 'payment') return <span className={`rpt-status ${STATUS_CLASS[v] || ''}`} title={row.why || undefined}>{v}</span>
  if (BAR_KEYS.has(k) && v != null) return <div className="rpt-progress-cell"><div className="rpt-progress-bar"><div className="rpt-progress-fill" style={{ width: `${v}%` }} /></div><span>{v}%</span></div>
  if (k === 'change' && v != null) return <span className={v < 0 ? 'rpt-neg' : 'rpt-pos'}>{v > 0 ? '+' : ''}{v} pts</span>
  if (k === 'patient') return <strong>{v}</strong>
  return fmtCell(k, v)
}

function PatientPicker({ patients, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [open])
  const cur = patients.find((p) => p.id === value)
  const list = patients.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="rpt-pick" ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      <button type="button" className="rpt-select-btn" aria-haspopup="listbox" aria-expanded={open} aria-label="Patient" onClick={() => setOpen((o) => !o)}>{cur ? cur.name : 'All patients'}</button>
      {open && (
        <div className="rpt-pick-menu">
          <label className="rpt-pick-search"><Search size={15} aria-hidden="true" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients…" aria-label="Search patients" /></label>
          <ul role="listbox" aria-label="Patients">
            <li role="option" aria-selected={!value} className={!value ? 'on' : ''} onClick={() => { onChange(''); setOpen(false) }}>All patients</li>
            {list.map((p) => <li key={p.id} role="option" aria-selected={p.id === value} className={p.id === value ? 'on' : ''} onClick={() => { onChange(p.id); setOpen(false) }}>{p.name}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function TherapistReportPage({ user, onLogout, betaTier }) {
  const { id: routePatient } = useParams()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const type = routePatient ? 'patient' : (REPORT_TYPES.find((r) => r.id === sp.get('type'))?.id || 'appointments')
  const dflt = presetRange('month')
  const filters = useMemo(() => ({
    from: sp.get('from') || dflt.from, to: sp.get('to') || dflt.to, view: sp.get('view') || 'daily', patientId: routePatient || sp.get('patientId') || '',
    therapyType: sp.get('therapyType') || '', q: sp.get('q') || '', sort: sp.get('sort') || '', page: parseInt(sp.get('page'), 10) || 1,
  }), [sp, routePatient]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilters = useCallback((patch) => {
    setSp((cur) => {
      const next = new URLSearchParams(cur)
      Object.entries(patch).forEach(([k, v]) => { if (v === '' || v == null || v === 1 && k === 'page') next.delete(k); else next.set(k, String(v)) })
      if (!('page' in patch)) next.delete('page')
      return next
    }, { replace: true })
  }, [setSp])

  const [patients, setPatients] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(null)
  const [search, setSearch] = useState(filters.q)

  useEffect(() => { authFetch('/api/reports/patients').then((d) => setPatients(d.patients || [])).catch(() => {}) }, [])
  useEffect(() => { setSearch(filters.q) }, [filters.q])
  useEffect(() => {
    if (search === filters.q) return undefined
    const t = setTimeout(() => setFilters({ q: search }), 250)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    const query = { from: filters.from, to: filters.to, view: filters.view, patientId: filters.patientId, therapyType: filters.therapyType, q: filters.q, sort: filters.sort, page: filters.page, limit: PAGE }
    Object.keys(query).forEach((k) => { if (!query[k]) delete query[k] })
    authFetch(`/api/reports/${type}`, { query })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) { setData(null); setError(e.message || 'Could not load this report.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, filters.from, filters.to, filters.view, filters.patientId, filters.therapyType, filters.q, filters.sort, filters.page])

  const selected = REPORT_TYPES.find((r) => r.id === type)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2800) }
  const patientName = patients.find((p) => p.id === filters.patientId)?.name
  const filtersText = [`View: ${filters.view}`, `Patient: ${patientName || 'All'}`, `Therapy type: ${filters.therapyType || 'All'}`, filters.q ? `Search: "${filters.q}"` : null].filter(Boolean).join(' · ')
  const therapist = user?.name || user?.full_name || 'Therapist'

  const switchType = (id) => {
    const keep = {}; ;['from', 'to', 'view', 'patientId', 'therapyType'].forEach((k) => { if (sp.get(k)) keep[k] = sp.get(k) })
    if (routePatient) navigate(`/therapist/reports?${new URLSearchParams({ ...keep, type: id })}`)
    else setSp({ ...keep, type: id }, { replace: true })
  }
  const openPatient = (id) => navigate(`/therapist/reports/patient/${id}?${new URLSearchParams({ from: filters.from, to: filters.to, view: filters.view, back: type })}`)
  const backToReports = () => navigate(`/therapist/reports?${new URLSearchParams({ type: sp.get('back') || 'progress', from: filters.from, to: filters.to, view: filters.view })}`)
  const reset = () => setSp({ type }, { replace: true })

  const sortBy = (key) => {
    const [c, d] = filters.sort.split(':')
    setFilters({ sort: c === key && d === 'asc' ? `${key}:desc` : `${key}:asc` })
  }

  const tbl = data?.table
  const pages = tbl ? Math.max(1, Math.ceil(tbl.total / PAGE)) : 1
  const noData = data && type !== 'patient' && tbl.total === 0 && !filters.q

  return (
    <TherapistPageShell user={user} onLogout={onLogout} title="Reports" subtitle="Generate and export therapy reports" icon="" menuItems={getTherapistMenuItems(betaTier)}>
      <div className="rpt-layout">
        <div className="rpt-sidebar">
          <p className="rpt-sidebar-label">Report Type</p>
          <select className="rpt-type-select" value={type === 'patient' ? '' : type} onChange={(e) => switchType(e.target.value)} aria-label="Report type">
            {type === 'patient' && <option value="">Individual Patient Report</option>}
            {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {REPORT_TYPES.map((r) => (
            <button key={r.id} className={`rpt-type-btn ${type === r.id ? 'active' : ''}`} onClick={() => switchType(r.id)}>
              <span className="rpt-type-icon" style={{ background: r.tint, color: r.color }}><r.Icon size={18} aria-hidden="true" /></span>
              <span className="rpt-type-info"><span className="rpt-type-name">{r.label}</span><span className="rpt-type-desc">{r.desc}</span></span>
            </button>
          ))}
        </div>

        <div className="rpt-main">
          <div className="rpt-main-head">
            <div className="rpt-main-heading">
              <span className="rpt-main-title-icon" style={{ background: selected?.tint || '#e6f5f2', color: selected?.color || '#159a72' }}>{selected ? <selected.Icon size={20} aria-hidden="true" /> : <FileText size={20} aria-hidden="true" />}</span>
              <div>
                <h2 className="rpt-main-title">{selected?.label || 'Individual Patient Report'}</h2>
                <p className="rpt-main-sub">{selected?.headline || 'Progress, attendance, exercises and games for one patient'}</p>
              </div>
            </div>
            <div className="rpt-export-btns">
              {type !== 'patient' && <button className="rpt-btn rpt-btn-excel" onClick={() => setExporting('xlsx')} disabled={loading || !data}><FileSpreadsheet size={16} aria-hidden="true" /> Export Excel</button>}
              <button className="rpt-btn rpt-btn-pdf" onClick={() => setExporting('pdf')} disabled={loading || !data}><FileText size={16} aria-hidden="true" /> Export PDF</button>
            </div>
          </div>

          <div className="rpt-filters">
            <div className="rpt-filter-group">
              <label>Date Range</label>
              <div className="rpt-daterange-inputs">
                <input type="date" value={filters.from} max={filters.to} onChange={(e) => e.target.value && setFilters({ from: e.target.value })} aria-label="From" />
                <span className="rpt-daterange-sep">–</span>
                <input type="date" value={filters.to} min={filters.from} onChange={(e) => e.target.value && setFilters({ to: e.target.value })} aria-label="To" />
              </div>
              <div className="rpt-presets">{PRESETS.map(([id, l]) => <button key={id} type="button" onClick={() => setFilters(presetRange(id))}>{l}</button>)}</div>
            </div>
            <div className="rpt-filter-group">
              <label>View</label>
              <div className="rpt-granularity">
                {VIEWS.map(([id, l]) => <button key={id} type="button" className={`rpt-granularity-btn ${filters.view === id ? 'active' : ''}`} onClick={() => setFilters({ view: id })}>{l}</button>)}
              </div>
            </div>
            {type !== 'patient' && (
              <>
                <div className="rpt-filter-group"><label>Patient</label><PatientPicker patients={patients} value={filters.patientId} onChange={(v) => setFilters({ patientId: v })} /></div>
                <div className="rpt-filter-group">
                  <label>Therapy type</label>
                  <select className="rpt-select-btn" value={filters.therapyType || 'All'} onChange={(e) => setFilters({ therapyType: e.target.value === 'All' ? '' : e.target.value })} aria-label="Therapy type">
                    {THERAPY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="rpt-filter-meta">{tbl && <span className="rpt-count-pill">{tbl.total} record{tbl.total !== 1 ? 's' : ''} found</span>}</div>
          </div>

          {error && <div className="rpt-error-box" role="alert">{error}</div>}
          {loading && !data && <div className="rpt-loading">Loading report…</div>}

          {data && type === 'patient' && <PatientReportView key={data.patientId + data.header.from} data={data} onBack={backToReports} />}

          {data && type !== 'patient' && (
            <div className={loading ? 'rpt-fade' : ''}>
              <div className="rpt-kpi-row">{data.kpis.map((k) => <KpiTile key={k.key} k={k} />)}</div>
              {data.summary && <p className="rpt-summary">{data.summary}</p>}
              {data.notice && <p className="rpt-notice"><Info size={15} aria-hidden="true" /> {data.notice}</p>}

              {noData ? (
                <div className="rpt-empty"><p>No data for these filters</p><button type="button" className="rpt-btn rpt-btn-pdf" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Reset filters</button></div>
              ) : (
                <>
                  <div className="rpt-charts-row">
                    {[data.charts.primary, data.charts.secondary].map((c, i) => (
                      <div className="rpt-chart-card" key={c.title} data-chart={i}><div className="rpt-chart-head"><p className="rpt-chart-title">{c.title}</p></div><ChartBody chart={c} /></div>
                    ))}
                  </div>

                  {data.info && (
                    <div className="rpt-info-row">
                      <div><b>Busiest day</b><span>{data.info.busiestDay ? `${data.info.busiestDay.label} (${data.info.busiestDay.count})` : '—'}</span></div>
                      <div><b>Busiest time</b><span>{data.info.busiestSlot ? `${data.info.busiestSlot.label} (${data.info.busiestSlot.count})` : '—'}</span></div>
                      <div><b>In-person / Online</b><span>{data.info.inPerson} / {data.info.online}</span></div>
                      <div><b>Top cancellation reasons</b><span>{data.info.reasons.length ? data.info.reasons.map((r) => `${r.label} (${r.count})`).join(', ') : '—'}</span></div>
                    </div>
                  )}
                  {data.hardest && data.hardest.length > 0 && (
                    <div className="rpt-hardest"><h4>Hardest exercises</h4><ol>{data.hardest.map((h) => <li key={h.name}><span>{h.name}</span><b>{h.accuracy}%</b><small>{h.plays} play{h.plays === 1 ? '' : 's'}</small></li>)}</ol></div>
                  )}

                  <div className="rpt-table-tools">
                    <label className="rpt-tsearch"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this table…" aria-label="Search table" />{search && <button type="button" onClick={() => { setSearch(''); setFilters({ q: '' }) }} aria-label="Clear search"><X size={15} /></button>}</label>
                  </div>
                  <div className="rpt-table-wrap">
                    {tbl.total === 0 ? <div className="rpt-empty"><p>No records found for the selected filters.</p></div> : (
                      <table className="rpt-table">
                        <thead>
                          <tr>{data.cols.map(([k, l]) => {
                            const [c, d] = filters.sort.split(':')
                            return <th key={k} aria-sort={c === k ? (d === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="rpt-th" onClick={() => sortBy(k)}>{l}{c === k && (d === 'asc' ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />)}</button></th>
                          })}</tr>
                        </thead>
                        <tbody>
                          {tbl.rows.map((row) => (
                            <tr key={row.id} className={row.patientId ? 'rpt-row-link' : ''} onClick={() => row.patientId && openPatient(row.patientId)}>
                              {data.cols.map(([k, l]) => <td key={k} data-label={l}><Cell k={k} row={row} /></td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {tbl.total > PAGE && (
                    <div className="rpt-pager">
                      <button type="button" onClick={() => setFilters({ page: filters.page - 1 })} disabled={filters.page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
                      <span>Page {filters.page} of {pages}</span>
                      <button type="button" onClick={() => setFilters({ page: filters.page + 1 })} disabled={filters.page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {exporting && (
        <ExportPreview
          format={exporting} type={type} label={selected?.label || 'Individual Patient Report'} filters={filters} filtersText={filtersText} therapist={therapist}
          patientMode={type === 'patient'} data={data} onClose={() => setExporting(null)} onDone={(m) => { setExporting(null); showToast(m) }}
        />
      )}
      {toast && <div className="rpt-toast">{toast}</div>}
    </TherapistPageShell>
  )
}
