import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { CalmButton, CalmCard } from './CalmButton'
import EmergencyDone from './EmergencyDone'
import EmergencyPicker from './EmergencyPicker'
import GoBag from './GoBag'
import HUD from './HUD'
import IntroCards from './IntroCards'
import PaoGuide from './PaoGuide'
import PauseMenu from './PauseMenu'
import SafetySteps, { PracticeRound } from './SafetySteps'
import { EMERGENCIES, loadLearned, saveLearned, saveSettings } from './emergencies'
import { sounds } from './sounds'
import './emergency-ready.css'

const IDLE_MS = 20000

// Pao's line (pose, bubble, voice). The bubble always shows; the voice follows the sound setting.
function useTalk(sRef) {
  const [line, setLine] = useState({ pose: 'welcome', message: '', speech: '', speak: false, id: 0 })
  const idRef = useRef(0)
  const talk = useCallback((pose, message, speech, speak = true) => {
    idRef.current += 1
    setLine({ pose, message, speech: speech ?? message.replace(/\*/g, ''), speak: speak && sRef.current.sound, id: idRef.current })
  }, [sRef])
  return { line, talk }
}

// 20 seconds with no tap anywhere: Pao offers a calm breath. Never repeats until the child does something again.
function useIdleCalm(talk, active) {
  useEffect(() => {
    if (!active) return undefined
    let t
    const arm = () => { clearTimeout(t); t = setTimeout(() => talk('calm', 'Breathe in... and out. You are *safe*. This is practice.', 'Breathe in... and out. You are safe. This is practice.'), IDLE_MS) }
    arm()
    const events = ['pointerdown', 'keydown']
    events.forEach((e) => window.addEventListener(e, arm))
    return () => { clearTimeout(t); events.forEach((e) => window.removeEventListener(e, arm)) }
  }, [talk, active])
}

const hear = (sRef, text) => { if (sRef.current.sound) speakPao(text, { rate: 0.8, pitch: 1.05 }) }

// One run of one emergency: What is it? -> Learn what to do (+ practice) -> Pack the go-bag -> Done.
// Remounted for every run, so each finished emergency is its own activity session.
function EmergencyRun({ emergency, settings, setSettings, settingsKey, learned, onLearned, onAnother, onExit }) {
  const gameSession = useGameSession({ gameName: 'Emergency Ready' })
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const { line, talk } = useTalk(sRef)

  const [part, setPart] = useState('intro') // intro | steps | practice | bag | done
  const [idx, setIdx] = useState(0)
  const [confirmed, setConfirmed] = useState(() => new Set())
  const [paused, setPaused] = useState(false)
  const [calmOpen, setCalmOpen] = useState(false)
  const [points, setPoints] = useState(0)
  const [result, setResult] = useState(null)
  const stats = useRef({ introViewed: new Set([0]), practiceWrong: 0, bagWrong: 0, hints: 0, calm: false })
  const startedAt = useRef(Date.now())
  const finished = useRef(false)

  useIdleCalm(talk, !paused && !calmOpen && part !== 'done')

  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); setPaused(true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  // Each screen: Pao reads the card (when "read aloud" is on) and the bubble always shows.
  useEffect(() => {
    if (paused || calmOpen) return
    const ra = sRef.current.readAloud
    if (part === 'intro') { const c = emergency.intro[idx]; talk('explaining', c.text, `${c.title}. ${c.text}`, ra) }
    else if (part === 'steps') { const st = emergency.steps[idx]; talk('showing', `*${st.title}*. ${st.reason}`, `${st.title}. ${st.reason}`, ra) }
    else if (part === 'practice') talk('showing', 'Put the steps in order. What comes *first*?', 'Put the steps in order. What comes first?')
    else if (part === 'bag') talk('explaining', "Let's pack the *go-bag*. Tap the things we need.", "Let's pack the go-bag. Tap the things we need.")
  }, [part, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback(async () => {
    if (finished.current) return
    finished.current = true
    const s = stats.current
    const wrong = s.practiceWrong + s.bagWrong
    const stars = wrong <= 1 ? 3 : wrong <= 4 ? 2 : 1
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    setPart('done')
    if (sRef.current.sound) sounds.done()
    talk('safetyStar', 'You are a *Safety Star*!', 'You are a Safety Star!')
    const nextLearned = new Set(learned).add(emergency.id)
    saveLearned(settingsKey, nextLearned)
    onLearned(nextLearned)
    setResult({ stars, reward: null })
    const data = await gameSession.finish({
      correct: 4 + 6, attempts: 4 + 6 + wrong, hints_used: s.hints, stars,
      detail: {
        game: 'emergency-ready', emergency_key: emergency.id, emergency_id: emergency.id, duration_seconds: secs,
        intro_cards_viewed: s.introViewed.size, steps_confirmed: confirmed.size, practice_wrong_taps: s.practiceWrong, gobag_wrong_items: s.bagWrong,
        hints_used: s.hints, calm_used: s.calm, completed: true,
      },
    })
    if (data) setResult((r) => ({ ...r, reward: data.reward }))
  }, [gameSession, emergency, learned, onLearned, settingsKey, confirmed, talk])

  const toggleSound = () => {
    const n = { ...settings, sound: !settings.sound }
    if (!n.sound) stopPaoVoice()
    setSettings(n)
    saveSettings(settingsKey, n)
  }
  const openCalm = () => {
    stats.current.calm = true
    stopPaoVoice()
    setCalmOpen(true)
    talk('calm', 'Breathe in... and out. You are *safe*. This is practice.', 'Breathe in... and out. You are safe. This is practice.')
  }

  const goIntro = (d) => {
    const n = idx + d
    if (n < 0) { onAnother(); return }
    if (n >= emergency.intro.length) { setPart('steps'); setIdx(0); return }
    stats.current.introViewed.add(n)
    setIdx(n)
  }
  const goStep = (d) => {
    const n = idx + d
    if (n < 0) { setPart('intro'); setIdx(emergency.intro.length - 1); return }
    if (n >= emergency.steps.length) { setIdx(0); setPart(sRef.current.practice ? 'practice' : 'bag'); return }
    setIdx(n)
  }
  const confirmStep = (i) => {
    setConfirmed((c) => { if (c.has(i)) return c; setPoints((p) => p + 10); return new Set(c).add(i) })
    if (sRef.current.sound) sounds.chime()
    talk('showing', 'Great. You can do this *step*.', 'Great. You can do this step.')
  }

  const chip = part === 'intro' ? 1 : part === 'steps' || part === 'practice' ? 2 : part === 'bag' ? 3 : 4

  return (
    <div className="er-root">
      <div className="er-floor" />
      <HUD label={emergency.name} current={chip} points={points} sound={settings.sound} calm={<CalmButton onOpen={openCalm} />} onPause={() => { stopPaoVoice(); setPaused(true) }} onToggleSound={toggleSound} />

      {part === 'intro' && <IntroCards emergency={emergency} idx={idx} hotline={settings.hotline} onHear={(t) => hear(sRef, t)} onBack={() => goIntro(-1)} onNext={() => goIntro(1)} />}
      {part === 'steps' && <SafetySteps emergency={emergency} idx={idx} confirmed={confirmed} onConfirm={confirmStep} onHear={(t) => hear(sRef, t)} onBack={() => goStep(-1)} onNext={() => goStep(1)} />}
      {part === 'practice' && (
        <PracticeRound
          emergency={emergency}
          onRight={(c) => { if (sRef.current.sound) sounds.chime(); talk('showing', `Yes! *${c.title}*. What comes *next*?`, `Yes! ${c.title}. What comes next?`) }}
          onWrong={() => { stats.current.practiceWrong += 1; talk('gentleNo', 'Not that one yet. What comes *first*?', 'Not that one yet. What comes first?') }}
          onDone={() => { setPart('bag'); setIdx(0) }}
        />
      )}
      {part === 'bag' && (
        <GoBag
          emergency={emergency} paused={paused || calmOpen} talk={talk} sound={settings.sound} playPack={sounds.pack}
          onWrong={() => { stats.current.bagWrong += 1 }} onHint={() => { stats.current.hints += 1 }}
          onPacked={complete}
        />
      )}
      {part === 'done' && result && (
        <EmergencyDone emergency={emergency} learnedCount={learned.size + (learned.has(emergency.id) ? 0 : 1)} total={EMERGENCIES.length} reward={result.reward} stars={result.stars} onAnother={onAnother} onBack={onExit} />
      )}

      <PaoGuide line={line} />
      {calmOpen && <CalmCard onClose={() => setCalmOpen(false)} />}
      {paused && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onToggleSound={toggleSound} onExit={onExit} />}
    </div>
  )
}

export default function EmergencyReady({ settings: initial, settingsKey, onExit }) {
  const [settings, setSettings] = useState(initial)
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const [selected, setSelected] = useState(null)
  const [run, setRun] = useState(null)
  const [learned, setLearned] = useState(() => loadLearned(settingsKey))
  const [paused, setPaused] = useState(false)
  const [calmOpen, setCalmOpen] = useState(false)
  const { line, talk } = useTalk(sRef)

  useIdleCalm(talk, !run && !paused && !calmOpen)
  useEffect(() => { if (!run) talk('welcome', "I'll learn with you. *Pick* one!", "I'll learn with you. Pick one!") }, [run, talk])

  const onSelect = (e) => { setSelected(e.id); talk('welcome', `*${e.name}* it is. Let's learn together.`, `${e.name} it is. Let's learn together.`) }
  const toggleSound = () => {
    const n = { ...settings, sound: !settings.sound }
    if (!n.sound) stopPaoVoice()
    setSettings(n)
    saveSettings(settingsKey, n)
  }

  if (run) {
    return (
      <EmergencyRun
        key={`${run.emergency.id}-${run.n}`} emergency={run.emergency} settings={settings} setSettings={setSettings} settingsKey={settingsKey}
        learned={learned} onLearned={setLearned} onAnother={() => setRun(null)} onExit={onExit}
      />
    )
  }

  return (
    <div className="er-root">
      <div className="er-floor" />
      <HUD label="Hard · Ages 12–19" current={0} points={0} sound={settings.sound} calm={<CalmButton onOpen={() => { stopPaoVoice(); setCalmOpen(true); talk('calm', 'Breathe in... and out. You are *safe*. This is practice.', 'Breathe in... and out. You are safe. This is practice.') }} />} onPause={() => { stopPaoVoice(); setPaused(true) }} onToggleSound={toggleSound} />
      <EmergencyPicker shown={settings.shown} learned={learned} selected={selected} hotline={settings.hotline} onSelect={onSelect} onBack={onExit} onStart={(e) => { stopPaoVoice(); setRun({ emergency: e, n: 1 }) }} />
      <PaoGuide line={line} />
      {calmOpen && <CalmCard onClose={() => setCalmOpen(false)} />}
      {paused && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onToggleSound={toggleSound} onExit={onExit} />}
    </div>
  )
}
