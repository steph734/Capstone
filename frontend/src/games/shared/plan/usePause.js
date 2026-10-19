import { useSyncExternalStore } from 'react'

// One flag for "the therapist paused play time". The plan hook sets it; every game can read it.
//   const paused = usePause()   // true -> stop your requestAnimationFrame loops, timers and speech, and ignore input
// While paused a full-screen overlay already blocks touches, the page's CSS animations are frozen and speech is cancelled,
// so a game that does nothing still stops. Games that keep their own clocks should also check the flag.
let paused = false
const subs = new Set()
export const isPaused = () => paused
export function setPaused(next) {
  if (paused === next) return
  paused = next
  try {
    document.documentElement.classList.toggle('tp-paused', next)
    if (next) window.speechSynthesis?.cancel()
  } catch { /* no DOM */ }
  subs.forEach((f) => f())
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export default function usePause() { return useSyncExternalStore(subscribe, () => paused, () => false) }
