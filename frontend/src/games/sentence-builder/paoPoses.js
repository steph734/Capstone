// Pao's poses live in public/games/sentence-builder/ and are loaded by URL (never imported).
const base = import.meta.env.BASE_URL || '/'
const pose = (file) => `${base}games/sentence-builder/pao-${file}.svg`

export const paoPoses = {
  reading: pose('reading'),
  asking: pose('asking'),
  thinking: pose('thinking'),
  hint: pose('hint'),
  goodWord: pose('good-word'),
  tryAgain: pose('try-again'),
  abracadabra: pose('abracadabra'),
  sentenceStar: pose('sentence-star'),
}

export const FALLBACK_PAO = `${base}pao.png`

// Loads every pose before puzzle 1. A pose that fails is logged and falls back to the normal Pao image.
export function preloadPoses() {
  return Promise.all(Object.entries(paoPoses).map(([name, src]) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => { console.warn(`Sentence Builder: could not load Pao pose "${name}" (${src})`); resolve(false) }
    img.src = src
  })))
}
