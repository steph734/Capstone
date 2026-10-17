import { memo, useMemo } from 'react'
import { BALL, HOLE, VIEW, colorFor } from './config'
import Launcher from './Launcher'

const makeStars = () => Array.from({ length: 70 }, (_, i) => {
  const r = (n) => { const x = Math.sin(i * 999 + n * 17) * 10000; return x - Math.floor(x) }
  return { x: r(1) * VIEW.w, y: r(2) * VIEW.h, s: 1 + r(3) * 2.2, o: 0.25 + r(4) * 0.6 }
})

// Letter balls draw on a 1600x900 board. Their positions are written straight to
// the DOM by useChain, so this only re-renders when the chain's contents change.
function Board({ balls, pathD, size, registerEl, hintId, wrongId, onTap, angle, shot, onShotDone, bursts, bubble, reduceMotion }) {
  const stars = useMemo(makeStars, [])
  const r = (BALL * size) / 2
  return (
    <svg className="ab-board" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Alphabet Blast board">
      <defs>
        <linearGradient id="ab-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b3399" /><stop offset=".55" stopColor="#221b63" /><stop offset="1" stopColor="#120e3a" /></linearGradient>
        <radialGradient id="ab-hole"><stop offset="0" stopColor="#000" /><stop offset=".6" stopColor="#12062b" /><stop offset="1" stopColor="#4b2a8f" /></radialGradient>
      </defs>
      <rect width={VIEW.w} height={VIEW.h} fill="url(#ab-bg)" />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />)}

      <path d={pathD} fill="none" stroke="#0d0833" strokeOpacity=".55" strokeWidth={84 * size} strokeLinecap="round" strokeLinejoin="round" />

      <circle cx={HOLE.x} cy={HOLE.y} r="84" fill="#7b4dff" opacity=".22" />
      <circle cx={HOLE.x} cy={HOLE.y} r="70" fill="none" stroke="#8e5cff" strokeWidth="10" opacity=".55" />
      <circle cx={HOLE.x} cy={HOLE.y} r="52" fill="#000" stroke="#7b4dff" strokeWidth="4" />

      <Launcher angle={angle} shot={shot} reduceMotion={reduceMotion} onShotDone={onShotDone} />

      {balls.map((b) => {
        const text = b.lower ? b.letter.toLowerCase() : b.letter
        return (
          <g key={b.id} ref={(n) => registerEl(b.id, n)} style={{ display: 'none' }}>
            <g className={wrongId === b.id ? 'ab-wiggle' : undefined}>
              {hintId === b.id && <circle r={r + 12} fill="#ffe14d" opacity=".4" className={reduceMotion ? undefined : 'ab-glow'} stroke="#ffe14d" strokeWidth="7" />}
              <circle r={r} fill={colorFor(b.letter)} stroke="#fff" strokeOpacity=".8" strokeWidth="3" />
              <ellipse cx={-r * 0.35} cy={-r * 0.45} rx={r * 0.28} ry={r * 0.14} fill="#fff" opacity=".7" transform={`rotate(-30 ${-r * 0.35} ${-r * 0.45})`} />
              <text textAnchor="middle" dominantBaseline="central" y="3" fontSize={r * 1.1} fontWeight="800" fill="#2a2150" style={{ fontFamily: "'Baloo 2','Atkinson Hyperlegible',system-ui,sans-serif", pointerEvents: 'none' }}>{text}</text>
              <circle r={Math.max(r + 8, 32)} fill="transparent" style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.preventDefault(); onTap(b) }} />
            </g>
          </g>
        )
      })}

      {bursts.map((b) => (
        <g key={b.key} transform={`translate(${b.x} ${b.y})`} className={reduceMotion ? 'ab-burst-static' : 'ab-burst'} pointerEvents="none">
          {Array.from({ length: 10 }, (_, i) => <line key={i} x1="30" x2="62" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" transform={`rotate(${i * 36})`} />)}
          <text y="-60" textAnchor="middle" fontSize="38" fontWeight="800" fill="#fff" style={{ fontFamily: "'Baloo 2',system-ui,sans-serif" }}>+10</text>
        </g>
      ))}

      {bubble && (
        <g transform={`translate(${bubble.x} ${bubble.y - 64})`} pointerEvents="none">
          <rect x="-86" y="-24" width="172" height="40" rx="20" fill="#fff" />
          <text textAnchor="middle" y="4" fontSize="22" fontWeight="800" fill="#4a2ca0" style={{ fontFamily: "'Atkinson Hyperlegible',system-ui,sans-serif" }}>Not this one!</text>
        </g>
      )}
    </svg>
  )
}

export default memo(Board)
