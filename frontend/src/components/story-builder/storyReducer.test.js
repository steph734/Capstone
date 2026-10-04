import { describe, it, expect } from 'vitest'
import { storyReducer, initialState, buildRecapPanels, buildFinishResult } from './storyReducer'

const choice = (key, extra = {}) => ({
  choice_key: key, label: key, image_url: `/icons/${key}.svg`, is_correct: false, feedback: `fb ${key}`, name_in_story: `a ${key}`, ...extra,
})

const story = {
  story_key: 'red',
  items: [
    { label: 'Pack', pick_count: 3, text: 'Red packs the basket.', image_url: '/scenes/home.svg',
      recap: { from_picks: true, template: 'Red packed {items}.' }, recap_image: 'from_choice',
      choices: [
        choice('flowers', { is_correct: true, name_in_story: 'flowers' }),
        choice('cookies', { is_correct: true, name_in_story: 'cookies' }),
        choice('bear', { is_correct: true, name_in_story: 'a toy bear' }),
        choice('rock'),
      ] },
    { label: 'Wolf', pick_count: 1, text: 'The wolf asks.', image_url: '/scenes/wolf.svg',
      recap: { from_choice: true }, recap_image: 'from_choice',
      choices: [
        choice('truth', { is_correct: true, feedback: 'Red tells the truth.' }),
        choice('silent', { is_correct: true, feedback: 'Red stays quiet.' }),
        choice('lie'),
      ] },
    { label: 'Order', is_order_check: true, pick_count: 1, text: 'Put these in order.', image_url: '/scenes/order.svg',
      choices: [choice('a', { is_correct: true })] },
  ],
}

const tap = (state, item, key) => storyReducer(state, { type: 'tap', item, choiceKey: key })
const started = () => storyReducer(initialState, { type: 'start', storyIndex: 0 })

describe('storyReducer', () => {
  it('starts a story at step 0 in the playing phase', () => {
    const s = started()
    expect(s.phase).toBe('playing')
    expect(s.stepIndex).toBe(0)
    expect(s.stepDone).toBe(false)
  })

  it('multi-pick: a pick_count 3 step completes only after the third correct pick', () => {
    let s = started()
    const pack = story.items[0]
    s = tap(s, pack, 'flowers')
    s = tap(s, pack, 'cookies')
    expect(s.stepDone).toBe(false)
    expect(s.picks[0]).toEqual(['flowers', 'cookies'])
    s = tap(s, pack, 'bear')
    expect(s.stepDone).toBe(true)
    expect(s.picks[0]).toEqual(['flowers', 'cookies', 'bear'])
  })

  it('ignores taps once the step is done or the same tile is tapped again', () => {
    let s = started()
    const pack = story.items[0]
    s = tap(s, pack, 'flowers')
    expect(tap(s, pack, 'flowers')).toBe(s)
    s = tap(s, pack, 'cookies')
    s = tap(s, pack, 'bear')
    expect(tap(s, pack, 'rock')).toBe(s)
  })

  it('several correct answers: any correct choice finishes a pick_count 1 step', () => {
    let s = started()
    s = storyReducer(s, { type: 'next', stepCount: 3 }) // no-op before done
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'flowers' })
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'cookies' })
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'bear' })
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    expect(s.stepIndex).toBe(1)

    const wolf = story.items[1]
    s = tap(s, wolf, 'silent')
    expect(s.stepDone).toBe(true)
  })

  it('wrong-then-right: the wrong tile is remembered, and the right one still completes the step', () => {
    let s = started()
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'flowers' })
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'cookies' })
    s = storyReducer(s, { type: 'tap', item: story.items[0], choiceKey: 'bear' })
    s = storyReducer(s, { type: 'next', stepCount: 3 })

    const wolf = story.items[1]
    s = tap(s, wolf, 'lie')
    expect(s.wrong[1]).toEqual(['lie'])
    expect(s.stepDone).toBe(false)
    expect(tap(s, wolf, 'lie')).toBe(s) // a wrong tile can't be tapped again
    s = tap(s, wolf, 'truth')
    expect(s.stepDone).toBe(true)
    expect(s.attempts).toBe(5)
  })

  it('moves to done after the last step', () => {
    let s = started()
    s = tap(s, story.items[0], 'flowers')
    s = tap(s, story.items[0], 'cookies')
    s = tap(s, story.items[0], 'bear')
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    s = tap(s, story.items[1], 'truth')
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    s = tap(s, story.items[2], 'a')
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    expect(s.phase).toBe('done')
  })

  it('recap from_picks fills {items} with the picked name_in_story values', () => {
    let s = started()
    s = tap(s, story.items[0], 'flowers')
    s = tap(s, story.items[0], 'cookies')
    s = tap(s, story.items[0], 'bear')
    const panels = buildRecapPanels(story, s)
    expect(panels[0].line).toBe('Red packed flowers, cookies and a toy bear.')
  })

  it('recap from_choice uses the feedback and picture of the choice the patient made', () => {
    let s = started()
    s = tap(s, story.items[0], 'flowers')
    s = tap(s, story.items[0], 'cookies')
    s = tap(s, story.items[0], 'bear')
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    s = tap(s, story.items[1], 'silent')

    const panels = buildRecapPanels(story, s)
    expect(panels).toHaveLength(2) // the is_order_check step is skipped
    expect(panels[1].line).toBe('Red stays quiet.')
    expect(panels[1].image).toBe('/icons/silent.svg')
  })

  it('builds the finish payload with choice keys and stars', () => {
    let s = started()
    s = tap(s, story.items[0], 'flowers')
    s = tap(s, story.items[0], 'cookies')
    s = tap(s, story.items[0], 'bear')
    s = storyReducer(s, { type: 'next', stepCount: 3 })
    s = tap(s, story.items[1], 'lie')
    s = tap(s, story.items[1], 'truth')

    const result = buildFinishResult(story, s)
    expect(result.correct).toBe(4) // three packed items plus one wolf answer
    expect(result.attempts).toBe(5)
    expect(result.stars).toBe(2) // one step needed a retry
    expect(result.detail).toEqual({
      story_key: 'red',
      choices: { Pack: ['flowers', 'cookies', 'bear'], Wolf: 'truth' },
    })
  })
})
