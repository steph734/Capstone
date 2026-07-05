/* CVD-validated 7-hue categorical order (see dataviz skill palette validator) */
const DEFAULT_BAR_COLORS = ['#3b82f6', '#2a9d8f', '#f59e0b', '#22c55e', '#8b5cf6', '#e46a4b', '#ec4899']

/* ---------- Vertical bar chart (dashed gridlines, value-on-cap, pill labels) ---------- */
export function CategoryBarChart({ data, formatValue = (v) => v, colors = DEFAULT_BAR_COLORS, markToday = false }) {
  const max = Math.max(...data.map((d) => d.value))

  return (
    <div className="viz-bar-chart">
      <div className="viz-bar-grid">
        {[...Array(4)].map((_, i) => <div key={i} className="viz-bar-gridline" />)}
      </div>
      <div className="viz-bar-bars">
        {data.map((d, i) => {
          const pct = Math.round((d.value / max) * 100)
          const color = colors[i % colors.length]
          return (
            <div key={d.label} className="viz-bar-group">
              <span className="viz-bar-count">{formatValue(d.value)}</span>
              <div className="viz-bar-track">
                <div className="viz-bar-fill" style={{ height: `${pct}%`, background: color }} />
              </div>
              <span className="viz-bar-pill">{d.label}{markToday && d.isToday ? ' · Today' : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="viz-bar-baseline" />
    </div>
  )
}

/* ---------- Line chart (dashed gridlines, value-above-point, pill labels) ---------- */
export function TrendLineChart({ data, formatValue = (v) => v, lineColor = 'var(--viz-accent)', dotColors = DEFAULT_BAR_COLORS }) {
  const plotWidth = 600
  const plotHeight = 208
  const values = data.map((d) => d.value)
  const max = Math.max(...values) || 1
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth / 2

  const points = data.map((d, i) => [
    data.length > 1 ? i * stepX : plotWidth / 2,
    plotHeight - (d.value / max) * plotHeight,
  ])

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const areaPath = `M${points[0][0]},${plotHeight} ${points.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} L${points[points.length - 1][0]},${plotHeight} Z`

  return (
    <div className="viz-line-chart">
      <div className="viz-line-plot">
        <div className="viz-line-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="viz-bar-gridline" />)}
        </div>
        <svg className="viz-line-svg" viewBox={`0 0 ${plotWidth} ${plotHeight}`} preserveAspectRatio="none">
          <path d={areaPath} fill={lineColor} fillOpacity="0.14" stroke="none" />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {points.map(([x, y], i) => (
          <div
            key={data[i].label}
            className="viz-line-dot"
            style={{ left: `${(x / plotWidth) * 100}%`, top: `${(y / plotHeight) * 100}%`, background: dotColors[i % dotColors.length] }}
          >
            <span className="viz-line-value">{formatValue(values[i])}</span>
          </div>
        ))}
      </div>
      <div className="viz-bar-baseline" />
      <div className="viz-line-labels">
        {data.map((d) => <span key={d.label} className="viz-bar-pill">{d.label}</span>)}
      </div>
    </div>
  )
}

/* ---------- Donut chart (conic-gradient ring + legend) ---------- */
export function DonutChart({ data, centerValue, centerSub }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  let cursor = 0
  const stops = data.map((d) => {
    const start = cursor
    cursor += (d.value / total) * 100
    return `${d.color} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`
  }).join(', ')

  return (
    <div className="viz-donut-wrap">
      <div className="viz-donut-ring" style={{ background: `conic-gradient(${stops})` }}>
        <div className="viz-donut-center">
          <span className="viz-donut-total">{centerValue}</span>
          <span className="viz-donut-sublabel">{centerSub}</span>
        </div>
      </div>
      <ul className="viz-donut-legend">
        {data.map((d) => (
          <li key={d.label} className="viz-legend-row">
            <span className="viz-legend-dot" style={{ background: d.color }} />
            <span className="viz-legend-label">{d.label}</span>
            <span className="viz-legend-count">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
