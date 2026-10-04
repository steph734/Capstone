import { useMemo, useRef, useState } from 'react'
import SunnyScenery from '../../pages/games/SunnyScenery'
import PaoGuide from '../PaoGuide'
import GameFinishScreen from '../GameFinishScreen'
import { buildTasks, initLevel, sequenceReducer, routineSentence } from './sequence'
import { TaskPickerModal } from './DailyRoutinesModals'

// Daily Routines: put the pictures of a routine in order. Works for any
// step_by_step game document (see sequence.js). Pao reads and cheers along.
const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const BODY = { fontFamily: "'Atkinson Hyperlegible', system-ui, sans-serif" }
const SPEECH_LANG = { en: 'en-US', tl: 'fil-PH', ceb: 'fil-PH' }

function speak(text, lang, enabled = true) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    u.lang = SPEECH_LANG[lang] || 'en-US'
    window.speechSynthesis.speak(u)
  } catch { /* read-aloud is best-effort */ }
}

export default function DailyRoutines({ game, patientAge = null, lang = 'en', onExit, onTaskComplete }) {
  const tasks = useMemo(() => buildTasks(game), [game])
  const readAloud = game.support?.read_aloud !== false
  const pickerTasks = useMemo(() => tasks.map((t) => ({
    ...t,
    steps: Math.max(0, ...t.levels.map((l) => l.steps.length)),
  })), [tasks])

  const [task, setTask] = useState(null)
  const [levelIdx, setLevelIdx] = useState(0)
  const [state, setState] = useState(null)
  const [levelDone, setLevelDone] = useState(false)
  const [taskDone, setTaskDone] = useState(false)
  const [picker, setPicker] = useState(true)
  const totals = useRef({ attempts: 0, hints: 0, stars: 0 })
  const reportedRef = useRef(false)

  const level = task?.levels[levelIdx]
  const line = state?.message || { text: '', tone: 'neutral' }

  const start = (t) => {
    totals.current = { attempts: 0, hints: 0, stars: 0 }
    reportedRef.current = false
    setTask(t)
    setLevelIdx(0)
    setTaskDone(false)
    setLevelDone(false)
    setPicker(false)
    const first = t.levels[0]
    setState(initLevel(first))
    const hello = `Let's do ${t.name.toLowerCase()}! Tap a picture, then tap a box.`
    speak(hello, lang, readAloud)
  }

  const openLevel = (idx) => {
    setLevelIdx(idx)
    setLevelDone(false)
    setState(initLevel(task.levels[idx]))
  }

  const dispatch = (action) => {
    if (!level || !state) return
    const next = sequenceReducer(state, action, level, task.finish_text)
    if (action.type === 'place') {
      if (next.placed !== state.placed) {
        totals.current.stars += 1
      } else if (next.message.tone === 'hint' && next.wrong > state.wrong) {
        totals.current.attempts += 1
      }
      if (next.glowSlot !== null && next.glowSlot !== state.glowSlot) totals.current.hints += 1
    }
    setState(next)
    if (next.message.text && next.message !== state.message) speak(next.message.text, lang, readAloud)
    if (next.done) {
      // Hand the message over after the last box fills, then open the level-done screen.
      setTimeout(() => {
        setLevelDone(true)
        const last = levelIdx === task.levels.length - 1
        if (last && !reportedRef.current) {
          reportedRef.current = true
          setTaskDone(true)
          onTaskComplete?.({
            correct: task.levels.reduce((n, l) => n + l.steps.length, 0),
            attempts: totals.current.stars + totals.current.attempts,
            hints_used: totals.current.hints,
            stars: totals.current.stars,
            detail: { task_key: task.key, level_order: level.level_order },
          })
        }
      }, 700)
    }
  }

  const readSentence = () => {
    if (!level) return
    speak(routineSentence(level.steps), lang, true)
  }

  if (task && taskDone && levelDone) {
    return (
      <GameFinishScreen
        title={task.finish_text}
        subtitle={`You finished ${task.name.toLowerCase()}.`}
        badgeFallback={{ emoji: '🏅', name: 'New badge!' }}
        xp={game.pointsPerPlay ?? 100}
        replayLabel="Play again"
        onReplay={() => start(task)}
        onExit={onExit}
      />
    )
  }

  if (picker || !task) {
    return (
      <Shell>
        <TaskPickerModal tasks={pickerTasks} patientAge={patientAge} onPick={start} onBack={onExit} />
      </Shell>
    )
  }

  const lastLevel = levelIdx === task.levels.length - 1
  const safety = task.safety
  const tray = state?.tray || []

  return (
    <Shell>
      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={() => setPicker(true)} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>← Tasks</button>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md" style={HEADING}>
          <span className="text-[16px] font-extrabold text-[#2B2366]">{task.name}</span>
          <span className="rounded-full bg-[#ede9fe] px-2.5 py-0.5 text-[13px] font-bold text-[#5b21b6]">Level {level.level_order} · {level.level_name}</span>
        </div>
        <div className="flex h-12 items-center gap-1.5 rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING} aria-label={`${state?.stars || 0} stars`}>⭐ {totals.current.stars}</div>
      </div>

      {/* Heading + safety banner */}
      <div className="relative z-10 mx-4 flex flex-wrap items-center justify-center gap-2 pb-2">
        <h2 className="text-[20px] font-extrabold text-[#2B2366]" style={HEADING}>Put the steps in order</h2>
        {safety && <span className="rounded-full bg-[#FDE68A] px-3 py-1 text-[14px] font-extrabold text-[#92400E]">Always cook with a grown-up</span>}
      </div>

      {/* Numbered boxes */}
      <div className="relative z-10 mx-4 flex flex-shrink-0 flex-wrap justify-center gap-3 rounded-[32px] bg-white/85 px-4 py-4 shadow-lg" role="group" aria-label="Steps in order">
        {level.steps.map((step, i) => {
          const placedKey = state.placed[i]
          const placedStep = placedKey !== undefined ? level.steps.find((s) => s.key === placedKey) : null
          const glow = state.glowSlot === i
          const pos = i === 0 ? 'First' : i === level.steps.length - 1 ? 'Last' : 'Next'
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => dispatch({ type: 'place', slot: i })}
              aria-label={placedStep ? `Box ${i + 1}: ${placedStep.label}` : `Box ${i + 1}, empty`}
              className={`flex w-[118px] flex-col items-center gap-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] sm:w-[132px]`}
            >
              <span className={`flex h-[104px] w-full items-center justify-center overflow-hidden rounded-2xl border-[3px] border-dashed bg-white sm:h-[120px] ${glow ? 'ring-4 ring-[#F59E0B]' : ''} ${placedStep ? 'border-solid border-[#2F8A4C] bg-[#E3F4E8]' : 'border-[#8A5A3B]'}`}>
                {placedStep
                  ? <img src={placedStep.image_url} alt="" className="h-full w-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  : <span className="text-[26px] font-extrabold text-[#8A5A3B]" aria-hidden="true">{i + 1}</span>}
              </span>
              <span className={`text-[13px] font-extrabold ${placedStep ? 'text-[#2F8A4C]' : 'text-[#5A5670]'}`} style={{ ...HEADING, fontSize: 14 }}>
                {placedStep ? placedStep.label : pos}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tray of shuffled pictures */}
      <div className="relative z-10 mx-4 mt-3 flex flex-shrink-0 flex-wrap items-center justify-center gap-3 rounded-[32px] bg-white/85 px-4 py-4 shadow-lg" role="group" aria-label="Pictures to place">
        {tray.length === 0 && <p className="text-[16px] font-bold text-[#2F8A4C]">Every picture is in place.</p>}
        {tray.map((key) => {
          const step = level.steps.find((s) => s.key === key)
          const selected = state.selected === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={step.label}
              onClick={() => dispatch({ type: 'select', key })}
              className={`flex w-[118px] flex-col items-center rounded-2xl bg-white p-2 shadow-md transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6] sm:w-[132px] ${selected ? '-translate-y-2.5 border-[3px] border-[#6D4AE0]' : 'border-[3px] border-transparent'}`}
              style={{ minHeight: 64 }}
            >
              <img src={step.image_url} alt="" className="h-[84px] w-full object-contain sm:h-[96px]" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              <span className="mt-1 text-center text-[13px] font-extrabold text-[#2B2A4C]" style={HEADING}>{step.label}</span>
            </button>
          )
        })}
      </div>

      {/* Pao + bubble */}
      <PaoGuide tone={line.tone} bubbleStyle={BODY}>
        {line.text || 'Tap a picture, then tap a box.'}
      </PaoGuide>

      {/* Level done */}
      {levelDone && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(30,60,100,0.45)] p-4 backdrop-blur-sm" style={BODY}>
          <div role="dialog" aria-modal="true" aria-label="Level done" className="flex w-full max-w-[520px] flex-col items-center gap-3 rounded-[32px] bg-[#FFF8EC] p-6 text-center shadow-2xl">
            <h2 className="text-[26px] font-extrabold text-[#2B2366]" style={HEADING}>
              {taskDone ? task.finish_text : 'Great job!'}
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {level.steps.map((s, i) => (
                <div key={s.key} className="flex flex-col items-center">
                  <img src={s.image_url} alt={s.label} className="h-[64px] w-[64px] rounded-xl bg-white object-contain p-1 shadow" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <span className="mt-0.5 text-[12px] font-extrabold text-[#5A5670]">{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="text-[16px] text-[#2B2A4C]">{routineSentence(level.steps)}</p>
            {taskDone && (
              <div className="flex flex-wrap justify-center gap-2 text-[14px] font-bold">
                <span className="rounded-full bg-[#E3F4E8] px-3 py-1.5 text-[#2F8A4C]">+{game.pointsPerPlay ?? 100} XP for Pao</span>
                <span className="rounded-full bg-[#FFF0CC] px-3 py-1.5 text-[#C97A00]">New badge!</span>
              </div>
            )}
            <div className="mt-2 flex w-full flex-col gap-2.5">
              {!lastLevel && (
                <button type="button" onClick={() => openLevel(levelIdx + 1)} className="h-14 rounded-2xl bg-[#6D4AE0] text-[18px] font-extrabold text-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>Next level</button>
              )}
              {lastLevel && (
                <button type="button" onClick={() => start(task)} className="h-14 rounded-2xl bg-[#F59E0B] text-[18px] font-extrabold text-[#2B2366] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]" style={HEADING}>Play again</button>
              )}
              <button type="button" onClick={readSentence} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Read my steps</button>
              <button type="button" onClick={() => setPicker(true)} className="h-12 rounded-2xl border-2 border-[#E4DFCE] bg-white text-[16px] font-bold text-[#5A5670] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#3B82F6]">Other tasks</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto overscroll-contain" style={BODY}>
      <SunnyScenery />
      <div className="relative z-10 flex min-h-full flex-col">{children}</div>
    </div>
  )
}
