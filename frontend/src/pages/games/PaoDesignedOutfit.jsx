// Admin-designed outfit pieces for Pao — the same viewBox="0 0 300 366"
// coordinate space as the hand-drawn items in PaoOutfits.jsx, but built
// from a small `design` object instead of one component per item:
//   { style, main, trim, pattern, patternColor, decal }
// `style` picks a base template for the category (a beanie, a hoodie,
// boots…), the colours/pattern paint it, and `decal` is an optional
// emoji sticker placed where that template has room for one.
import { cloneElement, useId } from 'react'
import { THUMB_VB } from './PaoOutfits'

export const DESIGN_STYLES = {
  hair: [
    { id: 'tuft',      label: 'Tuft' },
    { id: 'bangs',     label: 'Bangs' },
    { id: 'curly',     label: 'Curly' },
    { id: 'spiky',     label: 'Spiky' },
    { id: 'bun',       label: 'Bun' },
    { id: 'ponytail',  label: 'Ponytail' },
    { id: 'pigtails',  label: 'Pigtails' },
    { id: 'long',      label: 'Long' },
  ],
  hats: [
    { id: 'beanie',   label: 'Beanie' },
    { id: 'cap',      label: 'Cap' },
    { id: 'tophat',   label: 'Top hat' },
    { id: 'crown',    label: 'Crown' },
    { id: 'bow',      label: 'Bow' },
    { id: 'headband', label: 'Headband' },
    { id: 'witch',    label: 'Witch hat' },
    { id: 'santa',    label: 'Santa hat' },
    { id: 'antlers',  label: 'Antlers' },
    { id: 'bunny',    label: 'Bunny ears' },
    { id: 'party',    label: 'Party hat' },
  ],
  clothes: [
    { id: 'tee',     label: 'T-shirt' },
    { id: 'sweater', label: 'Sweater' },
    { id: 'hoodie',  label: 'Hoodie' },
    { id: 'vest',    label: 'Vest' },
    { id: 'scarf',   label: 'Scarf' },
    { id: 'cape',    label: 'Cape' },
  ],
  pants: [
    { id: 'pants',   label: 'Pants' },
    { id: 'shorts',  label: 'Shorts' },
    { id: 'skirt',   label: 'Skirt' },
    { id: 'joggers', label: 'Joggers' },
  ],
  shoes: [
    { id: 'sneakers', label: 'Sneakers' },
    { id: 'boots',    label: 'Boots' },
    { id: 'slippers', label: 'Slippers' },
    { id: 'sandals',  label: 'Sandals' },
  ],
}

export const DESIGN_PATTERNS = [
  { id: 'solid',   label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'dots',    label: 'Dots' },
  { id: 'stars',   label: 'Stars' },
  { id: 'hearts',  label: 'Hearts' },
  { id: 'checks',  label: 'Checks' },
  { id: 'zigzag',  label: 'Zigzag' },
  { id: 'snowflakes', label: 'Snowflakes' },
  { id: 'candycane',  label: 'Candy cane' },
  { id: 'bats',       label: 'Bats' },
  { id: 'flowers',    label: 'Flowers' },
  { id: 'confetti',   label: 'Confetti' },
]

export const DESIGN_COLOURS = [
  '#ef4444', '#f97316', '#fbbf24', '#84cc16', '#22c55e', '#14b8a6', '#38bdf8',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f9a8d4', '#a16207', '#1f2937',
  '#9ca3af', '#ffffff',
]

export const DESIGN_DECALS = ['⭐', '❤️', '🌈', '🚀', '🐾', '🌸', '⚡', '🎵', '🍀', '🦋', '🌙', '☀️', '🍓', '🐼', '🏆', '🧩']

// Natural hair shades, offered ahead of the regular palette for hair.
export const HAIR_COLOURS = ['#2a1d13', '#5b3a1e', '#8b5a2b', '#c68642', '#f5d17a', '#d9772b', '#e5e7eb']

export const DEFAULT_DESIGNS = {
  hair:    { style: 'bangs',    main: '#5b3a1e', trim: '#ec4899', pattern: 'solid',   patternColor: '#ffffff', decal: '' },
  hats:    { style: 'beanie',   main: '#3b82f6', trim: '#fbbf24', pattern: 'solid',   patternColor: '#ffffff', decal: '' },
  clothes: { style: 'tee',      main: '#22c55e', trim: '#ffffff', pattern: 'solid',   patternColor: '#ffffff', decal: '⭐' },
  pants:   { style: 'pants',    main: '#6366f1', trim: '#1f2937', pattern: 'solid',   patternColor: '#ffffff', decal: '' },
  shoes:   { style: 'sneakers', main: '#ef4444', trim: '#ffffff', pattern: 'solid',   patternColor: '#ffffff', decal: '' },
}

// ─── colour helpers ─────────────────────────────────────────────────────────
function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return [156, 163, 175]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(hex, target, amt) {
  const a = parseHex(hex)
  const b = parseHex(target)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amt))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const darken = (hex, amt) => mix(hex, '#000000', amt)
const lighten = (hex, amt) => mix(hex, '#ffffff', amt)

function star(cx, cy, r1, r2, n = 5) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (i * Math.PI / n) - Math.PI / 2
    const r = i % 2 === 0 ? r1 : r2
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function PatternDef({ id, pattern, color }) {
  if (pattern === 'stripes') return (
    <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
      <rect width="18" height="7" fill={color} />
    </pattern>
  )
  if (pattern === 'dots') return (
    <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="4" fill={color} />
      <circle cx="17" cy="17" r="4" fill={color} />
    </pattern>
  )
  if (pattern === 'stars') return (
    <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
      <polygon points={star(13, 13, 7, 3)} fill={color} />
    </pattern>
  )
  if (pattern === 'hearts') return (
    <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M13,20 C4,14 5,6 10,7 C12,7.5 13,9 13,10 C13,9 14,7.5 16,7 C21,6 22,14 13,20 Z" fill={color} />
    </pattern>
  )
  if (pattern === 'checks') return (
    <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
      <rect width="12" height="24" fill={color} opacity=".45" />
      <rect width="24" height="12" fill={color} opacity=".45" />
    </pattern>
  )
  if (pattern === 'snowflakes') return (
    <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
      <g stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <line x1="6" y1="13" x2="20" y2="13" /><line x1="9.5" y1="6.9" x2="16.5" y2="19.1" /><line x1="16.5" y1="6.9" x2="9.5" y2="19.1" />
      </g>
    </pattern>
  )
  if (pattern === 'candycane') return (
    <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="14" fill={color} />
    </pattern>
  )
  if (pattern === 'bats') return (
    <pattern id={id} width="30" height="24" patternUnits="userSpaceOnUse">
      <path d="M15,9 Q11,3 5,5 Q8,8 3,11 Q9,11 11,15 Q13,12 15,13 Q17,12 19,15 Q21,11 27,11 Q22,8 25,5 Q19,3 15,9 Z" fill={color} />
    </pattern>
  )
  if (pattern === 'flowers') return (
    <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
      {[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180
        return <circle key={a} cx={13 + 4 * Math.cos(r)} cy={13 + 4 * Math.sin(r)} r="3" fill={color} />
      })}
      <circle cx="13" cy="13" r="2.2" fill="#fde68a" />
    </pattern>
  )
  if (pattern === 'confetti') return (
    <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse">
      <rect x="3" y="4" width="6" height="3" rx="1" fill={color} transform="rotate(25 6 5)" />
      <rect x="18" y="8" width="6" height="3" rx="1" fill="#fbbf24" transform="rotate(-30 21 9)" />
      <rect x="8" y="19" width="6" height="3" rx="1" fill="#22c55e" transform="rotate(60 11 20)" />
      <rect x="21" y="22" width="6" height="3" rx="1" fill="#3b82f6" transform="rotate(10 24 23)" />
      <circle cx="15" cy="14" r="1.8" fill="#ec4899" />
    </pattern>
  )
  if (pattern === 'zigzag') return (
    <pattern id={id} width="24" height="14" patternUnits="userSpaceOnUse">
      <polyline points="0,10 6,4 12,10 18,4 24,10" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
    </pattern>
  )
  return null
}

// ─── hair clips ─────────────────────────────────────────────────────────────
// Drawn accessories for hair (stored in design.decal as the clip id),
// painted in the hair tie & clip colour.
export const HAIR_CLIPS = [
  { id: 'bow',       label: 'Bow' },
  { id: 'heart',     label: 'Heart' },
  { id: 'star',      label: 'Star' },
  { id: 'flower',    label: 'Flower' },
  { id: 'butterfly', label: 'Butterfly' },
  { id: 'barrette',  label: 'Barrette' },
  { id: 'snap',      label: 'Snap clip' },
  { id: 'pearls',    label: 'Pearl pins' },
  { id: 'bobby',     label: 'Bobby pins' },
]
export const isHairClip = (id) => HAIR_CLIPS.some((c) => c.id === id)

// One clip centred on (0,0), about 30 units wide; place it with `transform`.
export function HairClipShape({ type, color }) {
  const ink = darken(color, 0.45)
  const light = lighten(color, 0.45)
  const line = { stroke: ink, strokeWidth: 1.6, strokeLinejoin: 'round' }
  if (type === 'bow') return (
    <g>
      <path d="M0,0 C-6,-10 -17,-9 -16,0 C-17,9 -6,10 0,0 Z" fill={color} {...line} />
      <path d="M0,0 C6,-10 17,-9 16,0 C17,9 6,10 0,0 Z" fill={color} {...line} />
      <path d="M-2,2 L-7,11 L-3,10 M2,2 L7,11 L3,10" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="-9" cy="-3" rx="3" ry="1.8" fill={light} opacity=".8" />
      <circle cx="0" cy="0" r="4" fill={color} {...line} />
    </g>
  )
  if (type === 'heart') return (
    <g>
      <path d="M0,9 C-12,1 -12,-9 -5,-9 C-2,-9 0,-6 0,-4 C0,-6 2,-9 5,-9 C12,-9 12,1 0,9 Z" fill={color} {...line} />
      <ellipse cx="-5" cy="-4" rx="2.6" ry="1.6" fill="#fff" opacity=".6" transform="rotate(-30 -5 -4)" />
    </g>
  )
  if (type === 'star') return (
    <g>
      <polygon points={star(0, 0, 11, 5)} fill={color} {...line} />
      <circle cx="-3" cy="-3" r="1.8" fill="#fff" opacity=".6" />
    </g>
  )
  if (type === 'flower') return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => {
        const r = ((a - 90) * Math.PI) / 180
        return <circle key={a} cx={6 * Math.cos(r)} cy={6 * Math.sin(r)} r="5.2" fill={color} {...line} />
      })}
      <circle cx="0" cy="0" r="3.8" fill="#fde68a" stroke={ink} strokeWidth="1.2" />
    </g>
  )
  if (type === 'butterfly') return (
    <g>
      {[-1, 1].map((sx) => (
        <g key={sx} transform={`scale(${sx} 1)`}>
          <ellipse cx="-7" cy="-4" rx="7.5" ry="6" fill={color} {...line} transform="rotate(-18 -7 -4)" />
          <ellipse cx="-6" cy="5" rx="5" ry="4" fill={light} {...line} transform="rotate(20 -6 5)" />
          <circle cx="-8" cy="-5" r="1.8" fill="#fff" opacity=".7" />
        </g>
      ))}
      <rect x="-1.6" y="-8" width="3.2" height="16" rx="1.6" fill={ink} />
    </g>
  )
  if (type === 'barrette') return (
    <g>
      <rect x="-15" y="-5" width="30" height="10" rx="5" fill={color} {...line} />
      <rect x="-12" y="-3" width="24" height="2.4" rx="1.2" fill={light} opacity=".8" />
      {[-8, 0, 8].map((cx) => <circle key={cx} cx={cx} cy="2" r="1.8" fill="#fff" stroke={ink} strokeWidth=".8" />)}
    </g>
  )
  if (type === 'snap') return (
    <g>
      <path d="M-15,0 Q-15,-6 -8,-6 L11,-2.5 Q15,0 11,2.5 L-8,6 Q-15,6 -15,0 Z" fill={color} {...line} />
      <ellipse cx="-6" cy="0" rx="4" ry="2.4" fill={darken(color, 0.25)} />
      <path d="M-4,-4 L9,-1.5" stroke={light} strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </g>
  )
  if (type === 'pearls') return (
    <g>
      {[[-10, 2], [0, -2], [10, 2]].map(([cx, cy]) => (
        <g key={cx}>
          <line x1={cx} y1={cy} x2={cx + 4} y2={cy + 9} stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="4.4" fill="#fdf6ec" stroke={color} strokeWidth="1.8" />
          <circle cx={cx - 1.4} cy={cy - 1.4} r="1.3" fill="#fff" />
        </g>
      ))}
    </g>
  )
  if (type === 'bobby') return (
    <g fill="none" strokeLinecap="round">
      {[-6, 6].map((dx) => (
        <g key={dx} transform={`rotate(${dx > 0 ? 28 : -28})`}>
          <path d={`M${dx - 1.5},-12 L${dx - 1.5},12 M${dx + 1.5},-12 Q${dx + 3.5},0 ${dx + 1.5},12`} stroke={ink} strokeWidth="3.6" />
          <path d={`M${dx - 1.5},-12 L${dx - 1.5},12 M${dx + 1.5},-12 Q${dx + 3.5},0 ${dx + 1.5},12`} stroke={color} strokeWidth="2" />
        </g>
      ))}
    </g>
  )
  return null
}

function HairClip({ type, x, y, size, color }) {
  if (!type) return null
  // Older designs stored an emoji here — keep showing those as stickers.
  if (!isHairClip(type)) return <Decal x={x} y={y} size={size} glyph={type} />
  const k = (size * 3) / 30
  return (
    <g transform={`translate(${x} ${y}) rotate(-18) scale(${k})`}>
      <HairClipShape type={type} color={color} />
    </g>
  )
}

function Decal({ x, y, size, glyph }) {
  if (!glyph) return null
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="central" style={{ userSelect: 'none' }}>
      {glyph}
    </text>
  )
}

// ─── the piece itself ───────────────────────────────────────────────────────
// Pao's own body, in the shared 300x366 space — fitted pieces trace these
// so they read as worn rather than stuck on top.
const BODY = { cx: 150, cy: 272, rx: 92, ry: 84 }
const SHIRT_REGION = 'M 30,150 L 270,150 L 270,314 Q 150,342 30,314 Z'
const WAIST = 'M 30,286 Q 150,314 270,286'
const PANTS_REGION = `${WAIST} L 270,380 L 30,380 Z`
const SHORTS_REGION = `${WAIST} L 270,334 Q 205,352 150,338 Q 95,352 30,334 Z`
const VEST_REGION = 'M 30,150 L 139,150 L 139,338 Q 90,332 30,312 Z M 270,150 L 161,150 L 161,338 Q 210,332 270,312 Z'

// Hair sits on Pao's head: circle (150,138) r=114, ears at (57,50) and
// (243,50). CAP covers the crown down to a soft hairline; BANGS adds a
// scalloped fringe over the forehead.
const HAIR_CAP = 'M 0,-60 L 300,-60 L 300,118 Q 264,80 218,74 Q 184,70 150,84 Q 116,70 82,74 Q 36,80 0,118 Z'
const HAIR_BANGS = 'M 0,-60 L 300,-60 L 300,120 Q 280,104 262,92 Q 246,106 228,86 Q 210,102 192,82 Q 172,98 150,80 Q 128,98 108,82 Q 90,102 72,86 Q 54,106 38,92 Q 20,104 0,120 Z'

// `layer` lets PandaMascot slot a piece in at the right depth: 'feet'
// (shoes, under the belly), 'body' (shirt/pants, under the arms and head),
// 'arms' (sleeves/scarf, over the arms but under the head), 'cape' (behind
// the body), 'back'/'front' (hair behind/on the head), and hair also has a
// 'clip' layer, drawn on top of everything so the ears never hide it.
// 'all' draws every part in order — used for the stand-alone thumbnails.
export function DesignedOutfit({ category, design, layer = 'all' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const d = { ...DEFAULT_DESIGNS[category], ...design }
  const main = d.main
  const trim = d.trim
  const hasPattern = d.pattern && d.pattern !== 'solid'
  const patId = `pdo-pat-${uid}`
  const outline = darken(main, 0.35)
  // Cartoon ink lines, same weight as Pao's own outlines
  const ink = darken(main, 0.6)
  const trimInk = darken(trim, 0.5)
  const show = (l) => layer === 'all' || layer === l

  const ids = {
    shade: `pdo-shade-${uid}`,
    body: `pdo-body-${uid}`,
    shirt: `pdo-shirt-${uid}`,
    region: `pdo-region-${uid}`,
    sleeve: `pdo-sleeve-${uid}`,
    aboveCuff: `pdo-cuff-${uid}`,
    hood: `pdo-hood-${uid}`,
    scarf: `pdo-scarf-${uid}`,
    hem: `pdo-hem-${uid}`,
    sides: `pdo-sides-${uid}`,
    footL: `pdo-footl-${uid}`,
    footR: `pdo-footr-${uid}`,
    head: `pdo-head-${uid}`,
  }
  const url = (id) => `url(#${id})`

  // Hair pieces: solid fill, the pattern on top, then a soft outline.
  const paint = (el, key) => (
    <g key={key}>
      {cloneElement(el, { fill: main })}
      {hasPattern && cloneElement(el, { fill: `url(#${patId})` })}
      {cloneElement(el, { fill: 'none', stroke: outline, strokeWidth: 2, strokeOpacity: 0.55 })}
    </g>
  )

  // Worn pieces: fill, pattern, a soft light-to-shadow shading so the
  // fabric wraps around Pao's round body, then an ink outline.
  const cloth = (el, key, { stroke = true } = {}) => (
    <g key={key}>
      {cloneElement(el, { fill: main })}
      {hasPattern && cloneElement(el, { fill: url(patId) })}
      {cloneElement(el, { fill: url(ids.shade) })}
      {stroke && cloneElement(el, { fill: 'none', stroke: ink, strokeWidth: 4, strokeLinejoin: 'round' })}
    </g>
  )

  // A trim band with its own outline (cuffs, hems, waistbands).
  const band = (dPath, width, key) => (
    <g key={key}>
      <path d={dPath} fill="none" stroke={trimInk} strokeWidth={width + 3.5} strokeLinecap="round" />
      <path d={dPath} fill="none" stroke={trim} strokeWidth={width} strokeLinecap="round" />
    </g>
  )

  // Fabric cut to Pao's body: the region clipped to his silhouette, with
  // the body edge re-inked only where the fabric covers it.
  const fitted = (regionD, key) => (
    <g key={key}>
      <g clipPath={url(ids.body)}>{cloth(<path d={regionD} />, 'f')}</g>
      <g clipPath={url(ids.region)}>
        <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx + 1} ry={BODY.ry + 1} fill="none" stroke={ink} strokeWidth="4.5" />
      </g>
    </g>
  )

  // Draw the left-hand version, then mirror it for the right side.
  const pairLR = (render, key) => (
    <g key={key}>
      {render()}
      <g transform="translate(300 0) scale(-1 1)">{render()}</g>
    </g>
  )

  let regionD = null
  if (category === 'clothes') regionD = d.style === 'vest' ? VEST_REGION : SHIRT_REGION
  if (category === 'pants') regionD = d.style === 'shorts' ? SHORTS_REGION : PANTS_REGION
  if (category === 'hair' && !['tuft', 'curly'].includes(d.style)) regionD = d.style === 'bangs' ? HAIR_BANGS : HAIR_CAP

  const defs = (
    <defs>
      {hasPattern && <PatternDef id={patId} pattern={d.pattern} color={d.patternColor} />}
      <radialGradient id={ids.shade} cx="38%" cy="30%" r="78%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
        <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.24" />
      </radialGradient>
      <clipPath id={ids.body}><ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx + 2.5} ry={BODY.ry + 2.5} /></clipPath>
      {regionD && <clipPath id={ids.region}><path d={regionD} /></clipPath>}
      {/* short sleeve: shoulder half of the upper arm, in the arm's rotated frame */}
      <clipPath id={ids.sleeve}><rect x="57" y="230" width="90" height="100" /></clipPath>
      {/* long sleeve stops at the wrist so the paw stays out */}
      <clipPath id={ids.aboveCuff}><rect x="0" y="150" width="300" height="147" /></clipPath>
      <clipPath id={ids.hood}><ellipse cx="150" cy="276" rx="104" ry="96" /></clipPath>
      <clipPath id={ids.scarf}><rect x="0" y="206" width="300" height="160" /></clipPath>
      <clipPath id={ids.hem}><rect x="0" y="340" width="300" height="40" /></clipPath>
      <clipPath id={ids.sides}><rect x="0" y="290" width="92" height="90" /><rect x="208" y="290" width="92" height="90" /></clipPath>
      <clipPath id={ids.footL}><ellipse cx="108" cy="339" rx="48.5" ry="26" /></clipPath>
      <clipPath id={ids.footR}><ellipse cx="192" cy="339" rx="48.5" ry="26" /></clipPath>
      <clipPath id={ids.head}><circle cx="150" cy="138" r="116.5" /></clipPath>
    </defs>
  )

  let body = null

  if (category === 'hats' && show('hats')) {
    if (d.style === 'cap') {
      body = (
        <>
          {paint(<path d="M 86,70 Q 84,4 150,2 Q 216,4 214,70 Z" />)}
          <path d="M 150,4 L 150,68 M 118,8 Q 110,40 112,68 M 182,8 Q 190,40 188,68" fill="none" stroke={outline} strokeWidth="1.8" opacity=".4" />
          <path d="M 70,72 Q 150,50 230,72 Q 230,88 150,90 Q 70,88 70,72 Z" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="2" />
          <circle cx="150" cy="4" r="7" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <ellipse cx="118" cy="28" rx="18" ry="9" fill="#fff" opacity=".2" transform="rotate(-22 118 28)" />
          <Decal x={150} y={40} size={26} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'tophat') {
      body = (
        <>
          <ellipse cx="150" cy="62" rx="80" ry="15" fill={darken(main, 0.25)} />
          {paint(<path d="M 104,60 L 108,-40 Q 150,-48 192,-40 L 196,60 Q 150,70 104,60 Z" />)}
          <ellipse cx="150" cy="-40" rx="42" ry="9" fill={lighten(main, 0.15)} stroke={outline} strokeWidth="1.5" />
          <path d="M 106,36 Q 150,44 194,36 L 195,54 Q 150,62 105,54 Z" fill={trim} />
          <ellipse cx="126" cy="-6" rx="8" ry="26" fill="#fff" opacity=".15" />
          <Decal x={150} y={4} size={28} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'crown') {
      body = (
        <>
          {paint(<polygon points="92,66 90,6 118,34 134,-6 150,28 166,-6 182,34 210,6 208,66" />)}
          <rect x="88" y="48" width="124" height="20" rx="7" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          {[[90, 6], [134, -6], [166, -6], [210, 6]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6.5" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          ))}
          {[110, 190].map((x) => <circle key={x} cx={x} cy="58" r="4.5" fill={lighten(main, 0.35)} />)}
          <Decal x={150} y={40} size={24} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'bow') {
      body = (
        <>
          <path d="M 184,46 L 172,82 L 186,76 L 192,86 L 198,46 Z" fill={darken(main, 0.15)} />
          <path d="M 196,46 L 208,80 L 214,72 L 224,78 L 206,44 Z" fill={darken(main, 0.15)} />
          {paint(<ellipse cx="164" cy="34" rx="28" ry="19" transform="rotate(-18 164 34)" />, 'l')}
          {paint(<ellipse cx="220" cy="34" rx="28" ry="19" transform="rotate(18 220 34)" />, 'r')}
          <circle cx="192" cy="40" r="12" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <Decal x={192} y={40} size={14} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'witch') {
      body = (
        <>
          <ellipse cx="150" cy="60" rx="92" ry="17" fill={darken(main, 0.25)} stroke={outline} strokeWidth="2" />
          {paint(<path d="M 104,60 Q 124,20 140,-12 Q 150,-36 176,-46 Q 196,-50 206,-40 Q 184,-38 176,-20 Q 170,10 196,60 Z" />)}
          <path d="M 108,42 Q 150,52 192,42 L 195,58 Q 150,68 105,58 Z" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <rect x="140" y="44" width="20" height="16" rx="3" fill="none" stroke={lighten(trim, 0.45)} strokeWidth="3.5" />
          <Decal x={150} y={16} size={22} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'santa') {
      body = (
        <>
          {paint(<path d="M 84,64 Q 86,2 150,-2 Q 214,-4 240,92 Q 222,44 198,36 Q 212,50 216,64 Z" />)}
          <ellipse cx="124" cy="22" rx="18" ry="9" fill="#fff" opacity=".2" transform="rotate(-24 124 22)" />
          <rect x="76" y="50" width="148" height="26" rx="13" fill={trim} stroke={darken(trim, 0.25)} strokeWidth="1.5" />
          <circle cx="240" cy="94" r="15" fill={trim} stroke={darken(trim, 0.25)} strokeWidth="1.5" />
          <Decal x={150} y={63} size={16} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'antlers') {
      const antler = () => (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {['M 104,40 Q 92,10 76,-18', 'M 90,14 Q 70,10 56,-4', 'M 84,-2 Q 98,-14 102,-32'].map((p) => (
            <g key={p}>
              <path d={p} stroke={darken(main, 0.45)} strokeWidth="14" />
              <path d={p} stroke={main} strokeWidth="9.5" />
            </g>
          ))}
        </g>
      )
      body = (
        <>
          {antler()}
          <g transform="translate(300 0) scale(-1 1)">{antler()}</g>
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={darken(trim, 0.3)} strokeWidth="13" strokeLinecap="round" />
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={trim} strokeWidth="9" strokeLinecap="round" />
          <Decal x={150} y={17} size={16} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'bunny') {
      const ear = () => (
        <>
          {paint(<ellipse cx="116" cy="-14" rx="18" ry="46" transform="rotate(-10 116 -14)" />)}
          <ellipse cx="117" cy="-8" rx="8" ry="32" fill={trim} opacity=".9" transform="rotate(-10 117 -8)" />
        </>
      )
      body = (
        <>
          {ear()}
          <g transform="translate(300 0) scale(-1 1)">{ear()}</g>
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={outline} strokeWidth="13" strokeLinecap="round" strokeOpacity=".6" />
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={main} strokeWidth="10" strokeLinecap="round" />
          <Decal x={150} y={17} size={16} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'party') {
      body = (
        <g transform="rotate(-8 150 40)">
          {paint(<polygon points="110,58 150,-34 190,58" />)}
          <path d="M 110,58 Q 150,68 190,58" fill="none" stroke={trim} strokeWidth="8" strokeLinecap="round" />
          <circle cx="150" cy="-36" r="12" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <Decal x={150} y={24} size={20} glyph={d.decal} />
        </g>
      )
    } else if (d.style === 'headband') {
      body = (
        <>
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={outline} strokeWidth="16" strokeLinecap="round" strokeOpacity=".5" />
          <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={main} strokeWidth="13" strokeLinecap="round" />
          {hasPattern && <path d="M 72,86 Q 72,20 150,16 Q 228,20 228,86" fill="none" stroke={`url(#${patId})`} strokeWidth="13" strokeLinecap="round" />}
          <circle cx="104" cy="36" r="17" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <Decal x={104} y={36} size={20} glyph={d.decal || '🌸'} />
        </>
      )
    } else {
      // beanie
      body = (
        <>
          {paint(<path d="M 80,74 Q 74,-2 150,-6 Q 226,-2 220,74 Z" />)}
          <rect x="74" y="56" width="152" height="26" rx="13" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          {[92, 108, 124, 140, 156, 172, 188, 204].map((x) => (
            <line key={x} x1={x} y1="60" x2={x} y2="78" stroke={darken(trim, 0.2)} strokeWidth="1.6" opacity=".45" />
          ))}
          <circle cx="150" cy="-12" r="16" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <circle cx="145" cy="-17" r="5" fill="#fff" opacity=".35" />
          <ellipse cx="116" cy="18" rx="22" ry="10" fill="#fff" opacity=".2" transform="rotate(-24 116 18)" />
          <Decal x={150} y={26} size={28} glyph={d.decal} />
        </>
      )
    }
  }

  if (category === 'hair') {
    // Hair covering the top of the head, cut to his head shape, with the
    // head outline re-inked under it and a glossy highlight.
    const onHead = (
      <>
        {regionD && (
          <>
            <g clipPath={url(ids.head)}>{cloth(<path d={regionD} />, 'cap')}</g>
            <g clipPath={url(ids.region)}><circle cx="150" cy="138" r="115" fill="none" stroke={ink} strokeWidth="5" /></g>
            <path d="M 98,40 Q 150,18 202,40" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".3" />
          </>
        )}
      </>
    )
    // Soft cloud of curls: all the ink rings first, then all the fills, so
    // the outline only shows around the outside of the cloud.
    const cloud = (circles, key) => (
      <g key={key}>
        {circles.map(([cx, cy, r]) => <circle key={`o${cx}-${cy}`} cx={cx} cy={cy} r={r + 4} fill={ink} />)}
        {circles.map(([cx, cy, r]) => <circle key={`f${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={main} />)}
        {hasPattern && circles.map(([cx, cy, r]) => <circle key={`p${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={url(patId)} />)}
        {circles.map(([cx, cy, r]) => <circle key={`s${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={url(ids.shade)} />)}
      </g>
    )
    const tie = (cx, cy, r = 8) => <circle cx={cx} cy={cy} r={r} fill={trim} stroke={trimInk} strokeWidth="2.5" />

    let back = null
    let front = null
    let clip = null // [x, y, size] of the hair clip

    if (d.style === 'tuft') {
      front = cloth(<path d="M 136,30 Q 120,-4 148,-22 Q 140,0 156,10 Q 162,-12 188,-14 Q 170,4 168,30 Z" />, 'tuft')
      clip = [182, 30, 16]
    } else if (d.style === 'curly') {
      const ring = (radius, from, to, step, r) => {
        const out = []
        for (let a = from; a <= to; a += step) {
          const rad = (a * Math.PI) / 180
          out.push([Math.round(150 + radius * Math.cos(rad)), Math.round(138 + radius * Math.sin(rad)), r])
        }
        return out
      }
      front = cloud([...ring(106, 205, 335, 16, 24), ...ring(84, 222, 318, 24, 22)], 'curls')
      clip = [114, 42, 18]
    } else if (d.style === 'spiky') {
      back = cloth(<polygon points="56,74 30,18 86,34 88,-18 126,14 150,-38 174,14 212,-18 214,34 270,18 244,74" />, 'spikes')
      front = onHead
      clip = [118, 58, 16]
    } else if (d.style === 'bun') {
      back = (
        <>
          {cloth(<circle cx="150" cy="2" r="30" />, 'bun')}
          <path d="M 132,-6 Q 150,-20 168,-6 M 134,10 Q 150,-2 166,10" fill="none" stroke={ink} strokeWidth="2.5" opacity=".35" strokeLinecap="round" />
        </>
      )
      front = (<>{onHead}<ellipse cx="150" cy="28" rx="22" ry="7" fill={trim} stroke={trimInk} strokeWidth="2.5" /></>)
      clip = [118, 56, 16]
    } else if (d.style === 'ponytail') {
      back = cloth(<path d="M 212,22 Q 292,18 288,110 Q 286,164 262,196 Q 270,128 244,72 Z" />, 'tail')
      front = (<>{onHead}{tie(198, 28, 9)}</>)
      clip = [198, 28, 14]
    } else if (d.style === 'pigtails') {
      back = pairLR(() => (
        <>
          {cloth(<ellipse cx="30" cy="124" rx="26" ry="42" transform="rotate(18 30 124)" />, 'tail')}
          <path d="M 22,108 Q 32,128 26,152" fill="none" stroke={ink} strokeWidth="2.5" opacity=".35" strokeLinecap="round" />
        </>
      ), 'tails')
      front = (
        <>
          {onHead}
          <path d="M 150,62 L 150,26" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".45" />
          {pairLR(() => tie(46, 88))}
        </>
      )
      clip = [46, 88, 15]
    } else if (d.style === 'long') {
      back = cloth(<path d="M 150,6 C 60,6 22,70 24,150 C 26,200 30,238 48,266 Q 70,258 84,270 Q 96,250 100,236 L 200,236 Q 204,250 216,270 Q 230,258 252,266 C 270,238 274,200 276,150 C 278,70 240,6 150,6 Z" />, 'long')
      front = onHead
      clip = [112, 64, 18]
    } else {
      // bangs
      front = onHead
      clip = [110, 72, 16]
    }

    body = (
      <>
        {show('back') && back}
        {show('front') && front}
        {show('clip') && clip && <HairClip x={clip[0]} y={clip[1]} size={clip[2]} type={d.decal} color={trim} />}
      </>
    )
  }

  if (category === 'clothes') {
    const collar = (
      <g clipPath={url(ids.body)}>
        <circle cx="150" cy="138" r="120" fill="none" stroke={trimInk} strokeWidth="13" />
        <circle cx="150" cy="138" r="120" fill="none" stroke={trim} strokeWidth="9.5" />
      </g>
    )
    const hem = <g clipPath={url(ids.body)}>{band('M 30,308 Q 150,335 270,308', 9, 'hem')}</g>
    const creases = (
      <g fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity=".35">
        <path d="M 118,300 Q 130,307 142,303" />
        <path d="M 160,305 Q 172,309 184,300" />
        <path d="M 96,262 Q 104,276 102,292" />
        <path d="M 204,262 Q 196,276 198,292" />
      </g>
    )
    const shortSleeve = () => (
      <g transform="rotate(-28 68 278)">
        <g clipPath={url(ids.sleeve)}>{cloth(<ellipse cx="68" cy="278" rx="37" ry="24" />)}</g>
        <ellipse cx="58" cy="278" rx="5" ry="22.6" fill={trim} stroke={trimInk} strokeWidth="2.5" />
      </g>
    )
    const longSleeve = () => (
      <>
        <g clipPath={url(ids.aboveCuff)}>
          <g transform="rotate(-28 68 278)">{cloth(<ellipse cx="68" cy="278" rx="37" ry="24" />, 'u')}</g>
          {cloth(<ellipse cx="58" cy="300" rx="29" ry="21" />, 'lo')}
        </g>
        <ellipse cx="58" cy="297" rx="28.4" ry="5.5" fill={trim} stroke={trimInk} strokeWidth="2.5" />
      </>
    )

    let bodyPart = null
    let armsPart = null
    let capePart = null

    if (d.style === 'sweater') {
      bodyPart = (<>{fitted(SHIRT_REGION)}{creases}{hem}{collar}<Decal x={150} y={290} size={30} glyph={d.decal} /></>)
      armsPart = pairLR(longSleeve)
    } else if (d.style === 'hoodie') {
      bodyPart = (
        <>
          {fitted(SHIRT_REGION)}
          {creases}
          {hem}
          {/* hood down: a thick rolled rim around the neck, under the chin */}
          <g clipPath={url(ids.hood)}>
            <circle cx="150" cy="138" r="125" fill="none" stroke={ink} strokeWidth="24" />
            <circle cx="150" cy="138" r="125" fill="none" stroke={darken(main, 0.12)} strokeWidth="19.5" />
            {hasPattern && <circle cx="150" cy="138" r="125" fill="none" stroke={url(patId)} strokeWidth="19.5" />}
            <circle cx="150" cy="138" r="125" fill="none" stroke={url(ids.shade)} strokeWidth="19.5" />
          </g>
          {cloth(<path d="M 112,296 Q 150,288 188,296 L 180,326 Q 150,333 120,326 Z" />, 'pocket')}
          <path d="M 136,252 Q 134,268 133,284 M 164,252 Q 166,268 167,284" fill="none" stroke={trim} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="133" cy="286" r="3.6" fill={trim} stroke={trimInk} strokeWidth="1.5" />
          <circle cx="167" cy="286" r="3.6" fill={trim} stroke={trimInk} strokeWidth="1.5" />
          <Decal x={150} y={311} size={18} glyph={d.decal} />
        </>
      )
      armsPart = pairLR(longSleeve)
    } else if (d.style === 'vest') {
      bodyPart = (
        <>
          {fitted(VEST_REGION)}
          <g clipPath={url(ids.body)}>
            {band('M 139,246 L 139,337', 5, 'l')}
            {band('M 161,246 L 161,337', 5, 'r')}
          </g>
          {[272, 294, 316].map((y) => <circle key={y} cx="130" cy={y} r="4.2" fill={trim} stroke={trimInk} strokeWidth="1.5" />)}
          <Decal x={104} y={288} size={20} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'cape') {
      // The cape hangs behind Pao's body (the 'cape' layer), so only its
      // edges show around him; the collar and clasp sit at his neck.
      capePart = cloth(<path d="M 92,206 Q 42,276 28,352 Q 90,372 150,362 Q 210,372 272,352 Q 258,276 208,206 Z" />, 'cape')
      armsPart = (
        <>
          {pairLR(() => (
            <path d="M 106,224 L 72,168 L 126,206 Z" fill={trim} stroke={trimInk} strokeWidth="3" strokeLinejoin="round" />
          ))}
          <path d="M 112,248 Q 150,266 188,248" fill="none" stroke={trim} strokeWidth="5" strokeLinecap="round" />
          <circle cx="150" cy="258" r="9" fill={trim} stroke={trimInk} strokeWidth="2.5" />
          <Decal x={150} y={259} size={14} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'scarf') {
      armsPart = (
        <>
          {/* wraps around the neck — the head, drawn after, hides the inner edge */}
          <g clipPath={url(ids.scarf)}>
            <circle cx="150" cy="140" r="122" fill="none" stroke={ink} strokeWidth="22" />
            <circle cx="150" cy="140" r="122" fill="none" stroke={main} strokeWidth="17" />
            {hasPattern && <circle cx="150" cy="140" r="122" fill="none" stroke={url(patId)} strokeWidth="17" />}
          </g>
          {cloth(<path d="M 172,240 Q 184,280 178,318 L 204,314 Q 208,274 196,236 Z" />, 'tail')}
          <path d="M 180,302 L 204,299" stroke={trim} strokeWidth="5" />
          {[182, 188, 194, 200].map((x) => (
            <line key={x} x1={x} y1="316" x2={x + 1} y2="327" stroke={trim} strokeWidth="3" strokeLinecap="round" />
          ))}
          <Decal x={189} y={276} size={14} glyph={d.decal} />
        </>
      )
    } else {
      // tee
      bodyPart = (<>{fitted(SHIRT_REGION)}{creases}{hem}{collar}<Decal x={150} y={290} size={30} glyph={d.decal} /></>)
      armsPart = pairLR(shortSleeve)
    }

    body = (<>{show('cape') && capePart}{show('body') && bodyPart}{show('arms') && armsPart}</>)
  }

  if (category === 'pants' && show('body')) {
    const waistband = <g clipPath={url(ids.body)}>{band('M 30,291 Q 150,319 270,291', 10, 'waist')}</g>
    const seam = <path d="M 150,318 L 150,344 M 138,357 Q 150,342 162,357" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".7" />
    const legHem = (width, key) => (
      <g key={key} clipPath={url(ids.body)}>
        <g clipPath={url(ids.hem)}>
          <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx - 3} ry={BODY.ry - 3} fill="none" stroke={trimInk} strokeWidth={width + 3.5} />
          <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx - 3} ry={BODY.ry - 3} fill="none" stroke={trim} strokeWidth={width} />
        </g>
      </g>
    )

    if (d.style === 'shorts') {
      body = (
        <>
          {fitted(SHORTS_REGION)}
          <g clipPath={url(ids.body)}>{band('M 34,329 Q 95,346 150,333 Q 205,346 266,329', 7, 'cuffs')}</g>
          <path d="M 150,326 L 150,336" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".7" />
          {waistband}
          <Decal x={110} y={322} size={14} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'skirt') {
      const SKIRT = 'M 60,300 Q 150,324 240,300 Q 256,326 266,350 Q 150,378 34,350 Q 44,326 60,300 Z'
      body = (
        <>
          {cloth(<path d={SKIRT} />, 'skirt')}
          <g fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity=".35">
            <path d="M 104,316 L 92,364" /><path d="M 150,324 L 150,370" /><path d="M 196,316 L 208,364" />
          </g>
          {band('M 38,349 Q 150,376 262,349', 8, 'hem')}
          {band('M 60,301 Q 150,326 240,301', 9, 'waist')}
          <Decal x={150} y={346} size={18} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'joggers') {
      body = (
        <>
          {fitted(PANTS_REGION)}
          <g clipPath={url(ids.region)}>
            <g clipPath={url(ids.sides)}>
              <ellipse cx={BODY.cx} cy={BODY.cy} rx={BODY.rx - 9} ry={BODY.ry - 8} fill="none" stroke={trim} strokeWidth="6" />
            </g>
          </g>
          {seam}
          {legHem(11, 'cuff')}
          {waistband}
          <path d="M 146,304 Q 142,316 138,322 M 154,304 Q 158,316 162,322" fill="none" stroke={trimInk} strokeWidth="2.5" strokeLinecap="round" />
          <Decal x={112} y={332} size={15} glyph={d.decal} />
        </>
      )
    } else {
      body = (
        <>
          {fitted(PANTS_REGION)}
          {seam}
          {legHem(6, 'cuff')}
          {waistband}
          {[96, 204].map((x) => <rect key={x} x={x - 3} y="291" width="6" height="13" rx="2" fill={darken(trim, 0.15)} transform={`rotate(${x < 150 ? 10 : -10} ${x} 305)`} />)}
          <Decal x={112} y={332} size={15} glyph={d.decal} />
        </>
      )
    }
  }

  if (category === 'shoes' && show('feet')) {
    // Each shoe is drawn at the left foot (x=108) and mirrored; Pao's belly,
    // drawn after, covers the back of the shoe just like his real feet.
    const x = 108
    const foot = <ellipse cx={x} cy="339" rx="48.5" ry="26" />
    let decalAt = [x - 27, 344, 13]

    let shoe = null
    if (d.style === 'boots') {
      shoe = () => (
        <>
          {cloth(<path d={`M ${x - 48},342 L ${x - 53},302 Q ${x},288 ${x + 53},302 L ${x + 48},342 Z`} />, 'shaft')}
          {band(`M ${x - 53},304 Q ${x},291 ${x + 53},304`, 9, 'cuffb')}
          {cloth(foot, 'foot')}
          <g clipPath={url(ids.footL)}><rect x={x - 50} y="355" width="100" height="12" fill={darken(trim, 0.2)} /></g>
        </>
      )
    } else if (d.style === 'slippers') {
      shoe = () => (
        <>
          {cloth(foot, 'foot')}
          <path d={`M ${x - 48},339 A 48 26 0 0 1 ${x + 48},339`} fill="none" stroke={trimInk} strokeWidth="12" strokeLinecap="round" />
          <path d={`M ${x - 48},339 A 48 26 0 0 1 ${x + 48},339`} fill="none" stroke={trim} strokeWidth="8.5" strokeLinecap="round" strokeDasharray="0.1 7" />
          <path d={`M ${x - 48},339 A 48 26 0 0 1 ${x + 48},339`} fill="none" stroke={trim} strokeWidth="6" strokeLinecap="round" />
          <circle cx={x - 40} cy="324" r="9" fill={lighten(trim, 0.2)} stroke={trimInk} strokeWidth="2" />
        </>
      )
    } else if (d.style === 'sandals') {
      decalAt = [x - 36, 332, 11]
      shoe = () => (
        <>
          <g clipPath={url(ids.footL)}>
            <rect x={x - 50} y="354" width="100" height="14" fill={trim} />
            <path d={`M ${x - 50},354 L ${x + 50},354`} stroke={trimInk} strokeWidth="2.5" />
          </g>
          <ellipse cx={x} cy="339" rx="48.5" ry="26" fill="none" stroke={trimInk} strokeWidth="2" opacity=".4" />
          {[`M ${x - 47},330 Q ${x},314 ${x + 47},330`, `M ${x - 46},346 Q ${x},334 ${x + 46},346`].map((p, i) => (
            <g key={i}>
              <path d={p} fill="none" stroke={ink} strokeWidth="12.5" strokeLinecap="round" />
              <path d={p} fill="none" stroke={main} strokeWidth="9" strokeLinecap="round" />
              {hasPattern && <path d={p} fill="none" stroke={url(patId)} strokeWidth="9" strokeLinecap="round" />}
            </g>
          ))}
        </>
      )
    } else {
      // sneakers
      shoe = () => (
        <>
          {cloth(foot, 'foot')}
          <g clipPath={url(ids.footL)}>
            <ellipse cx={x + 4} cy="350" rx="34" ry="10" fill={lighten(main, 0.3)} opacity=".6" />
            <rect x={x - 50} y="353" width="100" height="14" fill={trim} />
            <path d={`M ${x - 50},353 L ${x + 50},353`} stroke={trimInk} strokeWidth="2.5" />
          </g>
          <path d={`M ${x - 46},331 Q ${x - 32},343 ${x - 12},338`} fill="none" stroke={trim} strokeWidth="5" strokeLinecap="round" />
          {[322, 330].map((y) => (
            <line key={y} x1={x - 12} y1={y} x2={x + 12} y2={y} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
          ))}
        </>
      )
    }
    // Stickers sit outside the mirror so the right shoe's isn't flipped.
    const [dx, dy, size] = decalAt
    body = (
      <>
        {shoe()}
        <g transform="translate(300 0) scale(-1 1)">{shoe()}</g>
        <Decal x={dx} y={dy} size={size} glyph={d.decal} />
        <Decal x={300 - dx} y={dy} size={size} glyph={d.decal} />
      </>
    )
  }

  return <g>{defs}{body}</g>
}

// Hair is shown on a plain head so a fringe reads as a fringe.
const THUMB_VIEWBOXES = { ...THUMB_VB, hats: THUMB_VB.hair, hair: '8 -46 284 270' }

export function DesignedOutfitThumbnail({ category, design, width = 72 }) {
  const vb = THUMB_VIEWBOXES[category] || '0 0 300 366'
  const [,, vw, vh] = vb.split(' ').map(Number)
  return (
    <svg viewBox={vb} width={width} height={Math.round(width * vh / vw)} style={{ display: 'block', overflow: 'visible' }}>
      {category === 'hair' ? (
        <>
          <DesignedOutfit category="hair" design={design} layer="back" />
          <circle cx="57" cy="50" r="38" fill="#3b2a1d" stroke="#2a1d13" strokeWidth="4" />
          <circle cx="243" cy="50" r="38" fill="#3b2a1d" stroke="#2a1d13" strokeWidth="4" />
          <circle cx="150" cy="138" r="114" fill="#fbfbfb" stroke="#2a1d13" strokeWidth="5" />
          <DesignedOutfit category="hair" design={design} layer="front" />
          <DesignedOutfit category="hair" design={design} layer="clip" />
        </>
      ) : (
        <DesignedOutfit category={category} design={design} />
      )}
    </svg>
  )
}
