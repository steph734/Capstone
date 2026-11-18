import { useEffect, useRef, useState } from 'react'
import { TrendChart } from '../ReportCharts'
import { fetchTables } from './reportApi'
import { MODULE_DEFS } from './ReportModuleCard'
import { fmtMoney, fmtNumber, fmtRange } from './reportRange'

const GREEN = '#2E5E4E'

function cellText(col, row) {
  const v = row[col.key]
  if (v === null || v === undefined || v === '') return '—'
  switch (col.kind) {
    case 'money': return fmtMoney(v)
    case 'number': return fmtNumber(v)
    case 'pct': return `${v}%`
    case 'pct1': return `${v > 0 ? '+' : ''}${v}%`
    default: return String(v)
  }
}

// Closes on Esc and returns focus to whatever opened it.
function Modal({ title, subtitle, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.focus()
    return () => opener?.focus?.()
  }, [])
  return (
    <div className="orp-modal-backdrop" onClick={onClose}>
      <div className="orp-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <header className="orp-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="orp-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="orp-modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ── View report: the module's trend and the exact rows the CSV/PDF contain, for the selected range ── */
export function ReportViewModal({ def, mod, labels, range, query, busyKey, onExport, onClose }) {
  const [state, setState] = useState({ loading: true, error: '', table: null })

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ loading: true, error: '', table: null })
    fetchTables(def.key, query, ctrl.signal)
      .then((d) => setState({ loading: false, error: '', table: d.tables?.[0] || null }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ loading: false, error: err.message, table: null }) })
    return () => ctrl.abort()
  }, [def.key, query])

  const fmt = def.key === 'revenue' ? (v) => fmtMoney(v) : mod?.metricFormat === 'pct' ? (v) => `${v}%` : (v) => fmtNumber(v)
  const table = state.table
  const empty = !state.loading && !state.error && (!table || table.rows.length === 0)

  return (
    <Modal title={`${def.icon} ${def.title}`} subtitle={`${def.desc} · ${fmtRange(range.from, range.to)}`} onClose={onClose}>
      {mod?.series?.length > 0 && !mod.empty && (
        <div className="orp-modal-chart" role="img" aria-label={`${def.title} trend for ${fmtRange(range.from, range.to)}`}>
          <TrendChart months={labels?.length === mod.series.length ? labels : mod.series.map((_, i) => i + 1)} trend={mod.series} color={GREEN} valueFormatter={fmt} />
        </div>
      )}
      {state.loading && <p className="orp-hint">Loading rows…</p>}
      {state.error && <p className="orp-hint orp-error" role="alert">{state.error}</p>}
      {empty && <p className="orp-hint">No data for {fmtRange(range.from, range.to)}.</p>}
      {table && table.rows.length > 0 && (
        <div className="orp-table-wrap">
          <table className="orp-table">
            <thead><tr>{table.cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{table.cols.map((c) => <td key={c.key}>{cellText(c, r)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="orp-actions orp-modal-actions">
        {['csv', 'pdf'].map((f) => (
          <button key={f} type="button" className="orp-btn orp-btn-outline" disabled={empty || !!busyKey} onClick={() => onExport(def.key, f, def.title)}>
            {busyKey === `${def.key}:${f}` ? <span className="orp-spinner" aria-hidden="true" /> : f.toUpperCase()}
          </button>
        ))}
      </div>
    </Modal>
  )
}

/* ── Custom report builder: combine any modules into one file for the selected range ── */
export function CustomReportModal({ range, busyKey, onExport, onClose }) {
  const [selected, setSelected] = useState(['revenue', 'attendance', 'patient-growth'])
  const toggle = (k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const extra = `&modules=${selected.join(',')}`
  return (
    <Modal title="Custom report builder" subtitle={`Pick the metrics to combine into a single file · ${fmtRange(range.from, range.to)}`} onClose={onClose}>
      <div className="orp-checks" role="group" aria-label="Metrics to include">
        {MODULE_DEFS.map((d) => (
          <label key={d.key} className={`orp-check ${selected.includes(d.key) ? 'checked' : ''}`}>
            <input type="checkbox" checked={selected.includes(d.key)} onChange={() => toggle(d.key)} />
            <span aria-hidden="true">{d.icon}</span> {d.title}
          </label>
        ))}
      </div>
      {selected.length === 0 && <p className="orp-hint">Select at least one metric to generate a report.</p>}
      <div className="orp-actions orp-modal-actions">
        {['csv', 'pdf'].map((f) => (
          <button key={f} type="button" className="orp-btn orp-btn-primary" disabled={selected.length === 0 || !!busyKey} onClick={() => onExport('custom', f, 'Custom report', extra)}>
            {busyKey === `custom:${f}` ? <span className="orp-spinner light" aria-hidden="true" /> : `Generate ${f.toUpperCase()}`}
          </button>
        ))}
      </div>
    </Modal>
  )
}
