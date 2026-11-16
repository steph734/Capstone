import { useCallback, useEffect, useRef, useState } from 'react'
import { authFetch, getSessionToken } from '../../../utils/session'
import { homeStatus } from './homeUtil'

// The signed-in patient's home practice plan, with a live "time left today" that follows the server's clock.
//   enabled false -> nothing is fetched (not a patient account, previews, therapist-hosted play).
export default function useHomePractice(enabled) {
  const [data, setData] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const anchor = useRef({ left: 0, at: 0, offset: 0 })
  const [tick, setTick] = useState(0)
  const reloadedAtZero = useRef(false)
  const signedOut = useRef(false) // the server said 401: stop asking until the page is reloaded after signing in again

  const load = useCallback(async () => {
    if (!enabled) return
    if (signedOut.current || !getSessionToken()) { setData(null); setLoaded(true); return } // no server session: asking would only give a 401
    try {
      const d = await authFetch('/api/home-practice/me')
      anchor.current = { left: d.window?.secondsLeft || 0, at: performance.now(), offset: new Date(d.now).getTime() - Date.now() }
      reloadedAtZero.current = false
      setData(d)
    } catch (err) { if (err?.status === 401) signedOut.current = true; setData(null) } finally { setLoaded(true) }
  }, [enabled])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!enabled) return undefined
    const t = setInterval(() => { if (!document.hidden) load() }, 30000)
    const vis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [enabled, load])
  useEffect(() => {
    if (!enabled) return undefined
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [enabled])

  void tick
  const nowMs = Date.now() + anchor.current.offset
  const secondsLeft = data?.window?.open ? Math.max(0, Math.round(anchor.current.left - (performance.now() - anchor.current.at) / 1000)) : 0
  const status = homeStatus(data, secondsLeft, nowMs)
  // The countdown reached zero: ask the server for the real state once.
  useEffect(() => { if (data?.window?.open && secondsLeft <= 0 && !reloadedAtZero.current) { reloadedAtZero.current = true; load() } }, [data, secondsLeft, load])

  return {
    enabled, loaded, data, plan: data?.plan || null, status, secondsLeft, reload: load,
    // Games waiting to be played right now (for the sidebar badge).
    count: status.kind === 'open' && data?.plan ? data.plan.games.length : 0,
  }
}
