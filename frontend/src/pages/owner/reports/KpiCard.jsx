import Sparkline from './Sparkline'
import { fmtValue, fmtSigned, describeDelta, fmtMoney } from './reportRange'

const ARROW = {
  up: <path d="M7 17L17 7M8 7h9v9" />,
  down: <path d="M7 7l10 10M17 8v9H8" />,
  flat: <path d="M5 12h14" />,
}

// A KPI: value, change versus the comparison period, and a sparkline. `kpi` is undefined until the first load.
// Colour only says good/bad (goodDirection decides), and the arrow is never the only signal: the delta also has
// visible text and a screen-reader sentence that says "up"/"down" and whether it is an improvement.
export default function KpiCard({ def, kpi, compareText, loading, empty }) {
  const delta = kpi ? describeDelta(kpi, `vs ${compareText}`) : null
  const value = !kpi ? null : kpi.key === 'growth' && kpi.value !== null ? fmtSigned(kpi.value) : fmtValue(kpi.value, kpi.valueFormat)
  const fmt = kpi?.valueFormat === 'money' ? fmtMoney : (v) => String(v)
  return (
    <section className={`orp-kpi ${loading ? 'is-loading' : ''}`} aria-label={def.label}>
      <h3 className="orp-kpi-label" title={def.hint}>{def.label}</h3>
      <div className={`orp-kpi-value ${!kpi ? 'is-skeleton' : ''}`}>{value ?? ' '}</div>
      <div className={`orp-delta ${kpi ? `tone-${kpi.tone}` : ''}`}>
        {delta && (
          <>
            {delta.direction !== 'flat' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ARROW[delta.direction]}</svg>
            )}
            <strong aria-hidden="true">{delta.text}</strong>
            <span className="orp-delta-note" aria-hidden="true">vs {compareText}</span>
            <span className="orp-sr">{delta.sr}</span>
          </>
        )}
      </div>
      <Sparkline series={kpi?.series} label={`${def.label} trend`} format={fmt} />
      {empty && <span className="orp-sr">No data in the selected range</span>}
    </section>
  )
}
