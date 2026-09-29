import { SHAPES } from '../../data/puzzlePals'

export function ShapeEl({ shape, ...props }) {
  const s = SHAPES[shape] || SHAPES.square
  const El = s.el
  return <El {...s.a} strokeLinejoin="round" {...props}/>
}

// Painted wooden piece: darker copy offset 5 below for depth, the colour, a light inner rim, a peg and the picture.
export function PuzzlePiece({ item, size = 120, glow = false, lifted = false }) {
  const s = SHAPES[item.shape] || {}
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      filter: glow ? 'drop-shadow(0 0 16px rgba(251,191,36,.95))' : lifted ? 'drop-shadow(0 22px 18px rgba(0,0,0,.28))' : 'none' }}>
      <svg viewBox="-4 -4 108 108" width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <ShapeEl shape={item.shape} fill={item.dark} transform="translate(0 5)"/>
        <ShapeEl shape={item.shape} fill={item.color} stroke={item.dark} strokeWidth="2.5"/>
        <ShapeEl shape={item.shape} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="3" transform="translate(50 50) scale(.86) translate(-50 -50)"/>
      </svg>
      <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: size * (s.peg ?? .08), width: size * .17, height: size * .17, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%,#f7d6a8,#c98c4c 70%,#8a5526)', boxShadow: '0 3px 0 rgba(0,0,0,.25)', zIndex: 2 }}/>
      <span style={{ position: 'relative', top: size * (s.emojiY ?? 0), fontSize: size * (s.emojiSize ?? .46), lineHeight: 1, filter: 'drop-shadow(0 3px 0 rgba(0,0,0,.15))' }}>{item.emoji}</span>
    </span>
  )
}

// Carved hole in the board. `target` = the hole the child needs now (pulsing yellow dashed outline).
export function PuzzleHole({ item, size = 170, target = false }) {
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="-6 -6 112 112" width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <ShapeEl shape={item.shape} fill="#8a5526"/>
        <ShapeEl shape={item.shape} fill="#6b3f18" opacity=".55" transform="translate(0 3)"/>
        <ShapeEl shape={item.shape} fill="none" stroke="rgba(255,235,200,.35)" strokeWidth="2" transform="translate(0 1)"/>
        {target && <ShapeEl shape={item.shape} fill="rgba(253,224,71,.28)" stroke="#fde047" strokeWidth="5" strokeDasharray="10 7" style={{ animation: 'pzPulse 1.4s ease-in-out infinite' }}/>}
      </svg>
      <span style={{ position: 'relative', fontSize: size * .4, filter: 'grayscale(1) brightness(.4)', opacity: .22 }}>{item.emoji}</span>
    </span>
  )
}
