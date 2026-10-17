import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Lightbulb, Volume2 } from 'lucide-react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import ChoiceCard from './ChoiceCard'
import HUD from './HUD'
import PaoGuide from './PaoGuide'
import PauseMenu from './PauseMenu'
import ResultScreen from './ResultScreen'
import WordCard, { Rhymed } from './WordCard'
import { FALLBACK_PAO, preloadPoses } from './paoPoses'
import { buildGame, saveSettings, split } from './rounds'
import { sounds } from './sounds'
import './rhyme-time.css'

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)
const freshStats = () => ({ points: 0, wrong: 0, hints: 0, streak: 0, best: 0, firstTry: 0, log: [] })
const freshRound = () => ({ hints: 0, wrong: 0, chosen: [] })

export default function RhymeTime({ patientName = 'friend', settings: initial, settingsKey, onExit }) {
  const gameSession = useGameSession({ gameName: 'Rhyme Time' })
  const [settings, setSettings] = useState(initial)
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [ready, setReady] = useState(true) // the loading modal (games/shared) has already preloaded the art
  const [rounds, setRounds] = useState(() => buildGame(initial))
  const [ri, setRi] = useState(0)
  const [stage, setStage] = useState('intro') // intro | asking | done
  const [paused, setPaused] = useState(false)
  const [line, setLine] = useState({ pose: 'listening', message: '', speech: '', speak: false, id: 0 })
  const [wrongSet, setWrongSet] = useState(() => new Set())
  const [wiggle, setWiggle] = useState(null)
  const [glow, setGlow] = useState(false)
  const [picked, setPicked] = useState(null)
  const [wrongCount, setWrongCount] = useState(0)
  const [points, setPoints] = useState(0)
  const [gain, setGain] = useState('')
  const [confetti, setConfetti] = useState(false)
  const [result, setResult] = useState(null)

  const idRef = useRef(0)
  const stats = useRef(freshStats())
  const roundRef = useRef(freshRound())
  const startedAt = useRef(Date.now())
  const seq = useRef(0)
  const round = rounds[ri]

  const talk = useCallback((pose, message, speech, speak = true) => {
    idRef.current += 1
    seq.current += 1
    setLine({ pose, message, speech: speech ?? message.replace(/\*/g, ''), speak: speak && sRef.current.sound, id: idRef.current })
  }, [])

  useEffect(() => {
    let alive = true
    preloadPoses().then(() => { if (alive) setReady(true) })
    return () => { alive = false; stopPaoVoice() }
  }, [])

  // Pause when the tab is hidden.
  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); seq.current += 1; setPaused(true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const showHint = useCallback(() => {
    const r = rounds[ri]
    if (!r) return
    const [on, end] = split(r.word, r.wordEnd)
    const [answerOn] = split(r.answer, r.answerEnd)
    if (!roundRef.current.hints) { roundRef.current.hints = 1; stats.current.hints += 1 }
    setGlow(true)
    talk('hint', `Listen to the end: *${on}-${end.toUpperCase()}*, *${answerOn}*-...`, `Listen to the end: ${on}, ${end}. ${r.word}. ${answerOn}, ...`)
  }, [rounds, ri, talk])
  const hintRef = useRef(showHint)
  useEffect(() => { hintRef.current = showHint })

  // 1. Pao says the word, then the cards slide in.
  useEffect(() => {
    if (!ready || paused || result || stage !== 'intro' || !round) return undefined
    talk('listening', `Listen... *${round.word}*!`, `Listen... ${round.word}!`, sRef.current.autoPlay)
    const t = setTimeout(() => setStage('asking'), 1500)
    return () => clearTimeout(t)
  }, [ready, paused, result, stage, ri, round, talk])

  // 2-4. Asking, then thinking after 4s and a hint after the hint delay (or 3s after a wrong try).
  useEffect(() => {
    if (!ready || paused || result || stage !== 'asking' || !round) return undefined
    const timers = []
    if (wrongCount === 0) {
      talk('asking', `Which one rhymes with *${round.word}*?`)
      timers.push(setTimeout(() => talk('thinking', 'Hmm... take your time.'), 4000))
      timers.push(setTimeout(() => { if (!roundRef.current.hints) hintRef.current() }, sRef.current.hintDelay * 1000))
    } else {
      timers.push(setTimeout(() => { if (!roundRef.current.hints) hintRef.current() }, 3000))
    }
    return () => timers.forEach(clearTimeout)
  }, [ready, paused, result, stage, ri, round, wrongCount, talk])

  const finish = useCallback(async () => {
    const s = stats.current
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    const stars = s.wrong <= 2 ? 3 : s.wrong <= 6 ? 2 : 1
    stopPaoVoice()
    if (sRef.current.sound) sounds.win()
    setResult({ stars, secs, reward: null, profile: null })
    const data = await gameSession.finish({
      correct: rounds.length, attempts: rounds.length + s.wrong, hints_used: s.hints, stars,
      detail: {
        game: 'rhyme-time', duration_seconds: secs, rounds: s.log, correct_first_try: s.firstTry, wrong_taps: s.wrong,
        hints_used: s.hints, best_streak: s.best, points: stats.current.points, settings: sRef.current, completed: true,
      },
    })
    if (data) setResult((r) => ({ ...r, reward: data.reward, profile: data.profile }))
  }, [gameSession, rounds.length])

  const next = useCallback(() => {
    if (ri + 1 >= rounds.length) { finish(); return }
    roundRef.current = freshRound()
    setRi(ri + 1)
    setWrongSet(new Set()); setWrongCount(0); setGlow(false); setPicked(null); setGain(''); setConfetti(false)
    setStage('intro')
  }, [ri, rounds.length, finish])

  // 6. Auto-advance 6s after a correct answer.
  useEffect(() => {
    if (stage !== 'done' || paused || result || !settings.autoNext) return undefined
    const t = setTimeout(next, 6000)
    return () => clearTimeout(t)
  }, [stage, paused, result, settings.autoNext, next])

  const pick = useCallback((word) => {
    if (stage !== 'asking' || paused || !round) return
    roundRef.current.chosen.push(word)
    const s = stats.current
    if (word === round.answer) {
      const firstTry = !roundRef.current.hints && !roundRef.current.wrong
      const earned = firstTry ? 10 : 5
      s.streak = firstTry ? s.streak + 1 : 0
      s.best = Math.max(s.best, s.streak)
      if (firstTry) s.firstTry += 1
      s.points = (s.points || 0) + earned
      s.log.push({ word: round.word, answer: round.answer, chosen: [...roundRef.current.chosen], hints: roundRef.current.hints, correct_first_try: firstTry })
      setPoints((p) => p + earned)
      setGain(`+${earned}`)
      setPicked(word); setGlow(false); setStage('done'); setConfetti(true)
      setTimeout(() => setConfetti(false), 1600)
      if (sRef.current.sound) sounds.correct()
      if (firstTry && s.streak % 3 === 0) talk('singing', `*${round.word}*, *${round.answer}*, *${round.extra}*, la la la!`)
      else talk('correct', `Yes! *${cap(round.word)}* and *${round.answer}* rhyme. They both end with *-${round.ending}*!`)
    } else {
      roundRef.current.wrong += 1
      s.wrong += 1
      setWrongSet((w) => new Set(w).add(word))
      setWiggle(word)
      setTimeout(() => setWiggle(null), 600)
      if (sRef.current.sound) sounds.wrong()
      talk('tryAgain', `Good try! *${word}* does not rhyme with *${round.word}*. Try again!`)
      setWrongCount((c) => c + 1)
    }
  }, [stage, paused, round, talk])

  const hearWord = (w) => {
    if (!sRef.current.sound) return
    seq.current += 1
    speakPao(w, { rate: 0.75, pitch: 1.1 })
  }
  const hearAll = () => {
    if (!sRef.current.sound || !round) return
    seq.current += 1
    const tok = seq.current
    const go = (i) => {
      if (tok !== seq.current || i >= round.choices.length) return
      speakPao(round.choices[i], { rate: 0.75, pitch: 1.1, onEnd: () => setTimeout(() => go(i + 1), 450) })
    }
    go(0)
  }

  const pause = () => { stopPaoVoice(); seq.current += 1; setPaused(true) }
  const restart = () => {
    stopPaoVoice()
    stats.current = freshStats(); roundRef.current = freshRound(); startedAt.current = Date.now()
    setRounds(buildGame(sRef.current)); setRi(0); setStage('intro'); setWrongSet(new Set()); setWrongCount(0)
    setGlow(false); setPicked(null); setGain(''); setPoints(0); setResult(null); setConfetti(false); setPaused(false)
  }
  const toggleSound = () => {
    const nextSettings = { ...settings, sound: !settings.sound }
    if (!nextSettings.sound) { stopPaoVoice(); seq.current += 1 }
    setSettings(nextSettings)
    if (settingsKey) saveSettings(settingsKey, nextSettings)
  }

  // Keyboard: 1/2/3 pick a card, Space plays the word, Esc pauses.
  useEffect(() => {
    const on = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') { setPaused((p) => !p); return }
      if (!round || result) return
      if (/^[1-3]$/.test(e.key)) { const w = round.choices[Number(e.key) - 1]; if (w && !wrongSet.has(w)) pick(w) }
      else if (e.key === ' ' && !e.target.closest?.('button, [role="button"]')) { e.preventDefault(); hearWord(round.word) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, result, wrongSet, pick])

  if (!round) return null

  const cardState = (w) => {
    if (stage === 'done') return w === picked ? 'correct' : 'faded'
    if (wrongSet.has(w)) return wiggle === w ? 'wiggle' : 'wrong'
    if (glow && w === round.answer) return 'hint'
    return 'idle'
  }

  return (
    <div className={`rt-root${reduceMotion ? ' rt-reduce' : ''}`}>
      <i className="rt-beam b1" /><i className="rt-beam b2" />
      <div className="rt-strip" />
      <HUD round={ri} total={rounds.length} points={points} sound={settings.sound} onPause={pause} onToggleSound={toggleSound} />

      <div className="rt-main">
        <WordCard round={round} onHear={() => hearWord(round.word)} />
        <div className={`rt-rhymepill${stage === 'done' ? ' show' : ''}`} aria-live="polite">
          {stage === 'done' && <><Rhymed word={round.word} end={round.wordEnd} /> <small>and</small> <Rhymed word={round.answer} end={round.answerEnd} /> <small>rhyme!</small></>}
        </div>
        <div className={`rt-choices${stage === 'intro' ? ' hidden' : ''}`} data-n={round.choices.length}>
          {round.choices.map((w, i) => (
            <ChoiceCard key={`${ri}-${w}`} word={w} index={i} state={cardState(w)} tag={gain}
              disabled={stage !== 'asking' || wrongSet.has(w) || paused} onPick={pick} onHear={hearWord} />
          ))}
        </div>
      </div>

      <PaoGuide line={line} />

      <div className="rt-actions">
        {stage === 'done' ? (
          <button type="button" className="rt-next" onClick={next}>Next <ArrowRight size={22} aria-hidden="true" /></button>
        ) : (
          <>
            <button type="button" className="rt-act" onClick={hearAll} disabled={stage !== 'asking'}><Volume2 size={20} aria-hidden="true" /> Hear all three</button>
            <button type="button" className="rt-act" onClick={showHint} disabled={stage !== 'asking'}><Lightbulb size={20} aria-hidden="true" /> Hint</button>
          </>
        )}
      </div>

      {confetti && !reduceMotion && <div className="rt-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${(i % 6) * 0.06}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}

      {paused && !result && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onRestart={restart} onToggleSound={toggleSound} onExit={onExit} />}
      {result && (
        <ResultScreen
          name={String(patientName).split(' ')[0]} stars={result.stars} correct={rounds.length}
          pairs={stats.current.log.map((l) => rounds.find((r) => r.word === l.word))} firstTry={stats.current.firstTry}
          hints={stats.current.hints} streak={stats.current.best} reward={result.reward} profile={result.profile}
          sound={settings.sound} reduceMotion={reduceMotion} onBack={onExit} onAgain={restart}
        />
      )}
    </div>
  )
}
