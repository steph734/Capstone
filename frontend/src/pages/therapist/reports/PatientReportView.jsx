import { useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { authFetch } from '../../../utils/session'
import { ChartBody } from './ReportChart.jsx'
import { KpiTile } from './KpiTile.jsx'
import { STATUS_CLASS } from './config.jsx'

// Individual patient report: header, KPIs, two charts, latest SOAP assessment and plan, home exercises, games,
// and editable therapist remarks (saved with the report).
export default function PatientReportView({ data, onBack, onRemarksSaved }) {
  const [text, setText] = useState(data.sections.remarks.text)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')
  const h = data.header
  const s = data.sections

  const save = async () => {
    setBusy(true)
    try {
      await authFetch('/api/reports/remarks', { method: 'PUT', body: { patientId: data.patientId, text } })
      setSaved('Remarks saved'); onRemarksSaved?.(text)
    } catch (e) { setSaved(e.message || 'Could not save') } finally { setBusy(false); setTimeout(() => setSaved(''), 2500) }
  }

  return (
    <>
      <button type="button" className="rpt-back" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" /> Back to reports</button>
      <div className="rpt-patient-head">
        <div>
          <h3>{h.name}</h3>
          <p>Age {h.age ?? '—'} · {h.condition} · Guardian: {h.guardian}</p>
          <p>Therapist: {h.therapist} · {h.from} to {h.to}</p>
        </div>
        <span className={`rpt-status ${STATUS_CLASS[h.status] || ''}`} title={h.why}>{h.status}</span>
      </div>
      <div className="rpt-kpi-row">{data.kpis.map((k) => <KpiTile key={k.key} k={k} />)}</div>
      {data.summary && <p className="rpt-summary">{data.summary}</p>}
      <div className="rpt-charts-row">
        {[data.charts.primary, data.charts.secondary].map((c) => (
          <div className="rpt-chart-card" key={c.title}><div className="rpt-chart-head"><p className="rpt-chart-title">{c.title}</p></div><ChartBody chart={c} /></div>
        ))}
      </div>
      <div className="rpt-sections">
        <section className="rpt-section">
          <h4>Latest Assessment and Plan</h4>
          {s.soap ? (<><p className="rpt-muted">From the signed note of {s.soap.date}{s.soap.signedBy ? ` · ${s.soap.signedBy}` : ''}</p><h5>Assessment</h5><p>{s.soap.assessment || '—'}</p><h5>Plan</h5><p>{s.soap.plan || '—'}</p></>) : <p className="rpt-muted">No signed SOAP note yet.</p>}
        </section>
        <section className="rpt-section">
          <h4>Home exercises</h4>
          {s.exercises.length === 0 ? <p className="rpt-muted">No exercises assigned.</p> : (
            <ul className="rpt-list">{s.exercises.map((e, i) => <li key={i}><span>{e.name}</span><span className={`rpt-status ${e.status === 'Done' ? 'rpt-status-confirmed' : 'rpt-status-pending'}`}>{e.status}</span></li>)}</ul>
          )}
        </section>
        <section className="rpt-section">
          <h4>Game activity</h4>
          <p>{s.games.played} games played{s.games.favorite ? ` · favourite: ${s.games.favorite}` : ''}</p>
          {s.games.badges.length > 0 && <p className="rpt-muted">Badges: {s.games.badges.join(', ')}</p>}
        </section>
        <section className="rpt-section">
          <h4>Therapist remarks</h4>
          <textarea className="rpt-remarks" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Therapist remarks" placeholder="Add remarks for this report…" />
          <div className="rpt-remarks-foot"><button type="button" className="rpt-btn rpt-btn-pdf" onClick={save} disabled={busy}><Save size={16} aria-hidden="true" /> Save remarks</button>{saved && <span className="rpt-muted">{saved}</span>}</div>
        </section>
      </div>
      {data.notice && <p className="rpt-notice">{data.notice}</p>}
    </>
  )
}
