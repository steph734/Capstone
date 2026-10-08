import { useMemo, useRef, useState } from 'react'
import SunnyScenery from '../../pages/games/SunnyScenery'
import PaoGuide from '../PaoGuide'
import GameFinishScreen from '../GameFinishScreen'
import {
  buildEmergencies, initOrder, orderReducer, initSafeOrNot, safeOrNotReducer,
  initChoose, chooseReducer, initSort, sortReducer, partComplete,
} from './emergencyReady'
import { EmergencyStartModal, EmergencyPicker, EmergencyPickerFooter, EmergencyIntro, EmergencyEndModal } from './EmergencyReadyModals'
import { OrderPart, SafeOrNotPart, ChoosePart, SortPart, EMERGENCY_BODY } from './EmergencyReadyParts'

const HEADING = { fontFamily: "'Baloo 2', system-ui, sans-serif" }
const SPEECH_LANG = { en: 'en-US', tl: 'fil-PH', ceb: 'fil-PH' }

function speak(text, lang, enabled = true) {
  if (!enabled || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.85
    u.lang = SPEECH_LANG[lang] || 'en-US'
    window.speechSynthesis.speak(u)
  } catch { /* read-aloud is best-effort */ }
}

const init = {
  order: (level) => initOrder(level),
  safe_or_not: () => initSafeOrNot(),
  choose: () => initChoose(),
  sort: (level) => initSort(level),
}
const reduce = {
  order: orderReducer,
  safe_or_not: safeOrNotReducer,
  choose: chooseReducer,
  sort: sortReducer,
}

export default function EmergencyReady({ game, lang = 'en', onExit, onComplete }) {
  const emergencies = useMemo(() => buildEmergencies(game), [game])
  const readAloud = game.support?.read_aloud !== false
  const zones = game.typeSettings?.sort_place?.zones || [{ zone_key: 'bag', label: 'Go-bag' }, { zone_key: 'home', label: 'Leave at home' }]

  const [phase, setPhase] = useState('picker') // picker | intro | play | end
  const [pickedKey, setPickedKey] = useState(null)
  const [activeKey, setActiveKey] = useState(null)
  const [partIdx, setPartIdx] = useState(0)
  const [partState, setPartState] = useState(null)
  const totals = useRef({ stars: 0, attempts: 0, hints: 0, safeMistakes: 0 })
  const reportedRef = useRef(false)

  const emergency = emergencies.find((e) => e.key === activeKey) || null
  const level = emergency?.levels[partIdx] || null

  const startEmergency = (key) => {
    const e = emergencies.find((x) => x.key === key)
    if (!e) return
    totals.current = { stars: 0, attempts: 0, hints: 0, safeMistakes: 0 }
    reportedRef.current = false
    setActiveKey(key)
    setPickedKey(null)
    setPartIdx(0)
    setPartState(init[e.levels[0].mode](e.levels[0]))
    setPhase('intro')
    speak(`${e.name}. ${e.rule}.`, lang, readAloud)
  }

  const beginPuzzles = () => {
    setPhase('play')
    const first = emergency.levels[0]
    speak(first.question || first.lead || 'Let\'s begin.', lang, readAloud)
  }

  const openPart = (idx) => {
    const lv = emergency.levels[idx]
    setPartIdx(idx)
    setPartState(init[lv.mode](lv))
    speak(lv.question || lv.lead || '', lang, readAloud)
  }

  const advance = () => {
    const nextIdx = partIdx + 1
    if (nextIdx >= emergency.levels.length) {
      if (!reportedRef.current) {
        reportedRef.current = true
        const t = totals.current
        onComplete?.({
          correct: t.stars,
          attempts: t.attempts + t.stars,
          hints_used: t.hints,
          stars: t.stars,
          detail: { emergency_key: emergency.key, parts_completed: 4, safe_or_not_mistakes: t.safeMistakes },
        })
      }
      setPhase('end')
      speak(`You're ${emergency.name} Ready!`, lang, readAloud)
    } else {
      openPart(nextIdx)
    }
  }

  const dispatch = (action) => {
    const next = reduce[level.mode](partState, action, level)
    if (next === partState) { setPartState(next); return }
    setPartState(next)
    if (next.message?.text && next.message !== partState.message) speak(next.message.text, lang, readAloud)
    if (next.stars > (partState.stars || 0)) totals.current.stars += 1
    if (level.mode === 'order' && action.type === 'place' && next.message?.tone === 'hint') totals.current.attempts += 1
    if (level.mode === 'order' && next.glowSlot !== null && next.glowSlot !== partState.glowSlot) totals.current.hints += 1
    if ((level.mode === 'safe_or_not' || level.mode === 'choose') && action.type === 'answer') {
      totals.current.attempts += 1
      if (next.correct === false && level.mode === 'safe_or_not') totals.current.safeMistakes += 1
    }
    if (level.mode === 'sort' && action.type === 'drop' && next.message?.tone === 'hint') totals.current.attempts += 1

    if (partComplete(level.mode, next)) {
      if (level.mode === 'order' || level.mode === 'sort') {
        setTimeout(advance, level.mode === 'order' ? 3000 : 1200)
      }
      // safe_or_not and choose advance when the patient taps Next/Finish
    }
  }

  if (!emergency) {
    return (
      <Shell>
        <EmergencyPicker emergencies={emergencies} onClose={onExit} onPick={setPickedKey} />
        {pickedKey && (
          <div className="fixed inset-0 z-[10001] flex items-end justify-center pb-10">
            <div className="w-[320px]"><EmergencyPickerFooter selected={emergencies.find((e) => e.key === pickedKey)} onBack={() => setPickedKey(null)} onLearn={() => startEmergency(pickedKey)} /></div>
          </div>
        )}
      </Shell>
    )
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <TopBar onBack={() => { setActiveKey(null); setPhase('picker') }} emergency={emergency} chip="Learn first" />
        <EmergencyIntro emergency={emergency} onBack={() => { setActiveKey(null); setPhase('picker') }} onStart={beginPuzzles} />
      </Shell>
    )
  }

  if (phase === 'end') {
    return (
      <GameFinishScreen
        title={`You're ${emergency.name} Ready!`}
        subtitle="Great job learning what to do!"
        badgeFallback={{ emoji: '🌟', name: 'Safety Star' }}
        xp={game.pointsPerPlay ?? 150}
        replayLabel="Play again"
        onReplay={() => startEmergency(emergency.key)}
        onExit={() => { setActiveKey(null); setPhase('picker') }}
      />
    )
  }

  // phase === 'play'
  const line = partState?.message?.text || ''
  const tone = partState?.message?.tone === 'good' ? 'success' : partState?.message?.tone === 'hint' ? 'hint' : 'neutral'
  const isLastChoice = level.mode === 'choose' && partState.index === level.items.length - 1

  return (
    <Shell>
      <TopBar onBack={onExit} emergency={emergency} chip="Hard" parts={emergency.levels} partIdx={partIdx} stars={totals.current.stars} />
      <div className="relative z-10 mx-4 mt-3 flex-1 overflow-y-auto pb-4">
        {level.mode === 'order' && <OrderPart level={level} state={partState} dispatch={dispatch} />}
        {level.mode === 'safe_or_not' && <SafeOrNotPart level={level} state={partState} dispatch={dispatch} onNext={() => { const n = safeOrNotReducer(partState, { type: 'next' }, level); setPartState(n); if (n.done) advance() }} />}
        {level.mode === 'choose' && <ChoosePart level={level} state={partState} dispatch={dispatch} isLast={isLastChoice} onNext={() => { const n = chooseReducer(partState, { type: 'next' }, level); setPartState(n); if (n.done) advance() }} />}
        {level.mode === 'sort' && <SortPart level={level} zones={zones} state={partState} dispatch={dispatch} />}
      </div>
      <PaoGuide tone={tone} bubbleStyle={EMERGENCY_BODY}>{line || 'Take your time.'}</PaoGuide>
    </Shell>
  )
}

function TopBar({ onBack, emergency, chip, parts, partIdx, stars }) {
  return (
    <div className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
      <button type="button" onClick={onBack} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-extrabold text-[#2B2366] shadow-md" style={HEADING}>← Games</button>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-white px-4 py-2 shadow-md" style={HEADING}>
        <span className="text-[16px] font-extrabold text-[#2B2366]">Emergency Ready</span>
        <span className="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 text-[12.5px] font-bold text-[#92400E]">{emergency.name}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${chip === 'Hard' ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#DBEAFE] text-[#1D4ED8]'}`}>{chip}</span>
        {parts && parts.map((lv, i) => (
          <span key={lv.level_order} className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${i < partIdx ? 'bg-[#2F8A4C] text-white' : i === partIdx ? 'bg-[#6D4AE0] text-white' : 'bg-[#EDE9FE] text-[#5b21b6]'}`}>
            {i < partIdx ? '✓ ' : ''}{lv.short_name}
          </span>
        ))}
      </div>
      {typeof stars === 'number' && <div className="flex h-12 items-center gap-1.5 rounded-full bg-white px-4 text-[17px] font-extrabold text-[#C97A00] shadow-md" style={HEADING}>⭐ {stars}</div>}
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-y-auto overscroll-contain" style={EMERGENCY_BODY}>
      <SunnyScenery />
      <div className="relative z-10 flex min-h-full flex-col">{children}</div>
    </div>
  )
}
