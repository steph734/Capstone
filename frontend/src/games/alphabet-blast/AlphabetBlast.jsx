import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import PandaMascot from '../../pages/games/PandaMascot'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import Board from './Board'
import HUD from './HUD'
import PauseMenu from './PauseMenu'
import ResultScreen from './ResultScreen'
import useChain from './useChain'
import usePathPoints from './usePathPoints'
import { sounds } from './sounds/sounds'
import { BALL, GAP, LAUNCHER, VIEW, lettersFor, saveSettings } from './config'
import './alphabet-blast.css'

const PRAISE = ['Great pop!', 'Yay!', 'Super!', 'Wow, nice one!', 'You did it!']
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function useStage() {
  const get = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const scale = Math.min(w / VIEW.w, h / VIEW.h)
    return { scale, left: (w - VIEW.w * scale) / 2, top: (h - VIEW.h * scale) / 2, portrait: h > w && w < 700 }
  }
  const [s, setS] = useState(get)
  useEffect(() => {
    const on = () => setS(get())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on) }
  }, [])
  return s
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function AlphabetBlast({ patientName = 'friend', settings: initial, settingsKey, onExit }) {
  const [settings, setSettings] = useState(initial)
  const stage = useStage()
  const path = usePathPoints()
  const reduceMotion = useMemo(reducedMotion, [])
  const gameSession = useGameSession({ gameName: 'Alphabet Blast' })

  const display = useCallback((l) => (settings.letterCase === 'lower' ? l.toLowerCase() : l), [settings.letterCase])
  const targets = useMemo(() => lettersFor(settings), [settings])
  const size = Math.min(1.45, Math.max(1, 64 / (BALL * stage.scale)))

  const [phase, setPhase] = useState('play') // play | paused | done
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(() => new Set())
  const [points, setPoints] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const [talking, setTalking] = useState(false)
  const [hintId, setHintId] = useState(null)
  const [wrongId, setWrongId] = useState(null)
  const [bubble, setBubble] = useState(null)
  const [bursts, setBursts] = useState([])
  const [shot, setShot] = useState(null)
  const [angle, setAngle] = useState(-90)
  const [howOpen, setHowOpen] = useState(() => { try { return !localStorage.getItem('alphabetBlast:howSeen') } catch { return true } })
  const [result, setResult] = useState(null)

  const stats = useRef({ total: 0, correct: 0, wrong: 0, streak: 0, best: 0, hints: 0, rescues: 0 })
  const lock = useRef(false)
  const startedAt = useRef(Date.now())
  const sRef = useRef(settings)
  const doneRef = useRef(done)
  const burstId = useRef(0)
  useEffect(() => { sRef.current = settings; doneRef.current = done })

  const say = useCallback((text, { speak = true } = {}) => {
    setMessage(text)
    if (!speak || !sRef.current.sound) return
    speakPao(text, { rate: 0.9, onStart: () => setTalking(true), onEnd: () => setTalking(false) })
  }, [])
  const fx = (name) => { if (sRef.current.sound) sounds[name]() }

  const chain = useChain({
    path, gap: GAP * size, settings, running: phase === 'play',
    onRescue: () => { stats.current.rescues += 1; say("Oops! Let's push them back. You can do it!") },
  })
  const { init, ensureTarget, popBall, positionOf, setHalfSpeed, registerEl, balls, ballsRef } = chain

  const target = targets[idx]

  const announce = useCallback((letter, lead = '') => {
    const line = `Find the letter ${letter}. ${letter}!`
    if (sRef.current.autoSpeak) say(`${lead} ${line}`.trim())
    else say(lead || line, { speak: Boolean(lead) })
  }, [say])

  const start = useCallback(() => {
    stopPaoVoice()
    stats.current = { total: 0, correct: 0, wrong: 0, streak: 0, best: 0, hints: 0, rescues: 0 }
    lock.current = false
    startedAt.current = Date.now()
    setIdx(0); setDone(new Set()); setPoints(0); setSeconds(0); setShot(null); setBursts([]); setHintId(null); setResult(null)
    init(targets, targets[0])
    setPhase('play')
    announce(targets[0], 'Hehe! Let us blast some letters.')
  }, [init, targets, announce])

  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; start() } }, [start])
  useEffect(() => () => stopPaoVoice(), [])

  // Timer (counts up; never a countdown).
  useEffect(() => {
    if (phase !== 'play') return undefined
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Pause when the tab is hidden.
  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); setPhase((p) => (p === 'play' ? 'paused' : p)) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  // New target: make sure it is on screen, then start the hint timers.
  useEffect(() => {
    if (phase !== 'play' || !target) return undefined
    ensureTarget(target)
    setHintId(null)
    setHalfSpeed(false)
    const t1 = setTimeout(() => {
      const ball = ballsRef.current.find((b) => b.letter === target && (positionOf(b.id)?.dist ?? -1) >= 0)
      if (ball) { setHintId(ball.id); stats.current.hints += 1 }
      say(`Look! ${target} is glowing.`)
    }, settings.hintDelay * 1000)
    const t2 = setTimeout(() => setHalfSpeed(true), 12000)
    return () => { clearTimeout(t1); clearTimeout(t2); setHalfSpeed(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, phase, settings.hintDelay])

  const finish = useCallback(async () => {
    const s = stats.current
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    const stars = s.wrong <= 4 ? 3 : s.wrong <= 10 ? 2 : 1
    fx('win')
    setPhase('done')
    setResult({ stars, secs, reward: null, profile: null })
    const data = await gameSession.finish({
      correct: s.correct, attempts: s.total, hints_used: s.hints, stars,
      detail: {
        game: 'alphabet-blast', duration_seconds: secs, total_taps: s.total, correct_taps: s.correct, wrong_taps: s.wrong,
        hints_used: s.hints, rescues: s.rescues, best_streak: s.best, letters_completed: targets, settings: sRef.current, completed: true,
      },
    })
    if (data) setResult((r) => ({ ...r, reward: data.reward, profile: data.profile }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSession, targets])

  const onShotDone = useCallback((sh) => {
    const pos = positionOf(sh.id) || sh
    const s = stats.current
    const letter = targets[idx]
    popBall(sh.id, targets.filter((l) => l !== letter))
    setShot(null)
    s.correct += 1; s.streak += 1; s.best = Math.max(s.best, s.streak)
    setPoints((p) => p + 10)
    const nextDone = new Set(doneRef.current).add(letter)
    setDone(nextDone)
    fx('pop')
    const key = ++burstId.current
    setBursts((b) => [...b, { key, x: pos.x, y: pos.y }])
    setTimeout(() => setBursts((b) => b.filter((x) => x.key !== key)), 700)
    if (nextDone.size >= targets.length) { say(pick(PRAISE)); finish(); return }
    const lead = pick(PRAISE)
    say(lead, { speak: false })
    setTimeout(() => {
      lock.current = false
      setIdx((i) => i + 1)
      announce(targets[idx + 1], lead)
    }, 600)
  }, [positionOf, popBall, targets, idx, say, finish, announce])

  const tap = useCallback((ball) => {
    if (phase !== 'play' || lock.current) return
    const s = stats.current
    s.total += 1
    const pos = positionOf(ball.id)
    if (!pos) return
    if (ball.letter === target) {
      lock.current = true
      setHintId(null)
      setAngle((Math.atan2(pos.y - LAUNCHER.y, pos.x - LAUNCHER.x) * 180) / Math.PI)
      fx('shoot')
      setShot({ id: ball.id, x: pos.x, y: pos.y })
    } else {
      s.wrong += 1; s.streak = 0
      fx('wrong')
      setWrongId(ball.id)
      setBubble({ x: pos.x, y: pos.y })
      setTimeout(() => { setWrongId(null); setBubble(null) }, 900)
      say(`That's ${ball.letter}. Find ${target}!`)
    }
  }, [phase, positionOf, target, say])

  // Keyboard (handy for testing): typing a letter pops that letter when it is on screen.
  useEffect(() => {
    const on = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') { setPhase((p) => (p === 'play' ? 'paused' : p === 'paused' ? 'play' : p)); return }
      if (!/^[a-z]$/i.test(e.key)) return
      const L = e.key.toUpperCase()
      const ball = balls.find((b) => b.letter === L && (positionOf(b.id)?.dist ?? -1) >= 0)
      if (ball) tap(ball)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [balls, positionOf, tap])

  const toggleSound = () => {
    const next = { ...settings, sound: !settings.sound }
    if (!next.sound) stopPaoVoice()
    setSettings(next)
    if (settingsKey) saveSettings(settingsKey, next)
  }
  const hear = () => {
    if (!target || !settings.sound) return
    speakPao(`Find the letter ${target}. ${target}!`, { rate: 0.9, onStart: () => setTalking(true), onEnd: () => setTalking(false) })
  }
  const toggleHow = () => {
    setHowOpen((o) => {
      if (o) { try { localStorage.setItem('alphabetBlast:howSeen', '1') } catch { /* ignore */ } }
      return !o
    })
  }

  if (stage.portrait) {
    return (
      <div className="ab-root ab-rotate" role="alert">
        <RotateCw size={56} aria-hidden="true" />
        <h2>Turn your device sideways</h2>
        <p>Alphabet Blast plays best in landscape.</p>
        <button type="button" className="ab-big" onClick={onExit}>Back to games</button>
      </div>
    )
  }

  return (
    <div className={`ab-root${reduceMotion ? ' ab-reduce' : ''}`}>
      <div className="ab-stage" style={{ width: VIEW.w, height: VIEW.h, transform: `translate(${stage.left}px, ${stage.top}px) scale(${stage.scale})` }}>
        <Board
          balls={balls} pathD={path.d} size={size} registerEl={registerEl} hintId={hintId} wrongId={wrongId} onTap={tap}
          angle={angle} shot={shot} onShotDone={onShotDone} bursts={bursts} bubble={bubble} reduceMotion={reduceMotion}
        />
        <div className="ab-pao" style={{ left: LAUNCHER.x - 64, top: LAUNCHER.y - 64 }} aria-hidden="true">
          <PandaMascot mouthOpen={talking} pxWidth={118} pandaState={talking ? 'happy' : 'normal'} />
        </div>
        <HUD
          settings={settings} targets={targets} done={done} current={target} points={points} timeLabel={clock(seconds)} display={display}
          onPause={() => { stopPaoVoice(); setPhase('paused') }} onToggleSound={toggleSound} onHear={hear}
          message={message} tip={hintId ? `Tip: ${display(target)} is glowing.` : ''} howOpen={howOpen} onToggleHow={toggleHow}
        />
      </div>

      {phase === 'paused' && (
        <PauseMenu sound={settings.sound} onResume={() => setPhase('play')} onRestart={start} onToggleSound={toggleSound} onExit={onExit} />
      )}
      {phase === 'done' && result && (
        <ResultScreen
          name={String(patientName).split(' ')[0]} stars={result.stars} letters={targets} seconds={result.secs}
          correct={stats.current.correct} total={stats.current.total} streak={stats.current.best}
          reward={result.reward} profile={result.profile} reduceMotion={reduceMotion} onBack={onExit} onAgain={start}
        />
      )}
    </div>
  )
}
