import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '../../../utils/session'

// Today's game plan for the player, with a clock corrected to the server's and a countdown that ticks every second.
//   state: 'off' (not enforced) | 'loading' | 'none' | 'before' | 'open' | 'paused' | 'over'
// `enabled` is false for previews / practice mode, where nothing is locked.
export default function usePlanState({ enabled, activitySessionId }) {
  const [plan, setPlan] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const offset = useRef(0)
  const [tick, setTick] = useState(0)
  const [warned, setWarned] = useState(false)
  const [warnNow, setWarnNow] = useState(false)
  const [gameOpen, setGameOpen] = useState(false)
  const [overDismissed, setOverDismissed] = useState(false)
  const backRef = useRef(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const d = await authFetch('/api/patient/game-plan/today', { query: activitySessionId ? { activitySessionId } : undefined })
      if (d.plan) offset.current = new Date(d.plan.now).getTime() - Date.now()
      setPlan(d.plan); setPlayerName(d.playerName || '')
    } catch {
      setPlan(null)
    } finally { setLoaded(true) }
  }, [enabled, activitySessionId])

  useEffect(() => { setLoaded(false); load() }, [load])
  useEffect(() => {
    if (!enabled) return undefined
    const t = setInterval(load, 60000) // resync with the server every minute
    return () => clearInterval(t)
  }, [enabled, load])
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const nowMs = Date.now() + offset.current
  void tick
  const start = plan ? new Date(plan.playStart).getTime() : 0
  const end = plan ? new Date(plan.playEnd).getTime() : 0

  let state = 'off'
  if (enabled) {
    if (!loaded) state = 'loading'
    else if (!plan || plan.status === 'cancelled') state = 'none'
    else if (plan.status === 'ended' || nowMs > end) state = 'over'
    else if (plan.status === 'paused') state = 'paused'
    else if (plan.status === 'scheduled' || nowMs < start) state = 'before'
    else state = 'open'
  }

  const remaining = !plan ? 0
    : state === 'paused' ? plan.remainingSeconds
      : state === 'open' ? Math.max(0, Math.round((end - nowMs) / 1000))
        : state === 'before' ? Math.round((end - start) / 1000) : 0
  const total = plan ? Math.max(1, Math.round((end - start) / 1000)) : 1

  // One "5 minutes left" warning per plan.
  useEffect(() => {
    if (state !== 'open' || !plan || warned || !plan.warnBeforeMinutes) return
    if (remaining <= plan.warnBeforeMinutes * 60) { setWarned(true); setWarnNow(true); setTimeout(() => setWarnNow(false), 7000) }
  }, [state, plan, remaining, warned])
  useEffect(() => { setWarned(false); setOverDismissed(false) }, [plan?.id])

  return {
    enabled, state, plan, playerName, remaining, total, warnNow, gameOpen, setGameOpen, reload: load,
    overDismissed, dismissOver: () => setOverDismissed(true),
    registerBack: (fn) => { backRef.current = fn }, goBack: () => backRef.current?.(),
  }
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
export const time12 = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
