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
    { id: 'beanie',   label: 'Beanie' },
    { id: 'cap',      label: 'Cap' },
    { id: 'tophat',   label: 'Top hat' },
    { id: 'crown',    label: 'Crown' },
    { id: 'bow',      label: 'Bow' },
    { id: 'headband', label: 'Headband' },
  ],
  clothes: [
    { id: 'tee',     label: 'T-shirt' },
    { id: 'sweater', label: 'Sweater' },
    { id: 'hoodie',  label: 'Hoodie' },
    { id: 'vest',    label: 'Vest' },
    { id: 'scarf',   label: 'Scarf' },
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
]

export const DESIGN_COLOURS = [
  '#ef4444', '#f97316', '#fbbf24', '#84cc16', '#22c55e', '#14b8a6', '#38bdf8',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f9a8d4', '#a16207', '#1f2937',
  '#9ca3af', '#ffffff',
]

export const DESIGN_DECALS = ['⭐', '❤️', '🌈', '🚀', '🐾', '🌸', '⚡', '🎵', '🍀', '🦋', '🌙', '☀️', '🍓', '🐼', '🏆', '🧩']

export const DEFAULT_DESIGNS = {
  hair:    { style: 'beanie',   main: '#3b82f6', trim: '#fbbf24', pattern: 'solid',   patternColor: '#ffffff', decal: '' },
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
  if (pattern === 'zigzag') return (
    <pattern id={id} width="24" height="14" patternUnits="userSpaceOnUse">
      <polyline points="0,10 6,4 12,10 18,4 24,10" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
    </pattern>
  )
  return null
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

// `layer` lets PandaMascot slot a piece in at the right depth: 'feet'
// (shoes, under the belly), 'body' (shirt/pants, under the arms and head),
// 'arms' (sleeves/scarf, over the arms but under the head). 'all' draws
// every part in order — used for the stand-alone thumbnails.
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
    </defs>
  )

  let body = null

  if (category === 'hair' && show('hair')) {
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

    body = (<>{show('body') && bodyPart}{show('arms') && armsPart}</>)
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

// Cropped close-up of a designed piece, same framing as OutfitThumbnail.
export function DesignedOutfitThumbnail({ category, design, width = 72 }) {
  const vb = THUMB_VB[category] || '0 0 300 366'
  const [,, vw, vh] = vb.split(' ').map(Number)
  return (
    <svg viewBox={vb} width={width} height={Math.round(width * vh / vw)} style={{ display: 'block', overflow: 'visible' }}>
      <DesignedOutfit category={category} design={design} />
    </svg>
  )
}
