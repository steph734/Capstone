import { useEffect, useRef } from 'react'

const STAR = 'M0,-17 L5,-6.8 L16,-5.3 L8,2.5 L10,13.6 L0,8.4 L-10,13.6 L-8,2.5 L-16,-5.3 L-5,-6.8 Z'
const TRAIL = 5

// The star Pao blasts from the cannon cap to the ball, with a soft gold trail (no trail under reduced motion).
// The helmet, platform and cannon cap themselves are HTML (PaoShooter).
export default function Launcher({ from, shot, reduceMotion, onShotDone }) {
  const star = useRef(null)
  const trail = useRef([])
  const doneRef = useRef(onShotDone)
  useEffect(() => { doneRef.current = onShotDone })

  useEffect(() => {
    if (!shot) return undefined
    const dur = reduceMotion ? 150 : 300
    const t0 = performance.now()
    let raf = 0
    const at = (t) => [from.x + (shot.x - from.x) * t, from.y + (shot.y - from.y) * t]
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur)
      const [x, y] = at(t)
      star.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${t * 360})`)
      trail.current.forEach((c, i) => {
        if (!c) return
        const [tx, ty] = at(Math.max(0, t - (i + 1) * 0.07))
        c.setAttribute('cx', tx.toFixed(1)); c.setAttribute('cy', ty.toFixed(1))
      })
      if (t < 1) raf = requestAnimationFrame(frame)
      else doneRef.current?.(shot)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [shot, reduceMotion, from])

  if (!shot) return null
  return (
    <g pointerEvents="none">
      {!reduceMotion && Array.from({ length: TRAIL }, (_, i) => (
        <circle key={i} ref={(n) => { trail.current[i] = n }} cx={from.x} cy={from.y} r={11 - i * 1.6} fill="#FFD43B" opacity={0.5 - i * 0.09} />
      ))}
      <path ref={star} d={STAR} fill="url(#ab-star)" stroke="#fff" strokeWidth="3" strokeLinejoin="round" transform={`translate(${from.x} ${from.y})`} />
    </g>
  )
}
