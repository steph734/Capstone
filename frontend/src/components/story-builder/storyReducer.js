// Pure state for Story Builder: no React, no speech, no timers. The screens
// decide what Pao says and when to move on; this only records what happened.
//
// Phases: 'start' -> 'picker' -> 'playing' -> 'done'.
// A step is complete once it has pick_count correct picks. Several choices can
// be correct, and wrong taps are remembered so that tile stays disabled.

export const initialState = {
  phase: 'start',
  storyIndex: 0,
  stepIndex: 0,
  picks: {},   // { [stepIndex]: [choice_key, ...] } correct picks, in tap order
  wrong: {},   // { [stepIndex]: [choice_key, ...] } wrong taps, disabled after
  attempts: 0,
  stepDone: false,
}

export function storyReducer(state, action) {
  switch (action.type) {
    case 'home':
      return { ...initialState }

    case 'picker':
      return { ...initialState, phase: 'picker' }

    case 'start':
      return { ...initialState, phase: 'playing', storyIndex: action.storyIndex }

    case 'tap': {
      const { item, choiceKey } = action
      if (state.phase !== 'playing' || state.stepDone || !item) return state
      const choice = item.choices?.find((c) => c.choice_key === choiceKey)
      if (!choice) return state

      const step = state.stepIndex
      const picked = state.picks[step] || []
      const missed = state.wrong[step] || []
      if (picked.includes(choiceKey) || missed.includes(choiceKey)) return state

      const attempts = state.attempts + 1
      if (!choice.is_correct) {
        return { ...state, attempts, wrong: { ...state.wrong, [step]: [...missed, choiceKey] } }
      }

      const nextPicked = [...picked, choiceKey]
      return {
        ...state,
        attempts,
        picks: { ...state.picks, [step]: nextPicked },
        stepDone: nextPicked.length >= pickCountOf(item),
      }
    }

    case 'next': {
      if (state.phase !== 'playing' || !state.stepDone) return state
      if (state.stepIndex + 1 < action.stepCount) {
        return { ...state, stepIndex: state.stepIndex + 1, stepDone: false }
      }
      return { ...state, phase: 'done', stepDone: false }
    }

    default:
      return state
  }
}

export function pickCountOf(item) {
  return Math.max(1, Number(item?.pick_count) || 1)
}

export function pickedChoices(item, keys = []) {
  return keys
    .map((key) => item?.choices?.find((c) => c.choice_key === key))
    .filter(Boolean)
}

// "a toy bear", "flowers" + "cookies" -> "a toy bear, flowers and cookies"
export function joinNames(names) {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// One panel per step the player actually told, skipping is_order_check steps.
// recap: { text } fixed line | { from_choice: true } (the picked choice's feedback)
//        | { from_picks: true, template } ({items} = picked name_in_story values)
// recap_image: a URL | 'from_choice' (the picked choice's picture) | missing (scene).
export function buildRecapPanels(story, state) {
  const panels = []
  ;(story?.items || []).forEach((item, step) => {
    if (item.is_order_check) return
    const picks = pickedChoices(item, state.picks[step])
    const first = picks[0]
    const recap = item.recap || {}

    let line = item.text || ''
    if (recap.from_choice) line = first?.feedback || first?.label || line
    else if (recap.from_picks) {
      const names = picks.map((c) => c.name_in_story || c.label)
      line = (recap.template || '{items}').replace('{items}', joinNames(names))
    } else if (recap.text) line = recap.text

    let image = item.image_url
    if (item.recap_image === 'from_choice') image = first?.image_url || item.image_url
    else if (item.recap_image) image = item.recap_image

    panels.push({ label: item.label, line, image })
  })
  return panels
}

// stars: 3 for steps told with no wrong taps, one less per step that needed a
// retry, never below 1 (stars are never taken away).
export function buildFinishResult(story, state) {
  const items = story?.items || []
  const choices = {}
  let correct = 0
  let stepsWithWrong = 0

  items.forEach((item, step) => {
    const keys = state.picks[step] || []
    correct += keys.length
    if ((state.wrong[step] || []).length > 0) stepsWithWrong += 1
    if (keys.length) choices[item.label] = pickCountOf(item) > 1 ? keys : keys[0]
  })

  return {
    correct,
    attempts: state.attempts,
    hints_used: 0,
    stars: Math.min(3, Math.max(1, items.length - stepsWithWrong)),
    detail: { story_key: story?.story_key, choices },
  }
}
