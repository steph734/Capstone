import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { authFetch } from '../../../utils/session'
import { buildPatientPdf, buildReportExcel, buildReportPdf } from './exportReport'

// Export preview: shows what will be exported (PDF preview, or a summary for Excel), with the "Anonymize patient names"
// checkbox. Downloading writes one audit-log row (report type, filters and format; never patient data).
export default function ExportPreview({ format, type, label, filters, filtersText, therapist, onClose, onDone, data, patientMode }) {
  const [anonymize, setAnonymize] = useState(false)
  const [state, setState] = useState({ loading: true, error: '', url: '', rows: [], total: 0 })
  const docRef = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    ;(async () => {
      setState((s) => ({ ...s, loading: true, error: '' }))
      try {
        if (patientMode) {
          const doc = await buildPatientPdf({ data, range: { from: filters.from, to: filters.to }, therapist, anonymize })
          docRef.current = doc
          objectUrl = URL.createObjectURL(doc.output('blob'))
          if (!cancelled) setState({ loading: false, error: '', url: objectUrl, rows: [], total: 0 })
          return
        }
        const q = { from: filters.from, to: filters.to, view: filters.view, patientId: filters.patientId, therapyType: filters.therapyType, q: filters.q }
        Object.keys(q).forEach((k) => { if (!q[k]) delete q[k] })
        const [rows, report] = await Promise.all([authFetch(`/api/reports/${type}/rows`, { query: q }), authFetch(`/api/reports/${type}`, { query: { ...q, limit: 1 } })])
        const args = { title: label, range: { from: filters.from, to: filters.to }, filtersText, therapist, kpis: report.kpis, charts: report.charts, extra: [report.summary, report.notice], cols: rows.cols, rows: rows.rows, anonymize }
        if (format === 'pdf') {
          const doc = await buildReportPdf(args)
          docRef.current = doc
          objectUrl = URL.createObjectURL(doc.output('blob'))
          if (!cancelled) setState({ loading: false, error: '', url: objectUrl, rows: rows.rows, total: rows.rows.length })
        } else {
          sheetRef.current = buildReportExcel(args)
          if (!cancelled) setState({ loading: false, error: '', url: '', rows: rows.rows, total: rows.rows.length })
        }
      } catch (e) { if (!cancelled) setState({ loading: false, error: e.message || 'Could not prepare the export.', url: '', rows: [], total: 0 }) }
    })()
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymize, format, type])

  const download = async () => {
    const name = `${patientMode ? 'patient-report' : `${type}-report`}-${filters.from}`
    if (format === 'pdf') docRef.current.save(`${name}.pdf`)
    else XLSX.writeFile(sheetRef.current, `${name}.xlsx`)
    try { await authFetch('/api/reports/export-log', { method: 'POST', body: { type: patientMode ? 'patient' : type, format: format === 'pdf' ? 'pdf' : 'xlsx', anonymized: anonymize, filters } }) } catch { /* the file is already saved */ }
    onDone(format === 'pdf' ? 'PDF exported successfully!' : 'Excel file exported successfully!')
  }

  return (
    <div className="rpt-modal-wrap" role="dialog" aria-modal="true" aria-label="Export preview" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rpt-modal">
        <div className="rpt-modal-head">
          <h3>{format === 'pdf' ? <FileText size={20} aria-hidden="true" /> : <FileSpreadsheet size={20} aria-hidden="true" />} Export {format === 'pdf' ? 'PDF' : 'Excel'}: {label}</h3>
          <button type="button" className="rpt-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label className="rpt-check"><input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} /> Anonymize patient names (Patient A, Patient B…) for research or sharing</label>
        <div className="rpt-modal-body">
          {state.loading && <p className="rpt-muted">Preparing the preview…</p>}
          {state.error && <p className="rpt-error" role="alert">{state.error}</p>}
          {!state.loading && !state.error && format === 'pdf' && <iframe title="PDF preview" src={state.url} className="rpt-pdf-frame" />}
          {!state.loading && !state.error && format !== 'pdf' && (
            <div className="rpt-xl-sum">
              <p><b>{state.total}</b> rows in the “Table” sheet, plus a “KPI summary” sheet.</p>
              <p className="rpt-muted">Period {filters.from} to {filters.to} · {filtersText}</p>
            </div>
          )}
        </div>
        <div className="rpt-modal-foot">
          <button type="button" className="rpt-btn rpt-btn-excel" onClick={onClose}>Cancel</button>
          <button type="button" className="rpt-btn rpt-btn-pdf" onClick={download} disabled={state.loading || Boolean(state.error)}><Download size={16} aria-hidden="true" /> Download</button>
        </div>
      </div>
    </div>
  )
}
