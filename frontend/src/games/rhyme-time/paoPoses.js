// Pao's poses live in public/games/rhyme-time/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (file) => `${base}games/rhyme-time/${file}.svg`

export const paoPoses = {
  listening: pose('pao-listening'),
  asking: pose('pao-asking'),
  thinking: pose('pao-thinking'),
  hint: pose('pao-hint'),
  correct: pose('pao-correct'),
  tryAgain: pose('pao-try-again'),
  singing: pose('pao-singing'),
  rhymeMaster: pose('pao-rhyme-master'),
}

export const FALLBACK_PAO = `${base}pao.png`

// Loads every pose before round 1. A pose that fails is logged and falls back to the normal Pao image.
export function preloadPoses() {
  return Promise.all(Object.entries(paoPoses).map(([name, src]) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => { console.warn(`Rhyme Time: could not load Pao pose "${name}" (${src})`); resolve(false) }
    img.src = src
  })))
}
