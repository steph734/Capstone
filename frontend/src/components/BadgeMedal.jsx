import { useId } from 'react'
import { symbolById } from '../data/badgeSymbols'

// Colourful achievement badge: rim (in the chosen shape) + dotted stitch line
// + sunburst face + curved name text + side stars + icon + glass shine, and
// either folded ribbon tails or a curved name banner underneath.
//
// Geometry/colours are copied exactly from the reference implementation —
// do not "simplify" the magic numbers, they're what makes the shapes read
// correctly at small picker sizes.

const poly = (n, cx, cy, r, rot = -90) => Array.from({ length: n }, (_, i) => {
  const a = (rot + (360 / n) * i) * Math.PI / 180
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

const starP = (n, cx, cy, r, ir, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const rr = i % 2 ? r * ir : r
  const a = (rot + (180 / n) * i) * Math.PI / 180
  return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`
}).join(' ')

const SHAPE = {
  circle: (cx, cy, r, p) => <circle cx={cx} cy={cy} r={r} {...p} />,
  rounded: (cx, cy, r, p) => <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} rx={r * .32} {...p} />,
  octagon: (cx, cy, r, p) => <polygon points={poly(8, cx, cy, r, -67.5)} strokeLinejoin="round" {...p} />,
  hexagon: (cx, cy, r, p) => <polygon points={poly(6, cx, cy, r)} strokeLinejoin="round" {...p} />,
  diamond: (cx, cy, r, p) => <rect x={cx - r * .76} y={cy - r * .76} width={r * 1.52} height={r * 1.52} rx={r * .18} transform={`rotate(45 ${cx} ${cy})`} {...p} />,
  shield: (cx, cy, r, p) => <path d={`M${cx - r},${cy - r * .9} Q${cx},${cy - r * 1.08} ${cx + r},${cy - r * .9} L${cx + r * .92},${cy + r * .15} Q${cx + r * .7},${cy + r * .78} ${cx},${cy + r * 1.05} Q${cx - r * .7},${cy + r * .78} ${cx - r * .92},${cy + r * .15} Z`} strokeLinejoin="round" {...p} />,
  star: (cx, cy, r, p) => <polygon points={starP(5, cx, cy, r * 1.12, .62)} strokeLinejoin="round" {...p} />,
  flower: (cx, cy, r, p) => <polygon points={starP(8, cx, cy, r * 1.04, .8)} strokeLinejoin="round" {...p} />,
  scallop: (cx, cy, r, p) => <polygon points={starP(12, cx, cy, r * 1.02, .9)} strokeLinejoin="round" {...p} />,
  gear: (cx, cy, r, p) => <polygon points={starP(10, cx, cy, r * 1.02, .84)} strokeLinejoin="round" {...p} />,
}

// Colourful achievement badge palette (rim/face/ink tones per colour id).
export const ACH = {
  gold: { base: '#f2b632', dark: '#b7791f', light: '#ffe8a3', face: '#f7c948', deep: '#8a5a12' },
  silver: { base: '#b8c2cf', dark: '#6b7686', light: '#f3f6fa', face: '#cdd5df', deep: '#4b5563' },
  bronze: { base: '#cd7f3e', dark: '#8a4b1f', light: '#ffd9b3', face: '#dc9056', deep: '#5c2f10' },
  red: { base: '#e03a2f', dark: '#9f1d1d', light: '#ffc9c2', face: '#ec5a4c', deep: '#6b1111' },
  orange: { base: '#f07a1a', dark: '#b4480f', light: '#ffd8ae', face: '#f7913a', deep: '#7a2e08' },
  amber: { base: '#f5a300', dark: '#b45309', light: '#ffe9a8', face: '#fbb82b', deep: '#7a3b06' },
  green: { base: '#2f9e44', dark: '#14632a', light: '#c7f2cf', face: '#40b35a', deep: '#0b3d19' },
  teal: { base: '#1fb5b0', dark: '#0e6f6c', light: '#c4f5f1', face: '#35c6c0', deep: '#084744' },
  blue: { base: '#2f8fe0', dark: '#1a5a9f', light: '#cde6fd', face: '#4aa3ec', deep: '#0f3a6a' },
  indigo: { base: '#5a60e0', dark: '#3730a3', light: '#d9dbff', face: '#6f75ea', deep: '#241f6b' },
  purple: { base: '#8e44c9', dark: '#5b1f8f', light: '#ecd6ff', face: '#a15ad6', deep: '#3b0f63' },
  pink: { base: '#e44d9b', dark: '#9d1d5f', light: '#ffd3ea', face: '#ee68ad', deep: '#6a0f3d' },
}

// Diamond draws as a circle and star draws as a scallop — those read better
// with curved text and a dotted stitch line than their "true" outline.
export const ACH_EDGE = {
  circle: 'circle', rounded: 'rounded', octagon: 'octagon', hexagon: 'hexagon',
  diamond: 'circle', shield: 'shield', star: 'scallop', flower: 'flower',
  scallop: 'scallop', gear: 'gear',
}

function star5(cx, cy, r, key) {
  return <polygon key={key} points={starP(5, cx, cy, r, .45)} />
}

export default function BadgeMedal({ shape = 'circle', colour = 'orange', symbol = 'star', name = '', size = 120, muted = false, banner = false }) {
  const rawId = useId()
  const uid = rawId.replace(/:/g, '')
  const cId = `${uid}c`, oId = `${uid}o`, tId = `${uid}t`, bId = `${uid}b`

  const c = ACH[colour] || ACH.orange
  const E = SHAPE[ACH_EDGE[shape]] || SHAPE.circle
  const cx = 50, cy = 48
  const showText = size >= 90 && !!name && !banner

  const rays = Array.from({ length: 28 }, (_, i) => {
    const a = (i * 360 / 28) * Math.PI / 180
    const b = ((i * 360 / 28) + 5) * Math.PI / 180
    return `M50 48 L${(50 + 34 * Math.cos(a)).toFixed(1)} ${(48 + 34 * Math.sin(a)).toFixed(1)} L${(50 + 34 * Math.cos(b)).toFixed(1)} ${(48 + 34 * Math.sin(b)).toFixed(1)}Z`
  }).join(' ')

  const up = (name || '').toUpperCase()
  const fs = up.length > 14 ? 6.2 : up.length > 10 ? 7 : 8

  const tails = (
    <>
      <polygon points="28,72 16,94 25,92 29,101 41,80" fill={c.dark} />
      <polygon points="72,72 84,94 75,92 71,101 59,80" fill={c.dark} />
      <polygon points="31,74 22,91 27,90 30,96 39,81" fill={c.base} />
      <polygon points="69,74 78,91 73,90 70,96 61,81" fill={c.base} />
    </>
  )

  const iconTransform = showText
    ? 'translate(37 42) scale(1.08)'
    : 'translate(32 30) scale(1.5)'

  return (
    <svg width={size} height={size * 1.08} viewBox="0 0 100 108" style={{ ...(muted ? { filter: 'grayscale(.9)', opacity: .5 } : null), overflow: 'visible' }}>
      <defs>
        <clipPath id={cId}><circle cx="50" cy="48" r="34" /></clipPath>
        <clipPath id={oId}>{E(cx, cy, 44, {})}</clipPath>
        <path id={tId} d="M22 50 A28 28 0 0 1 78 50" fill="none" />
        {banner && <path id={bId} d="M20 90 Q50 99 80 90" fill="none" />}
      </defs>

      {!banner && tails}
      {E(cx, cy + 3, 44, { fill: 'rgba(0,0,0,.22)' })}
      {E(cx, cy, 44, { fill: c.base, stroke: c.dark, strokeWidth: 1.6 })}
      <circle cx="50" cy="48" r="38" fill="none" stroke={c.light} strokeWidth="1" strokeDasharray="1.6 2.2" opacity=".75" />
      <circle cx="50" cy="48" r="35" fill={c.dark} />
      <circle cx="50" cy="48" r="34" fill={c.face} />
      <g clipPath={`url(#${cId})`}><path d={rays} fill={c.light} opacity=".22" /></g>
      <circle cx="50" cy="48" r="30.5" fill="none" stroke={c.light} strokeWidth=".9" opacity=".7" />

      {showText && (
        <>
          <text fontFamily="Oswald, 'Arial Narrow', sans-serif" fontWeight="700" fontSize={fs} fill={c.light} letterSpacing=".5">
            <textPath href={`#${tId}`} startOffset="50%" textAnchor="middle">{up}</textPath>
          </text>
          <g fill={c.light}>
            {star5(24, 56, 2.6, 'l')}
            {star5(76, 56, 2.6, 'r')}
          </g>
        </>
      )}

      <g
        transform={iconTransform}
        stroke={c.deep}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={c.light}
        opacity=".95"
        dangerouslySetInnerHTML={{ __html: symbolById(symbol).svg }}
      />

      <g clipPath={`url(#${oId})`}><path d="M0 0 L100 0 L100 34 Q60 52 0 70 Z" fill="#fff" opacity=".13" /></g>

      {banner && (
        <>
          <polygon points="8,80 20,80 20,96 8,96 13,88" fill={c.dark} />
          <polygon points="92,80 80,80 80,96 92,96 87,88" fill={c.dark} />
          <path d="M16 78 Q50 88 84 78 L84 94 Q50 104 16 94 Z" fill={c.light} stroke={c.dark} strokeWidth="1.2" />
          <text fontFamily="Oswald, 'Arial Narrow', sans-serif" fontWeight="700" fontSize={fs} fill={c.deep} letterSpacing=".4">
            <textPath href={`#${bId}`} startOffset="50%" textAnchor="middle">{up}</textPath>
          </text>
        </>
      )}
    </svg>
  )
}
