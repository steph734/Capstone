import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch } from '../../../utils/session'
import { setPaused } from './usePause'

// Today's game plan for the player, with a clock corrected to the server's and a countdown that ticks every second.
//   state: 'off' (not enforced) | 'loading' | 'none' | 'before' | 'open' | 'paused' | 'over'
// `enabled` is false for previews / practice mode, where nothing is locked.
export default function usePlanState({ enabled, activitySessionId }) {
  const [plan, setPlan] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const offset = useRef(0)
  const anchor = useRef({ remaining: 0, at: 0 }) // server remainingSeconds + the performance.now() it arrived at
  const gameOpenRef = useRef(false)
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
      if (d.plan) { offset.current = new Date(d.plan.now).getTime() - Date.now(); anchor.current = { remaining: d.plan.remainingSeconds, at: performance.now() } }
      setPlan(d.plan); setPlayerName(d.playerName || '')
    } catch {
      setPlan(null)
    } finally { setLoaded(true) }
  }, [enabled, activitySessionId])

  useEffect(() => { setLoaded(false); load() }, [load])
  useEffect(() => {
    if (!enabled) return undefined
    // Resync often so Pause, Resume, +5 min and End now apply quickly: every 3 s while a game is open, 10 s otherwise.
    // (Plain polling; a socket would push faster but the serverless host cannot hold one open.)
    let t
    const arm = () => { t = setTimeout(async () => { if (!document.hidden) await load(); arm() }, gameOpenRef.current ? 3000 : 10000) }
    arm()
    const vis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', vis) }
  }, [enabled, load])
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  void tick
  const running = plan && plan.status === 'active' ? Math.max(0, Math.round(anchor.current.remaining - (performance.now() - anchor.current.at) / 1000)) : 0

  let state = 'off'
  if (enabled) {
    if (!loaded) state = 'loading'
    else if (!plan || plan.status === 'cancelled') state = 'none'
    else if (plan.status === 'ended' || (plan.status === 'active' && running <= 0)) state = 'over'
    else if (plan.status === 'paused') state = 'paused'
    else if (plan.status === 'scheduled') state = 'before'
    else state = 'open'
  }

  // The countdown runs on the server's remaining seconds, measured with performance.now(): the device clock cannot change it.
  const remaining = !plan ? 0 : state === 'paused' ? plan.remainingSeconds : state === 'open' ? running : state === 'before' ? plan.remainingSeconds : 0
  const total = plan ? Math.max(1, plan.durationSeconds + plan.extendedSeconds) : 1
  useEffect(() => { setPaused(enabled && state === 'paused'); return () => setPaused(false) }, [enabled, state])

  // One "5 minutes left" warning per plan.
  useEffect(() => {
    if (state !== 'open' || !plan || warned || !plan.warnBeforeMinutes) return
    if (remaining <= plan.warnBeforeMinutes * 60) { setWarned(true); setWarnNow(true); setTimeout(() => setWarnNow(false), 7000) }
  }, [state, plan, remaining, warned])
  useEffect(() => { setWarned(false); setOverDismissed(false) }, [plan?.id])

  return {
    enabled, state, plan, playerName, remaining, total, warnNow, gameOpen, paused: state === 'paused',
    setGameOpen: (v) => { gameOpenRef.current = v; setGameOpen(v) }, reload: load,
    overDismissed, dismissOver: () => setOverDismissed(true),
    registerBack: (fn) => { backRef.current = fn }, goBack: () => backRef.current?.(),
  }
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
export const time12 = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
