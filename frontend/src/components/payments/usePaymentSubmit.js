import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createSubmitController } from './submitController'

// useElapsedTimer(startedAt): milliseconds since `startedAt`, recomputed once a second FROM THE CLOCK (Date.now() - startedAt),
// so it stays right when the browser throttles a background tab. Pass `enabled = false` to freeze it. Only the component that
// calls it re-renders every second.
export function useElapsedTimer(startedAt, enabled = true) {
  const [ms, setMs] = useState(() => (startedAt ? Math.max(0, Date.now() - startedAt) : 0))
  useEffect(() => {
    if (!startedAt) { setMs(0); return undefined }
    const update = () => setMs(Math.max(0, Date.now() - startedAt))
    update()
    if (!enabled) return undefined
    const id = setInterval(update, 1000)
    document.addEventListener('visibilitychange', update) // catch up at once when the tab comes back
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', update) }
  }, [startedAt, enabled])
  return ms
}

// usePaymentSubmit(): owns ONE submission (request, real upload progress, retries, abort, slow/stall detection).
// All the logic lives in submitController.js; this only connects it to React.
//   const { state, run, cancel } = usePaymentSubmit()
export default function usePaymentSubmit() {
  const ref = useRef(null)
  if (!ref.current) ref.current = createSubmitController()
  const c = ref.current
  const state = useSyncExternalStore(c.subscribe, c.getState)
  return { state, run: c.run, cancel: c.cancel }
}

// While `active`, the browser Back button does not leave the booking page: it just stays (a history entry is pushed and
// re-pushed on Back), and a refresh / tab close shows the browser's warning. The entry is removed again when `active` ends.
export function useLeaveGuard(active) {
  useEffect(() => {
    if (!active) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    const marker = { ...(window.history.state || {}), tpSending: true }
    window.history.pushState(marker, '')
    const onPop = () => { window.history.pushState(marker, '') } // Back pressed: stay here
    window.addEventListener('beforeunload', warn)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('popstate', onPop)
      if (window.history.state?.tpSending) window.history.back() // drop our own entry (the listener is already gone)
    }
  }, [active])
}
