import { useCallback, useEffect, useRef, useState } from 'react'
import { idleFor, ACTIVITY_THROTTLE_MS, HEARTBEAT_MIN_INTERVAL_MS } from '../config/idle'
import { readLastActivity, writeLastActivity, clearLastActivity, broadcast, subscribe, onActivity, isIdleHeld } from '../session/sessionBus'

const BUSY_REFRESH_MS = 5000
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'touchmove', 'pointerdown', 'wheel']

// Where the user is, from timestamps only (no counting): 'active' | 'warning' (with seconds left) | 'expired'.
export function idlePhase(now, lastActivityAt, idleMs, warningMs) {
  const idle = now - lastActivityAt
  if (idle >= idleMs + warningMs) return { phase: 'expired', remaining: 0 }
  if (idle >= idleMs) return { phase: 'warning', remaining: Math.max(1, Math.ceil((idleMs + warningMs - idle) / 1000)) }
  return { phase: 'active', remaining: Math.ceil(warningMs / 1000) }
}

// One idle timer for every role. It never counts down: it stores `lastActivityAt` and works out where the user is
// from the clock each time (every second, and straight away when the tab becomes visible or the computer wakes up),
// so a throttled background tab or a sleeping laptop cannot make the timer wrong.
//
//   phase 'active'  -> nothing shown
//   phase 'warning' -> idle for `idleMs`: show the modal, `remaining` seconds until logout
//   at idleMs + warningMs (or when another tab logs out) `onExpire(reason, { remote })` runs once
export default function useIdleTimeout({ enabled, role, onExpire, heartbeat }) {
  const { idleMs, warningMs } = idleFor(role)
  const [view, setView] = useState({ phase: 'active', remaining: Math.ceil(warningMs / 1000) })
  const last = useRef(Date.now())
  const lastWrite = useRef(0)
  const lastBeat = useRef(0)
  const done = useRef(false)
  const phase = useRef('active')
  const warned = useRef(false)
  const cb = useRef({ onExpire, heartbeat })
  cb.current = { onExpire, heartbeat }

  const show = useCallback((next) => {
    phase.current = next.phase
    setView((v) => (v.phase === next.phase && v.remaining === next.remaining ? v : next))
  }, [])

  const expire = useCallback((reason, remote = false) => {
    if (done.current) return
    done.current = true
    if (!remote) broadcast({ type: 'logout', reason })
    cb.current.onExpire?.(reason, { remote })
  }, [])

  const evaluate = useCallback(() => {
    if (done.current) return
    const now = Date.now()
    if (isIdleHeld()) { // an upload / payment / game / recording is running: that is activity
      if (now - lastWrite.current >= BUSY_REFRESH_MS) { last.current = now; lastWrite.current = now; writeLastActivity(now); broadcast({ type: 'activity' }) }
      warned.current = false
      show({ phase: 'active', remaining: Math.ceil(warningMs / 1000) })
      return
    }
    last.current = Math.max(last.current, readLastActivity()) // activity in another tab counts here too
    const p = idlePhase(now, last.current, idleMs, warningMs)
    if (p.phase === 'expired') { expire('idle'); return }
    if (p.phase === 'warning') {
      if (!warned.current) { warned.current = true; broadcast({ type: 'warning-shown' }) }
      show(p)
      return
    }
    warned.current = false
    show(p)
  }, [idleMs, warningMs, expire, show])

  const beat = useCallback(async () => {
    lastBeat.current = Date.now()
    return cb.current.heartbeat?.()
  }, [])

  // Real activity in this tab. In the warning the user has to choose (Stay / Log out), so movement does not dismiss it.
  const markActive = useCallback(() => {
    if (done.current || phase.current === 'warning') return
    const now = Date.now()
    if (now - lastWrite.current < ACTIVITY_THROTTLE_MS) return
    lastWrite.current = now
    last.current = now
    writeLastActivity(now)
    broadcast({ type: 'activity' })
    if (now - lastBeat.current >= HEARTBEAT_MIN_INTERVAL_MS) beat().catch(() => {}) // network blips are ignored; a 401 is handled by authFetch
  }, [beat])

  const stay = useCallback(async () => {
    const now = Date.now()
    last.current = now; lastWrite.current = now
    writeLastActivity(now)
    warned.current = false
    show({ phase: 'active', remaining: Math.ceil(warningMs / 1000) })
    broadcast({ type: 'stay-logged-in' })
    try { await beat() } catch { expire('idle') } // the server refused (401) or could not be reached: do not pretend the session is fine
  }, [beat, expire, show, warningMs])

  const logoutNow = useCallback(() => expire('manual'), [expire])

  const mounted = useRef(false)
  useEffect(() => {
    if (!enabled) { mounted.current = true; done.current = false; warned.current = false; clearLastActivity(); show({ phase: 'active', remaining: Math.ceil(warningMs / 1000) }); return undefined }
    done.current = false; warned.current = false
    const now = Date.now()
    const stored = readLastActivity()
    // A reloaded / restored tab checks the stored time first; a fresh login starts the clock now.
    if (!mounted.current && stored && now - stored >= idleMs + warningMs) { mounted.current = true; expire('idle'); return undefined }
    if (!mounted.current && stored) last.current = stored
    else { last.current = now; writeLastActivity(now) }
    mounted.current = true
    lastBeat.current = now
    evaluate()

    const onEvent = () => markActive()
    EVENTS.forEach((e) => window.addEventListener(e, onEvent, { passive: true, capture: true }))
    const onFocus = () => { markActive(); evaluate() }
    const onVisible = () => { if (document.visibilityState === 'visible') evaluate() } // waking up: re-check immediately
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', evaluate)
    window.addEventListener('pageshow', evaluate)
    document.addEventListener('visibilitychange', onVisible)
    const unNote = onActivity(markActive) // a successful authenticated call the user caused
    const unBus = subscribe((m) => {
      if (m?.type === 'logout') expire(m.reason || 'idle', true)
      else if (m?.type === 'activity' || m?.type === 'stay-logged-in') { last.current = Math.max(last.current, readLastActivity() || Date.now()); warned.current = false; evaluate() }
    })
    const tick = setInterval(evaluate, 1000)
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onEvent, { capture: true }))
      window.removeEventListener('focus', onFocus); window.removeEventListener('online', evaluate); window.removeEventListener('pageshow', evaluate)
      document.removeEventListener('visibilitychange', onVisible)
      unNote(); unBus(); clearInterval(tick)
    }
  }, [enabled, idleMs, warningMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return { phase: view.phase, remaining: view.remaining, warningSeconds: Math.ceil(warningMs / 1000), stay, logoutNow, expire }
}
