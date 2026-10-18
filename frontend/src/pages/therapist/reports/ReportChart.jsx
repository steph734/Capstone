import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const GRID = '#e8efec'
const label = (d) => `${d.label}${d.inProgress ? ' (in progress)' : ''}`
const prep = (chart, mapName) => chart.data.map((d) => ({ ...d, label: mapName && d.patientId ? mapName(d.label) : label(d), _light: Boolean(d.inProgress) }))

// One chart card body. Y axis always starts at 0. Bars for counts, lines only for trends over time.
// One colour per meaning; the last, unfinished period is drawn lighter and labelled "(in progress)".
export function ChartBody({ chart, fixed, mapName }) {
  const data = prep(chart, mapName)
  const yMax = chart.max ? [0, chart.max] : [0, (m) => Math.max(1, Math.ceil(m))]
  const empty = !data.length || data.every((d) => chart.series.every((s) => !(Number(d[s.key]) > 0)) && chart.kind !== 'line')
  if (empty && chart.kind !== 'line') return <div className="rpt-chart-empty">No data for these filters</div>
  if (chart.kind === 'line' && !data.some((d) => chart.series.some((s) => d[s.key] != null))) return <div className="rpt-chart-empty">No data for these filters</div>
  const common = { data, margin: { top: 14, right: 12, left: -8, bottom: 4 } }
  const axes = (horizontal) => (horizontal ? (
    <>
      <XAxis type="number" domain={[0, (m) => Math.max(1, Math.ceil(m))]} allowDecimals={false} tick={{ fontSize: 12 }} />
      <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12 }} />
    </>
  ) : (
    <>
      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" angle={data.length > 8 ? -35 : 0} textAnchor={data.length > 8 ? 'end' : 'middle'} height={data.length > 8 ? 56 : 30} />
      <YAxis domain={yMax} allowDecimals={false} tick={{ fontSize: 12 }} />
    </>
  ))
  const wrap = (child) => (fixed ? <div style={{ width: fixed.w, height: fixed.h }}>{child({ width: fixed.w, height: fixed.h })}</div> : <ResponsiveContainer width="100%" height={260}>{child({})}</ResponsiveContainer>)

  if (chart.kind === 'line') {
    return wrap((p) => (
      <LineChart {...p} {...common}>
        <CartesianGrid stroke={GRID} vertical={false} />{axes(false)}<Tooltip formatter={(v) => (v == null ? '–' : v)} />
        {chart.series.length > 1 && <Legend />}
        {chart.series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />)}
      </LineChart>
    ))
  }
  const horizontal = chart.kind === 'hbar'
  return wrap((p) => (
    <BarChart {...p} {...common} layout={horizontal ? 'vertical' : 'horizontal'}>
      <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />{axes(horizontal)}<Tooltip cursor={{ fill: 'rgba(15,118,110,.06)' }} />
      {(chart.kind === 'group' || chart.kind === 'stack') && <Legend />}
      {chart.series.map((s) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || '#0d9488'} stackId={chart.kind === 'stack' ? 'a' : undefined} radius={chart.kind === 'stack' ? 0 : [6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={chart.colorByPoint ? d.color : s.color} fillOpacity={d._light ? 0.45 : 1} />)}
        </Bar>
      ))}
    </BarChart>
  ))
}

// Renders a chart off-screen and returns a PNG data URL (for the PDF). `mapName` anonymises patient names on the chart.
export async function chartToImage(chart, mapName, w = 560, h = 280) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;background:#fff`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(<div style={{ background: '#fff' }}><ChartBody chart={chart} fixed={{ w, h }} mapName={mapName} /></div>))
    await new Promise((r) => setTimeout(r, 120))
    const svg = host.querySelector('svg.recharts-surface')
    if (!svg) return null
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}` })
    const c = document.createElement('canvas')
    c.width = w * 2; c.height = h * 2
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  } catch { return null } finally { root.unmount(); host.remove() }
}
