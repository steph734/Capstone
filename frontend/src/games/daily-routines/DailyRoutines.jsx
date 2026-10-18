import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Lightbulb, Undo2 } from 'lucide-react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import HUD from './HUD'
import PaoGuide from './PaoGuide'
import PauseMenu from './PauseMenu'
import StepBoard from './StepBoard'
import StepCard from './StepCard'
import TaskDone from './TaskDone'
import TaskPicker from './TaskPicker'
import Picture from './pictures/Picture'
import { STEPS_PER_TASK, buildTray, loadDone, saveDone, saveSettings } from './tasks'
import { sounds } from './sounds'
import './daily-routines.css'

const freshStats = () => ({ points: 0, wrong: 0, hints: 0, steps: [] })
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Talk helper: Pao's line (pose, bubble, voice). The voice respects the sound setting; the bubble always shows.
function useTalk(sRef) {
  const [line, setLine] = useState({ pose: 'welcome', message: '', speech: '', speak: false, id: 0 })
  const idRef = useRef(0)
  const seq = useRef(0)
  const talk = useCallback((pose, message, speech, speak = true) => {
    idRef.current += 1
    seq.current += 1
    setLine({ pose, message, speech: speech ?? message.replace(/\*/g, ''), speak: speak && sRef.current.sound, id: idRef.current })
  }, [sRef])
  return { line, talk, seq }
}

// The tray card that flies into the next slot.
function Flyer({ fly, onDone }) {
  const el = useRef(null)
  useLayoutEffect(() => {
    const node = el.current
    if (!node) return undefined
    let alive = true
    const dx = fly.to.left - fly.from.left
    const dy = fly.to.top - fly.from.top
    const sx = fly.to.width / fly.from.width
    const sy = fly.to.height / fly.from.height
    node.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }], { duration: reduced() ? 90 : 300, easing: 'ease-in-out', fill: 'forwards' }).finished
      .then(() => { if (alive) onDone(fly) }).catch(() => { if (alive) onDone(fly) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { from, task, step } = fly
  return (
    <div ref={el} className="dr-card dr-flyer" style={{ left: from.left, top: from.top, width: from.width, height: from.height }}>
      <div className="dr-pic"><Picture name={`${task.id}:${step.id}`} /></div>
      <span className="dr-steptext">{step.text}</span>
    </div>
  )
}

// One run of one task. Remounted for every run, so each finished task is its own activity session.
function TaskPlay({ task, settings, setSettings, settingsKey, onPickAnother, onRestart, onExit, onEarned }) {
  const gameSession = useGameSession({ gameName: 'Daily Routines' })
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const { line, talk, seq } = useTalk(sRef)
  const lockedFirst = settings.placeExample || task.safety // the example step (always for cooking, for safety)

  const [slots, setSlots] = useState(() => task.steps.map((s, i) => (i === 0 && (settings.placeExample || task.safety) ? s : null)))
  const [stage, setStage] = useState('intro') // intro | play | done
  const [paused, setPaused] = useState(false)
  const [glowId, setGlowId] = useState(null)
  const [wiggleId, setWiggleId] = useState(null)
  const [fly, setFly] = useState(null)
  const [wrongTick, setWrongTick] = useState(0)
  const [points, setPoints] = useState(0)
  const [confetti, setConfetti] = useState(false)
  const [result, setResult] = useState(null)

  const rootRef = useRef(null)
  const lock = useRef(false)
  const stats = useRef(freshStats())
  const startedAt = useRef(Date.now())
  const stepStart = useRef(Date.now())
  const perStep = useRef({}) // id -> { wrong, hints }
  const lastEvent = useRef('start')
  const wrongForSlot = useRef(0)
  const glowRef = useRef(null)
  const scored = useRef(new Set())
  const placedCount = slots.filter(Boolean).length
  const done = stage === 'done'
  const tray = useMemo(() => buildTray(task.steps, placedCount, settings.showAll), [task, placedCount, settings.showAll])

  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); seq.current += 1; setPaused(true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [seq])

  const showHint = useCallback(() => {
    const next = task.steps[placedCount]
    if (!next) return
    const rec = (perStep.current[next.id] ||= { wrong: 0, hints: 0 })
    if (glowRef.current !== next.id) { glowRef.current = next.id; rec.hints += 1; stats.current.hints += 1 }
    setGlowId(next.id)
    talk('hint', 'Look! This step is *glowing*.')
  }, [task, placedCount, talk])
  const hintRef = useRef(showHint)
  useEffect(() => { hintRef.current = showHint })

  // 1. Pao shows the task and (on Easy) the example first step.
  useEffect(() => {
    if (paused || result || stage !== 'intro') return undefined
    if (lockedFirst) talk('showing', `First, we *${task.steps[0].text.toLowerCase()}*!`, `First, we ${task.steps[0].text.toLowerCase()}!`, sRef.current.readAloud || task.safety)
    else talk('showing', `${task.name}${task.note ? `, ${task.note}` : ''}. Let's start!`)
    const t = setTimeout(() => { talk('asking', 'What do we do *next*?', 'What do we do next?'); setStage('play'); stepStart.current = Date.now() }, lockedFirst ? 3200 : 2200)
    return () => clearTimeout(t)
  }, [paused, result, stage, lockedFirst, task, talk])

  // 2. Thinking after 6s; hint after the hint delay or two wrong taps on the same slot.
  useEffect(() => {
    if (paused || result || stage !== 'play') return undefined
    const timers = []
    if (lastEvent.current === 'placed') timers.push(setTimeout(() => talk('asking', 'What do we do *next*?', 'What do we do next?'), 1400))
    timers.push(setTimeout(() => {
      const last = [...slots].reverse().find(Boolean)
      talk('thinking', 'Hmm... what did we just do?', `Hmm... what did we just do? ${last ? last.text : ''}`)
    }, 6000))
    const wait = lastEvent.current === 'wrong' && wrongForSlot.current >= 2 ? 2500 : sRef.current.hintDelay * 1000
    timers.push(setTimeout(() => { if (glowRef.current === null) hintRef.current() }, wait))
    return () => timers.forEach(clearTimeout)
  }, [paused, result, stage, placedCount, wrongTick, talk]) // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback(async (finalSlots) => {
    const s = stats.current
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    const stars = s.wrong <= 1 ? 3 : s.wrong <= 4 ? 2 : 1
    setStage('done'); setGlowId(null); glowRef.current = null
    setConfetti(true)
    setTimeout(() => setConfetti(false), 2000)
    if (sRef.current.sound) sounds.done()
    talk('taskDone', `You did every step in *order*! ${task.finish}`, `You did every step in order! ${task.finish}`)
    setResult({ stars, secs, reward: null })
    const data = await gameSession.finish({
      correct: STEPS_PER_TASK, attempts: STEPS_PER_TASK + s.wrong, hints_used: s.hints, stars,
      detail: {
        game: 'daily-routines', task_key: task.key, task_id: task.id, duration_seconds: secs,
        steps: finalSlots.map((st) => ({ id: st.id, wrong_taps: perStep.current[st.id]?.wrong || 0, hints: perStep.current[st.id]?.hints || 0, seconds: perStep.current[st.id]?.seconds || 0 })),
        wrong_taps: s.wrong, hints_used: s.hints, stars, points: s.points, settings: sRef.current, completed: true,
      },
    })
    if (data) {
      setResult((r) => ({ ...r, reward: data.reward }))
      onEarned(task.id) // remember this task as finished (the one badge itself comes from the server)
    }
  }, [gameSession, task, talk, onEarned])

  const arrive = useCallback((f) => {
    setFly(null); lock.current = false
    const idx = f.slotIdx
    const next = slots.map((s, i) => (i === idx ? f.step : s))
    setSlots(next)
    lastEvent.current = 'placed'
    const rec = (perStep.current[f.step.id] ||= { wrong: 0, hints: 0 })
    rec.seconds = Math.round((Date.now() - stepStart.current) / 1000)
    stepStart.current = Date.now()
    if (!scored.current.has(f.step.id)) {
      scored.current.add(f.step.id)
      const earned = rec.hints > 0 ? 5 : 10
      stats.current.points += earned
      setPoints((p) => p + earned)
    }
    wrongForSlot.current = 0; glowRef.current = null; setGlowId(null)
    if (sRef.current.sound) sounds.place()
    if (next.every(Boolean)) complete(next)
    else talk('goodStep', `Yes! *${f.step.text}* comes next.`, `Yes! ${f.step.text} comes next.`, sRef.current.readAloud)
  }, [slots, complete, talk])

  const pick = useCallback((step) => {
    if (stage !== 'play' || paused || lock.current) return
    const slotIdx = slots.findIndex((s) => !s)
    if (slotIdx < 0) return
    const correct = task.steps[slotIdx]
    if (step.id === correct.id) {
      const cardEl = rootRef.current?.querySelector(`[data-card="${step.id}"]`)
      const slotEl = rootRef.current?.querySelector(`[data-slot="${slotIdx}"]`)
      if (!cardEl || !slotEl) { arrive({ step, slotIdx, task }); return }
      lock.current = true
      const a = cardEl.getBoundingClientRect()
      const b = slotEl.getBoundingClientRect()
      setFly({ step, slotIdx, task, from: { left: a.left, top: a.top, width: a.width, height: a.height }, to: { left: b.left, top: b.top, width: b.width, height: b.height } })
    } else {
      const rec = (perStep.current[correct.id] ||= { wrong: 0, hints: 0 })
      rec.wrong += 1; stats.current.wrong += 1; wrongForSlot.current += 1
      lastEvent.current = 'wrong'
      setWiggleId(step.id)
      setTimeout(() => setWiggleId(null), 500)
      if (sRef.current.sound) sounds.wrong()
      talk('tryAgain', `Not yet! ${correct.why}`, null)
      setWrongTick((n) => n + 1)
    }
  }, [stage, paused, slots, task, arrive, talk])

  const undo = useCallback(() => {
    if (stage !== 'play' || lock.current) return
    const last = slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0).pop()
    if (last === undefined || (last === 0 && lockedFirst)) return
    setSlots(slots.map((s, i) => (i === last ? null : s)))
    lastEvent.current = 'undo'; glowRef.current = null; setGlowId(null)
  }, [stage, slots, lockedFirst])

  const hearText = (t) => { if (!sRef.current.sound) return; seq.current += 1; speakPao(t, { rate: 0.8, pitch: 1.1 }) }
  const hearSoFar = () => {
    const placed = slots.filter(Boolean)
    hearText(placed.length ? placed.map((s, i) => `${i === 0 ? 'First' : 'Then'}, ${s.text.toLowerCase()}.`).join(' ') : 'Tap a step to start.')
  }

  const toggleSound = () => {
    const n = { ...settings, sound: !settings.sound }
    if (!n.sound) { stopPaoVoice(); seq.current += 1 }
    setSettings(n)
    if (settingsKey) saveSettings(settingsKey, n)
  }

  useEffect(() => {
    const on = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') { setPaused((p) => !p); return }
      if (/^[1-3]$/.test(e.key)) { const s = tray[Number(e.key) - 1]; if (s) pick(s) }
      else if (e.key === 'Backspace') { e.preventDefault(); undo() }
      else if (e.key === ' ' && !e.target.closest?.('button, [role="button"]')) { e.preventDefault(); hearSoFar() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tray, pick, undo, slots])

  return (
    <div className="dr-root" ref={rootRef}>
      <div className="dr-room"><i className="dr-window" /><i className="dr-shelf"><b /></i></div>
      <div className="dr-floor" />
      <HUD label={task.name} total={STEPS_PER_TASK} index={placedCount} points={points} sound={settings.sound} onPause={() => { stopPaoVoice(); seq.current += 1; setPaused(true) }} onToggleSound={toggleSound} />

      <div className="dr-main">
        <StepBoard task={task} slots={slots} done={done} onHear={done ? () => hearText(task.steps.map((s, i) => `${i === 0 ? 'First' : 'Then'}, ${s.text.toLowerCase()}.`).join(' ')) : hearSoFar} />
        {done ? (
          result && <TaskDone task={task} reward={result.reward} stars={result.stars} onAgain={onRestart} onPick={onPickAnother} />
        ) : (
          <>
            <span className="dr-label dr-trayhead">Tap the next step</span>
            <div className="dr-tray">
              {tray.map((s, i) => (
                <StepCard key={s.id} task={task} step={s} index={i} state={wiggleId === s.id ? 'wiggle' : glowId === s.id ? 'glow' : 'idle'}
                  hidden={fly?.step.id === s.id} disabled={stage !== 'play' || paused} onPick={pick} onHear={hearText} />
              ))}
            </div>
          </>
        )}
      </div>

      <PaoGuide line={line} />

      {!done && (
        <div className="dr-actions">
          <button type="button" className="dr-white" onClick={undo} disabled={stage !== 'play' || placedCount <= (lockedFirst ? 1 : 0)}><Undo2 size={20} aria-hidden="true" /> Undo</button>
          <button type="button" className="dr-white" onClick={showHint} disabled={stage !== 'play'}><Lightbulb size={20} aria-hidden="true" /> Hint</button>
        </div>
      )}

      {fly && <Flyer fly={fly} onDone={arrive} />}
      {confetti && !reduced() && <div className="dr-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${(i % 7) * 0.07}s`, background: ['#ffc83d', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      {paused && !result && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onRestart={onRestart} onToggleSound={toggleSound} onExit={onExit} />}
    </div>
  )
}

export default function DailyRoutines({ patientName: _patientName = 'friend', settings: initial, settingsKey, onExit }) {
  const [settings, setSettings] = useState(initial)
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const [selected, setSelected] = useState(null)
  const [run, setRun] = useState(null) // { task, n }
  const [earned, setEarned] = useState(() => loadDone(settingsKey))
  const [paused, setPaused] = useState(false)
  const { line, talk } = useTalk(sRef)

  useEffect(() => {
    if (run) return
    talk('welcome', "Let's practice! *Pick* a task.", "Let's practice! Pick a task.")
  }, [run, talk])

  const onSelect = (t) => { setSelected(t.id); talk('welcome', `*${t.name}* it is! Tap Start.`, `${t.name} it is! Tap Start.`) }
  const toggleSound = () => {
    const n = { ...settings, sound: !settings.sound }
    if (!n.sound) stopPaoVoice()
    setSettings(n)
    if (settingsKey) saveSettings(settingsKey, n)
  }
  const addEarned = useCallback((id) => setEarned((e) => { const n = new Set(e).add(id); saveDone(settingsKey, n); return n }), [settingsKey])

  if (run) {
    return (
      <TaskPlay
        key={`${run.task.id}-${run.n}`} task={run.task} settings={settings} setSettings={setSettings} settingsKey={settingsKey} onEarned={addEarned}
        onRestart={() => setRun({ task: run.task, n: run.n + 1 })} onPickAnother={() => setRun(null)} onExit={onExit}
      />
    )
  }

  return (
    <div className="dr-root">
      <div className="dr-room"><i className="dr-window" /><i className="dr-shelf"><b /></i></div>
      <div className="dr-floor" />
      <HUD label="Easy" points={0} sound={settings.sound} onPause={() => { stopPaoVoice(); setPaused(true) }} onToggleSound={toggleSound} />
      <TaskPicker earned={earned} selected={selected} onSelect={onSelect} onBack={onExit} onStart={(t) => { stopPaoVoice(); setRun({ task: t, n: 1 }) }} />
      <PaoGuide line={line} />
      {paused && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onToggleSound={toggleSound} onExit={onExit} />}
    </div>
  )
}

