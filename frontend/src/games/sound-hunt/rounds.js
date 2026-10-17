// The 5 sound-hunt rounds, in play order. Add more sets here later.
export const ROUNDS = [
  { id: 'b', letter: 'B', sound: 'b', ttsSound: 'buh', targets: ['ball', 'banana', 'bear'], others: ['cat', 'sun', 'fish'] },
  { id: 'm', letter: 'M', sound: 'm', ttsSound: 'mmm', targets: ['moon', 'milk', 'monkey'], others: ['dog', 'hat', 'pig'] },
  { id: 's', letter: 'S', sound: 's', ttsSound: 'sss', targets: ['sun', 'sock', 'soap'], others: ['ball', 'cake', 'fish'] },
  { id: 'p', letter: 'P', sound: 'p', ttsSound: 'puh', targets: ['pig', 'pen', 'pizza'], others: ['moon', 'car', 'bed'] },
  { id: 'c', letter: 'C', sound: 'k', ttsSound: 'kuh', targets: ['cat', 'car', 'cake'], others: ['sun', 'bus', 'milk'] },
]

// How the voice should say each sound (the sound, not the letter name).
export const TTS_SOUND = { b: 'buh', d: 'duh', f: 'fff', h: 'huh', k: 'kuh', m: 'mmm', p: 'puh', s: 'sss' }

// The first sound of the "other" words, for the "Sun starts with /s/" hint.
export const WORD_SOUND = { cat: 'k', sun: 's', fish: 'f', dog: 'd', hat: 'h', pig: 'p', ball: 'b', cake: 'k', moon: 'm', car: 'k', bed: 'b', bus: 'b', milk: 'm' }

export const DEFAULT_SETTINGS = { saySound: true, showWords: true, hintDelay: 10, autoNext: true, sound: true }

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// Six shuffled cards for one round.
export const buildCards = (round) => shuffle([...round.targets.map((word) => ({ word, target: true })), ...round.others.map((word) => ({ word, target: false }))])

const KEY = 'soundHunt:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}
