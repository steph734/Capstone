import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Lightbulb, Undo2, Volume2 } from 'lucide-react'
import { useGameSession } from '../../hooks/useGameSession'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import HUD from './HUD'
import LevelUp from './LevelUp'
import PaoGuide from './PaoGuide'
import PauseMenu from './PauseMenu'
import PictureCard from './PictureCard'
import ResultScreen from './ResultScreen'
import WordTile from './WordTile'
import { FALLBACK_PAO, preloadPoses } from './paoPoses'
import { TYPE_NAME, buildGame, pointsFor, saveSettings } from './sentences'
import { sounds } from './sounds'
import './sentence-builder.css'

const freshStats = () => ({ points: 0, wrong: 0, hints: 0, log: [] })
const freshPuzzle = () => ({ taps: 0, wrong: 0, hints: 0, start: Date.now() })
const LEVEL_TEXT = { medium: 'Great! Now 4-word sentences!', hard: 'Wow! Now 5-word sentences!' }

// A copy of the tile that flies from the tray into the next slot (and back, if the word is wrong).
function Flyer({ fly, colors, reduceMotion, onDone }) {
  const el = useRef(null)
  useLayoutEffect(() => {
    const node = el.current
    if (!node) return undefined
    let alive = true
    const dx = fly.to.left - fly.from.left
    const dy = fly.to.top - fly.from.top
    const sx = fly.to.width / fly.from.width
    const sy = fly.to.height / fly.from.height
    const ms = reduceMotion ? 90 : 300
    const opts = { duration: ms, easing: 'ease-in-out', fill: 'forwards' }
    const at = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
    ;(async () => {
      await node.animate([{ transform: 'none' }, { transform: at }], opts).finished
      if (fly.correct) { if (alive) onDone(fly); return }
      if (!alive) return
      await node.animate([
        { transform: at }, { transform: `translate(${dx - 10}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: `translate(${dx + 10}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: `translate(${dx - 6}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: at },
      ], { duration: reduceMotion ? 90 : 350, fill: 'forwards' }).finished
      if (!alive) return
      await node.animate([{ transform: at }, { transform: 'none' }], opts).finished
      if (alive) onDone(fly)
    })().catch(() => { if (alive) onDone(fly) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { from, tile } = fly
  return (
    <div ref={el} className={`sb-tile sb-flyer ${colors ? `t-${tile.type}` : 't-plain'}`} style={{ left: from.left, top: from.top, width: from.width, height: from.height }}>{tile.text}</div>
  )
}

export default function SentenceBuilder({ patientName = 'friend', settings: initial, settingsKey, onExit }) {
  const gameSession = useGameSession({ gameName: 'Sentence Builder' })
  const [settings, setSettings] = useState(initial)
  const sRef = useRef(settings)
  useEffect(() => { sRef.current = settings })
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const [ready, setReady] = useState(false)
  const [puzzles, setPuzzles] = useState(() => buildGame())
  const [pi, setPi] = useState(0)
  const [stage, setStage] = useState('intro') // intro | play | done | levelup
  const [slots, setSlots] = useState(() => puzzles[0].words.map(() => null))
  const [paused, setPaused] = useState(false)
  const [line, setLine] = useState({ pose: 'reading', message: '', speech: '', speak: false, id: 0 })
  const [glowId, setGlowId] = useState(null)
  const [fly, setFly] = useState(null)
  const [wrongTick, setWrongTick] = useState(0)
  const [points, setPoints] = useState(0)
  const [gain, setGain] = useState(0)
  const [confetti, setConfetti] = useState(false)
  const [result, setResult] = useState(null)

  const rootRef = useRef(null)
  const idRef = useRef(0)
  const seq = useRef(0)
  const lock = useRef(false)
  const stats = useRef(freshStats())
  const pRef = useRef(freshPuzzle())
  const startedAt = useRef(Date.now())
  const lastEvent = useRef('start')
  const wrongForSlot = useRef(0)
  const glowRef = useRef(false)
  const puzzle = puzzles[pi]
  const placed = slots.filter(Boolean)
  const placedIds = new Set(placed.map((t) => t.id))

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

  useEffect(() => {
    const on = () => { if (document.hidden) { stopPaoVoice(); seq.current += 1; setPaused(true) } }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  const showHint = useCallback(() => {
    const p = puzzles[pi]
    const idx = slots.findIndex((s) => !s)
    if (!p || idx < 0) return
    const tile = p.tiles.find((t) => !placedIds.has(t.id) && t.text === p.words[idx].text)
    if (!tile) return
    if (!glowRef.current) { glowRef.current = true; pRef.current.hints += 1; stats.current.hints += 1 }
    setGlowId(tile.id)
    talk('hint', 'My wand shows the next word!')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles, pi, slots, talk])
  const hintRef = useRef(showHint)
  useEffect(() => { hintRef.current = showHint })

  // 1. Pao reads the picture (and the sentence, for easy puzzles), then asks for the first word.
  useEffect(() => {
    if (!ready || paused || result || stage !== 'intro' || !puzzle) return undefined
    const mode = sRef.current.sayFirst
    const say = mode === 'all' || (mode === 'easy' && puzzle.level === 'easy')
    talk('reading', say ? `Look! *${puzzle.sentence}*` : 'Look at the picture!', say ? `Look! ${puzzle.sentence}` : 'Look at the picture!')
    const t = setTimeout(() => { talk('asking', 'What comes first? Tap a word!'); setStage('play') }, say ? 3800 : 2200)
    return () => clearTimeout(t)
  }, [ready, paused, result, stage, pi, puzzle, talk])

  // 3-4. Thinking after 5s; hint after the hint delay (or 2.5s after a wrong try).
  useEffect(() => {
    if (!ready || paused || result || stage !== 'play' || !puzzle) return undefined
    const timers = []
    if (lastEvent.current === 'placed') timers.push(setTimeout(() => talk('asking', 'What comes next?'), 1400))
    timers.push(setTimeout(() => talk('thinking', 'Hmm... look at the picture again.'), 5000))
    const wait = lastEvent.current === 'wrong' && wrongForSlot.current >= 1 ? 2500 : sRef.current.hintDelay * 1000
    timers.push(setTimeout(() => hintRef.current(), wait))
    return () => timers.forEach(clearTimeout)
  }, [ready, paused, result, stage, pi, puzzle, placed.length, wrongTick, talk])

  const finish = useCallback(async () => {
    const s = stats.current
    const secs = Math.round((Date.now() - startedAt.current) / 1000)
    const stars = s.wrong <= 3 ? 3 : s.wrong <= 8 ? 2 : 1
    const by = (lv) => s.log.filter((l) => l.level === lv && l.perfect).length
    stopPaoVoice()
    if (sRef.current.sound) sounds.win()
    setResult({ stars, secs, reward: null, profile: null })
    const data = await gameSession.finish({
      correct: puzzles.reduce((n, p) => n + p.words.length, 0), attempts: puzzles.reduce((n, p) => n + p.words.length, 0) + s.wrong,
      hints_used: s.hints, stars,
      detail: {
        game: 'sentence-builder', duration_seconds: secs, total_puzzles: 7, puzzles: s.log, perfect_count: s.log.filter((l) => l.perfect).length,
        perfect_by_level: { easy: by('easy'), medium: by('medium'), hard: by('hard') }, wrong_taps: s.wrong, hints_used: s.hints, stars,
        points: s.points, settings: sRef.current, completed: true,
      },
    })
    if (data) setResult((r) => ({ ...r, reward: data.reward, profile: data.profile }))
  }, [gameSession, puzzles])

  const completePuzzle = useCallback(() => {
    const p = puzzles[pi]
    const c = pRef.current
    const pts = pointsFor(p.level, c.wrong, c.hints)
    const perfect = !c.wrong && !c.hints
    stats.current.points += pts
    stats.current.log.push({ id: p.id, level: p.level, sentence: p.sentence, word_count: p.words.length, taps: c.taps, wrong_taps: c.wrong, hints: c.hints, perfect, seconds: Math.round((Date.now() - c.start) / 1000), points: pts })
    setPoints((x) => x + pts)
    setGain(pts)
    setGlowId(null)
    setStage('done')
    setConfetti(true)
    setTimeout(() => setConfetti(false), 1600)
    if (sRef.current.sound) sounds.correct()
    talk('abracadabra', `Abracadabra! *${p.sentence}* You are a word wizard!`, `Abracadabra! ${p.sentence} You are a word wizard!`)
  }, [puzzles, pi, talk])

  const next = useCallback(() => {
    if (pi + 1 >= puzzles.length) { finish(); return }
    const np = puzzles[pi + 1]
    pRef.current = freshPuzzle(); lastEvent.current = 'start'; wrongForSlot.current = 0; glowRef.current = false
    setSlots(np.words.map(() => null)); setGlowId(null); setConfetti(false); setGain(0)
    setPi(pi + 1)
    if (np.level !== puzzles[pi].level) {
      setStage('levelup')
      if (sRef.current.sound) sounds.levelup()
      talk('abracadabra', LEVEL_TEXT[np.level])
    } else setStage('intro')
  }, [pi, puzzles, finish, talk])

  useEffect(() => {
    if (stage !== 'levelup' || paused) return undefined
    const t = setTimeout(() => setStage('intro'), 2000)
    return () => clearTimeout(t)
  }, [stage, paused])

  useEffect(() => {
    if (stage !== 'done' || paused || result || !settings.autoNext) return undefined
    const t = setTimeout(next, 6000)
    return () => clearTimeout(t)
  }, [stage, paused, result, settings.autoNext, next])

  const arrive = useCallback((f) => {
    const p = puzzles[pi]
    setFly(null); lock.current = false
    if (f.correct) {
      const nextSlots = slots.map((s, i) => (i === f.slotIdx ? f.tile : s))
      setSlots(nextSlots)
      lastEvent.current = 'placed'; wrongForSlot.current = 0; glowRef.current = false
      setGlowId(null)
      if (sRef.current.sound) sounds.place()
      if (nextSlots.every(Boolean)) completePuzzle()
      else talk('goodWord', `Yes! "*${f.tile.text}*" goes there.`)
    } else {
      pRef.current.wrong += 1; stats.current.wrong += 1; wrongForSlot.current += 1
      lastEvent.current = 'wrong'
      if (sRef.current.sound) sounds.wrong()
      talk('tryAgain', 'Hmm, try another word!')
      setWrongTick((x) => x + 1)
    }
    return p
  }, [puzzles, pi, slots, completePuzzle, talk])

  const pick = useCallback((tile) => {
    if (stage !== 'play' || paused || lock.current || placedIds.has(tile.id)) return
    const slotIdx = slots.findIndex((s) => !s)
    if (slotIdx < 0) return
    const correct = tile.text === puzzle.words[slotIdx].text
    pRef.current.taps += 1
    const tileEl = rootRef.current?.querySelector(`[data-tile="${tile.id}"]`)
    const slotEl = rootRef.current?.querySelector(`[data-slot="${slotIdx}"]`)
    if (!tileEl || !slotEl) { arrive({ tile, slotIdx, correct }); return }
    lock.current = true
    const a = tileEl.getBoundingClientRect()
    const b = slotEl.getBoundingClientRect()
    setFly({ tile, slotIdx, correct, from: { left: a.left, top: a.top, width: a.width, height: a.height }, to: { left: b.left, top: b.top, width: b.width, height: b.height } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, slots, puzzle, arrive])

  const undo = useCallback(() => {
    if (stage !== 'play' || lock.current) return
    const last = slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0).pop()
    if (last === undefined) return
    setSlots(slots.map((s, i) => (i === last ? null : s)))
    lastEvent.current = 'undo'; setGlowId(null); glowRef.current = false
  }, [stage, slots])

  const hearWord = (w) => {
    if (!sRef.current.sound) return
    seq.current += 1
    speakPao(w, { rate: 0.75, pitch: 1.1 })
  }
  const hearSentence = () => {
    if (!sRef.current.sound) return
    seq.current += 1
    const said = placed.map((t) => t.text).join(' ')
    speakPao(said || 'Tap a word to start.', { rate: 0.8, pitch: 1.1 })
  }
  const readWords = () => {
    if (!sRef.current.sound || !puzzle) return
    seq.current += 1
    const tok = seq.current
    const go = (i) => {
      if (tok !== seq.current || i >= puzzle.tiles.length) return
      speakPao(puzzle.tiles[i].text, { rate: 0.75, pitch: 1.1, onEnd: () => setTimeout(() => go(i + 1), 400) })
    }
    go(0)
  }

  const pause = () => { stopPaoVoice(); seq.current += 1; setPaused(true) }
  const restart = () => {
    stopPaoVoice()
    const g = buildGame()
    stats.current = freshStats(); pRef.current = freshPuzzle(); startedAt.current = Date.now()
    lastEvent.current = 'start'; wrongForSlot.current = 0; glowRef.current = false; lock.current = false
    setPuzzles(g); setPi(0); setSlots(g[0].words.map(() => null)); setStage('intro'); setGlowId(null); setFly(null)
    setPoints(0); setGain(0); setResult(null); setConfetti(false); setPaused(false)
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
      if (!puzzle || result) return
      if (/^[1-9]$/.test(e.key)) { const t = puzzle.tiles[Number(e.key) - 1]; if (t) pick(t) }
      else if (e.key === 'Backspace') { e.preventDefault(); undo() }
      else if (e.key === ' ' && !e.target.closest?.('button, [role="button"]')) { e.preventDefault(); hearSentence() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, result, pick, undo, placed.length])

  if (!ready || !puzzle) {
    return (
      <div className="sb-root sb-loading" role="status">
        <img src={FALLBACK_PAO} alt="Pao" draggable="false" />
        <p>Getting ready...</p>
      </div>
    )
  }

  const colors = settings.showColors
  const types = [...new Set(puzzle.words.map((w) => w.type))]
  const done = stage === 'done'

  return (
    <div className={`sb-root${reduceMotion ? ' sb-reduce' : ''}`} ref={rootRef}>
      <div className="sb-strip" />
      <HUD index={pi} total={puzzles.length} level={puzzle.level} points={points} sound={settings.sound} onPause={pause} onToggleSound={toggleSound} />

      <div className="sb-main">
        <PictureCard puzzle={puzzle} slots={slots} done={done} colors={colors} onHear={hearSentence} />
        <div className="sb-below">
          {done ? (
            <div className="sb-donebar" aria-live="polite">
              <span className="sb-donecheck"><Check size={30} strokeWidth={4} aria-hidden="true" /></span>
              <div><strong>&ldquo;{puzzle.sentence}&rdquo;</strong><small>Every word is in the right place</small></div>
              <span className="sb-gain">+{gain}</span>
            </div>
          ) : (
            <>
              <div className="sb-tray">
                {puzzle.tiles.map((t, i) => (
                  <WordTile key={`${pi}-${t.id}`} tile={t} index={i} colors={colors} glow={glowId === t.id} used={placedIds.has(t.id)}
                    hidden={fly?.tile.id === t.id} disabled={stage !== 'play' || placedIds.has(t.id) || paused} onPick={pick} onHear={hearWord} />
                ))}
              </div>
              {colors && (
                <div className="sb-legend">
                  {types.map((ty) => <span key={ty}><i className={`t-${ty}`} />{TYPE_NAME[ty]}</span>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PaoGuide line={line} />

      <div className="sb-actions">
        {done ? (
          <button type="button" className="sb-next" onClick={next}>Next <ArrowRight size={22} aria-hidden="true" /></button>
        ) : (
          <>
            <button type="button" className="sb-act" onClick={readWords} disabled={stage !== 'play'}><Volume2 size={20} aria-hidden="true" /> Read words</button>
            <button type="button" className="sb-act" onClick={undo} disabled={stage !== 'play' || !placed.length}><Undo2 size={20} aria-hidden="true" /> Undo</button>
            <button type="button" className="sb-act" onClick={showHint} disabled={stage !== 'play'}><Lightbulb size={20} aria-hidden="true" /> Hint</button>
          </>
        )}
      </div>

      {fly && <Flyer fly={fly} colors={colors} reduceMotion={reduceMotion} onDone={arrive} />}
      {confetti && !reduceMotion && <div className="sb-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 83) % 100}%`, animationDelay: `${(i % 6) * 0.06}s`, background: ['#ffd23f', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'][i % 5] }} />)}</div>}
      {stage === 'levelup' && <LevelUp text={LEVEL_TEXT[puzzle.level]} />}

      {paused && !result && <PauseMenu sound={settings.sound} onResume={() => setPaused(false)} onRestart={restart} onToggleSound={toggleSound} onExit={onExit} />}
      {result && (
        <ResultScreen
          name={String(patientName).split(' ')[0]} stars={result.stars} puzzles={puzzles.map((p) => ({ ...p, perfect: stats.current.log.find((l) => l.id === p.id)?.perfect }))}
          perfect={stats.current.log.filter((l) => l.perfect).length} hints={stats.current.hints} seconds={result.secs}
          reward={result.reward} profile={result.profile} sound={settings.sound} reduceMotion={reduceMotion} onBack={onExit} onAgain={restart}
        />
      )}
    </div>
  )
}
