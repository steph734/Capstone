// Defaults, colours and the track layout for Alphabet Blast.
export const VIEW = { w: 1440, h: 900 }
export const BALL = 56
export const GAP = 57
export const LAUNCHER = { x: 640, y: 500 }

// Landscape track: two laps of a shrinking ellipse around Pao (clockwise: along the top to the right, down the
// side, back along the bottom), spiralling in to the black hole on the left. The ribbon, the arrows and the balls
// are all built from this one point list, so they always agree. Joined with a Catmull-Rom curve.
function ellipseSpiral(c) {
  const pts = []
  const N = 70
  for (let i = 0; i <= N; i += 1) {
    const t = i / N
    const a = ((200 + 700 * t) * Math.PI) / 180
    pts.push([Math.round(c.x + (540 - 240 * t) * Math.cos(a)), Math.round(c.y + (285 - 120 * t) * Math.sin(a))])
  }
  return pts
}
const SPIRAL = ellipseSpiral(LAUNCHER)
export const HOLE = { x: SPIRAL[SPIRAL.length - 1][0], y: SPIRAL[SPIRAL.length - 1][1] }

export function buildPathD(p = SPIRAL) {
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

// Landscape for wide screens, a taller layout for portrait (phones held upright).
const SPIRAL_PORTRAIT = [
  [80, 330], [250, 270], [520, 265], [760, 320], [830, 520], [840, 800], [820, 1100], [740, 1300], [520, 1370], [300, 1360], [140, 1280], [80, 1060], [70, 760],
  [130, 540], [250, 500], [480, 470], [680, 560], [730, 760], [700, 980], [560, 1110], [380, 1120], [260, 1020], [230, 840], [300, 700], [420, 705],
]
export const LAYOUTS = {
  landscape: { view: VIEW, spiral: SPIRAL, launcher: LAUNCHER, hole: HOLE },
  portrait: { view: { w: 900, h: 1600 }, spiral: SPIRAL_PORTRAIT, launcher: { x: 500, y: 930 }, hole: { x: 420, y: 705 } },
}

export const SPEEDS = { 'very-slow': 18, slow: 30, normal: 42 } // px per second along the track
export const SPEED_LABELS = { 'very-slow': 'Very slow', slow: 'Slow', normal: 'Normal' }
export const SPEED_FILL = { 'very-slow': 25, slow: 50, normal: 75 }
export const LETTER_SETS = { 'a-z': 'A to Z', 'a-m': 'A to M', 'n-z': 'N to Z', custom: 'Custom list' }
// In-game chain-speed control and difficulty chips: the three existing speeds, slowest first.
export const SPEED_ORDER = ['very-slow', 'slow', 'normal']
export const SPEED_BUTTONS = { 'very-slow': 'Slow', slow: 'Normal', normal: 'Fast' }
export const DIFFICULTY = { 'very-slow': 'Easy', slow: 'Medium', normal: 'Hard' }
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

const PASTELS = ['#86EFAC', '#7DD3FC', '#FDBA74', '#FDA4AF', '#C4B5FD', '#FDE68A']
export const DARKER = ['#3FA866', '#3B93BF', '#C9833A', '#C95E6F', '#7F6BD0', '#C9B24F']
export const colorIndex = (letter) => (letter.charCodeAt(0) - 65 + 6000) % PASTELS.length
export const colorFor = (letter) => PASTELS[colorIndex(letter)]

const KEY = 'alphabetBlast:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}
