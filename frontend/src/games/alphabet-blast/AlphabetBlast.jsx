import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { useOptionalPao } from '../../context/PaoContext'
import Board from './Board'
import HUD from './HUD'
import IntroModal from './IntroModal'
import PauseMenu from './PauseMenu'
import { BlackHole, PaoAvatar72, PaoShooter, Sky, useEquippedNoHat } from './PaoShooter'
import ResultScreen from './ResultScreen'
import useChain from './useChain'
import usePathPoints from './usePathPoints'
import { sounds } from './sounds/sounds'
import { BALL, DIFFICULTY, GAP, LAYOUTS, colorFor, lettersFor, saveSettings } from './config'
import './alphabet-blast.css'

const PRAISE = ['Great pop!', 'Yay!', 'Super!', 'Wow, nice one!', 'You did it!']
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const DANGER_LINE = 'Careful! The chain is close to the black hole. Pop quickly!'
const BADGE_GAME = 'Alphabet Blast'
const BURST_COLORS = Array.from({ length: 6 }, (_, i) => colorFor(String.fromCharCode(65 + i)))
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function useStage() {
  const get = () => {
    // visualViewport excludes mobile browser toolbars, so the stage is not cut off at the bottom.
    const vv = window.visualViewport
    const w = Math.round(vv?.width || window.innerWidth)
    const h = Math.round(vv?.height || window.innerHeight)
    const portrait = h > w
    const view = LAYOUTS[portrait ? 'portrait' : 'landscape'].view
    const scale = Math.min(w / view.w, h / view.h)
    return { scale, left: (w - view.w * scale) / 2, top: (h - view.h * scale) / 2, portrait }
  }
  const [s, setS] = useState(get)
  useEffect(() => {
    const on = () => setS(get())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); window.visualViewport?.removeEventListener('resize', on) }
  }, [])
  return s
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function AlphabetBlast({ patientName = 'friend', settings: initial, settingsKey, onExit, preview = false }) {
  const [settings, setSettings] = useState(initial)
  const stage = useStage()
  const layout = LAYOUTS[stage.portrait ? 'portrait' : 'landscape']
  const { view: VIEW, launcher: LAUNCHER } = layout
  const path = usePathPoints(layout.spiral)
  const reduceMotion = useMemo(reducedMotion, [])
  const gameSession = useGameSession({ gameName: 'Alphabet Blast' })
  const ident = useOptionalPao()?.ident
  const equipped = useEquippedNoHat()

  const display = useCallback((l) => (settings.letterCase === 'lower' ? l.toLowerCase() : l), [settings.letterCase])
  const targets = useMemo(() => lettersFor(settings), [settings])
  const size = Math.min(1.45, Math.max(1, 64 / (BALL * stage.scale)))

  const [phase, setPhase] = useState('intro') // intro | play | paused | done
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
  const [howOpen, setHowOpen] = useState(() => { try { return !localStorage.getItem('alphabetBlast:howSeen') } catch { return true } })
  const [result, setResult] = useState(null)
  const [danger, setDanger] = useState(false)
  const [combo, setCombo] = useState(null)
  const [fxPose, setFxPose] = useState(null) // brief reaction: 'cheer' on a pop, 'shy' on a miss
  const [badge, setBadge] = useState(null)
  const fxTimer = useRef(null)
  const comboTimer = useRef(null)

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

  const flashPose = (p) => { clearTimeout(fxTimer.current); setFxPose(p); fxTimer.current = setTimeout(() => setFxPose(null), 1400) }
  const onDanger = useCallback((on) => { setDanger(on); if (on) say(DANGER_LINE) }, [say])

  const chain = useChain({
    path, gap: GAP * size, settings, running: phase === 'play' || phase === 'intro', frozen: phase === 'intro', onDanger,
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
    setIdx(0); setDone(new Set()); setPoints(0); setSeconds(0); setShot(null); setBursts([]); setHintId(null); setResult(null); setBadge(null); setDanger(false); setCombo(null)
    init(targets, targets[0])
    setPhase('play')
    try { localStorage.setItem('alphabetBlast:howSeen', '1') } catch { /* ignore */ } // the how-to-play panel opens by itself on the very first play only
    announce(targets[0], 'Hehe! Let us blast some letters.')
  }, [init, targets, announce])

  // Back to the intro card (first load and "Play again"): the board is set up behind it, the timer stays stopped.
  const toIntro = useCallback(() => {
    stopPaoVoice()
    stats.current = { total: 0, correct: 0, wrong: 0, streak: 0, best: 0, hints: 0, rescues: 0 }
    lock.current = false
    setIdx(0); setDone(new Set()); setPoints(0); setSeconds(0); setShot(null); setBursts([]); setHintId(null); setResult(null); setBadge(null); setDanger(false); setCombo(null); setMessage('')
    init(targets, targets[0])
    setPhase('intro')
  }, [init, targets])

  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; toIntro() } }, [toIntro])
  useEffect(() => () => { stopPaoVoice(); clearTimeout(fxTimer.current); clearTimeout(comboTimer.current) }, [])

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
    // Badge progress comes from the real badge API; with no player (preview) or no matching badge the row is hidden.
    if (ident?.activitySessionId || ident?.patientEmail) {
      try {
        const q = ident.activitySessionId ? `activitySessionId=${encodeURIComponent(ident.activitySessionId)}` : `patientEmail=${encodeURIComponent(ident.patientEmail)}`
        const body = await fetch(`/api/pao/badges?${q}`).then((x) => x.json())
        const b = (body.badges || []).find((x) => x.relatedGameName === BADGE_GAME && x.target > 0)
        if (b) setBadge({ name: b.name, progress: b.earned ? b.target : b.progress ?? 0, target: b.target, rewardOutfit: b.rewardOutfit, earned: b.earned })
      } catch { /* no badge row */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSession, targets, ident])

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
    setBursts((b) => [...b, { key, x: pos.x, y: pos.y, colors: BURST_COLORS }])
    flashPose('cheer')
    if (s.streak >= 3) { setCombo({ n: s.streak, key }); clearTimeout(comboTimer.current); comboTimer.current = setTimeout(() => setCombo(null), 1500) }
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
      fx('shoot')
      setShot({ id: ball.id, x: pos.x, y: pos.y })
    } else {
      s.wrong += 1; s.streak = 0
      fx('wrong')
      setWrongId(ball.id)
      setBubble({ x: pos.x, y: pos.y, letter: ball.lower ? ball.letter.toLowerCase() : ball.letter })
      setCombo(null)
      flashPose('shy')
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
  const setSpeed = (k) => setSettings((v) => ({ ...v, speed: k })) // this play only; the therapist's saved default is not changed
  const toggleHow = () => {
    setHowOpen((o) => {
      if (o) { try { localStorage.setItem('alphabetBlast:howSeen', '1') } catch { /* ignore */ } }
      return !o
    })
  }

  // Pao's face: happy by default, cheering on a pop, "oops" on a miss, worried when the chain is close to the hole.
  const paoPose = fxPose || (danger ? 'wow' : 'happy')
  const avatar = (d) => <PaoAvatar72 diameter={d} equipped={equipped} pose={paoPose} />
  const name = String(patientName).split(' ')[0]

  return (
    <div className={`ab-root${reduceMotion ? ' ab-reduce' : ''}${danger && phase === 'play' ? ' ab-alert' : ''}`}>
      <Sky />
      <div className={`ab-stage${stage.portrait ? ' ab-portrait' : ''}`} style={{ width: VIEW.w, height: VIEW.h, transform: `translate(${stage.left}px, ${stage.top}px) scale(${stage.scale})` }}>
        <BlackHole pos={layout.hole} danger={danger && phase === 'play'} />
        <Board
          layout={layout} balls={balls} path={path} size={size} registerEl={registerEl} hintId={hintId} wrongId={wrongId} target={target} onTap={tap}
          shot={shot} onShotDone={onShotDone} bursts={bursts} bubble={bubble} reduceMotion={reduceMotion}
          ballsRef={ballsRef} positionOf={positionOf} running={phase === 'play'}
        />
        <PaoShooter pos={LAUNCHER} equipped={equipped} pose={paoPose} />
        <HUD
          settings={settings} targets={targets} done={done} current={target} points={points} timeLabel={clock(seconds)} display={display}
          onPause={() => { stopPaoVoice(); setPhase('paused') }} onToggleSound={toggleSound} onHear={hear} onSpeed={setSpeed}
          message={message} tip={hintId ? `Tip: ${display(target)} is glowing.` : ''} howOpen={howOpen} onToggleHow={toggleHow}
          preview={preview} combo={combo} difficulty={DIFFICULTY[settings.speed] || 'Medium'} avatar={avatar(72)}
        />
      </div>

      {phase === 'intro' && <IntroModal speed={settings.speed} onSpeed={setSpeed} onStart={start} avatar={avatar(120)} />}
      {phase === 'paused' && <PauseMenu onResume={() => setPhase('play')} onRestart={start} onExit={onExit} />}
      {phase === 'done' && result && (
        <ResultScreen
          name={name} stars={result.stars} letters={targets} seconds={result.secs}
          correct={stats.current.correct} total={stats.current.total} streak={stats.current.best}
          badge={badge} avatar={avatar(144)} preview={preview} reduceMotion={reduceMotion} onBack={onExit} onAgain={toIntro}
        />
      )}
    </div>
  )
}
