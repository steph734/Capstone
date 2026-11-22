import { useEffect } from 'react'
import { holdIdle } from '../session/sessionBus'

// Keeps the idle timer from running while a screen is doing something long (an upload, a payment, a game, recording).
//   useIdleBusy('payment')            -> held while this component is mounted
//   useIdleBusy('upload', uploading)  -> held only while `active` is true
// Always released on unmount or when `active` turns false.
export function useIdleBusy(reason = 'busy', active = true) {
  useEffect(() => {
    if (!active) return undefined
    return holdIdle(reason)
  }, [reason, active])
}
export default useIdleBusy
