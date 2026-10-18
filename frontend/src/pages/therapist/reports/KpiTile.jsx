import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { KPI_ICONS, KPI_TONE } from './config.jsx'
import { changeText, fmtKpi } from './exportReport'

// KPI card with the change versus the previous period of the same length. Green = good, red = bad;
// for cancellations and no-shows "up" is bad.
export function KpiTile({ k }) {
  const Icon = KPI_ICONS[k.icon] || KPI_ICONS.calendar
  const up = k.changePct != null && k.changePct > 0
  const down = k.changePct != null && k.changePct < 0
  const good = k.changePct == null || k.changePct === 0 ? null : (up && k.good === 'up') || (down && k.good === 'down')
  return (
    <div className={`rpt-kpi rpt-kpi-${KPI_TONE[k.tone] || 'teal'}`}>
      <div className="rpt-kpi-top">
        <span className="rpt-kpi-icon"><Icon size={20} aria-hidden="true" /></span>
        <div className="rpt-kpi-text">
          <span className="rpt-kpi-val">{fmtKpi(k)}</span>
          <span className="rpt-kpi-lbl">{k.label}</span>
        </div>
      </div>
      <span className={`rpt-kpi-change ${good === null ? '' : good ? 'good' : 'bad'}`}>
        {up ? <ArrowUp size={13} aria-hidden="true" /> : down ? <ArrowDown size={13} aria-hidden="true" /> : <Minus size={13} aria-hidden="true" />}
        {changeText(k)} vs previous period
      </span>
      <svg className="rpt-kpi-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,26 C22,12 40,34 64,24 C88,14 108,32 132,22 C156,12 178,30 200,20 L200,40 L0,40 Z" fill="currentColor" />
      </svg>
    </div>
  )
}
