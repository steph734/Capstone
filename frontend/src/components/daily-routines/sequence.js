// Rules for a step_by_step game (no React). Works for any game document that
// has levels[] with items[] { label, text, image_url, step_order }. Levels can
// carry a task_key to group them into tasks; with no tasks array, every level
// belongs to one task.

const WRONG_LIMIT = { full_model: 1, partial: 2, none: 3 }

// Groups levels into tasks, each with its levels sorted and its steps sorted.
export function buildTasks(game) {
  const sbs = game.type_settings?.step_by_step || {}
  const taskDefs = Array.isArray(sbs.tasks) && sbs.tasks.length ? sbs.tasks : null
  const levels = [...(game.levels || [])].sort((a, b) => (a.level_order || 0) - (b.level_order || 0))

  const groups = taskDefs
    ? taskDefs.map((t) => ({ def: t, levels: levels.filter((l) => l.task_key === t.task_key) }))
    : [{ def: { task_key: 'all', name: game.name, finish_text: 'Well done!' }, levels }]

  return groups
    .filter((g) => g.levels.length)
    .map(({ def, levels: taskLevels }) => ({
      key: def.task_key,
      name: def.name,
      finish_text: def.finish_text || 'Well done!',
      color: def.color,
      cover_image: def.cover_image,
      min_age: def.min_age ?? 0,
      safety: def.safety === true,
      levels: taskLevels.map((l) => ({
        key: `${def.task_key}-${l.level_order}`,
        task_key: def.task_key,
        level_order: l.level_order,
        level_name: l.level_name,
        prompt_level: l.prompt_level || 'none',
        steps: [...(l.items || [])]
          .sort((a, b) => a.step_order - b.step_order)
          .map((it) => ({ key: `${def.task_key}-${l.level_order}-${it.step_order}`, label: it.label, text: it.text, image_url: it.image_url, step_order: it.step_order })),
      })),
    }))
}

// A random order of the given keys that is never the original order.
export function shuffleSteps(keys) {
  if (keys.length < 2) return [...keys]
  for (let tries = 0; tries < 100; tries++) {
    const a = [...keys]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.join('\u0000') !== keys.join('\u0000')) return a
  }
  return [...keys].reverse()
}

// Starting state for a level. Full-model levels place step 1 in its box.
export function initLevel(level) {
  const placed = {}
  let pool = level.steps.map((s) => s.key)
  if (level.prompt_level === 'full_model' && level.steps.length) {
    placed[0] = level.steps[0].key
    pool = pool.slice(1)
  }
  return {
    placed,
    tray: shuffleSteps(pool),
    selected: null,
    wrong: 0,
    glowSlot: null,
    stars: Object.keys(placed).length,
    done: false,
    message: { text: '', tone: 'neutral' },
  }
}

// Pure transition. Actions: select {key}, place {slot}.
export function sequenceReducer(state, action, level, finishText) {
  if (action.type === 'select') {
    return { ...state, selected: action.key, message: { text: '', tone: 'neutral' } }
  }
  if (action.type !== 'place' || state.done) return state
  if (state.placed[action.slot] !== undefined) return state

  if (!state.selected) {
    return { ...state, message: { text: 'First, tap a picture.', tone: 'hint' } }
  }

  const correctSlot = level.steps.findIndex((s) => s.key === state.selected)
  const step = level.steps[correctSlot]

  if (action.slot === correctSlot) {
    const placed = { ...state.placed, [action.slot]: state.selected }
    const done = Object.keys(placed).length === level.steps.length
    return {
      ...state,
      placed,
      tray: state.tray.filter((k) => k !== state.selected),
      selected: null,
      wrong: 0,
      glowSlot: null,
      stars: state.stars + 1,
      done,
      message: done
        ? { text: finishText || 'Well done!', tone: 'success' }
        : { text: `Next, ${step.text}!`, tone: 'success' },
    }
  }

  const wrong = state.wrong + 1
  const limit = WRONG_LIMIT[level.prompt_level] ?? WRONG_LIMIT.none
  const later = action.slot < correctSlot
  return {
    ...state,
    wrong,
    glowSlot: wrong >= limit ? correctSlot : null,
    message: {
      text: later
        ? 'Hmm, we do that a little later. Try another box.'
        : 'Hmm, we do that a little earlier. Try another box.',
      tone: 'hint',
    },
  }
}

// Read-aloud sentence: "First, a. Then b. Last, c."
export function routineSentence(items) {
  const texts = items.map((i) => i.text)
  return texts.map((t, i) => {
    if (i === 0) return `First, ${t}.`
    if (i === texts.length - 1) return `Last, ${t}.`
    return `Then ${t}.`
  }).join(' ')
}
