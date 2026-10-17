import { useEffect, useRef } from 'react'

const STAR = 'M0,-16 L4.7,-6.5 L15.2,-5 L7.6,2.4 L9.4,12.9 L0,8 L-9.4,12.9 L-7.6,2.4 L-15.2,-5 L-4.7,-6.5 Z'

// Blue pod with a red cannon that turns to the target, and the star it shoots.
// Pao himself is drawn by the game screen on top of the pod.
export default function Launcher({ pos: LAUNCHER, angle, shot, reduceMotion, onShotDone }) {
  const star = useRef(null)
  const doneRef = useRef(onShotDone)
  useEffect(() => { doneRef.current = onShotDone })

  useEffect(() => {
    if (!shot) return undefined
    const dur = reduceMotion ? 150 : 300
    const t0 = performance.now()
    let raf = 0
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur)
      const x = LAUNCHER.x + (shot.x - LAUNCHER.x) * t
      const y = LAUNCHER.y + (shot.y - LAUNCHER.y) * t
      star.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${t * 360})`)
      if (t < 1) raf = requestAnimationFrame(frame)
      else doneRef.current?.(shot)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [shot, reduceMotion])

  return (
    <g>
      {shot && <line x1={LAUNCHER.x} y1={LAUNCHER.y} x2={shot.x} y2={shot.y} stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeDasharray="2 14" strokeLinecap="round" />}
      <g transform={`translate(${LAUNCHER.x} ${LAUNCHER.y}) rotate(${angle})`} style={{ transition: reduceMotion ? 'none' : 'transform .25s ease-out' }}>
        <rect x="40" y="-17" width="58" height="34" rx="12" fill="#e5484d" />
        <rect x="86" y="-22" width="20" height="44" rx="9" fill="#c2343a" />
      </g>
      <circle cx={LAUNCHER.x} cy={LAUNCHER.y} r="82" fill="#7fa6ff" opacity=".28" />
      <circle cx={LAUNCHER.x} cy={LAUNCHER.y} r="72" fill="#3b6fe0" stroke="#bcd0ff" strokeWidth="6" />
      {shot && <path ref={star} d={STAR} fill="#ffd23f" stroke="#fff" strokeWidth="3" strokeLinejoin="round" transform={`translate(${LAUNCHER.x} ${LAUNCHER.y})`} />}
    </g>
  )
}
