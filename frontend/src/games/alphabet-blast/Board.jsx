import { memo, useEffect, useMemo, useRef } from 'react'
import { BALL, DARKER, colorFor, colorIndex } from './config'
import Launcher from './Launcher'

// Mixes a #rrggbb colour towards white (p = 0..1) for the ball highlights.
const lighten = (hex, p) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * p))
  return `rgb(${ch.join(',')})`
}
const BASE_COLORS = Array.from({ length: 6 }, (_, i) => colorFor(String.fromCharCode(65 + i)))
const FONT = "'Poppins','Baloo 2',system-ui,sans-serif"
const ARROW_EVERY = 110
const AIM_DOTS = 8

// Direction chevrons along the track, from the same point sampler the balls use.
function Arrows({ path, hole }) {
  const items = useMemo(() => {
    const out = []
    const tip = { x: 0, y: 0 }
    const at = { x: 0, y: 0 }
    for (let d = 70; d < path.length - 90; d += ARROW_EVERY) {
      path.at(d, at)
      path.at(d + 4, tip)
      if (Math.hypot(at.x - hole.x, at.y - hole.y) < 95) continue
      out.push({ x: at.x, y: at.y, a: (Math.atan2(tip.y - at.y, tip.x - at.x) * 180) / Math.PI })
    }
    return out
  }, [path, hole])
  return (
    <g fill="none" stroke="#8B7CF6" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      {items.map((a, i) => <polyline key={i} points="-6,-9 5,0 -6,9" transform={`translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${a.a.toFixed(1)})`} />)}
    </g>
  )
}

// Dotted gold guide (8 dots, shrinking and fading) from the cannon to the ball Pao is aiming at.
function AimGuide({ from, target, ballsRef, positionOf, running, hidden }) {
  const dots = useRef([])
  useEffect(() => {
    if (!running || hidden) { dots.current.forEach((d) => d && d.setAttribute('opacity', '0')); return undefined }
    let raf = 0
    const frame = () => {
      let best = null
      for (const b of ballsRef.current) {
        if (b.letter !== target) continue
        const p = positionOf(b.id)
        if (p && p.dist >= 0 && (!best || p.dist > best.dist)) best = p // the one closest to the black hole
      }
      dots.current.forEach((d, i) => {
        if (!d) return
        if (!best) { d.setAttribute('opacity', '0'); return }
        const t = (i + 1) / (AIM_DOTS + 1.4)
        d.setAttribute('cx', (from.x + (best.x - from.x) * t).toFixed(1))
        d.setAttribute('cy', (from.y + (best.y - from.y) * t).toFixed(1))
        d.setAttribute('r', (7 - i * 0.55).toFixed(2))
        d.setAttribute('opacity', (0.95 - i * 0.09).toFixed(2))
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, hidden, target, from, ballsRef, positionOf])
  return (
    <g fill="#FFD43B" pointerEvents="none" aria-hidden="true">
      {Array.from({ length: AIM_DOTS }, (_, i) => <circle key={i} ref={(n) => { dots.current[i] = n }} r="5" opacity="0" />)}
    </g>
  )
}

// Letter balls draw on the board. Their positions are written straight to the DOM by useChain, so this only
// re-renders when the chain's contents change.
function Board({ layout, balls, path, size, registerEl, hintId, wrongId, target, onTap, shot, onShotDone, bursts, bubble, reduceMotion, ballsRef, positionOf, running }) {
  const { view: VIEW, hole: HOLE, launcher } = layout
  const r = (BALL * size) / 2
  const W = 82 * size
  const cannon = useMemo(() => ({ x: launcher.x, y: launcher.y - 112 }), [launcher])
  return (
    <svg className="ab-board" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Alphabet Blast board">
      <defs>
        {BASE_COLORS.map((c, i) => (
          <radialGradient key={i} id={`abg-${i}`} cx=".34" cy=".28" r=".85">
            <stop offset="0" stopColor={lighten(c, 0.6)} />
            <stop offset=".55" stopColor={c} />
            <stop offset="1" stopColor={DARKER[i]} />
          </radialGradient>
        ))}
        <linearGradient id="ab-star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE680" /><stop offset="1" stopColor="#FFB020" /></linearGradient>
      </defs>

      {/* the ribbon: dark outer edge, bright body, dark inner lane */}
      <path d={path.d} fill="none" stroke="#120C55" strokeOpacity=".55" strokeWidth={W + 12} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path.d} fill="none" stroke="#3B2BB0" strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path.d} fill="none" stroke="#241878" strokeWidth={W - 22} strokeLinecap="round" strokeLinejoin="round" />
      <Arrows path={path} hole={HOLE} />

      <AimGuide from={cannon} target={target} ballsRef={ballsRef} positionOf={positionOf} running={running} hidden={Boolean(shot)} />

      {balls.map((b) => {
        const text = b.lower ? b.letter.toLowerCase() : b.letter
        const ci = colorIndex(b.letter)
        const isTarget = b.letter === target
        return (
          <g key={b.id} ref={(n) => registerEl(b.id, n)} style={{ display: 'none' }} role="img" aria-label={`Letter ${text}`}>
            <g className={wrongId === b.id ? 'ab-wiggle' : undefined}>
              {hintId === b.id && <circle r={r + 16} fill="#FFD43B" opacity=".4" className={reduceMotion ? undefined : 'ab-glow'} />}
              {isTarget && <circle r={r + 7} fill="#FFD43B" fillOpacity=".22" stroke="#FFD43B" strokeWidth="3" className={reduceMotion ? undefined : 'ab-ring'} />}
              <circle cy={5} r={r} fill={DARKER[ci]} />
              <circle r={r} fill={`url(#abg-${ci})`} />
              <ellipse cx={-r * 0.33} cy={-r * 0.42} rx={r * 0.3} ry={r * 0.17} fill="#fff" opacity=".8" transform={`rotate(-32 ${-r * 0.33} ${-r * 0.42})`} />
              <text textAnchor="middle" dominantBaseline="central" y="2" fontSize={r} fontWeight="800" fill="#1B1250" style={{ fontFamily: FONT, pointerEvents: 'none' }}>{text}</text>
              <circle r={Math.max(r + 8, 24)} fill="transparent" style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.preventDefault(); onTap(b) }} />
            </g>
          </g>
        )
      })}

      <Launcher from={cannon} shot={shot} reduceMotion={reduceMotion} onShotDone={onShotDone} />

      {bursts.map((b) => (
        <g key={b.key} transform={`translate(${b.x} ${b.y})`} pointerEvents="none">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + 0.3
            return <circle key={i} r="7" fill={b.colors[i % b.colors.length]} className={reduceMotion ? 'ab-dot-static' : 'ab-dot'} style={{ '--dx': `${Math.cos(a) * 54}px`, '--dy': `${Math.sin(a) * 54}px` }} />
          })}
          <text x={r + 22} y={-r - 6} fontSize="30" fontWeight="800" fill="#FFD43B" stroke="#4A3500" strokeWidth="1.2" paintOrder="stroke" className={reduceMotion ? 'ab-plus-static' : 'ab-plus'} style={{ fontFamily: FONT }}>+10</text>
        </g>
      ))}

      {bubble && (
        <g transform={`translate(${bubble.x} ${bubble.y - r - 26})`} pointerEvents="none">
          <rect x="-44" y="-17" width="88" height="32" rx="16" fill="#fff" />
          <text textAnchor="middle" y="5" fontSize="17" fontWeight="800" fill="#3A2E8C" style={{ fontFamily: FONT }}>Not {bubble.letter}</text>
        </g>
      )}
    </svg>
  )
}

export default memo(Board)
