import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPosesManifest, reactionPoseFor, calmSafePose, BUBBLE_FOR_POSE } from './paoLayers'

const HOLD_MS = 1800
const IDLE_NUDGE_MS = 25000
const TAP_CYCLE = ['wave', 'giggle', 'cheer', 'love', 'wow']
const HANDOFF_KEY = 'paoReactionHandoff' // { pose, at } — read once by the games-list header

// Drives the reaction pose + matching bubble for the layered-wardrobe
// preview (Customize Pao) and the "last pose" handoff to the header.
// calm: calm_visuals or prefers-reduced-motion — energetic poses become
// `happy` and fx stays hidden, but it's still always a celebration.
export function usePaoReaction({ calm = false, onSpeak } = {}) {
  const [pose, setPose] = useState('idle')
  const [bubble, setBubble] = useState('')
  const [posesManifest, setPosesManifest] = useState(null)
  const lastPoseRef = useRef('idle')
  const holdTimer = useRef(null)
  const idleTimer = useRef(null)
  const tapIdxRef = useRef(-1)

  useEffect(() => { loadPosesManifest().then(setPosesManifest) }, [])

  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      playPose('hips', 'Want to try something else on?', { hold: HOLD_MS })
      resetIdleTimer()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, IDLE_NUDGE_MS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const playPose = useCallback((rawPose, bubbleText, { hold = HOLD_MS, record = true } = {}) => {
    const shown = calm ? calmSafePose(rawPose) : rawPose
    clearTimeout(holdTimer.current)
    setPose(shown)
    setBubble(bubbleText ?? BUBBLE_FOR_POSE[shown] ?? '')
    if (record) lastPoseRef.current = shown
    onSpeak?.(bubbleText ?? BUBBLE_FOR_POSE[shown])
    if (hold) {
      holdTimer.current = setTimeout(() => {
        setPose('idle')
        setBubble('')
        try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ pose: shown, at: Date.now() })) } catch { /* best-effort */ }
      }, hold)
    }
  }, [calm, onSpeak])

  // On equip: look up the item's reaction, or a random non-repeating one.
  const reactToEquip = useCallback((category, itemKey) => {
    const chosen = reactionPoseFor(posesManifest, category, itemKey, { lastPose: lastPoseRef.current })
    playPose(chosen)
  }, [posesManifest, playPose])

  const reactToUnequip = useCallback(() => {
    playPose('happy', 'Back to my natural look!')
  }, [playPose])

  const reactToLocked = useCallback((badgeName) => {
    playPose('wave', badgeName ? `Win ${badgeName} to wear this!` : 'Keep playing to unlock this one!', { record: false })
  }, [playPose])

  // Tapping Pao in the preview: cycles wave -> giggle -> cheer -> love -> wow,
  // independent of what's equipped.
  const tapCycle = useCallback(() => {
    tapIdxRef.current = (tapIdxRef.current + 1) % TAP_CYCLE.length
    playPose(TAP_CYCLE[tapIdxRef.current], null, { hold: HOLD_MS, record: false })
  }, [playPose])

  useEffect(() => {
    resetIdleTimer()
    return () => { clearTimeout(holdTimer.current); clearTimeout(idleTimer.current) }
  }, [resetIdleTimer])

  // Any reaction call also counts as activity, so the 25s idle nudge
  // restarts from the last real interaction, not from mount.
  const wrap = useCallback((fn) => (...args) => { resetIdleTimer(); return fn(...args) }, [resetIdleTimer])

  // Call when the modal is closing, so the header picks up whatever pose
  // was showing even if its own hold timer hasn't finished yet.
  const handoffNow = useCallback(() => {
    if (pose === 'idle') return
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ pose, at: Date.now() })) } catch { /* best-effort */ }
  }, [pose])

  return {
    pose,
    bubble,
    fx: !calm,
    reactToEquip: wrap(reactToEquip),
    reactToUnequip: wrap(reactToUnequip),
    reactToLocked: wrap(reactToLocked),
    tapCycle: wrap(tapCycle),
    handoffNow,
  }
}

// Read once by the games-list header: the last pose shown in the modal, if
// it was set within the last few seconds (so a stale handoff from days ago
// never resurfaces).
export function takeHandoffPose() {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(HANDOFF_KEY)
    const { pose, at } = JSON.parse(raw)
    if (Date.now() - at > 4000) return null
    return pose
  } catch { return null }
}
