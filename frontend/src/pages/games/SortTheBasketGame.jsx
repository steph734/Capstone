import { useState, useEffect, useRef } from 'react'
import GameFinishScreen from '../../components/GameFinishScreen'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger } from '../../utils/gameplayLogger'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { SORT_BASKET_LINES, pickLine, pickRandomLine } from '../../utils/paoLines'
import { fetchGameBadge } from '../../utils/gameProgress'
import { useGameSession } from '../../hooks/useGameSession'

// Sort the Basket: zones, levels and items all come from the `games` document
// (GET /api/games/by-name). Level 1 shows the answer, level 2 hints after a
// slip or on request, level 3 has no hints (the level's `prompt_level`).
const GAME_NAME = 'Sort the Basket'
const ASSETS = '/games/sort-the-basket'
const PAO = (pose) => `${ASSETS}/pao/pao-${pose}.svg`
const BASKET = (zoneKey) => `${ASSETS}/baskets/basket-${zoneKey}.svg`

// What each basket holds, spoken by "Read baskets" and shown as the legend.
const ZONE_USE = {
  food:    { legend: 'Things we eat',       phrase: 'things we eat',       fill: '#E98A2B' },
  clothes: { legend: 'Things we wear',      phrase: 'things we wear',      fill: '#3D7FD0' },
  toys:    { legend: 'Things we play with', phrase: 'things we play with', fill: '#B65AB0' },
}
const BASKET_TINT = { food: '#FFE6C7', clothes: '#DCEBFF', toys: '#F6DDF3' }
const BASKET_TEXT = { food: '#B2590B', clothes: '#2A5DA8', toys: '#8A3F85' }

const ZONE_NAME = (z) => (z?.label || '').replace(/ basket$/i, '') || z?.zone_key || ''
const article = (label) => (/^[aeiou]/i.test(label) ? 'an' : 'a')

// A short, gentle two-note chime on correct — no audio asset needed.
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    const notes = [523.25, 783.99] // C5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })
    setTimeout(() => ctx.close(), 700)
  } catch {}
}

// ─── Finish screen ────────────────────────────────────────────────────────────

function FinishScreen({ score, total, onReplay, onExit, lang = 'en', onRecord }) {
  const pct      = total ? score / total : 0
  const stars    = pct >= 0.85 ? 3 : pct >= 0.55 ? 2 : 1
  const scoreMsg = pickLine(
    stars === 3 ? SORT_BASKET_LINES.finishStars3 : stars === 2 ? SORT_BASKET_LINES.finishStars2 : SORT_BASKET_LINES.finishStars1,
    lang,
  )

  const [badgeShown, setBadgeShown] = useState(false)
  const [realBadge,  setRealBadge]  = useState(null)

  useEffect(() => {
    const speak = (text, onDone) => speakPao(text, { pitch: 1.62, rate: 1.08, onEnd: () => onDone?.() })
    const t = setTimeout(() => {
      speak(`${pickLine(SORT_BASKET_LINES.scoreLine, lang, score, total)} ${scoreMsg}`, () => {
        setTimeout(() => {
          try {
            const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
            if (!earned.includes('Basket Sorter')) {
              localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Basket Sorter']))
            }
          } catch {}
          onRecord?.()
          fetchGameBadge(GAME_NAME).then(setRealBadge)
          setBadgeShown(true)
          speak(pickLine(SORT_BASKET_LINES.badgeScript, lang))
        }, 700)
      })
    }, 500)
    return () => { clearTimeout(t); stopPaoVoice() }
  }, []) // eslint-disable-line

  return (
    <GameFinishScreen
      title={`${score} / ${total} Sorted!`}
      badge={badgeShown ? realBadge : null}
      badgeFallback={badgeShown ? { emoji: '🧺', name: 'Basket Sorter' } : null}
      stars={stars}
      replayLabel="Play again"
      onReplay={onReplay}
      onExit={onExit}
    />
  )
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export default function SortTheBasketGame(props) {
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/games/by-name?name=' + encodeURIComponent(GAME_NAME))
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (cancelled) return
        if (!ok || !b.game?.levels?.length || !b.game?.typeSettings?.sort_place?.zones?.length) setError(b.error || 'Sort the Basket is not ready yet.')
        else setGame(b.game)
      })
      .catch(() => { if (!cancelled) setError('Could not load Sort the Basket.') })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div style={{ ...stage, alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: 24 }}>
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{error}</p>
        <button onClick={props.onExit} style={topBtnStyle}>← All Games</button>
      </div>
    )
  }
  if (!game) return <div style={{ ...stage, alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>Loading…</div>
  return <SortTheBasketPlay game={game} {...props} />
}

// ─── Main game ────────────────────────────────────────────────────────────────

function SortTheBasketPlay({ game, onExit, patientId = 'alvrin', exerciseId = 'sort-basket', domain = 'Cognitive', lang = 'en' }) {
  const zones = game.typeSettings.sort_place.zones
  const levels = [...game.levels].sort((a, b) => a.level_order - b.level_order)
  const totalItems = levels.reduce((n, l) => n + l.items.length, 0)
  const outlines = game.typeSettings.sort_place.show_target_outlines !== false

  const gameSession = useGameSession({ gameName: GAME_NAME })

  const [levelIdx, setLevelIdx] = useState(0)
  const [current,  setCurrent]  = useState(0)
  const [answers,  setAnswers]  = useState([]) // one per finished item, all levels
  const [attempts, setAttempts] = useState(0) // picks on the current item
  const [firstZone, setFirstZone] = useState(null)
  const [hintUsed, setHintUsed] = useState(false)
  const [glowZone, setGlowZone] = useState(null)
  const [locked,   setLocked]   = useState(false)
  const [flash,    setFlash]    = useState(null) // { zone, type: 'correct' | 'wrong' }
  const [pose,     setPose]     = useState('hello')
  const [line,     setLine]     = useState('')
  const [readAloud, setReadAloud] = useState(game.support?.read_aloud !== false)
  const [paused,   setPaused]   = useState(false)
  const [phase,    setPhase]    = useState('play') // 'play' | 'levelDone' | 'done'
  const [sessionKey, setSessionKey] = useState(0)

  const level = levels[levelIdx]
  const item = level.items[current]
  const promptLevel = level.prompt_level || 'none'
  const zoneOf = (key) => zones.find((z) => z.zone_key === key)
  const answeredCount = answers.length
  const score = answers.filter((a) => a.correct).length

  const timerRef = useRef(null)
  const startedAtRef = useRef(Date.now())
  const pausedAtRef = useRef(null)
  const wrongTotalRef = useRef(0)
  const readAloudRef = useRef(readAloud)
  readAloudRef.current = readAloud
  const lineGen = useRef(0)

  const { submitEventBatch } = useAnalytics()
  const sessionIdRef = useRef(createSessionId())
  const loggerRef = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))
  const sessionEndedRef = useRef(false)
  const logExitOnce = () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    loggerRef.current.log('exit', {})
  }

  const say = (text, nextPose, { speak = true, onEnd } = {}) => {
    const gen = ++lineGen.current
    setLine(text)
    if (nextPose) setPose(nextPose)
    if (!speak || !readAloudRef.current || !text) { onEnd?.(); return }
    speakPao(text, {
      pitch: 1.5, rate: 0.95,
      onStart: () => { if (gen === lineGen.current && nextPose === 'listen') setPose('listen') },
      onEnd: () => { if (gen === lineGen.current) onEnd?.() },
    })
  }

  // The words Pao says for the current item: its name and what it is used for.
  const itemSpeech = () => `${article(item.label) === 'an' ? 'An' : 'A'} ${item.label.toLowerCase()}! ${item.text || ''}`.trim()

  // New item → reset per-item state, show the answer on level 1, and read it aloud.
  useEffect(() => {
    if (phase !== 'play' || !item) return undefined
    setAttempts(0); setFirstZone(null); setHintUsed(false); setLocked(false); setFlash(null)
    setGlowZone(promptLevel === 'full_model' ? item.zone_key : null)
    startedAtRef.current = Date.now()
    pausedAtRef.current = null
    loggerRef.current.log('prompt_shown', {})
    const t = setTimeout(() => {
      if (promptLevel === 'full_model') {
        const z = zoneOf(item.zone_key)
        say(`${itemSpeech()} ${ZONE_NAME(z)} basket!`, 'point')
      } else {
        say(`${itemSpeech()} ${pickLine(SORT_BASKET_LINES.prompt, lang)}`, 'listen')
      }
    }, 350)
    return () => clearTimeout(t)
  }, [levelIdx, current, phase, sessionKey]) // eslint-disable-line

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    stopPaoVoice()
    logExitOnce()
  }, []) // eslint-disable-line

  const advance = () => {
    if (current + 1 < level.items.length) { setCurrent((c) => c + 1); return }
    if (levelIdx + 1 < levels.length) {
      setPhase('levelDone')
      say(`Level ${level.level_order} done! Ready for ${levels[levelIdx + 1].level_name}?`, 'surprised')
    } else {
      setPhase('done')
      logExitOnce()
    }
  }

  const pickZone = (zoneKey) => {
    if (locked || paused || phase !== 'play' || !item) return
    const isCorrect = zoneKey === item.zone_key
    const nextAttempts = attempts + 1
    const first = firstZone ?? zoneKey
    setAttempts(nextAttempts)
    setFirstZone(first)
    setLocked(true)
    setFlash({ zone: zoneKey, type: isCorrect ? 'correct' : 'wrong' })
    loggerRef.current.log('response_given', { responseTimeMs: Date.now() - startedAtRef.current, isCorrect, inputMethod: 'tap', touchPressure: null })

    const z = zoneOf(zoneKey)
    if (isCorrect) {
      playChime()
      setGlowZone(null)
      const answer = {
        level: level.level_order,
        item: item.label,
        zone: item.zone_key,
        chosenZone: first,
        correct: nextAttempts === 1,
        attempts: nextAttempts,
        hintUsed,
        timeMs: Date.now() - startedAtRef.current,
      }
      setAnswers((a) => [...a, answer])
      loggerRef.current.log('praise_shown', {})
      say(pickLine(SORT_BASKET_LINES.correctFor, lang, item.label, article(item.label), ZONE_NAME(z)), nextAttempts === 1 ? 'correct' : 'proud')
      timerRef.current = setTimeout(advance, 2000)
    } else {
      wrongTotalRef.current += 1
      say(pickRandomLine(SORT_BASKET_LINES.wrongTry, lang), 'try-again')
      timerRef.current = setTimeout(() => {
        setFlash(null); setLocked(false)
        // Level 2 (and any wrong-twice slip on level 1) shows the answer; level 3 never does.
        if (promptLevel !== 'none') {
          setGlowZone(item.zone_key)
          if (promptLevel === 'partial' && !hintUsed) setHintUsed(true)
          say(pickLine(SORT_BASKET_LINES.assistFor, lang, ZONE_NAME(zoneOf(item.zone_key))), 'idea')
        } else {
          setPose('thinking')
        }
      }, 1100)
    }
  }

  const useHint = () => {
    if (locked || paused || promptLevel === 'none' || !item) return
    setHintUsed(true)
    setGlowZone(item.zone_key)
    loggerRef.current.log('hint_used', {})
    say(`${item.text || ''} ${ZONE_NAME(zoneOf(item.zone_key))} basket!`.trim(), 'idea')
  }

  // Take back the last finished item in this level (never crosses a level).
  const undo = () => {
    if (locked || paused || current === 0) return
    clearTimeout(timerRef.current)
    setAnswers((a) => a.slice(0, -1))
    setCurrent((c) => c - 1)
  }

  const readBaskets = () => {
    const text = zones.map((z) => `${ZONE_NAME(z)} basket: ${(ZONE_USE[z.zone_key]?.phrase || ZONE_NAME(z)).toLowerCase()}.`).join(' ')
    say(text, 'point', { speak: true })
  }

  const togglePause = () => {
    if (!paused) {
      pausedAtRef.current = Date.now()
      stopPaoVoice(); clearTimeout(timerRef.current)
      setPaused(true)
    } else {
      if (pausedAtRef.current) startedAtRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
      setPaused(false)
      if (locked && flash?.type === 'correct') timerRef.current = setTimeout(advance, 600)
      else if (locked) { setFlash(null); setLocked(false) }
    }
  }

  const startNextLevel = () => {
    setLevelIdx((i) => i + 1)
    setCurrent(0)
    setPhase('play')
  }

  const recordFinish = () => gameSession.finish({
    correct: score,
    attempts: answers.reduce((n, a) => n + a.attempts, 0),
    hints_used: answers.filter((a) => a.hintUsed).length,
    stars: score,
    detail: {
      wrongTries: wrongTotalRef.current,
      levels: levels.length,
      answers: answers.map(({ level, item, chosenZone, correct, attempts, hintUsed, timeMs }) => ({ level, item, chosenZone, correct, attempts, hintUsed, timeMs })),
    },
  })

  const handleReplay = () => {
    stopPaoVoice()
    setAnswers([]); setCurrent(0); setLevelIdx(0); setPhase('play'); setSessionKey((k) => k + 1)
    wrongTotalRef.current = 0
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    sessionEndedRef.current = false
  }

  const handleExit = () => { logExitOnce(); stopPaoVoice(); onExit() }

  if (phase === 'done') {
    return <FinishScreen score={score} total={totalItems} onReplay={handleReplay} onExit={handleExit} lang={lang} onRecord={recordFinish} />
  }

  const showHintBtn = promptLevel !== 'none'
  const progressDots = levels.flatMap((l) => l.items.map((_, i) => ({ l: l.level_order, i })))

  return (
    <div style={stage}>
      <style>{`
        @keyframes sbBob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes sbPop   { 0%{transform:scale(1)} 40%{transform:scale(1.07)} 100%{transform:scale(1)} }
        @keyframes sbShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-7px)} 75%{transform:translateX(7px)} }
        @keyframes sbDash  { to{stroke-dashoffset:-24} }
        .sb-basket:focus-visible, .sb-btn:focus-visible { outline: 4px solid #3B82F6; outline-offset: 2px }
        @media (prefers-reduced-motion: reduce){ *{animation:none !important} }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="sb-btn" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'} style={{ ...roundBtn, width: 62, height: 62 }}>
            <img src={`${ASSETS}/ui/icon-pause.svg`} alt="" width={28} height={28} />
          </button>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', opacity: .75 }}>Cognitive · Sorting</div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
              {game.name} <span style={{ fontSize: 13, background: '#2DB36A', borderRadius: 14, padding: '3px 11px', verticalAlign: 'middle', textTransform: 'capitalize' }}>{game.difficulty || 'easy'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#2A1F80', borderRadius: 30, padding: '10px 20px' }} aria-label={`Item ${Math.min(answeredCount + 1, totalItems)} of ${totalItems}`}>
          <span style={{ fontWeight: 800, fontSize: 15, marginRight: 4 }}>Level {level.level_order} · {level.level_name}</span>
          {progressDots.map((d, idx) => (
            <span key={idx} style={{ width: 13, height: 13, borderRadius: '50%', background: idx < answeredCount ? '#2DB36A' : idx === answeredCount ? '#FFC93C' : '#5B4BC4', boxShadow: idx === answeredCount ? '0 0 0 3px rgba(255,201,60,.35)' : 'none' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ ...pill, minWidth: 100, justifyContent: 'center' }}><img src={`${ASSETS}/ui/icon-star.svg`} alt="" width={26} height={26} /> <b style={{ fontSize: 22 }}>{score}</b></div>
          <button className="sb-btn" onClick={() => { setReadAloud((v) => !v); stopPaoVoice() }} aria-pressed={readAloud} aria-label="Read aloud" style={{ ...roundBtn, width: 62, height: 62, opacity: readAloud ? 1 : .5 }}>
            <img src={`${ASSETS}/ui/icon-speaker.svg`} alt="" width={30} height={30} />
          </button>
        </div>
      </div>

      {/* ── Game content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '4px 20px 12px', overflowY: 'auto' }}>
        {phase === 'levelDone' ? (
          <div style={{ ...card, flexDirection: 'column', textAlign: 'center', padding: '28px 36px', gap: 14 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#2B2366' }}>Level {level.level_order} done!</div>
            <div style={{ fontSize: 18, color: '#5A5670', fontWeight: 700 }}>Next up: {levels[levelIdx + 1].level_name}</div>
            <button className="sb-btn" onClick={startNextLevel} style={{ ...yellowBtn, height: 60, fontSize: 20, padding: '0 36px' }}>Next level</button>
          </div>
        ) : (
          <>
            {/* The item to sort */}
            <div
              draggable={!locked && !paused}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', 'item')}
              style={{ ...card, cursor: locked ? 'default' : 'grab', width: 'min(910px, 100%)', boxSizing: 'border-box' }}
            >
              <div style={{ width: 300, maxWidth: '38%', aspectRatio: '1', borderRadius: 18, background: 'linear-gradient(#CDEBFA 60%, #A2D98A 60%)', border: '4px solid #F2DDB0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img key={`${levelIdx}-${current}`} src={item.image_url} alt={item.label} draggable={false} style={{ width: '70%', height: '70%', objectFit: 'contain', animation: flash?.type === 'wrong' ? 'sbShake .45s' : 'sbBob 2.4s ease-in-out infinite' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: '#5B3FD0' }}>Look at the picture. Which basket does it go in?</div>
                <div style={{ fontSize: 'clamp(34px, 6vw, 62px)', fontWeight: 900, color: '#25222F', lineHeight: 1.05 }}>{item.label}</div>
                <button className="sb-btn" onClick={() => say(itemSpeech(), 'listen')} style={{ ...softBtn, background: '#6D4AE0', color: '#fff', alignSelf: 'flex-start', height: 48 }}>
                  <img src={`${ASSETS}/ui/icon-speaker.svg`} alt="" width={20} height={20} style={{ filter: 'brightness(0) invert(1)' }} /> Hear the word
                </button>
              </div>
            </div>

            {/* Baskets */}
            <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 36px)', justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label="Baskets">
              {zones.map((z) => {
                const use = ZONE_USE[z.zone_key]
                const glow = glowZone === z.zone_key
                const f = flash?.zone === z.zone_key ? flash.type : null
                return (
                  <button
                    key={z.zone_key}
                    className="sb-basket"
                    onClick={() => pickZone(z.zone_key)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); pickZone(z.zone_key) }}
                    aria-label={`${z.label}${use ? `: ${use.legend}` : ''}`}
                    style={{
                      position: 'relative', width: 250, maxWidth: '30vw', minWidth: 150, minHeight: 230, border: 'none', borderRadius: 20,
                      background: BASKET_TINT[z.zone_key] || '#fff', cursor: 'pointer', padding: '14px 8px 12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                      boxShadow: `0 8px 0 ${z.color || '#999'}`,
                      outline: glow ? '5px dashed #FFC93C' : outlines ? `3px dashed ${z.color}55` : 'none', outlineOffset: 6,
                      animation: f === 'correct' ? 'sbPop .45s' : f === 'wrong' ? 'sbShake .4s' : 'none',
                    }}
                  >
                    <img src={BASKET(z.zone_key)} alt="" draggable={false} style={{ width: '82%', height: 'auto' }} onError={(e) => { e.currentTarget.src = `${ASSETS}/baskets/basket-empty.svg` }} />
                    <span style={{ fontSize: 34, fontWeight: 900, color: BASKET_TEXT[z.zone_key] || '#2B2366' }}>{ZONE_NAME(z)}</span>
                    {glow && <span aria-hidden="true" style={{ position: 'absolute', top: -14, right: -8, background: '#FFC93C', color: '#2B2366', borderRadius: 14, padding: '2px 10px', fontSize: 14, fontWeight: 900 }}>Here!</span>}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
              {zones.map((z) => (
                <span key={z.zone_key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: z.color }} />{ZONE_USE[z.zone_key]?.legend || ZONE_NAME(z)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Pao bar ── */}
      <div style={{ flexShrink: 0, borderTop: '4px solid #FFC93C', background: '#2A1F80', display: 'flex', alignItems: 'flex-end', gap: 14, padding: '0 20px 12px', flexWrap: 'wrap', minHeight: 140 }}>
        <img src={PAO(pose)} alt="Pao the panda" width={150} height={150} style={{ marginTop: -56, flexShrink: 0, animation: 'sbBob 3s ease-in-out infinite' }} />
        <div role="status" aria-live="polite" style={{ flex: '1 1 260px', alignSelf: 'center', background: '#fff', color: '#25222F', borderRadius: '18px 18px 18px 4px', padding: '14px 20px', fontSize: 22, fontWeight: 800, lineHeight: 1.35, maxWidth: 720 }}>
          {line || 'Hi! I am Pao.'}
        </div>
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignSelf: 'center', flexWrap: 'wrap' }}>
          <button className="sb-btn" onClick={readBaskets} style={softBtn}><img src={`${ASSETS}/ui/icon-speaker.svg`} alt="" width={18} height={18} /> Read baskets</button>
          <button className="sb-btn" onClick={undo} disabled={current === 0 || phase !== 'play'} style={{ ...softBtn, opacity: current === 0 || phase !== 'play' ? .5 : 1 }}><img src={`${ASSETS}/ui/icon-undo.svg`} alt="" width={18} height={18} /> Undo</button>
          {showHintBtn && <button className="sb-btn" onClick={useHint} disabled={phase !== 'play'} style={yellowBtn}><img src={`${ASSETS}/ui/icon-hint.svg`} alt="" width={18} height={18} /> Hint</button>}
        </div>
      </div>

      {/* ── Pause overlay ── */}
      {paused && (
        <div role="dialog" aria-label="Paused" style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,70,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5 }}>
          <img src={PAO('sleepy')} alt="" width={160} height={160} />
          <div style={{ fontSize: 34, fontWeight: 900 }}>Rest time</div>
          <button className="sb-btn" onClick={togglePause} style={{ ...yellowBtn, height: 60, fontSize: 20, padding: '0 40px' }}>Keep playing</button>
          <button className="sb-btn" onClick={handleExit} style={softBtn}>← All Games</button>
        </div>
      )}
    </div>
  )
}

const stage = {
  position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden',
  background: 'radial-gradient(circle at 20% 15%, rgba(255,255,255,.07) 0 2px, transparent 3px) 0 0/90px 90px, #4A35C8',
  fontFamily: "'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif",
}
const card = { display: 'flex', alignItems: 'center', gap: 28, background: '#FFF7EA', color: '#25222F', borderRadius: 24, padding: 22, boxShadow: '0 6px 0 rgba(0,0,0,.15)' }
const pill = { display: 'flex', alignItems: 'center', gap: 8, height: 62, background: '#3A2AA6', border: '2px solid rgba(255,255,255,.18)', borderRadius: 20, padding: '0 16px', color: '#fff' }
const roundBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3A2AA6', border: '2px solid rgba(255,255,255,.18)', borderRadius: 20, cursor: 'pointer' }
const softBtn = { display: 'flex', alignItems: 'center', gap: 8, height: 54, padding: '0 22px', background: '#C9BFF5', color: '#3B2A9A', border: 'none', borderRadius: 18, fontSize: 18, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' }
const yellowBtn = { ...softBtn, background: '#FFC93C', color: '#2B2366' }
const topBtnStyle = { background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 12, padding: '10px 20px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }
