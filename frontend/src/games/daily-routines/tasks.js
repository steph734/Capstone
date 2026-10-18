// The 5 Daily Routines tasks. Stored as data so more can be added later.
// task.key / badgeCode match the database badges (the server awards the badge per task_key).
// step.why = the reason this step comes at its place ("Not yet! We need soap before we scrub.").
const step = (id, text, why) => ({ id, text, why })

// Daily Routines has ONE badge for the whole game (the first finished task earns it).
export const BADGE = { code: 'routine_star', name: 'Routine Star' }

export const TASKS = [
  {
    id: 'morning', key: 'morning', name: 'My morning', badge: BADGE.name, badgeCode: BADGE.code, finish: 'Ready for the day!', safety: false,
    steps: [
      step('wake', 'Wake up', 'We start the day by waking up.'),
      step('toilet', 'Use the toilet', 'First we use the toilet after we wake up.'),
      step('teeth', 'Brush your teeth', 'We brush our teeth before we wash up.'),
      step('face', 'Wash your face', 'We wash our face before we get dressed.'),
      step('dress', 'Get dressed', 'We get dressed before we eat.'),
      step('breakfast', 'Eat breakfast', 'Breakfast comes last, when we are ready.'),
    ],
  },
  {
    id: 'handwashing', key: 'handwashing', name: 'Washing hands', badge: BADGE.name, badgeCode: BADGE.code, finish: 'Squeaky clean!', safety: false,
    steps: [
      step('water', 'Turn on the water', 'First, we turn on the water.'),
      step('wet', 'Wet your hands', 'We wet our hands before the soap.'),
      step('soap', 'Put on soap', 'We need soap before we scrub.'),
      step('scrub', 'Scrub for 20 seconds', 'Scrub first, then rinse.'),
      step('rinse', 'Rinse the soap off', 'Rinse first, then dry.'),
      step('dry', 'Dry with a towel', 'Last, we dry with a towel.'),
    ],
  },
  {
    id: 'egg', key: 'egg', name: 'Cooking an egg', note: 'with a grown-up', badge: BADGE.name, badgeCode: BADGE.code, finish: 'Yummy egg!', safety: true,
    steps: [
      step('help', 'Ask a grown-up to help', 'We always ask a grown-up first.'),
      step('pan', 'Put the pan on the stove', 'The pan goes on the stove before the egg.'),
      step('crack', 'Crack the egg into the pan', 'We crack the egg into the pan next.'),
      step('cook', 'Cook until it is white', 'We cook the egg before we put it on a plate.'),
      step('plate', 'Put the egg on a plate', 'Then the egg goes on a plate.'),
      step('off', 'Turn off the stove', 'Last, a grown-up turns off the stove.'),
    ],
  },
  {
    id: 'sandwich', key: 'sandwich', name: 'Making a sandwich', badge: BADGE.name, badgeCode: BADGE.code, finish: 'Yummy sandwich!', safety: false,
    steps: [
      step('wash', 'Wash your hands', 'We wash our hands before we touch food.'),
      step('bread', 'Take two slices of bread', 'We take the bread before we spread.'),
      step('butter', 'Spread the butter', 'We spread the butter before the cheese.'),
      step('cheese', 'Add the cheese', 'The cheese goes on the butter.'),
      step('top', 'Put the bread on top', 'We put the bread on top after the cheese.'),
      step('cut', 'Cut it in half', 'Last, we cut it in half.'),
    ],
  },
  {
    id: 'bedtime', key: 'bedtime', name: 'Bedtime', badge: BADGE.name, badgeCode: BADGE.code, finish: 'Sweet dreams!', safety: false,
    steps: [
      step('bath', 'Take a bath', 'We start with a bath.'),
      step('pajamas', 'Put on pajamas', 'We put on pajamas after the bath.'),
      step('teeth', 'Brush your teeth', 'We brush our teeth before the story.'),
      step('story', 'Read a story', 'We read a story before the light goes off.'),
      step('light', 'Turn off the light', 'We turn off the light before we sleep.'),
      step('sleep', 'Go to sleep', 'Last, we go to sleep.'),
    ],
  },
]

export const STEPS_PER_TASK = 6
export const DEFAULT_SETTINGS = { placeExample: true, showAll: false, readAloud: true, hintDelay: 12, sound: true }

const DONE = 'dailyRoutines:done:'
export function loadDone(who) {
  try { return new Set(JSON.parse(localStorage.getItem(DONE + who) || '[]')) } catch { return new Set() }
}
export function saveDone(who, set) {
  try { localStorage.setItem(DONE + who, JSON.stringify([...set])) } catch { /* private mode */ }
}

const KEY = 'dailyRoutines:settings:'
export function loadSettings(who) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY + who) || '{}') } } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveSettings(who, s) {
  try { localStorage.setItem(KEY + who, JSON.stringify(s)) } catch { /* private mode */ }
}

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }

// The tray: at most 3 cards (the next correct step + 2 others), or all remaining steps. Never in order.
export function buildTray(steps, placedCount, showAll) {
  const remaining = steps.slice(placedCount)
  if (remaining.length <= 1) return remaining
  const pool = showAll || remaining.length <= 3 ? remaining : [remaining[0], ...shuffle(remaining.slice(1)).slice(0, 2)]
  let tray
  let guard = 0
  do { tray = shuffle(pool); guard += 1 } while (tray.length > 1 && tray.every((s, i) => s.id === pool[i].id) && guard < 20)
  return tray
}
