import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Lightbulb, Volume2 } from 'lucide-react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import HUD from './HUD'
import PaoGuide from './PaoGuide'
import PauseMenu from './PauseMenu'
import PictureCard from './PictureCard'
import ResultScreen from './ResultScreen'
import SoundCard from './SoundCard'
import { FALLBACK_PAO, preloadPoses } from './paoPoses'
import { ROUNDS, WORD_SOUND, buildCards, saveSettings } from './rounds'
import { sounds } from './sounds'
import './sound-hunt.css'

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)
const freshStats = () => ({ points: 0, wrong: 0, hints: 0, firstTry: 0, log: [] })
const freshRound = () => ({ found: [], wrong: [], hints: 0, points: 0, start: Date.now() })

export default function SoundHunt({ patientName = 'friend', settings: initial, settingsKey, onExit }) {
  const gameSession = useGameSession({ gameName: 'Sound Hunt' })
  const [settings, setSettings] = useState(initial)
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [ready, setReady] = useState(false)
  const [cardSets, setCardSets] = useState(() => ROUNDS.map(buildCards))
  const [ri, setRi] = useState(0)
  const [stage, setStage] = useState('intro') // intro | play | done
  const [paused, setPaused] = useState(false)
  const [line, setLine] = useState({ pose: 'listening', message: '', speech: '', speak: false, id: 0 })
  const [found, setFound] = useState([])
  const [wrongWord, setWrongWord] = useState(null)
  const [wiggle, setWiggle] = useState(null)
  const [glow, setGlow] = useState(null)
  const [wrongRound, setWrongRound] = useState(0)
  const [points, setPoints] = useState(0)
  const [confetti, setConfetti] = useState(false)
  const [result, setResult] = useState(null)

  const idRef = useRef(0)
  const seq = useRef(0)
  const stats = useRef(freshStats())
  const rRef = useRef(freshRound())
  const startedAt = useRef(Date.now())
  const lastEvent = useRef('start')
  const glowRef = useRef(null)
  const round = ROUNDS[ri]
  const cards = cardSets[ri]

  const talk = useCallback((pose, message, speech, speak = true) => {
    idRef.current += 1
    seq.current += 1
    setLine({ pose, message, speech: speech ?? message, speak: speak && sRef.current.sound, id: idRef.current })
  }, [])

  useEffect(() => {
    let alive = true
    preloadPoses().then(() => { if (alive) setReady(true) })
    return () => { alive = false; stopPaoVoice() }
  }, [])

  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); seq.current += 1; setPaused(true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const showHint = useCallback(() => {
    const r = ROUNDS[ri]
    const word = r.targets.find((w) => !found.includes(w))
    if (!word) return
    if (glowRef.current !== word) { rRef.current.hints += 1; stats.current.hints += 1 }
    glowRef.current = word
    setGlow(word)
    talk('hint', `Look here! Listen: *${r.letter.toLowerCase()}*-*${r.letter.toLowerCase()}*-${word}.`, `Look here! Listen: ${r.ttsSound}, ${r.ttsSound}, ${word}.`)
  }, [ri, found, talk])
  const hintRef = useRef(showHint)
  useEffect(() => { hintRef.current = showHint })

  // 1. Pao says the sound 3 times, then the cards appear.
  useEffect(() => {
    if (!ready || paused || result || stage !== 'intro') return undefined
    const say = sRef.current.saySound
    talk('listening', `Listen... /*${round.sound}*/, /*${round.sound}*/, /*${round.sound}*/!`, `Listen... /${round.sound}/, /${round.sound}/, /${round.sound}/!`, say)
    const t = setTimeout(() => { talk('searching', `Let's hunt! Find the /*${round.sound}*/ words.`, `Let's hunt! Find the /${round.sound}/ words.`); setStage('play') }, say ? 3200 : 900)
    return () => clearTimeout(t)
  }, [ready, paused, result, stage, ri, round, talk])

  // 3. Thinking after 5s; hint after the hint delay (or 2.5s after the 2nd wrong tap).
  useEffect(() => {
    if (!ready || paused || result || stage !== 'play') return undefined
    const timers = []
    if (lastEvent.current === 'found') timers.push(setTimeout(() => talk('searching', `Keep hunting! Find the /*${round.sound}*/ words.`, `Keep hunting! Find the /${round.sound}/ words.`), 1500))
    timers.push(setTimeout(() => talk('thinking', 'Hmm... say each word slowly.'), 5000))
    const wait = lastEvent.current === 'wrong' && wrongRound >= 2 ? 2500 : sRef.current.hintDelay * 1000
    timers.push(setTimeout(() => { if (!glowRef.current) hintRef.current() }, wait))
    return () => timers.forEach(clearTimeout)
  }, [ready, paused, result, stage, ri, round, found.length, wrongRound, talk])

  const finish = useCallback(async () => {
    const s = stats.current
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    const stars = s.wrong <= 3 ? 3 : s.wrong <= 8 ? 2 : 1
    stopPaoVoice()
    if (sRef.current.sound) sounds.win()
    setResult({ stars, secs, reward: null, profile: null })
    const data = await gameSession.finish({
      correct: 15, attempts: 15 + s.wrong, hints_used: s.hints, stars,
      detail: {
        game: 'sound-hunt', duration_seconds: secs, total_rounds: 5, rounds: s.log, words_first_try: s.firstTry,
        wrong_taps: s.wrong, hints_used: s.hints, stars, points: s.points, settings: sRef.current, completed: true,
      },
    })
    if (data) setResult((r) => ({ ...r, reward: data.reward, profile: data.profile }))
  }, [gameSession])

  const completeRound = useCallback((all) => {
    const c = rRef.current
    stats.current.log.push({ id: round.id, sound: round.sound, found: all, wrong: c.wrong, hints: c.hints, seconds: Math.round((Date.now() - c.start) / 1000), points: c.points })
    setStage('done'); setGlow(null); glowRef.current = null
    setConfetti(true)
    setTimeout(() => setConfetti(false), 1600)
    if (sRef.current.sound) sounds.round()
    talk('roundDone', `You found all the /*${round.sound}*/ words! ${all.join(', ')}!`, `You found all the /${round.sound}/ words! ${all.join(', ')}!`)
  }, [round, talk])

  const next = useCallback(() => {
    if (ri + 1 >= ROUNDS.length) { finish(); return }
    rRef.current = freshRound(); lastEvent.current = 'start'; glowRef.current = null
    setRi(ri + 1); setFound([]); setGlow(null); setWrongRound(0); setWrongWord(null); setConfetti(false)
    setStage('intro')
  }, [ri, finish])

  useEffect(() => {
    if (stage !== 'done' || paused || result || !settings.autoNext) return undefined
    const t = setTimeout(next, 6000)
    return () => clearTimeout(t)
  }, [stage, paused, result, settings.autoNext, next])

  const pick = useCallback((word) => {
    if (stage !== 'play' || paused || found.includes(word)) return
    const card = cards.find((c) => c.word === word)
    if (!card) return
    const c = rRef.current
    const s = stats.current
    if (card.target) {
      const afterHint = c.hints > 0
      const earned = afterHint ? 5 : 10
      c.points += earned; s.points += earned
      if (!afterHint) s.firstTry += 1
      c.found.push(word)
      const nextFound = [...found, word]
      setFound(nextFound); setPoints((p) => p + earned)
      if (glowRef.current === word) { glowRef.current = null; setGlow(null) }
      lastEvent.current = 'found'
      if (sRef.current.sound) sounds.correct()
      if (nextFound.length === 3) completeRound(nextFound)
      else talk('foundIt', `Yes! *${cap(word)}* starts with /*${round.sound}*/!`, `Yes! ${word} starts with /${round.sound}/!`)
    } else {
      s.wrong += 1; c.wrong.push(word)
      lastEvent.current = 'wrong'
      setWrongRound((n) => n + 1)
      setWrongWord(word); setWiggle(word)
      setTimeout(() => setWiggle(null), 600)
      setTimeout(() => setWrongWord((w) => (w === word ? null : w)), 2000)
      if (sRef.current.sound) sounds.wrong()
      const ws = WORD_SOUND[word] || word.charAt(0)
      talk('tryAgain', `*${cap(word)}* starts with /*${ws}*/. Try another!`, `${word} starts with /${ws}/. Try another!`)
    }
  }, [stage, paused, found, cards, round, completeRound, talk])

  const hearWord = (w) => {
    if (!sRef.current.sound) return
    seq.current += 1
    speakPao(w, { rate: 0.75, pitch: 1.1 })
  }
  const hearSound = () => {
    if (!sRef.current.sound) return
    seq.current += 1
    speakPao(`${round.ttsSound}. ${round.ttsSound}. ${round.ttsSound}.`, { rate: 0.7, pitch: 1.1 })
  }
  const hearAll = () => {
    if (!sRef.current.sound) return
    seq.current += 1
    const tok = seq.current
    const go = (i) => {
      if (tok !== seq.current || i >= cards.length) return
      speakPao(cards[i].word, { rate: 0.75, pitch: 1.1, onEnd: () => setTimeout(() => go(i + 1), 450) })
    }
    go(0)
  }

  const pause = () => { stopPaoVoice(); seq.current += 1; setPaused(true) }
  const restart = () => {
    stopPaoVoice()
    stats.current = freshStats(); rRef.current = freshRound(); startedAt.current = Date.now()
    lastEvent.current = 'start'; glowRef.current = null
    setCardSets(ROUNDS.map(buildCards)); setRi(0); setStage('intro'); setFound([]); setGlow(null); setWrongRound(0); setWrongWord(null)
    setPoints(0); setResult(null); setConfetti(false); setPaused(false)
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
      if (result) return
      if (/^[1-6]$/.test(e.key)) { const c = cards[Number(e.key) - 1]; if (c) pick(c.word) }
      else if (e.key === ' ' && !e.target.closest?.('button, [role="button"]')) { e.preventDefault(); hearSound() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, result, pick, round])

  if (!ready) {
    return (
      <div className="sh-root sh-loading" role="status">
        <img src={FALLBACK_PAO} alt="Pao" draggable="false" />
        <p>Getting ready...</p>
      </div>
    )
  }

  const cardState = (w, isTarget) => {
    if (stage === 'done') return isTarget ? 'found' : 'faded'
    if (found.includes(w)) return 'found'
    if (wrongWord === w) return wiggle === w ? 'wrong wiggle' : 'wrong'
    if (glow === w) return 'glow'
    return 'idle'
  }

  return (
    <div className={`sh-root${reduceMotion ? ' sh-reduce' : ''}`}>
      <i className="sh-leaf l1" /><i className="sh-leaf l2" /><i className="sh-leaf l3" />
      <div className="sh-hill" />
      <HUD round={ri} total={ROUNDS.length} points={points} sound={settings.sound} onPause={pause} onToggleSound={toggleSound} />

      <div className="sh-main">
        <SoundCard round={round} found={found.length} onHear={hearSound} />
        <div className={`sh-grid${stage === 'intro' ? ' hidden' : ''}`}>
          {cards.map((c, i) => (
            <PictureCard key={`${ri}-${c.word}`} word={c.word} index={i} state={cardState(c.word, c.target)} showWord={settings.showWords}
              label={wrongWord === c.word ? `${cap(c.word)} starts with /${WORD_SOUND[c.word] || c.word.charAt(0)}/` : ''}
              disabled={stage !== 'play' || found.includes(c.word) || paused} onPick={pick} onHear={hearWord} />
          ))}
        </div>
        <div className={`sh-banner${stage === 'done' ? ' show' : ''}`} aria-live="polite">
          {stage === 'done' && <><span className="sh-bcheck"><Check size={24} strokeWidth={4} aria-hidden="true" /></span>{round.targets.map(cap).join(', ')}: they all start with <span className="sh-orange">/{round.sound}/</span>!</>}
        </div>
      </div>

      <PaoGuide line={line} />

      <div className="sh-actions">
        {stage === 'done' ? (
          <button type="button" className="sh-next" onClick={next}>Next sound <ArrowRight size={22} aria-hidden="true" /></button>
        ) : (
          <>
            <button type="button" className="sh-act" onClick={hearAll} disabled={stage !== 'play'}><Volume2 size={20} aria-hidden="true" /> Hear all words</button>
            <button type="button" className="sh-act" onClick={showHint} disabled={stage !== 'play'}><Lightbulb size={20} aria-hidden="true" /> Hint</button>
          </>
        )}
      </div>

      {confetti && !reduceMotion && <div className="sh-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${(i % 6) * 0.06}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}

      {paused && !result && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onRestart={restart} onToggleSound={toggleSound} onExit={onExit} />}
      {result && (
        <ResultScreen
          name={String(patientName).split(' ')[0]} stars={result.stars} firstTry={stats.current.firstTry} hints={stats.current.hints} seconds={result.secs}
          rows={ROUNDS.map((r) => ({ id: r.id, letter: r.letter, words: r.targets }))}
          reward={result.reward} profile={result.profile} sound={settings.sound} reduceMotion={reduceMotion} onBack={onExit} onAgain={restart}
        />
      )}
    </div>
  )
}
