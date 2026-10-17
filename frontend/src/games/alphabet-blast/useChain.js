import { useCallback, useEffect, useRef, useState } from 'react'
import { SPEEDS } from './config'

const CHAIN_LENGTH = 30
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// The chain lives in refs and is moved along the precomputed track with direct
// transform updates, so React only re-renders when balls are added or removed.
export default function useChain({ path, gap, settings, running, onRescue }) {
  const [balls, setBalls] = useState([])
  const ballsRef = useRef([])
  const dispRef = useRef(new Map())
  const els = useRef(new Map())
  const headRef = useRef(0)
  const idRef = useRef(0)
  const slowUntil = useRef(0)
  const halfSpeed = useRef(false)
  const gapRef = useRef(gap)
  const rescueRef = useRef(onRescue)
  const settingsRef = useRef(settings)
  const tmp = useRef({ x: 0, y: 0 })
  useEffect(() => { gapRef.current = gap; rescueRef.current = onRescue; settingsRef.current = settings })

  const make = useCallback((letter) => {
    const c = settingsRef.current.letterCase
    return { id: ++idRef.current, letter, lower: c === 'lower' || (c === 'both' && Math.random() < 0.5) }
  }, [])

  const commit = (list) => { ballsRef.current = list; setBalls(list) }

  // Build a fresh chain from the letters still to pop, plus repeats.
  const init = useCallback((remaining, firstTarget) => {
    const pool = shuffle(remaining)
    while (pool.length < CHAIN_LENGTH) pool.push(remaining[Math.floor(Math.random() * remaining.length)])
    const letters = pool.slice(0, Math.max(CHAIN_LENGTH, remaining.length))
    const at = letters.indexOf(firstTarget)
    if (at < 0) letters[3] = firstTarget
    else if (at > 5) [letters[3], letters[at]] = [letters[at], letters[3]]
    const list = letters.map(make)
    dispRef.current = new Map(list.map((b, i) => [b.id, i]))
    headRef.current = 9 * gapRef.current
    slowUntil.current = 0
    halfSpeed.current = false
    commit(list)
  }, [make])

  const visibleCount = () => Math.min(ballsRef.current.length, Math.floor(headRef.current / gapRef.current) + 1)

  // The target must always be in the visible part of the chain.
  const ensureTarget = useCallback((letter) => {
    const list = ballsRef.current
    const vis = visibleCount()
    if (list.slice(0, vis).some((b) => b.letter === letter)) return
    if (vis < 2) return
    const i = 1 + Math.floor(Math.random() * (vis - 1))
    const next = list.map((b, k) => (k === i ? { ...b, letter } : b))
    commit(next)
  }, [])

  const popBall = useCallback((id, fill) => {
    const list = ballsRef.current.filter((b) => b.id !== id)
    dispRef.current.delete(id)
    els.current.delete(id)
    while (list.length < CHAIN_LENGTH && fill.length) {
      const b = make(fill[Math.floor(Math.random() * fill.length)])
      dispRef.current.set(b.id, list.length)
      list.push(b)
    }
    commit(list)
  }, [make])

  const positionOf = useCallback((id) => {
    const d = dispRef.current.get(id)
    if (d == null) return null
    const dist = headRef.current - d * gapRef.current
    return { ...path.at(dist, { x: 0, y: 0 }), dist }
  }, [path])

  const slowTemporarily = useCallback((ms) => { slowUntil.current = performance.now() + ms }, [])
  const setHalfSpeed = useCallback((on) => { halfSpeed.current = on }, [])
  const registerEl = useCallback((id, node) => { if (node) els.current.set(id, node); else els.current.delete(id) }, [])

  useEffect(() => {
    if (!running) return undefined
    let raf = 0
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const list = ballsRef.current
      let mult = 1
      if (now < slowUntil.current) mult *= 0.35
      if (halfSpeed.current) mult *= 0.5
      headRef.current += (SPEEDS[settingsRef.current.speed] || SPEEDS.slow) * mult * dt
      const k = 1 - Math.exp(-dt / 0.1)
      const g = gapRef.current
      list.forEach((b, i) => {
        const d = dispRef.current.get(b.id) ?? i
        const nd = d + (i - d) * k
        dispRef.current.set(b.id, Math.abs(i - nd) < 0.002 ? i : nd)
      })
      if (list.length) {
        const front = headRef.current - (dispRef.current.get(list[0].id) ?? 0) * g
        if (front >= path.length - 30) {
          headRef.current -= path.length * 0.25
          slowUntil.current = now + 3500
          rescueRef.current?.()
        }
      }
      list.forEach((b) => {
        const el = els.current.get(b.id)
        if (!el) return
        const dist = headRef.current - (dispRef.current.get(b.id) ?? 0) * g
        if (dist < 0) { el.style.display = 'none'; return }
        el.style.display = ''
        path.at(dist, tmp.current)
        el.setAttribute('transform', `translate(${tmp.current.x.toFixed(1)} ${tmp.current.y.toFixed(1)})`)
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, path])

  return { balls, ballsRef, init, ensureTarget, popBall, positionOf, slowTemporarily, setHalfSpeed, registerEl }
}
