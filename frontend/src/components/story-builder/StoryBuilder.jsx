import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { useGameSession } from '../../hooks/useGameSession'
import { PwSky } from '../picture-word-game/pwUi'
import usePwStage from '../picture-word-game/usePwStage'
import { PAO_PROP_CSS } from '../../games/pictureWord/PaoProps'
import { STREAK_EVERY, ENCOURAGE_AFTER } from '../../games/storyBuilder/paoReactions'
import { useStoryPao } from './StoryPao'
import { PickerScreen, ResultsScreen, SceneFor, StepScreen, WatchScreen } from './StoryScreens'
import { storyKeyOf } from './storyKeys'
import { storyReducer, initialState, pickCountOf, buildRecapPanels, buildFinishResult } from './storyReducer'
import '../picture-word-game/pictureWord.css'
import './storyBuilder.css'

// Story Builder: every story, step, choice and recap line comes from the game's `levels` in MongoDB, so a new story
// is a database change only. This file draws, speaks and reacts; the rules live in storyReducer.js (unchanged).
const GAME_NAME = 'Story Builder'
const SPEECH = { rate: 0.8, pitch: 1.15 }

const sortBy = (list, key) => [...(list || [])].sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0))

export default function StoryBuilder({ onExit, preview = false, patientName = 'friend', patientEmail = null, patientId = 'alvrin' }) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')
  const [state, dispatch] = useReducer(storyReducer, initialState)
  const [watching, setWatching] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [stepsRight, setStepsRight] = useState(0) // steps told with no wrong tap so far (the star pill)
  const [seconds, setSeconds] = useState(0)
  const [progress, setProgress] = useState({})
  const [placed, setPlaced] = useState([]) // order check: step indexes tapped so far, in order
  const [flash, setFlash] = useState(null) // the card that was not next (soft orange for a moment)
  const orderWrongSent = useRef(false)
  const finishedRef = useRef(false)
  const startedAt = useRef(Date.now())
  const wrongRun = useRef(0) // wrong picks in a row
  const stepHadWrong = useRef(false)
  const cleanRun = useRef(0) // steps in a row with no wrong tap
  const firstTrySteps = useRef(0)
  const gameSession = useGameSession({ gameName: GAME_NAME })
  const stage = usePwStage()

  const progressKey = `storyBuilder:progress:${patientEmail || patientId}`
  const first = String(patientName).split(' ')[0]
  const pao = useStoryPao({ name: first })

  const stories = useMemo(() => sortBy(game?.levels, 'level_order'), [game])
  // Steps are sorted once here, so every index (picks, recap, finish) lines up.
  const story = useMemo(() => {
    const s = stories[state.storyIndex]
    return s && { ...s, items: sortBy(s.items, 'step_order') }
  }, [stories, state.storyIndex])
  const items = story?.items || []
  const item = items[state.stepIndex]
  // The closing "what happened first?" step asks for the WHOLE story in order: every told step, shuffled once per story.
  const orderIdx = useMemo(() => items.map((_, i) => i).filter((i) => !items[i].is_order_check), [items])
  const isOrder = Boolean(item?.is_order_check) && orderIdx.length >= 2
  const deck = useMemo(() => {
    const a = [...orderIdx]
    for (let tries = 0; tries < 8; tries += 1) {
      for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
      if (a.some((v, i) => v !== orderIdx[i])) break
    }
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdx.join(','), state.storyIndex])

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

  // The picker is the first screen (no separate start card).
  useEffect(() => { if (game && state.phase === 'start') dispatch({ type: 'picker' }) }, [game, state.phase])

  useEffect(() => { try { setProgress(JSON.parse(localStorage.getItem(progressKey) || '{}')) } catch { /* ignore */ } }, [progressKey])
  useEffect(() => () => stopPaoVoice(), [])

  // Narration: the same words as before; Pao wears the headphones while it plays.
  const narrate = () => {
    if (!item) return
    stopPaoVoice()
    speakPao(`${item.text} ${item.question}`, { ...SPEECH, onStart: () => pao.setListening(true), onEnd: () => pao.setListening(false) })
  }
  useEffect(() => {
    if (state.phase !== 'playing' || !item) return undefined
    pao.setListening(false)
    pao.say(pao.lineFor('listening'))
    setAnnounce(`Step ${state.stepIndex + 1} of ${items.length}`)
    stepHadWrong.current = false
    wrongRun.current = 0
    setPlaced([]); setFlash(null); orderWrongSent.current = false
    narrate()
    return () => { stopPaoVoice(); pao.setListening(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.storyIndex, state.stepIndex])

  // Time and progress are counted per story.
  useEffect(() => {
    if (state.phase === 'playing' && state.stepIndex === 0 && !state.stepDone) {
      startedAt.current = Date.now()
      wrongRun.current = 0; cleanRun.current = 0; firstTrySteps.current = 0
      setStepsRight(0)
      finishedRef.current = false
      setWatching(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.storyIndex])

  const remember = (steps) => {
    if (preview || !story) return
    const key = storyKeyOf(story) || story.story_key || story.level_name
    try {
      const next = { ...progress, [key]: Math.max(progress[key] || 0, steps) }
      setProgress(next)
      localStorage.setItem(progressKey, JSON.stringify(next))
    } catch { /* storage blocked */ }
  }

  // Report the finished story once; the reward sequence then shows on top.
  useEffect(() => {
    if (state.phase !== 'done' || finishedRef.current || !story) return
    finishedRef.current = true
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    setSeconds(secs)
    remember(items.length)
    const result = buildFinishResult(story, state)
    gameSession.finish({
      ...result,
      detail: { ...result.detail, ...(firstTrySteps.current ? { first_try_steps: firstTrySteps.current } : {}), ...(secs ? { duration_seconds: secs } : {}) },
    })
    const line = pao.fx('finished', { name: first })
    speakPao(line, SPEECH)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // Speech and callbacks run here, in event handlers, not inside setState updaters.
  const handleTap = (choice) => {
    if (!item || state.stepDone) return
    const picked = state.picks[state.stepIndex] || []
    const missed = state.wrong[state.stepIndex] || []
    if (picked.includes(choice.choice_key) || missed.includes(choice.choice_key)) return

    let text
    let finishesStep = false
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
      finishesStep = remaining <= 0
      wrongRun.current = 0
      let key = 'correct'
      if (finishesStep) {
        if (!stepHadWrong.current) { cleanRun.current += 1; firstTrySteps.current += 1; setStepsRight(firstTrySteps.current) } else cleanRun.current = 0
        if (!stepHadWrong.current && cleanRun.current % STREAK_EVERY === 0) key = 'streak'
        remember(state.stepIndex + 1)
      }
      pao.fx(key, { answer: choice.label, n: cleanRun.current }, text)
      setAnnounce(`Nice! ${choice.label} is right`)
    } else {
      text = choice.feedback || 'Try another one!'
      stepHadWrong.current = true
      wrongRun.current += 1
      pao.fx(wrongRun.current >= ENCOURAGE_AFTER && wrongRun.current % ENCOURAGE_AFTER === 0 ? 'encourage' : 'tryAgain', {}, text)
      setAnnounce('Not this one. Pick again')
    }

    speakPao(text, SPEECH)
    dispatch({ type: 'tap', item, choiceKey: choice.choice_key })
  }

  // Tapping the story in order. The reducer still decides the step (same picks, same wrong taps, same stars): a wrong
  // order records one wrong tap, and finishing the sequence records the step's correct pick(s).
  const handleOrderTap = (idx) => {
    if (!isOrder || state.stepDone || flash != null || placed.includes(idx)) return
    const expected = orderIdx[placed.length]
    if (idx === expected) {
      const next = [...placed, idx]
      setPlaced(next)
      wrongRun.current = 0
      if (next.length >= orderIdx.length) {
        const count = pickCountOf(item)
        ;(item.choices || []).filter((c) => c.is_correct).slice(0, count).forEach((c) => dispatch({ type: 'tap', item, choiceKey: c.choice_key }))
        if (!stepHadWrong.current) { cleanRun.current += 1; firstTrySteps.current += 1; setStepsRight(firstTrySteps.current) } else cleanRun.current = 0
        const key = !stepHadWrong.current && cleanRun.current % STREAK_EVERY === 0 ? 'streak' : 'correct'
        const text = 'Yes! You put the whole story in order!'
        pao.fx(key, { n: cleanRun.current }, text)
        speakPao(text, SPEECH)
        remember(state.stepIndex + 1)
        setAnnounce('Nice! The whole story is in order')
      } else {
        const text = `Yes! ${items[idx].label}. What happened next?`
        pao.fx('correct', {}, text)
        speakPao(text, SPEECH)
        setAnnounce(`Nice! ${items[idx].label} is number ${next.length}`)
      }
      return
    }
    stepHadWrong.current = true
    wrongRun.current += 1
    setFlash(idx)
    setTimeout(() => setFlash(null), 900)
    if (!orderWrongSent.current) {
      const wrongChoice = (item.choices || []).find((c) => !c.is_correct)
      if (wrongChoice) dispatch({ type: 'tap', item, choiceKey: wrongChoice.choice_key })
      orderWrongSent.current = true
    }
    const text = 'Hmm, that did not come next. Try another one!'
    pao.fx(wrongRun.current >= ENCOURAGE_AFTER && wrongRun.current % ENCOURAGE_AFTER === 0 ? 'encourage' : 'tryAgain', {}, text)
    speakPao(text, SPEECH)
    setAnnounce('Not this one. Pick again')
  }

  const goNext = () => { stopPaoVoice(); dispatch({ type: 'next', stepCount: items.length }) }
  const leaveStep = () => { stopPaoVoice(); dispatch({ type: 'picker' }) }

  if (error) {
    return (
      <div className="sbn-root" style={{ display: 'grid', placeItems: 'center' }}>
        <PwSky />
        <div style={{ position: 'relative', textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{error}</p>
          <button type="button" className="sbn-btn indigo" style={{ padding: '0 28px' }} onClick={onExit}>Back to games</button>
        </div>
      </div>
    )
  }
  if (!game) return <div className="sbn-root" aria-busy="true"><PwSky /></div>

  // One recap panel per told step, each with its animated scene (or the step's own picture).
  const panels = state.phase === 'done' && story
    ? (() => {
        const idx = items.map((_, i) => i).filter((i) => !items[i].is_order_check)
        return buildRecapPanels(story, state).map((p, n) => ({ ...p, scene: <SceneFor story={story} item={items[idx[n]]} index={idx[n]} label={`${p.label}: ${p.line}`} /> }))
      })()
    : []
  const result = state.phase === 'done' && story ? buildFinishResult(story, state) : null
  const paoH = stage.narrow ? 150 : 220

  return (
    <div className="sbn-root">
      <style>{PAO_PROP_CSS}</style>
      <PwSky />
      <div className={`sbn-stage${stage.narrow ? ' narrow' : ''}`} style={stage.style}>
        {state.phase === 'picker' && (
          <PickerScreen stories={stories} progress={progress} preview={preview} patientName={first} onPick={(i) => dispatch({ type: 'start', storyIndex: i })} onBack={onExit} />
        )}
        {(state.phase === 'playing' || state.phase === 'done') && story && item && (
          <StepScreen
            story={story} item={item} stepIndex={state.stepIndex} state={state} stars={stepsRight} preview={preview}
            paoView={pao.view} paoLine={pao.line} paoHeight={paoH}
            scene={<SceneFor story={story} item={item} index={state.stepIndex} label={`${item.label}: ${item.text}`} restartKey={state.stepDone ? 'solved' : 'play'} paused={watching} />}
            order={isOrder ? { cards: deck.map((i) => ({ idx: i, label: items[i].label, scene: <SceneFor story={story} item={items[i]} index={i} label={items[i].label} /> })), placed, flash, onTap: handleOrderTap } : null}
            onTap={handleTap} onNext={goNext} onRead={narrate} onBack={leaveStep}
          />
        )}
      </div>

      {state.phase === 'done' && story && !watching && (
        <ResultsScreen
          story={story} preview={preview} stars={result.stars}
          stats={{ steps: items.length, firstTry: firstTrySteps.current, seconds, line: pao.lineFor('finished', { name: first }) }}
          onWatch={() => { stopPaoVoice(); setWatching(true) }} onOther={() => dispatch({ type: 'picker' })} onExit={onExit}
        />
      )}
      {state.phase === 'done' && story && watching && <WatchScreen story={story} panels={panels} onClose={() => setWatching(false)} />}
      <div className="sbn-sr" aria-live="polite">{announce}</div>
    </div>
  )
}
