import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '../../../utils/session'

// Polls the live play-time endpoint every 3 s (paused while the tab is hidden) and keeps a clock offset to the server.
// Returns { plans: Map(patientId -> live), offset, refresh, tick } where tick changes every second (for local countdowns).
export default function useLiveMonitor(enabled = true) {
  const [plans, setPlans] = useState(() => new Map())
  const [tick, setTick] = useState(0)
  const offset = useRef(0)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const d = await authFetch('/api/therapist/game-plans/live')
      if (!alive.current) return
      offset.current = new Date(d.now).getTime() - Date.now()
      const at = performance.now()
      setPlans(new Map(d.plans.map((p) => [p.patientId, { ...p, _at: at }])))
    } catch { /* keep the last good data */ }
  }, [])

  useEffect(() => {
    alive.current = true
    if (!enabled) return undefined
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, 3000)
    const vis = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive.current = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [enabled, refresh])

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  return { plans, offset: offset.current, refresh, tick }
}

// Seconds left, counting down locally from the server's numbers.
export function secondsLeft(lv, offset) {
  if (!lv) return 0
  if (lv.status === 'ended') return 0
  // Counts down from the server's remainingSeconds using performance.now(), so this device's clock does not matter.
  if (lv.status === 'active') return Math.max(0, Math.round(lv.remainingSeconds - (performance.now() - (lv._at || performance.now())) / 1000))
  return lv.remainingSeconds
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// A soft two-note chime for a new alert.
export function chime() {
  try {
    const C = window.AudioContext || window.webkitAudioContext
    const ctx = new C()
    ;[660, 520].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16)
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + i * 0.16 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.22)
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + i * 0.16); o.stop(ctx.currentTime + i * 0.16 + 0.25)
    })
    setTimeout(() => ctx.close(), 800)
  } catch { /* sound is optional */ }
}
