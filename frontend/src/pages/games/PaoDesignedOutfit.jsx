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
export function DesignedOutfit({ category, design }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const d = { ...DEFAULT_DESIGNS[category], ...design }
  const main = d.main
  const trim = d.trim
  const hasPattern = d.pattern && d.pattern !== 'solid'
  const patId = `pdo-pat-${uid}`
  const clipId = `pdo-clip-${uid}`
  const outline = darken(main, 0.35)

  // Paint one base shape: solid fill, the pattern on top, then a soft
  // outline — so every template gets the same colour/pattern treatment.
  const paint = (el, key) => (
    <g key={key}>
      {cloneElement(el, { fill: main })}
      {hasPattern && cloneElement(el, { fill: `url(#${patId})` })}
      {cloneElement(el, { fill: 'none', stroke: outline, strokeWidth: 2, strokeOpacity: 0.55 })}
    </g>
  )

  const defs = (
    <defs>
      {hasPattern && <PatternDef id={patId} pattern={d.pattern} color={d.patternColor} />}
      <clipPath id={clipId}><ellipse cx="150" cy="272" rx="91" ry="83" /></clipPath>
    </defs>
  )

  let body = null

  if (category === 'hair') {
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
    // Every ellipse here is sized a hair larger than the matching arm/torso
    // part it sits over in PandaMascot.jsx (body 92×84, upper arm 34×21,
    // forearm 27×19, paw 22×14) so the fabric fully swallows Pao's own
    // brown fur with no sliver showing at the seams — an exact 1:1 match
    // left a visible crescent at the elbow bend.
    const torso = <ellipse cx="150" cy="272" rx="95" ry="87" />
    const upperL = <ellipse cx="68" cy="278" rx="37" ry="24" transform="rotate(-28 68 278)" />
    const upperR = <ellipse cx="232" cy="278" rx="37" ry="24" transform="rotate(28 232 278)" />
    const forearmL = <ellipse cx="58" cy="300" rx="30" ry="22" />
    const forearmR = <ellipse cx="242" cy="300" rx="30" ry="22" />
    const pawCuffL = <ellipse cx="52" cy="308" rx="25" ry="17" />
    const pawCuffR = <ellipse cx="248" cy="308" rx="25" ry="17" />
    // Short sleeve: covers the upper arm + elbow only, paw stays bare.
    const shortSleeves = (
      <>
        {paint(upperL, 'ul')}{paint(upperR, 'ur')}
        {paint(forearmL, 'fl')}{paint(forearmR, 'fr')}
        <ellipse cx="58" cy="300" rx="8" ry="19" fill={trim} transform="rotate(-10 58 300)" />
        <ellipse cx="242" cy="300" rx="8" ry="19" fill={trim} transform="rotate(10 242 300)" />
      </>
    )
    // Long sleeve: also covers the paw, with a cuff ring at the wrist.
    const longSleeves = (
      <>
        {paint(upperL, 'ul')}{paint(upperR, 'ur')}
        {paint(forearmL, 'fl')}{paint(forearmR, 'fr')}
        {paint(pawCuffL, 'pl')}{paint(pawCuffR, 'pr')}
        <ellipse cx="52" cy="303" rx="12" ry="4" fill={trim} transform="rotate(-18 52 303)" />
        <ellipse cx="248" cy="303" rx="12" ry="4" fill={trim} transform="rotate(18 248 303)" />
      </>
    )
    const hem = (
      <g clipPath={`url(#${clipId})`}>
        <rect x="52" y="332" width="196" height="16" fill={trim} />
      </g>
    )

    if (d.style === 'sweater') {
      body = (
        <>
          {paint(torso)}
          {hem}
          {longSleeves}
          <path d="M 116,198 Q 150,224 184,198" fill="none" stroke={trim} strokeWidth="9" strokeLinecap="round" />
          <Decal x={150} y={264} size={40} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'hoodie') {
      body = (
        <>
          {paint(torso)}
          {hem}
          {longSleeves}
          <path d="M 108,292 Q 150,284 192,292 L 184,326 Q 150,332 116,326 Z" fill={darken(main, 0.12)} stroke={outline} strokeWidth="1.5" strokeOpacity=".5" />
          <path d="M 96,206 Q 94,182 116,186 Q 150,176 184,186 Q 206,182 204,206 Q 150,232 96,206 Z" fill={darken(main, 0.18)} stroke={outline} strokeWidth="2" strokeOpacity=".5" />
          <path d="M 136,214 L 134,250 M 164,214 L 166,250" stroke={trim} strokeWidth="3" strokeLinecap="round" />
          <circle cx="134" cy="252" r="3.5" fill={trim} />
          <circle cx="166" cy="252" r="3.5" fill={trim} />
          <Decal x={150} y={266} size={32} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'vest') {
      body = (
        <>
          <g clipPath={`url(#${clipId})`}>
            {paint(<path d="M 40,190 L 128,190 L 140,236 L 140,370 L 40,370 Z" />, 'l')}
            {paint(<path d="M 260,190 L 172,190 L 160,236 L 160,370 L 260,370 Z" />, 'r')}
          </g>
          <path d="M 128,194 L 140,236 L 140,352 M 172,194 L 160,236 L 160,352" fill="none" stroke={trim} strokeWidth="5" strokeLinecap="round" />
          {[256, 282, 308].map((y) => <circle key={y} cx="131" cy={y} r="4.5" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1" />)}
          <Decal x={102} y={244} size={24} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'scarf') {
      body = (
        <>
          {paint(<path d="M 92,196 Q 150,224 208,196 Q 210,212 208,222 Q 150,250 92,222 Q 90,212 92,196 Z" />, 'band')}
          {paint(<path d="M 128,214 Q 116,254 112,300 Q 112,312 124,312 Q 134,312 136,300 Q 140,256 152,220 Z" />, 'tail')}
          <path d="M 112,294 L 136,294" stroke={trim} strokeWidth="5" />
          {[116, 122, 128, 134].map((x) => (
            <line key={x} x1={x} y1="310" x2={x} y2="322" stroke={trim} strokeWidth="3" strokeLinecap="round" />
          ))}
          <Decal x={125} y={262} size={18} glyph={d.decal} />
        </>
      )
    } else {
      // tee
      body = (
        <>
          {paint(torso)}
          {shortSleeves}
          <path d="M 118,198 Q 150,222 182,198" fill="none" stroke={trim} strokeWidth="7" strokeLinecap="round" />
          <Decal x={150} y={264} size={40} glyph={d.decal} />
        </>
      )
    }
  }

  if (category === 'pants') {
    const PANTS = 'M 60,282 Q 62,362 108,362 Q 138,364 150,356 Q 162,364 192,362 Q 238,362 240,282 Q 198,298 150,298 Q 102,298 60,282 Z'
    const waistband = <rect x="62" y="278" width="176" height="12" rx="6" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1" />

    if (d.style === 'shorts') {
      body = (
        <>
          {paint(<path d="M 60,282 Q 58,326 96,334 Q 132,338 150,326 Q 168,338 204,334 Q 242,326 240,282 Q 198,298 150,298 Q 102,298 60,282 Z" />)}
          <path d="M 64,318 Q 96,334 146,328 M 236,318 Q 204,334 154,328" fill="none" stroke={trim} strokeWidth="6" strokeLinecap="round" />
          {waistband}
          <Decal x={100} y={310} size={20} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'skirt') {
      body = (
        <>
          {paint(<path d="M 62,282 Q 150,300 238,282 L 258,334 Q 150,358 42,334 Z" />)}
          {[100, 150, 200].map((x) => (
            <line key={x} x1={x} y1="296" x2={x + (x - 150) * 0.2} y2="346" stroke={outline} strokeWidth="1.8" opacity=".35" />
          ))}
          <path d="M 44,332 Q 150,356 256,332" fill="none" stroke={trim} strokeWidth="8" strokeLinecap="round" />
          {waistband}
          <Decal x={150} y={320} size={22} glyph={d.decal} />
        </>
      )
    } else if (d.style === 'joggers') {
      body = (
        <>
          {paint(<path d={PANTS} />)}
          <path d="M 66,292 Q 64,338 90,356 M 234,292 Q 236,338 210,356" fill="none" stroke={trim} strokeWidth="6" strokeLinecap="round" />
          <ellipse cx="108" cy="358" rx="30" ry="7" fill={trim} />
          <ellipse cx="192" cy="358" rx="30" ry="7" fill={trim} />
          {waistband}
          <Decal x={112} y={322} size={20} glyph={d.decal} />
        </>
      )
    } else {
      body = (
        <>
          {paint(<path d={PANTS} />)}
          {/* Ankle cuffs — the leg path narrows to a point at the ankle,
              which leaves a gap against Pao's much wider (46px) feet; a
              cuff ellipse at each foot bridges that gap so the pant leg
              reads as reaching all the way down instead of floating. */}
          <ellipse cx="108" cy="352" rx="40" ry="11" fill={main} />
          <ellipse cx="192" cy="352" rx="40" ry="11" fill={main} />
          <line x1="150" y1="292" x2="150" y2="352" stroke={outline} strokeWidth="2" opacity=".35" />
          {waistband}
          <Decal x={104} y={322} size={22} glyph={d.decal} />
        </>
      )
    }
  }

  if (category === 'shoes') {
    const pair = (render) => [108, 192].map((x) => <g key={x}>{render(x, x < 150 ? -1 : 1)}</g>)

    if (d.style === 'boots') {
      body = pair((x) => (
        <>
          {paint(<path d={`M ${x - 36},340 L ${x - 30},300 Q ${x},292 ${x + 30},300 L ${x + 36},340 Z`} />, 's')}
          {paint(<ellipse cx={x} cy="344" rx="49" ry="23" />, 'f')}
          <rect x={x - 32} y="296" width="64" height="13" rx="6.5" fill={trim} />
          <ellipse cx={x} cy="360" rx="42" ry="7" fill={darken(trim, 0.15)} />
          <Decal x={x} y={322} size={16} glyph={d.decal} />
        </>
      ))
    } else if (d.style === 'slippers') {
      body = pair((x) => (
        <>
          {paint(<ellipse cx={x} cy="342" rx="48" ry="24" />)}
          <ellipse cx={x} cy="326" rx="40" ry="10" fill={trim} />
          <circle cx={x} cy="320" r="10" fill={lighten(trim, 0.2)} stroke={darken(trim, 0.2)} strokeWidth="1" />
          <Decal x={x} y={348} size={16} glyph={d.decal} />
        </>
      ))
    } else if (d.style === 'sandals') {
      body = pair((x) => (
        <>
          <ellipse cx={x} cy="354" rx="46" ry="12" fill={trim} stroke={darken(trim, 0.3)} strokeWidth="1.5" />
          <path d={`M ${x - 40},334 Q ${x},320 ${x + 40},334`} fill="none" stroke={main} strokeWidth="10" strokeLinecap="round" />
          <path d={`M ${x - 36},348 Q ${x},336 ${x + 36},348`} fill="none" stroke={main} strokeWidth="9" strokeLinecap="round" />
          {hasPattern && <path d={`M ${x - 40},334 Q ${x},320 ${x + 40},334`} fill="none" stroke={`url(#${patId})`} strokeWidth="10" strokeLinecap="round" />}
          <Decal x={x} y={326} size={14} glyph={d.decal} />
        </>
      ))
    } else {
      // sneakers
      body = pair((x, side) => (
        <>
          {paint(<ellipse cx={x} cy="338" rx="49" ry="27" />)}
          <ellipse cx={x} cy="346" rx="30" ry="12" fill={lighten(main, 0.25)} opacity=".8" />
          <path d={`M ${x - 46},342 Q ${x},370 ${x + 46},342 L ${x + 44},352 Q ${x},376 ${x - 44},352 Z`} fill={trim} stroke={darken(trim, 0.25)} strokeWidth="1.5" />
          {[322, 330].map((y) => (
            <line key={y} x1={x - 12} y1={y} x2={x + 12} y2={y} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
          ))}
          <Decal x={x + side * 26} y={336} size={14} glyph={d.decal} />
        </>
      ))
    }
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
