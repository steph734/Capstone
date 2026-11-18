// One-colour sparkline (green line, very light fill). Colour never carries meaning here; that is the delta's job.
// The SVG has a text alternative that summarises the trend, so it is not a picture-only signal.
const W = 240
const H = 48
const PAD = 3

export default function Sparkline({ series = [], label = 'Trend', unit = '', format = (v) => String(v) }) {
  const data = series.length ? series : [0]
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0
  const pts = data.map((v, i) => [PAD + i * step, H - PAD - ((v - min) / span) * (H - PAD * 2 - 4) - 2])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`
  const flat = max === min
  const summary = series.length
    ? `${label}: ${series.length} points, from ${format(series[0])} to ${format(series[series.length - 1])}${flat ? ', no change' : `, low ${format(min)}, high ${format(max)}`}${unit}`
    : `${label}: no data`
  return (
    <svg className="orp-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary}>
      <path d={area} className="orp-spark-fill" />
      <path d={line} className="orp-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
