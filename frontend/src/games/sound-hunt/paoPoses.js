// Pao's poses live in public/games/sound-hunt/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (file) => `${base}games/sound-hunt/pao-${file}.svg`

export const paoPoses = {
  listening: pose('listening'),
  searching: pose('searching'),
  foundIt: pose('found-it'),
  tryAgain: pose('try-again'),
  thinking: pose('thinking'),
  hint: pose('hint'),
  roundDone: pose('round-done'),
  soundHunter: pose('sound-hunter'),
}

export const FALLBACK_PAO = `${base}pao.png`

// Loads every pose before round 1. A pose that fails is logged and falls back to the normal Pao image.
export function preloadPoses() {
  return Promise.all(Object.entries(paoPoses).map(([name, src]) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => { console.warn(`Sound Hunt: could not load Pao pose "${name}" (${src})`); resolve(false) }
    img.src = src
  })))
}
