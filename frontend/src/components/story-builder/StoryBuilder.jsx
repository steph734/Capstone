import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { useGameSession } from '../../hooks/useGameSession'
import StoryStartModal from './StoryStartModal'
import StoryPicker from './StoryPicker'
import StoryStep from './StoryStep'
import StoryRecap from './StoryRecap'
import { storyReducer, initialState, pickCountOf, buildRecapPanels, buildFinishResult } from './storyReducer'
import './story-builder.css'

// Story Builder: every story, step, choice and recap line comes from the
// game's `levels` in MongoDB, so a new story is a database change only.
const GAME_NAME = 'Story Builder'
const SPEECH = { rate: 0.8, pitch: 1.15 }
const BASE_DELAY_MS = 2600

const sortBy = (list, key) => [...(list || [])].sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0))

// Long lines get a little more time before the next step.
const nextStepDelay = (text = '') => BASE_DELAY_MS + Math.max(0, text.length - 60) * 30

export default function StoryBuilder({ onExit }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const [state, dispatch] = useReducer(storyReducer, initialState)
  const [bubble, setBubble] = useState(null) // { key, text, tone } from the last tap
  const finishedRef = useRef(false)
  const gameSession = useGameSession({ gameName: GAME_NAME })

  const stories = useMemo(() => sortBy(game?.levels, 'level_order'), [game])
  // Steps are sorted once here, so every index (picks, recap, finish) lines up.
  const story = useMemo(() => {
    const s = stories[state.storyIndex]
    return s && { ...s, items: sortBy(s.items, 'step_order') }
  }, [stories, state.storyIndex])
  const items = story?.items || []
  const item = items[state.stepIndex]
  const stepKey = `${state.storyIndex}:${state.stepIndex}`

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/by-name?name=' + encodeURIComponent(GAME_NAME))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return
        if (ok) setGame(b.game)
        else setError(b.error || 'Could not load Story Builder.')
      })
      .catch(() => { if (!cancelled) setError('Could not load Story Builder.') })
    return () => { cancelled = true }
  }, [])

  // Stop speech when leaving the screen or moving on to another step.
  useEffect(() => () => stopPaoVoice(), [])

  // Read the story line and question as each step opens.
  useEffect(() => {
    if (state.phase !== 'playing' || !item) return undefined
    stopPaoVoice()
    speakPao(`${item.text} ${item.question}`, SPEECH)
    return () => stopPaoVoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.storyIndex, state.stepIndex])

  // A correct step waits a moment so Pao can finish, then moves on.
  useEffect(() => {
    if (state.phase !== 'playing' || !state.stepDone) return undefined
    const id = setTimeout(() => dispatch({ type: 'next', stepCount: items.length }), nextStepDelay(bubble?.text))
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.stepDone, state.stepIndex, state.storyIndex])

  // Report the finished story once; the reward sequence then shows on top.
  useEffect(() => {
    if (state.phase !== 'done' || finishedRef.current || !story) return
    finishedRef.current = true
    gameSession.finish(buildFinishResult(story, state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // Speech and callbacks run here, in event handlers, not inside setState updaters.
  const handleTap = (choice) => {
    if (!item || state.stepDone) return
    const picked = state.picks[state.stepIndex] || []
    const missed = state.wrong[state.stepIndex] || []
    if (picked.includes(choice.choice_key) || missed.includes(choice.choice_key)) return

    let text
    let tone
    if (choice.is_correct) {
      const count = pickCountOf(item)
      const remaining = count - (picked.length + 1)
      if (count > 1 && remaining > 0) {
        text = `Nice! ${choice.label} goes in the basket. ${remaining} more ${remaining === 1 ? 'thing' : 'things'}!`
      } else if (count > 1) {
        text = 'Yay! The basket is all packed!'
      } else {
        text = choice.feedback || `Yes! ${choice.label}!`
      }
      tone = 'good'
    } else {
      text = choice.feedback || 'Try another one!'
      tone = 'gentle'
    }

    setBubble({ key: stepKey, text, tone })
    speakPao(text, SPEECH)
    dispatch({ type: 'tap', item, choiceKey: choice.choice_key })
  }

  const readStep = () => item && speakPao(`${item.text} ${item.question}`, SPEECH)

  const readAll = () => {
    const panels = buildRecapPanels(story, state)
    speakPao(panels.map((p) => p.line).join(' '), SPEECH)
  }

  const leaveStep = () => {
    stopPaoVoice()
    setBubble(null)
    dispatch({ type: 'picker' })
  }

  if (error) {
    return (
      <div className="sb-root" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{error}</p>
          <button type="button" className="sb-btn" onClick={onExit}>Back to games</button>
        </div>
      </div>
    )
  }

  if (!game) return <div className="sb-root" aria-busy="true" />

  // Pao's bubble: the last tap's line for this step, otherwise the question.
  const shownBubble = bubble?.key === stepKey ? bubble : { text: item?.question || '', tone: 'hint' }

  return (
    <div className="sb-root">
      <div className="sb-cloud" aria-hidden="true" style={{ top: '9%', left: '6%' }} />
      <div className="sb-cloud" aria-hidden="true" style={{ top: '16%', right: '10%', transform: 'scale(.8)' }} />
      <div className="sb-hill sb-hill--a" aria-hidden="true" />
      <div className="sb-hill sb-hill--b" aria-hidden="true" />

      {state.phase === 'start' && (
        <StoryStartModal game={game} onStart={() => dispatch({ type: 'picker' })} onCancel={onExit} />
      )}

      {state.phase === 'picker' && (
        <StoryPicker
          stories={stories}
          onPick={(i) => dispatch({ type: 'start', storyIndex: i })}
          onClose={() => dispatch({ type: 'home' })}
        />
      )}

      {state.phase === 'playing' && story && item && (
        <StoryStep
          story={story}
          item={item}
          stepIndex={state.stepIndex}
          state={state}
          bubble={shownBubble}
          onTap={handleTap}
          onRead={readStep}
          onBack={leaveStep}
        />
      )}

      {state.phase === 'done' && story && (
        <StoryRecap
          story={story}
          panels={buildRecapPanels(story, state)}
          game={game}
          onReadAll={readAll}
          onPlayAgain={() => dispatch({ type: 'start', storyIndex: state.storyIndex })}
          onOtherStories={() => dispatch({ type: 'picker' })}
        />
      )}
    </div>
  )
}
