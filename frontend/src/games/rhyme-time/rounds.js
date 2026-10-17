// Rhyme rounds. wrong[] never rhymes with the word. wordEnd / answerEnd are how the ending is
// spelled in each word (they differ for bear / chair); the spoken ending is `ending`.
export const ROUNDS = [
  { word: 'cat', ending: 'at', answer: 'hat', wrong: ['dog', 'sun'], extra: 'bat', set: 'animals' },
  { word: 'dog', ending: 'og', answer: 'log', wrong: ['sun', 'cake'], extra: 'frog', set: 'animals' },
  { word: 'sun', ending: 'un', answer: 'bun', wrong: ['pig', 'car'], extra: 'run', set: 'home' },
  { word: 'bee', ending: 'ee', answer: 'tree', wrong: ['fish', 'moon'], extra: 'three', set: 'animals' },
  { word: 'cake', ending: 'ake', answer: 'lake', wrong: ['bug', 'star'], extra: 'snake', set: 'home' },
  { word: 'fish', ending: 'ish', answer: 'dish', wrong: ['bear', 'house'], extra: 'wish', set: 'animals' },
  { word: 'car', ending: 'ar', answer: 'star', wrong: ['cat', 'bee'], extra: 'jar', set: 'home' },
  { word: 'bug', ending: 'ug', answer: 'rug', wrong: ['dog', 'chair'], extra: 'mug', set: 'animals' },
  { word: 'pig', ending: 'ig', answer: 'wig', wrong: ['sun', 'spoon'], extra: 'dig', set: 'animals' },
  { word: 'mouse', ending: 'ouse', answer: 'house', wrong: ['cake', 'fish'], extra: 'blouse', set: 'animals' },
  { word: 'bear', ending: 'air', wordEnd: 'ear', answer: 'chair', answerEnd: 'air', wrong: ['bug', 'moon'], extra: 'hair', set: 'animals' },
  { word: 'moon', ending: 'oon', answer: 'spoon', wrong: ['tree', 'cat'], extra: 'balloon', set: 'home' },
]

export const WORD_SETS = { all: 'All words', animals: 'Animals', home: 'Things at home' }

export const DEFAULT_SETTINGS = {
  rounds: 10, wordSet: 'all', choices: 3, autoPlay: true, hintDelay: 8, autoNext: true, sound: true,
}

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// The rounds for one game, each with its picture choices already shuffled.
export function buildGame(settings) {
  const pool = ROUNDS.filter((r) => settings.wordSet === 'all' || r.set === settings.wordSet)
  return shuffle(pool).slice(0, settings.rounds).map((r) => {
    const wrong = shuffle(r.wrong).slice(0, Math.max(1, settings.choices - 1))
    return { ...r, wordEnd: r.wordEnd || r.ending, answerEnd: r.answerEnd || r.ending, choices: shuffle([r.answer, ...wrong]) }
  })
}

const KEY = 'rhymeTime:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}

// "cat" -> ["c", "at"] using the spelled ending.
export const split = (word, end) => (word.endsWith(end) ? [word.slice(0, word.length - end.length), end] : [word, ''])
