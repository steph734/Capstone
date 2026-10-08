// The 18 Pao poses, where to find them, and which app event plays which pose.
// Pose art lives at public/pao/svg/pao-<pose>.svg (preferred) and
// public/pao/png/pao-<pose>.png (fallback), 600x760, transparent. Until that
// folder is added to the project, PaoBuddy falls back to the existing
// illustrated <PandaMascot/>, mapped per pose below — nothing breaks either way.

export const POSES = [
  'idle', 'blink', 'hello', 'hooray', 'clap', 'think', 'listen', 'talk', 'eat',
  'yum', 'sleep', 'wow', 'oops', 'dance', 'hug', 'great', 'point', 'calm',
]

// What a screen reader says for each pose — never announced on every pose
// change (that uses aria-live="off"), only read if something asks for it.
export const POSE_DESCRIPTION = {
  idle: 'standing calmly', blink: 'blinking', hello: 'waving hello', hooray: 'cheering',
  clap: 'clapping', think: 'thinking', listen: 'listening', talk: 'talking',
  eat: 'eating', yum: 'enjoying a tasty bite', sleep: 'sleeping', wow: 'amazed',
  oops: 'gently surprised', dance: 'dancing', hug: 'hugging', great: 'giving a thumbs up',
  point: 'pointing', calm: 'breathing calmly',
}

// Poses safe to use when calm_visuals or prefers-reduced-motion is on — no
// bounce, no dance, no sudden energy. Everything else still shows, just
// without the extra motion (handled in PaoBuddy, not by hiding poses).
export const CALM_SAFE_POSES = new Set(['idle', 'talk', 'point', 'think', 'great', 'clap', 'calm', 'listen', 'hello'])

// Tap-to-react cycle (never an error, never "stop tapping").
export const REACTION_CYCLE = ['hello', 'hooray', 'clap', 'wow', 'dance', 'hug']
// The calm-visuals-safe version of the same cycle.
export const REACTION_CYCLE_CALM = ['hello', 'clap', 'great', 'clap', 'great', 'hello']

// App event -> pose + how long to hold it (ms) before returning to the base
// mood. `hold: null` means "stays until something else changes it" (e.g.
// while speech is playing).
export const MOOD_FOR_EVENT = {
  appOpen: { mood: 'hello', hold: 2200 },
  gameStart: { mood: 'hello', hold: 1800 },
  instructions: { mood: 'talk', hold: null },
  waitingForTap: { mood: 'point', hold: null },
  hintShown: { mood: 'think', hold: 2500 },
  patientSpeaking: { mood: 'listen', hold: null },
  correct: { mood: 'hooray', hold: 1600 },
  correctStreak3: { mood: 'great', hold: 1800 },
  wrongTry: { mood: 'oops', hold: 1200 }, // caller should follow with trigger('hintShown')
  feedHealthy: { mood: 'eat', hold: 1400 }, // caller should follow with setMood('yum', { hold: 1200 })
  feedJunk: { mood: 'oops', hold: 1400 },
  levelComplete: { mood: 'clap', hold: 2000 },
  newBadge: { mood: 'wow', hold: 2200 },
  levelUp: { mood: 'dance', hold: 2600 },
  gameFinished: { mood: 'hug', hold: 2600 },
  breathing: { mood: 'calm', hold: null },
  idleTooLong: { mood: 'point', hold: 2500 },
  breakTime: { mood: 'sleep', hold: null },
}

// Pose -> the nearest look the fallback <PandaMascot/> can make, used only
// until real pose art exists at the paths above.
export const FALLBACK_PANDA_STATE = {
  idle: 'normal', blink: 'normal', hello: 'happy', hooray: 'excited', clap: 'excited',
  think: 'shy', listen: 'normal', talk: 'happy', eat: 'happy', yum: 'excited',
  sleep: 'normal', wow: 'excited', oops: 'shy', dance: 'excited', hug: 'happy',
  great: 'happy', point: 'normal', calm: 'normal',
}
export const FALLBACK_TALKING_POSES = new Set(['talk', 'eat', 'hello', 'hooray'])

const svgPath = (pose) => `/pao/svg/pao-${pose}.svg`
const pngPath = (pose) => `/pao/png/pao-${pose}.png`
export function poseImagePaths(pose) {
  return { svg: svgPath(pose), png: pngPath(pose) }
}

// Poses worth blocking on before first paint; the rest load lazily.
export const PRELOAD_FIRST = ['idle', 'blink', 'hello', 'hooray', 'talk']

const checked = new Map() // pose -> true (has art) | false (confirmed missing)

// Tries the SVG, then the PNG, for one pose; remembers the result so we never
// re-request a pose we already know is missing.
function probe(pose) {
  if (checked.has(pose)) return Promise.resolve(checked.get(pose))
  return new Promise((resolve) => {
    const svg = new Image()
    svg.onload = () => { checked.set(pose, true); resolve(true) }
    svg.onerror = () => {
      const png = new Image()
      png.onload = () => { checked.set(pose, true); resolve(true) }
      png.onerror = () => { checked.set(pose, false); resolve(false) }
      png.src = pngPath(pose)
    }
    svg.src = svgPath(pose)
  })
}

// Preloads the given poses (default: the "first paint" set), best-effort.
// Safe to call more than once; already-checked poses resolve instantly.
export function preloadPaoPoses(poses = PRELOAD_FIRST) {
  return Promise.all(poses.map(probe))
}

export function hasPoseArt(pose) {
  return checked.get(pose) === true
}
