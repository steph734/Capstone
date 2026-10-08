// Pure logic for Emergency Ready (no React), so it is easy to test.
// Four part modes share one shape: init*(level) -> state, *Reducer(state, action, level) -> state.

// ─── Building the 6 emergencies from the game document ──────────────────────

export function buildEmergencies(game) {
  const defs = game?.type_settings?.step_by_step?.emergencies || []
  const levels = [...(game?.levels || [])].sort((a, b) => a.part_no - b.part_no)
  return defs.map((def) => ({
    key: def.emergency_key,
    name: def.name,
    rule: def.rule,
    coverImage: def.cover_image,
    color: def.color,
    border: def.border,
    introTitle: def.intro_title,
    introLines: def.intro_lines || [],
    signs: def.signs || [],
    puzzles: def.puzzles || [],
    endSummary: def.end_summary || [],
    levels: levels.filter((l) => l.emergency_key === def.emergency_key),
  })).filter((e) => e.levels.length)
}

// ─── order: put picture steps in order ───────────────────────────────────────

export function initOrder(level) {
  const keys = level.items.map((it) => it.label)
  return { placed: {}, tray: shuffle(keys), selected: null, wrong: 0, glowSlot: null, stars: 0, done: false, message: null }
}

export function orderReducer(state, action, level) {
  if (action.type === 'select') return { ...state, selected: action.key, message: null }
  if (action.type !== 'place' || state.done) return state
  if (state.placed[action.slot] !== undefined) return state
  if (!state.selected) return { ...state, message: { text: 'First, tap a picture.', tone: 'hint' } }

  const sorted = [...level.items].sort((a, b) => a.step_order - b.step_order)
  const correctSlot = sorted.findIndex((it) => it.label === state.selected)
  const step = sorted[correctSlot]

  if (action.slot === correctSlot) {
    const placed = { ...state.placed, [action.slot]: state.selected }
    const done = Object.keys(placed).length === sorted.length
    return { ...state, placed, tray: state.tray.filter((k) => k !== state.selected), selected: null, wrong: 0, glowSlot: null, stars: state.stars + 1, done, message: { text: step.text, tone: 'good' } }
  }

  const wrong = state.wrong + 1
  const later = action.slot < correctSlot
  const base = later ? `"${state.selected}" comes later.` : `"${state.selected}" comes earlier.`
  return {
    ...state,
    wrong,
    glowSlot: wrong >= 2 ? correctSlot : null,
    message: { text: level.rule_hint ? `${base} ${level.rule_hint}` : base, tone: 'hint' },
  }
}

// ─── safe_or_not: one card at a time, tap Safe or Not safe ──────────────────

export function initSafeOrNot() {
  return { index: 0, stars: 0, answered: false, correct: null, done: false, message: null }
}

export function safeOrNotReducer(state, action, level) {
  const item = level.items[state.index]
  if (action.type === 'answer') {
    if (state.answered) return state
    const correct = action.isSafe === item.is_safe
    return { ...state, answered: true, correct, stars: state.stars + (correct ? 1 : 0), message: { text: correct ? item.why : `Hmm, look again. ${item.why}`, tone: correct ? 'good' : 'hint' } }
  }
  if (action.type === 'next') {
    if (!state.answered) return state
    const index = state.index + 1
    const done = index >= level.items.length
    return { ...state, index: done ? state.index : index, answered: false, correct: null, done, message: null }
  }
  return state
}

// ─── choose: questions with picture answers ──────────────────────────────────

export function initChoose() {
  return { index: 0, stars: 0, answered: false, chosenKey: null, correct: null, done: false, message: null }
}

export function chooseReducer(state, action, level) {
  const item = level.items[state.index]
  if (action.type === 'answer') {
    if (state.answered) return state
    const choice = item.choices.find((c) => (c.choice_key || c.label) === action.key)
    const correct = !!choice?.is_correct
    return { ...state, answered: true, chosenKey: action.key, correct, stars: state.stars + (correct ? 1 : 0), message: { text: correct ? choice.why : `Hmm. ${choice.why}`, tone: correct ? 'good' : 'hint' } }
  }
  if (action.type === 'next') {
    if (!state.answered) return state
    const index = state.index + 1
    const done = index >= level.items.length
    return { ...state, index: done ? state.index : index, answered: false, chosenKey: null, correct: null, done, message: null }
  }
  return state
}

// ─── sort: tap an item, then tap a zone ──────────────────────────────────────

export function initSort(level) {
  const keys = level.items.map((it) => it.choice_key || it.label)
  return { placed: { bag: [], home: [] }, tray: shuffle(keys), selected: null, stars: 0, done: false, message: null }
}

export function sortReducer(state, action, level) {
  if (action.type === 'select') return { ...state, selected: action.key, message: null }
  if (action.type !== 'drop' || state.done) return state
  if (!state.selected) return { ...state, message: { text: 'First, tap an item.', tone: 'hint' } }

  const item = level.items.find((it) => (it.choice_key || it.label) === state.selected)
  if (item.zone_key === action.zoneKey) {
    const placed = { ...state.placed, [action.zoneKey]: [...state.placed[action.zoneKey], state.selected] }
    const done = Object.values(placed).flat().length === level.items.length
    return { ...state, placed, tray: state.tray.filter((k) => k !== state.selected), selected: null, stars: state.stars + 1, done, message: { text: item.why, tone: 'good' } }
  }
  const hint = item.zone_key === 'bag' ? 'Put it in the go-bag.' : 'Leave that one at home.'
  return { ...state, message: { text: `${item.why} ${hint}`, tone: 'hint' } }
}

// ─── shared ───────────────────────────────────────────────────────────────

export function partComplete(mode, state) {
  return !!state?.done
}

function shuffle(items) {
  if (items.length < 2) return [...items]
  for (let tries = 0; tries < 100; tries++) {
    const a = [...items]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.join('\u0000') !== items.join('\u0000')) return a
  }
  return [...items].reverse()
}
