// Defaults, colours and the track layout for Alphabet Blast.
export const VIEW = { w: 1600, h: 900 }
export const BALL = 62
export const GAP = 66
export const LAUNCHER = { x: 830, y: 530 }
export const HOLE = { x: 590, y: 555 }

// A smooth inward spiral: starts top-left, loops the board once, then circles the launcher
// and ends at the black hole. Points are joined with a Catmull-Rom curve.
const SPIRAL = [
  [110, 330], [300, 250], [650, 215], [1000, 225], [1230, 330], [1300, 520], [1200, 730], [900, 825], [550, 830], [300, 740], [240, 560],
  [350, 430], [600, 372], [900, 375], [1090, 470], [1080, 620], [900, 695], [700, 660], [590, 555],
]
export function buildPathD() {
  const p = SPIRAL
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[Math.max(0, i - 1)]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[Math.min(p.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`
  }
  return d
}

export const SPEEDS = { 'very-slow': 18, slow: 30, normal: 42 } // px per second along the track
export const SPEED_LABELS = { 'very-slow': 'Very slow', slow: 'Slow', normal: 'Normal' }
export const SPEED_FILL = { 'very-slow': 25, slow: 50, normal: 75 }
export const LETTER_SETS = { 'a-z': 'A to Z', 'a-m': 'A to M', 'n-z': 'N to Z', custom: 'Custom list' }
export const HINT_DELAYS = [4, 6, 10]

export const DEFAULT_SETTINGS = {
  speed: 'slow',
  letterSet: 'a-z',
  customLetters: '',
  letterCase: 'upper', // upper | lower | both
  autoSpeak: true,
  showTimer: true,
  hintDelay: 6,
  sound: true,
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export function lettersFor(settings) {
  if (settings.letterSet === 'a-m') return ALPHABET.slice(0, 13)
  if (settings.letterSet === 'n-z') return ALPHABET.slice(13)
  if (settings.letterSet === 'custom') {
    const picked = [...new Set(String(settings.customLetters || '').toUpperCase().split('').filter((c) => /[A-Z]/.test(c)))]
    if (picked.length) return picked.sort()
  }
  return ALPHABET
}

export const ALL_LETTERS = ALPHABET

const PASTELS = ['#ffb3c1', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff']
export const colorFor = (letter) => PASTELS[(letter.charCodeAt(0) - 65) % PASTELS.length]

const KEY = 'alphabetBlast:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}
