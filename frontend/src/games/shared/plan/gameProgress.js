import { useMemo } from 'react'

// One shared place where a game says how far along it is. The play-time monitor (usePlayEvents) sends this to the
// therapist every 20 s. Games call it through useGameProgress(); a game that never calls it still shows "playing",
// time in game and last tap, just without round and score.
//   const gp = useGameProgress()
//   gp.update({ round: 3, totalRounds: 6, score: 20, accuracy: 85, hints: 1 })
//   gp.retry(3)   // a round was restarted or failed
//   gp.hint()     // a hint was shown
const state = { round: null, totalRounds: null, score: null, accuracy: null, hints: 0 }
const listeners = new Set()

export const gameProgress = {
  update(patch) { Object.assign(state, patch) },
  reset() { Object.assign(state, { round: null, totalRounds: null, score: null, accuracy: null, hints: 0 }) },
  snapshot() { return { ...state } },
  retry(round) { listeners.forEach((fn) => fn({ type: 'round_retry', round: round ?? state.round })) },
  hint() { state.hints = (state.hints || 0) + 1; listeners.forEach((fn) => fn({ type: 'hint_used' })) },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
}

export const useGameProgress = () => useMemo(() => ({
  update: gameProgress.update, retry: gameProgress.retry, hint: gameProgress.hint,
}), [])
