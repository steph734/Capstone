import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPosesManifest, calmSafePose, BUBBLE_FOR_POSE, layerUrl, poseFile, fxFile } from './paoLayers'

const HOLD_MS = 1600

// Extra bubble lines for the game-specific poses (PROMPT-game-poses.md) —
// BUBBLE_FOR_POSE from the expression prompt covers the shared ones
// (cheer, encourage, star-eyes, heart-eyes, proud, thumbsup, calm, idle).
const GAME_BUBBLE = {
  'look-left': '', 'look-right': '', 'look-up': '', 'look-down': '',
  'point-up': 'On top!', 'point-down': 'Under!', 'point-side': 'Next to!',
  spot: 'Let\'s take a look!', 'cup-ear': 'Listen carefully!',
  'say-ah': 'ah', 'say-ee': 'ee', 'say-oo': 'oo', 'say-mm': 'mm',
  slow: 'Nice and slow!', rhyme: 'Let\'s find the rhyme!',
  build: 'Let\'s build it!', paint: 'Time to paint!', read: 'Let\'s read!', idea: 'I have an idea!',
}

// Poses whose fx (and only fx) is dropped under calm_visuals / reduced
// motion, per PROMPT-game-poses.md's narrower list for in-game use.
const CALM_DROP_FX = new Set(['rhyme', 'star-eyes', 'heart-eyes', 'slow'])

// Drives the corner Pao's pose for one game. gameKey must match a key in
// poses.json's game_reactions (e.g. 'puzzle-pals'). react(eventName) looks
// up that game's pose for the event and plays it; unmapped events are a
// no-op rather than an error, so a game can call react() liberally.
//
//   const paoGame = usePaoGameReactions('puzzle-pals', { calm })
//   paoGame.react('instruction_on_top')
//   <CornerPao equipped={outfit} pose={paoGame.pose} bubble={paoGame.bubble} .../>
export function usePaoGameReactions(gameKey, { calm = false, onSpeak, readAloud = true } = {}) {
  const [pose, setPose] = useState('idle')
  const [bubble, setBubble] = useState('')
  const [posesManifest, setPosesManifest] = useState(null)
  const holdTimer = useRef(null)

  useEffect(() => { loadPosesManifest().then(setPosesManifest) }, [])

  // Preload this game's own poses as soon as its reaction map is known
  // (call this again from a start modal's onOpen if you want it earlier).
  useEffect(() => {
    if (!posesManifest) return
    const map = posesManifest.game_reactions?.[gameKey] || {}
    const uniquePoses = new Set(Object.values(map))
    uniquePoses.forEach((p) => {
      const img1 = new Image(); img1.src = layerUrl(poseFile(p))
      const img2 = new Image(); img2.src = layerUrl(fxFile(p))
    })
  }, [posesManifest, gameKey])

  const react = useCallback((eventName, { hold = HOLD_MS } = {}) => {
    if (!posesManifest) return
    const mapped = posesManifest.game_reactions?.[gameKey]?.[eventName]
    if (!mapped) return
    const shown = calm ? calmSafePose(mapped) : mapped
    clearTimeout(holdTimer.current)
    setPose(shown)
    const text = GAME_BUBBLE[shown] ?? BUBBLE_FOR_POSE[shown] ?? ''
    setBubble(text)
    if (readAloud && text && text.length > 2) onSpeak?.(text) // skip reading single letters like "ah"
    if (hold) holdTimer.current = setTimeout(() => { setPose('idle'); setBubble('') }, hold)
  }, [posesManifest, gameKey, calm, onSpeak, readAloud])

  // Hold a say-* mouth shape exactly as long as the sound plays, then idle —
  // for wiring to speechSynthesis onboundary instead of the fixed hold above.
  const holdSay = useCallback((soundPose) => {
    clearTimeout(holdTimer.current)
    setPose(soundPose)
    setBubble(GAME_BUBBLE[soundPose] || '')
  }, [])
  const releaseSay = useCallback(() => {
    clearTimeout(holdTimer.current)
    setPose('idle')
    setBubble('')
  }, [])

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  return { pose, bubble, showFx: !calm || !CALM_DROP_FX.has(pose), react, holdSay, releaseSay }
}
