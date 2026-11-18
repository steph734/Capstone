import Sparkline from './Sparkline'
import { fmtValue } from './reportRange'

export const MODULE_DEFS = [
  { key: 'revenue', title: 'Revenue report', desc: 'All monthly revenue transactions.', icon: '💰', metricLabel: 'Months covered' },
  { key: 'attendance', title: 'Attendance report', desc: 'Monthly staff attendance records.', icon: '🕒', metricLabel: 'Staff tracked' },
  { key: 'patient-growth', title: 'Patient growth report', desc: 'New patient intake and roster growth.', icon: '📈', metricLabel: 'Roster today' },
  { key: 'service-popularity', title: 'Service popularity report', desc: 'Which therapy services are requested most.', icon: '🧩', metricLabel: 'Total bookings' },
  { key: 'retention', title: 'Retention rate report', desc: 'Patient retention versus churn.', icon: '🔁', metricLabel: 'Latest rate' },
  { key: 'staff-efficiency', title: 'Staff efficiency report', desc: 'Session completion rate per therapist.', icon: '⚙️', metricLabel: 'Avg completion' },
]

function Spinner() {
  return <span className="orp-spinner" aria-hidden="true" />
}

// Same layout for every module: icon + title, one-line description, sparkline, key metric, then the buttons.
export default function ReportModuleCard({ def, mod, loading, rangeText, busyKey, onView, onExport, onPickRange }) {
  const empty = !!mod?.empty
  const metricLabel = mod?.metricLabel || def.metricLabel
  const disabledTip = empty ? 'No data in this range to export' : undefined
  const exporting = (fmt) => busyKey === `${def.key}:${fmt}`
  return (
    <section className={`orp-module ${loading ? 'is-loading' : ''}`} aria-label={def.title}>
      <div className="orp-module-head">
        <span className="orp-chip" aria-hidden="true">{def.icon}</span>
        <h3 className="orp-module-title">{def.title}</h3>
      </div>
      <p className="orp-module-desc">{def.desc}</p>

      {empty ? (
        <div className="orp-module-empty">
          <p>No data for {rangeText}</p>
          <button type="button" className="orp-link" onClick={onPickRange}>Try a different range</button>
        </div>
      ) : (
        <Sparkline series={mod?.series} label={`${def.title} trend`} />
      )}

      <div className="orp-metric">
        <span>{metricLabel}</span>
        <strong className={!mod ? 'is-skeleton' : ''}>{mod ? fmtValue(mod.metricValue, mod.metricFormat) : ' '}</strong>
      </div>

      <div className="orp-actions">
        <button type="button" className="orp-btn orp-btn-primary" onClick={() => onView(def)} disabled={!mod}>View report</button>
        {['csv', 'pdf'].map((fmt) => (
          <button
            key={fmt}
            type="button"
            className="orp-btn orp-btn-outline"
            onClick={() => onExport(def.key, fmt, def.title)}
            disabled={!mod || empty || !!busyKey}
            title={disabledTip}
            aria-label={`Export ${def.title} as ${fmt.toUpperCase()}`}
          >
            {exporting(fmt) ? <Spinner /> : fmt.toUpperCase()}
          </button>
        ))}
      </div>
    </section>
  )
}
