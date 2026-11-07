import { useState } from 'react'
import { AMBER_FG, DataTable, GREEN_900, HOME, MUTED, THERAPY } from './ui'

// Plain-SVG charts for the Patient Stats page. Every chart scales to its card (width 100%, fixed aspect ratio via
// viewBox), has an aria-label that spells out the numbers, and shows a small bar (not nothing) for zero values.
const W = 760
const GRID = '#EAF0ED'
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const r1 = (n) => Math.round(n * 10) / 10
export const dayLabel = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })

function YAxis({ top, unit = '', ticks = 4, padL, padT, innerH, w, padR }) {
  return [...Array(ticks + 1)].map((_, i) => {
    const v = (top / ticks) * i
    const y = padT + innerH - (v / top) * innerH
    return (
      <g key={i}>
        <line x1={padL} x2={w - padR} y1={y} y2={y} stroke={GRID} />
        <text x={padL - 8} y={y + 4} fontSize="12" textAnchor="end" fill={MUTED}>{Number.isInteger(v) ? v : v.toFixed(1)}{unit}</text>
      </g>
    )
  })
}
const niceTop = (max, min = 4) => { const m = Math.max(min, max); const step = m <= 4 ? 1 : m <= 12 ? 3 : Math.ceil(m / 4 / 5) * 5; return Math.ceil(m / (step * 4)) * step * 4 || 4 }

// One point per recorded session: value above each point, game name + "Nov 8 · 2 min" under it, dashed average line
// (label sits in the right margin so it never covers a point) and a dashed 3-session average.
export function SessionLine({ points, color = THERAPY }) {
  const [hover, setHover] = useState(null)
  if (!points.length) return <p className="py-10 text-center" style={{ color: MUTED, fontSize: 15 }}>Not enough data yet.</p>
  const H = 300, padL = 46, padR = 92, padT = 28, padB = 58
  const innerW = W - padL - padR, innerH = H - padT - padB
  const step = points.length > 1 ? innerW / (points.length - 1) : 0
  const x = (i) => (points.length > 1 ? padL + i * step : padL + innerW / 2)
  const y = (v) => padT + innerH - (Math.min(100, Math.max(0, v)) / 100) * innerH
  const avg = r1(points.reduce((a, p) => a + p.value, 0) / points.length)
  const roll = points.map((_, i) => { const win = points.slice(Math.max(0, i - 1), i + 2); return win.reduce((a, p) => a + p.value, 0) / win.length })
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const rollLine = roll.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 110))))
  const sub = (p) => `${dayLabel(p.date)} · ${p.minutes ?? 0} min`
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`Accuracy per recorded session: ${points.map((p) => `${p.game} on ${sub(p)}, ${p.value}%`).join('; ')}. Average ${avg}%.`}>
        <YAxis top={100} unit="%" padL={padL} padT={padT} innerH={innerH} w={W} padR={padR} />
        <path d={area} fill={color} opacity="0.1" />
        <path d={rollLine} fill="none" stroke={HOME} strokeWidth="1.6" strokeDasharray="5 4" opacity="0.8" />
        <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke={HOME} strokeWidth="1.8" strokeDasharray="6 5" />
        <text x={W - padR + 8} y={y(avg) + 4} fontSize="13" fontWeight="700" fill={HOME}>Average {Math.round(avg)}%</text>
        <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 8 : 6.5} fill="#fff" stroke={color} strokeWidth="3"><title>{`${p.game}, ${sub(p)}: ${p.value}%`}</title></circle>
            <text x={x(i)} y={y(p.value) - 14} fontSize="14" fontWeight="800" textAnchor="middle" fill={GREEN_900}>{Math.round(p.value)}%</text>
            {(i % every === 0 || i === points.length - 1) && (
              <>
                <text x={x(i)} y={H - 32} fontSize="13" fontWeight="700" textAnchor="middle" fill={GREEN_900}>{trunc(p.game, 16)}</text>
                <text x={x(i)} y={H - 14} fontSize="12" textAnchor="middle" fill={MUTED}>{sub(p)}</text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

export function SessionTable({ points }) {
  return <DataTable caption="Accuracy for each recorded session" head={['Game', 'Date', 'Minutes', 'Accuracy']} rows={points.map((p) => [p.game, dayLabel(p.date), p.minutes ?? 0, `${p.value}%`])} />
}

// Accuracy by day, therapy vs home. `days` is the full list of day keys (the last 6 days minimum).
export function DayLines({ days, home, session }) {
  const avgBy = (pts) => { const m = new Map(); pts.forEach((p) => { const a = m.get(p.date) || []; a.push(p.value); m.set(p.date, a) }); return new Map([...m].map(([k, v]) => [k, r1(v.reduce((x, y) => x + y, 0) / v.length)])) }
  const h = avgBy(home), s = avgBy(session)
  const H = 260, padL = 46, padR = 20, padT = 28, padB = 34
  const innerW = W - padL - padR, innerH = H - padT - padB
  const x = (i) => (days.length > 1 ? padL + (innerW * i) / (days.length - 1) : padL + innerW / 2)
  const y = (v) => padT + innerH - (v / 100) * innerH
  const pts = (m) => days.map((d, i) => (m.has(d) ? { d, v: m.get(d), x: x(i), y: y(m.get(d)) } : null)).filter(Boolean)
  const hp = pts(h), sp = pts(s)
  const path = (a) => a.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const every = Math.max(1, Math.ceil(days.length / 10))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Accuracy by day. Therapy sessions: ${sp.map((p) => `${dayLabel(p.d)} ${p.v}%`).join(', ') || 'no plays'}. Home practice: ${hp.map((p) => `${dayLabel(p.d)} ${p.v}%`).join(', ') || 'no plays'}.`}>
      <YAxis top={100} unit="%" padL={padL} padT={padT} innerH={innerH} w={W} padR={padR} />
      {sp.length > 1 && <path d={path(sp)} fill="none" stroke={THERAPY} strokeWidth="2.4" strokeLinejoin="round" />}
      {hp.length > 1 && <path d={path(hp)} fill="none" stroke={HOME} strokeWidth="2.4" strokeLinejoin="round" />}
      {sp.map((p) => (<g key={`s${p.d}`}><circle cx={p.x} cy={p.y} r="6" fill={THERAPY} stroke="#fff" strokeWidth="2"><title>{`Therapy ${dayLabel(p.d)}: ${p.v}%`}</title></circle><text x={p.x} y={p.y - 12} fontSize="13" fontWeight="800" textAnchor="middle" fill={GREEN_900}>{Math.round(p.v)}%</text></g>))}
      {hp.map((p) => (<g key={`h${p.d}`}><rect x={p.x - 6} y={p.y - 6} width="12" height="12" rx="3" fill={HOME} stroke="#fff" strokeWidth="2"><title>{`Home ${dayLabel(p.d)}: ${p.v}%`}</title></rect><text x={p.x} y={p.y + 24} fontSize="13" fontWeight="800" textAnchor="middle" fill={GREEN_900}>{Math.round(p.v)}%</text></g>))}
      {days.map((d, i) => (i % every === 0 || i === days.length - 1) && <text key={d} x={x(i)} y={H - 10} fontSize="13" textAnchor="middle" fill={MUTED}>{dayLabel(d)}</text>)}
    </svg>
  )
}

// Grouped bars. categories: [{ label }]; series: [{ key, label, color }]; values[catIndex][seriesKey] = number | null.
// Zero values draw a small bar with a "0" above it. `goal` draws a dashed amber line.
export function GroupedBars({ categories, series, values, unit = '', goal = null, goalLabel, decimals = 1, caption }) {
  const H = 280, padL = 46, padR = 16, padT = 28, padB = 36
  const innerW = W - padL - padR, innerH = H - padT - padB
  const flat = categories.flatMap((_, i) => series.map((s) => values[i][s.key] ?? 0))
  const top = unit === '%' ? 100 : niceTop(Math.max(0, goal || 0, ...flat), 4)
  const slot = innerW / Math.max(1, categories.length)
  const bw = Math.min(34, (slot * 0.78) / series.length)
  const y = (v) => padT + innerH - (Math.min(top, v) / top) * innerH
  const fmt = (v) => (v == null ? '—' : `${Number.isInteger(v) ? v : Number(v).toFixed(decimals)}${unit}`)
  const aria = `${caption}: ${categories.map((c, i) => `${c.label}, ${series.map((s) => `${s.label} ${fmt(values[i][s.key])}`).join(', ')}`).join('; ')}.`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={aria}>
      <YAxis top={top} unit={unit} padL={padL} padT={padT} innerH={innerH} w={W} padR={padR} />
      {categories.map((c, i) => {
        const cx = padL + slot * i + slot / 2
        const left = cx - (bw * series.length + 3 * (series.length - 1)) / 2
        return (
          <g key={`${c.label}-${i}`}>
            {series.map((s, k) => {
              const v = values[i][s.key]
              const bx = left + k * (bw + 3)
              const h = v == null ? 0 : Math.max(3, y(0) - y(v))
              return (
                <g key={s.key}>
                  {v != null && <rect x={bx} y={y(0) - h} width={bw} height={h} rx="3" fill={s.color} opacity={v === 0 ? 0.45 : 1}><title>{`${c.label} · ${s.label}: ${fmt(v)}`}</title></rect>}
                  {v != null && <text x={bx + bw / 2} y={y(0) - h - 6} fontSize="13" fontWeight="800" textAnchor="middle" fill={GREEN_900}>{fmt(v)}</text>}
                </g>
              )
            })}
            <text x={cx} y={H - 12} fontSize="13" fontWeight="700" textAnchor="middle" fill={GREEN_900}>{trunc(c.label, 18)}</text>
          </g>
        )
      })}
      {goal ? <g><line x1={padL} x2={W - padR} y1={y(goal)} y2={y(goal)} stroke="#E8A317" strokeWidth="2" strokeDasharray="6 5" /><text x={W - padR} y={y(goal) - 6} fontSize="13" fontWeight="800" textAnchor="end" fill={AMBER_FG}>{goalLabel}</text></g> : null}
    </svg>
  )
}

export function GroupedTable({ categories, series, values, unit = '', decimals = 1, caption, first = '' }) {
  const fmt = (v) => (v == null ? '—' : `${Number.isInteger(v) ? v : Number(v).toFixed(decimals)}${unit}`)
  return <DataTable caption={caption} head={[first, ...series.map((s) => s.label)]} rows={categories.map((c, i) => [c.label, ...series.map((s) => fmt(values[i][s.key]))])} />
}

// Weekly completion: completed (green) over assigned (grey) with the number above each bar.
export function WeeklyBars({ weeks }) {
  const H = 220, padT = 30, padB = 30
  const innerH = H - padT - padB
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.assigned || 0, w.completed || 0)))
  const slot = W / Math.max(1, weeks.length)
  const bw = Math.min(54, slot * 0.5)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Games finished each week: ${weeks.map((w) => `${w.label} ${w.completed} of ${Math.max(w.assigned || 0, w.completed || 0)}`).join(', ')}.`}>
      {weeks.map((w, i) => {
        const total = Math.max(w.assigned || 0, w.completed || 0)
        const th = Math.max(4, (total / max) * innerH), dh = w.completed > 0 ? Math.max(4, (w.completed / max) * innerH) : 0
        const cx = slot * i + slot / 2, base = padT + innerH
        return (
          <g key={w.weekStart}>
            <rect x={cx - bw / 2} y={base - th} width={bw} height={th} rx="4" fill="#E8EFEC"><title>{`${w.label}: ${w.completed} finished of ${total}`}</title></rect>
            {dh > 0 && <rect x={cx - bw / 2} y={base - dh} width={bw} height={dh} rx="4" fill={HOME} />}
            <text x={cx} y={base - th - 8} fontSize="15" fontWeight="800" textAnchor="middle" fill={GREEN_900}>{w.completed}</text>
            <text x={cx} y={H - 8} fontSize="14" fontWeight="700" textAnchor="middle" fill={MUTED}>{w.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
