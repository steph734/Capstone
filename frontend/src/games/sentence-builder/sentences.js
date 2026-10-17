// Sentence bank. type: little | noun | verb | describe. The period is drawn by the UI, not a tile.
const w = (text, type) => ({ text, type })
const L = (t) => w(t, 'little')
const N = (t) => w(t, 'noun')
const V = (t) => w(t, 'verb')
const D = (t) => w(t, 'describe')

export const SENTENCES = [
  // Easy (3 words)
  { id: 'cat-sleeps', level: 'easy', words: [L('The'), N('cat'), V('sleeps')], picture: 'cat-sleeps', description: 'A cat sleeping on a cushion' },
  { id: 'dog-runs', level: 'easy', words: [L('The'), N('dog'), V('runs')], picture: 'dog-runs', description: 'A dog running in the park' },
  { id: 'eat-rice', level: 'easy', words: [N('I'), V('eat'), N('rice')], picture: 'eat-rice', description: 'A bowl of rice' },
  { id: 'bird-sings', level: 'easy', words: [L('The'), N('bird'), V('sings')], picture: 'bird-sings', description: 'A bird singing on a branch' },
  { id: 'mama-cooks', level: 'easy', words: [N('Mama'), V('cooks'), N('food')], picture: 'mama-cooks', description: 'Mama cooking at the stove' },
  { id: 'brush-teeth', level: 'easy', words: [N('I'), V('brush'), N('teeth')], picture: 'brush-teeth', description: 'A child brushing teeth' },
  // Medium (4 words)
  { id: 'cat-sleeping', level: 'medium', words: [L('The'), N('cat'), L('is'), V('sleeping')], picture: 'cat-sleeps', description: 'A cat sleeping by a window' },
  { id: 'boy-running', level: 'medium', words: [L('The'), N('boy'), L('is'), V('running')], picture: 'boy-running', description: 'A boy running outside' },
  { id: 'fish-swim', level: 'medium', words: [L('The'), N('fish'), L('can'), V('swim')], picture: 'fish-swim', description: 'A fish swimming' },
  { id: 'red-apples', level: 'medium', words: [N('I'), V('like'), D('red'), N('apples')], picture: 'red-apples', description: 'A basket of red apples' },
  { id: 'baby-crying', level: 'medium', words: [L('The'), N('baby'), L('is'), V('crying')], picture: 'baby-crying', description: 'A baby crying' },
  { id: 'go-school', level: 'medium', words: [N('We'), V('go'), L('to'), N('school')], picture: 'go-school', description: 'Children going to school' },
  // Hard (5 words)
  { id: 'dog-big', level: 'hard', words: [L('The'), N('dog'), L('is'), D('very'), D('big')], picture: 'dog-big', description: 'A very big dog next to a small cat' },
  { id: 'wash-hands', level: 'hard', words: [N('I'), V('wash'), L('my'), D('two'), N('hands')], picture: 'wash-hands', description: 'Two hands being washed' },
  { id: 'girl-reads', level: 'hard', words: [L('The'), N('girl'), V('reads'), L('a'), N('book')], picture: 'girl-reads', description: 'A girl reading a book' },
  { id: 'mom-coffee', level: 'hard', words: [L('My'), N('mom'), V('drinks'), D('hot'), N('coffee')], picture: 'mom-coffee', description: 'Mom with a hot cup of coffee' },
  { id: 'birds-sky', level: 'hard', words: [N('Birds'), V('fly'), L('in'), L('the'), N('sky')], picture: 'birds-sky', description: 'Birds flying in the sky' },
  { id: 'sun-hot', level: 'hard', words: [L('The'), N('sun'), L('is'), D('very'), D('hot')], picture: 'sun-hot', description: 'A very hot sun' },
]

export const PLAN = [['easy', 2], ['medium', 3], ['hard', 2]]
export const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
export const LEVEL_COLOR = { easy: '#2e9d63', medium: '#f08a1c', hard: '#e5484d' }
export const BASE_POINTS = { easy: 10, medium: 15, hard: 20 }
export const TYPE_NAME = { little: 'Little words', noun: 'Who or what', verb: 'Doing words', describe: 'Describing words' }

export const DEFAULT_SETTINGS = { sayFirst: 'easy', hintDelay: 10, showColors: true, autoNext: true, sound: true }

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// Tiles are never already in the right order.
export function scramble(words) {
  const order = words.map((x) => x.text).join('|')
  let tiles
  let guard = 0
  do { tiles = shuffle(words.map((x, i) => ({ ...x, id: i }))); guard += 1 } while (tiles.map((x) => x.text).join('|') === order && guard < 30)
  return tiles
}

// 2 easy, then 3 medium, then 2 hard, no repeats.
export function buildGame() {
  return PLAN.flatMap(([level, n]) => shuffle(SENTENCES.filter((s) => s.level === level)).slice(0, n))
    .map((s) => ({ ...s, tiles: scramble(s.words), sentence: `${s.words.map((x) => x.text).join(' ')}.` }))
}

export const pointsFor = (level, wrong, hints) => {
  const base = BASE_POINTS[level]
  if (!wrong && !hints) return base
  if (wrong <= 2 && hints <= 1) return Math.round(base * 0.7)
  return Math.round(base * 0.5)
}

const KEY = 'sentenceBuilder:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}
