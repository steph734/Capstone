import { useCallback, useEffect, useRef, useState } from 'react'
import { MOOD_FOR_EVENT, CALM_SAFE_POSES } from './paoPoses'

// Drives which pose Pao shows: a base mood (sticks around) plus a temporary
// one that interrupts it and returns to the base after `hold` ms. New moods
// always interrupt whatever is currently holding — that's the point of a
// mood queue of size 1, not a literal queue: the newest request wins.
//
//   const pao = usePaoMood('idle')
//   <PaoBuddy mood={pao.mood} .../>
//   pao.trigger('correct')           // from MOOD_FOR_EVENT
//   pao.setMood('hug', { hold: 2000 }) // anything custom
export function usePaoMood(initialMood = 'idle', { calmVisuals = false } = {}) {
  const [base, setBase] = useState(initialMood)
  const [temp, setTemp] = useState(null) // { mood, hold }
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const setMood = useCallback((mood, { hold = null, asBase = false } = {}) => {
    const safeMood = calmVisuals && !CALM_SAFE_POSES.has(mood) ? 'idle' : mood
    clearTimeout(timerRef.current)
    if (asBase || hold === null) {
      setTemp(null)
      setBase(safeMood)
      if (hold != null) {
        timerRef.current = setTimeout(() => setBase(initialMood), hold)
      }
      return
    }
    setTemp({ mood: safeMood })
    timerRef.current = setTimeout(() => setTemp(null), hold)
  }, [calmVisuals, initialMood])

  const trigger = useCallback((eventName) => {
    const def = MOOD_FOR_EVENT[eventName]
    if (!def) return
    setMood(def.mood, { hold: def.hold })
  }, [setMood])

  return { mood: temp?.mood || base, baseMood: base, trigger, setMood }
}
