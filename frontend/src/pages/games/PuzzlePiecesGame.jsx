import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import SunnyScenery from './SunnyScenery'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger, getPointerPressure } from '../../utils/gameplayLogger'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { PUZZLE_LINES, PUZZLE_COLOR_NAMES, pickLine, pickRandomLine } from '../../utils/paoLines'
import { fetchGameBadge } from '../../utils/gameProgress'
import { useGameSession } from '../../hooks/useGameSession'
import { buildPuzzleRound, SHAPE_NAMES, SHAPE_FACTS, LEVELS } from '../../data/puzzlePals'
import { PuzzlePiece, PuzzleHole } from './PuzzleShapes'
import { HandIcon, ArrowUpIcon, ArrowDownIcon, ArrowRightIcon } from '../../components/icons/SpeechIcons'
import BadgeMedal from '../../components/BadgeMedal'
import PaoLayered from '../../components/pao/PaoLayered'
import { usePaoGameReactions } from '../../components/pao/usePaoGameReactions'

const INSTRUCTION_EVENT = { top: 'instruction_on_top', under: 'instruction_under', nextTo: 'instruction_next_to' }
function useReducedMotionPz() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

// ─── Puzzle Pals ───────────────────────────────────────────────────────────────
//
// A wooden inset puzzle: label the shape and colour of each piece, practice
// positional words while placing them ("on top", "under", "next to"), and
// frame every placement as something Pao and the child solve together.

// Board is a 2x2 grid — 'top' sits above 'under', and 'under' sits beside
// 'nextTo' — so every placement teaches a real spatial relationship to the
// piece placed right before it.
const STEP_ORDER = ['top', 'under', 'nextTo']

const POS_LABEL = { top: 'ON TOP', under: 'UNDER', nextTo: 'NEXT TO' }
const POS_ICON = { top: ArrowUpIcon, under: ArrowDownIcon, nextTo: ArrowRightIcon }
const POS_ARROW = { top: '↑', under: '↓', nextTo: '→' }

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function localColor(item, lang) {
  return pickLine(PUZZLE_COLOR_NAMES[item.colorName] || { en: item.colorName, tl: item.colorName, ceb: item.colorName }, lang)
}
function localName(item, lang) {
  return item.names?.[lang] || item.names?.en || item.name
}
function shapeName(item, lang) {
  const n = SHAPE_NAMES[item.shape]
  return n ? (n[lang] || n.en) : item.shape
}

// ─── Small building blocks for the "Find this piece" line + tray chips ───────

function ItemChip({ item, lang }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: item.color, color: '#fff', borderRadius: 999, padding: '4px 13px 4px 9px', fontWeight: 900, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 18 }}>{item.emoji}</span>{localColor(item, lang)} {localName(item, lang)}
    </span>
  )
}

function PositionChip({ stepKey }) {
  const Icon = POS_ICON[stepKey]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fbbf24', color: '#78350f', borderRadius: 999, padding: '4px 12px', fontWeight: 900, whiteSpace: 'nowrap' }}>
      <Icon size={13}/> {POS_LABEL[stepKey]}
    </span>
  )
}

function ColorDot({ color }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }}/>
}

// Builds the highlighted "Find this piece" sentence from the round's data —
// not by searching the spoken audio string, which stays fully translated
// and independent (see PUZZLE_LINES.promptFor).
const FIND_INTRO = {
  top:    { en: 'Look for the', tl: 'Hanapin ang', ceb: 'Pangitaa ang' },
  under:  { en: 'Now find the', tl: 'Ngayon hanapin ang', ceb: 'Karon pangitaa ang' },
  nextTo: { en: 'Find the', tl: 'Hanapin ang', ceb: 'Pangitaa ang' },
}
const FIND_GOES = { en: 'goes', tl: 'ay nasa', ceb: 'naa sa' }
const FIND_THE = { en: 'the', tl: 'ng', ceb: 'sa' }

function findPieceLine({ item, refItem, stepKey, lang }) {
  const trailing = stepKey === 'top' ? (pickLine({ en: 'on top', tl: 'sa taas', ceb: 'sa taas' }, lang)) : null
  return (
    <>
      {pickLine(FIND_INTRO[stepKey], lang)} <ItemChip item={item} lang={lang}/> · <b style={{ color: '#b45309' }}>{shapeName(item, lang)}</b> →{' '}
      {pickLine(FIND_GOES, lang)} <PositionChip stepKey={stepKey}/>{' '}
      {trailing ? trailing : <>{pickLine(FIND_THE, lang)} <ItemChip item={refItem} lang={lang}/></>}
    </>
  )
}

// ─── Puzzle Pro badge (fallback if the real badge hasn't loaded yet) ──────────

function PuzzleBadge({ animate = false }) {
  return (
    <div style={{
      width: 100, height: 100, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #34d399 0%, #059669 60%, #064e3b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
      border: '4px solid #6ee7b7', boxShadow: '0 0 22px rgba(52,211,153,.55)',
      animation: animate ? 'pzBadgePop .7s cubic-bezier(.34,1.56,.64,1) both' : 'none',
    }}>
      🧩
    </div>
  )
}

// ─── Finish screen ────────────────────────────────────────────────────────────

const CONFETTI = ['🎉', '⭐', '🧩', '🎊', '✨']

function FinishScreen({ onReplay, onExit, lang = 'en', onRecord, round }) {
  const [talking, setTalking]     = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const [badgeShown, setBadgeShown] = useState(false)
  const [realBadge, setRealBadge] = useState(null)
  const mouthRef = useRef(null)
  const confetti = useRef(Array.from({ length: 16 }, (_, i) => ({
    emoji: CONFETTI[i % CONFETTI.length], left: Math.random() * 100, delay: Math.random() * 2, dur: 3 + Math.random() * 2,
  }))).current

  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 160)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => {
    try {
      const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
      if (!earned.includes('Puzzle Pro')) {
        localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Puzzle Pro']))
      }
    } catch {}
    onRecord?.()
    fetchGameBadge('Puzzle Pals').then(setRealBadge)
    const t = setTimeout(() => {
      setBadgeShown(true)
      speakPao(pickLine(PUZZLE_LINES.finishLine, lang), { onStart: () => setTalking(true), onEnd: () => setTalking(false) })
    }, 500)
    return () => { clearTimeout(t); stopPaoVoice() }
  }, []) // eslint-disable-line

  const board = round?.board

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, fontFamily: "'Segoe UI',system-ui,sans-serif", color: '#3a2e6b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <SunnyScenery/>
      <style>{`
        @keyframes gfSunPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes gfCloudDrift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(14px)} }
        @keyframes pzFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pzBadgePop { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes pzFadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pzConfetti { from{transform:translateY(-10vh) rotate(0)} to{transform:translateY(110vh) rotate(360deg)} }
      `}</style>

      {confetti.map((c, i) => (
        <span key={i} style={{ position: 'absolute', top: 0, left: `${c.left}%`, fontSize: 26, animation: `pzConfetti ${c.dur}s linear ${c.delay}s infinite`, pointerEvents: 'none' }}>{c.emoji}</span>
      ))}

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 70, flexWrap: 'wrap', justifyContent: 'center', padding: '0 24px' }}>
        {/* Left: finished board + Pao */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          {board && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,96px)', gridTemplateRows: 'repeat(2,96px)', gap: 14 }}>
              <div/>
              <PuzzlePiece item={board.top} size={96}/>
              <PuzzlePiece item={board.nextTo} size={96}/>
              <PuzzlePiece item={board.under} size={96}/>
            </div>
          )}
          <div style={{ animation: 'pzFloat 2.5s ease-in-out infinite' }}>
            <PandaMascot entered={true} mouthOpen={mouthOpen} pandaState="excited" pxWidth={150}/>
          </div>
        </div>

        {/* Right: result card */}
        <div style={{ background: '#fff', borderRadius: 32, padding: '36px 40px', maxWidth: 380, boxShadow: '0 24px 64px rgba(80,60,20,.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, fontSize: 34 }}><span>⭐</span><span>⭐</span><span>⭐</span></div>
          <h1 style={{ fontSize: 40, fontWeight: 900, margin: '6px 0 0', textAlign: 'center', color: '#1e1b4b' }}>Puzzle complete!</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(58,46,107,.65)', fontWeight: 600, textAlign: 'center' }}>You fixed the whole picture with Pao</p>

          {badgeShown && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'pzFadeUp .5s both', background: 'rgba(52,211,153,.08)', border: '2px solid rgba(52,211,153,.3)', borderRadius: 24, padding: '16px 32px', marginTop: 8 }}>
              {realBadge ? <BadgeMedal shape={realBadge.shape} colour={realBadge.colour} symbol={realBadge.symbol} size={90} /> : <PuzzleBadge animate={true}/>}
              <div style={{ fontSize: 18, fontWeight: 900, color: '#047857' }}>{realBadge ? realBadge.name : 'Puzzle Pro'}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309' }}>+100 XP</div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            {STEP_ORDER.map((s) => (
              <span key={s} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800 }}>
                {POS_ARROW[s]} {POS_LABEL[s].toLowerCase()}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button onClick={onReplay} style={{ background: '#22c55e', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 26px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Play Again 🧩</button>
            <button onClick={onExit} style={{ background: '#e2e8f0', border: 'none', color: '#334155', borderRadius: 14, padding: '13px 26px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Board cell — a hole (or its filled piece) with a hanging position pill ──

function BoardCell({ cellRef, stepKey, item, filled, justFilled, isCurrent, hintOn }) {
  return (
    <div ref={cellRef} style={{ position: 'relative', width: 170, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {filled
        ? <span style={{ display: 'inline-flex', animation: justFilled ? 'pzSlotPop .5s cubic-bezier(.34,1.56,.64,1)' : 'none' }}><PuzzlePiece item={item} size={170}/></span>
        : <PuzzleHole item={item} size={170} target={isCurrent && hintOn}/>
      }
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
        padding: '4px 13px', borderRadius: 999, fontSize: 13, fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap',
        background: isCurrent ? '#fbbf24' : '#7c4a1e', color: isCurrent ? '#78350f' : '#ffe9c7',
        boxShadow: isCurrent ? '0 0 0 4px rgba(251,191,36,.35)' : 'none',
      }}>
        {POS_ARROW[stepKey]} {POS_LABEL[stepKey]}
      </span>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function PuzzlePiecesGame({ onExit, patientId = 'alvrin', patientEmail = null, exerciseId = 'puzzle-pieces', domain = 'Cognitive', lang = 'en', setId = 'animals', level = 'easy' }) {
  const gameSession = useGameSession({ gameName: 'Puzzle Pals' })
  const reducedMotion = useReducedMotionPz()
  const paoGame = usePaoGameReactions('puzzle-pals', { calm: reducedMotion, readAloud: false })
  const streakRef = useRef(0)
  const tallyRef = useRef({ wrong: 0, hints: 0 })
  const recordFinish = () => gameSession.finish({
    correct: STEP_ORDER.length,
    attempts: STEP_ORDER.length + tallyRef.current.wrong,
    hints_used: tallyRef.current.hints,
    stars: STEP_ORDER.length,
    detail: { setId, level },
  })
  const buildRound = () => buildPuzzleRound(setId, level)

  const [round, setRound]           = useState(buildRound)
  const [stepIndex, setStepIndex]   = useState(0)
  const [placed, setPlaced]         = useState([])
  const [locked, setLocked]         = useState(false)
  const [tray, setTray]             = useState([])
  const [justFilled, setJustFilled] = useState(null)
  const [shakeId, setShakeId]       = useState(null)
  const [missCount, setMissCount]   = useState(0)
  const [hint, setHint]             = useState(false)
  const [talking, setTalking]       = useState(false)
  const [mouthOpen, setMouthOpen]   = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [promptNode, setPromptNode] = useState(null) // highlighted "Find this piece" content for the current prompt
  const [drag, setDrag]             = useState(null) // { item, pointerId, x, y, offsetX, offsetY }
  const [done, setDone]             = useState(false)

  const mouthRef = useRef(null)
  const shakeTimerRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const topRef = useRef(null)
  const underRef = useRef(null)
  const nextToRef = useRef(null)
  const { submitEventBatch } = useAnalytics()
  const sessionIdRef     = useRef(createSessionId())
  const loggerRef        = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))
  const promptShownAtRef = useRef(null)
  const sessionEndedRef  = useRef(false)

  const logExitOnce = () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    loggerRef.current.log('exit', {})
  }

  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 160)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => () => {
    clearInterval(mouthRef.current)
    clearTimeout(shakeTimerRef.current)
    stopPaoVoice()
    logExitOnce()
  }, []) // eslint-disable-line

  // Plain spoken line — nudges, hints, and the finish cheer. Keeps the
  // existing word-by-word typing effect via onWord.
  const speak = (text) => {
    setPromptNode(null)
    setDisplayText('')
    speakPao(text, {
      pitch: 1.62, rate: 1.08,
      onStart: () => setTalking(true),
      onEnd:   () => setTalking(false),
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  // The prompt/praise line — spoken fully translated audio via PUZZLE_LINES,
  // but the visible bubble is built straight from the round's structured
  // data (item/shape/position), not by parsing the spoken string.
  const speakPrompt = (spokenText, node) => {
    setDisplayText('')
    setPromptNode(node)
    speakPao(spokenText, { pitch: 1.62, rate: 1.08, onStart: () => setTalking(true), onEnd: () => setTalking(false) })
  }

  // Set up tray + intro prompt whenever a new round starts.
  useEffect(() => {
    setTray(shuffle([round.board.top, round.board.under, round.board.nextTo, round.decoy].filter(Boolean)))
    setMissCount(0); setHint(false)
    const stepKey = STEP_ORDER[0]
    const item = round.board[stepKey]
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    streakRef.current = 0
    paoGame.react(INSTRUCTION_EVENT[stepKey])
    const t = setTimeout(() => {
      speakPrompt(pickLine(PUZZLE_LINES.promptFor, lang, stepKey, item), findPieceLine({ item, refItem: null, stepKey, lang }))
    }, 500)
    return () => clearTimeout(t)
  }, [round]) // eslint-disable-line

  const currentStepKey = STEP_ORDER[stepIndex]
  const currentTarget  = round.board[currentStepKey]
  const cellRefFor = { top: topRef, under: underRef, nextTo: nextToRef }

  const hitTestCell = (x, y) => {
    for (const key of ['top', 'under', 'nextTo']) {
      const el = cellRefFor[key].current
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key
    }
    return null
  }

  const handlePieceAnswer = (item, isCorrect, inputMethod, pressure) => {
    if (locked) return
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect, inputMethod, touchPressure: pressure })

    if (!isCorrect) {
      setShakeId(item.id)
      clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => setShakeId(null), 450)
      streakRef.current = 0
      paoGame.react('wrong')
      const nextMiss = missCount + 1
      tallyRef.current.wrong += 1
      if (nextMiss === 2) tallyRef.current.hints += 1
      setMissCount(nextMiss)
      if (nextMiss >= 2) {
        setHint(true)
        const refKey = currentStepKey === 'under' ? 'top' : currentStepKey === 'nextTo' ? 'under' : null
        speak(pickLine(PUZZLE_LINES.hint, lang, currentStepKey, currentTarget, refKey ? round.board[refKey] : null))
      } else {
        speak(pickRandomLine(PUZZLE_LINES.nudges, lang))
      }
      return
    }

    // Fill the slot immediately — only the next prompt's narration waits.
    streakRef.current += 1
    paoGame.react(streakRef.current > 0 && streakRef.current % 3 === 0 ? 'correct_streak' : 'correct')
    setMissCount(0); setHint(false)
    setTray(prev => prev.filter(a => a.id !== item.id))
    setPlaced(prev => [...prev, currentStepKey])
    setJustFilled(currentStepKey)
    setLocked(true)
    const praiseText = pickLine(PUZZLE_LINES.praiseFor, lang, item, currentStepKey)
    const factText = pickLine(SHAPE_FACTS[item.shape] || {}, lang) || ''
    speak(`${praiseText} ${factText}`.trim())
    loggerRef.current.log('praise_shown', {})

    const nextIndex = stepIndex + 1
    setStepIndex(nextIndex)
    setTimeout(() => {
      if (nextIndex >= STEP_ORDER.length) {
        logExitOnce()
        paoGame.react('finished', { hold: 0 })
        setTimeout(() => setDone(true), 1400)
        return
      }
      setLocked(false)
      const nextKey = STEP_ORDER[nextIndex]
      paoGame.react(INSTRUCTION_EVENT[nextKey])
      const refKey  = nextKey === 'under' ? 'top' : 'under'
      const nextItem = round.board[nextKey]
      const refItem = round.board[refKey]
      promptShownAtRef.current = Date.now()
      loggerRef.current.log('prompt_shown', {})
      speakPrompt(pickLine(PUZZLE_LINES.promptFor, lang, nextKey, nextItem, refItem), findPieceLine({ item: nextItem, refItem, stepKey: nextKey, lang }))
    }, 1600)
  }

  // ── Tap / drag handling (unified via Pointer Events) ─────────────────────────

  const handlePointerDown = (item) => (e) => {
    if (locked) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ item, pointerId: e.pointerId, x: e.clientX, y: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, width: rect.width, height: rect.height })
  }

  const handlePointerMove = (e) => {
    setDrag((d) => (d && d.pointerId === e.pointerId ? { ...d, x: e.clientX, y: e.clientY } : d))
  }

  const handlePointerUp = (e) => {
    setDrag((d) => {
      if (!d || d.pointerId !== e.pointerId) return d
      const moved = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y)
      const dropStepKey = hitTestCell(e.clientX, e.clientY)
      const pressure = getPointerPressure(e)
      if (dropStepKey) {
        const isCorrect = dropStepKey === currentStepKey && d.item.id === currentTarget.id
        handlePieceAnswer(d.item, isCorrect, 'drag', pressure)
      } else if (moved < 8) {
        handlePieceAnswer(d.item, d.item.id === currentTarget.id, 'tap', pressure)
      }
      return null
    })
  }

  const handlePointerCancel = () => setDrag(null)

  const handleKeyDown = (item) => (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (locked) return
    handlePieceAnswer(item, item.id === currentTarget.id, 'tap', null)
  }

  const handleReplay = () => {
    stopPaoVoice()
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    sessionEndedRef.current = false
    setStepIndex(0); setPlaced([]); setLocked(false); setJustFilled(null); setShakeId(null); setDone(false)
    setRound(buildRound())
  }

  const handleExit = () => {
    logExitOnce()
    stopPaoVoice()
    onExit()
  }

  if (done) return <FinishScreen onReplay={handleReplay} onExit={handleExit} lang={lang} round={round} onRecord={recordFinish}/>

  const levelMeta = LEVELS.find((l) => l.id === round.level) || LEVELS[0]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, fontFamily: "'Segoe UI',system-ui,sans-serif", color: '#3a2e6b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SunnyScenery/>
      <style>{`
        @keyframes gfSunPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes gfCloudDrift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(14px)} }
        @keyframes pzFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pzPieceBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pzShake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes pzSlotPop   { 0%{transform:scale(.7)} 60%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes pzPulse     { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes pzSoundWave { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes pzCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pzFadeIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .pz-top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 14px 22px; flex-shrink: 0; }
        .pz-main { position: relative; z-index: 2; flex: 1; min-height: 0; overflow-y: auto; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 56px; padding: 8px 24px 12px; }
        .pz-board { padding: 26px; border-radius: 30px; background: repeating-linear-gradient(95deg,rgba(120,70,30,.08) 0 3px,transparent 3px 22px), linear-gradient(160deg,#e9b877,#d49a57 60%,#c28545); box-shadow: inset 0 3px 0 rgba(255,255,255,.45), inset 0 -6px 0 rgba(120,70,30,.35), 0 12px 0 #9a6431, 0 30px 40px rgba(60,40,10,.28); }
        .pz-grid { display: grid; grid-template-columns: repeat(2, clamp(104px, 30vw, 170px)); grid-template-rows: repeat(2, clamp(104px, 30vw, 170px)); gap: clamp(12px, 3vw, 30px); }
        .pz-side { width: 560px; max-width: 100%; display: flex; flex-direction: column; gap: 18px; }
        .pz-tray { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; }
        @media (max-width: 760px) {
          .pz-main { flex-direction: column; flex-wrap: nowrap; gap: 14px; padding: 8px 12px; justify-content: flex-start; }
          .pz-board { padding: 14px; border-radius: 22px; }
          .pz-side { width: 100%; gap: 12px; }
          .pz-tray { gap: 12px; padding: 14px 10px !important; }
          .pz-top { padding: 10px 12px; }
        }
        .pz-bob { animation: pzPieceBob 2.6s ease-in-out infinite; }
        .pz-shake { animation: pzShake .45s ease; }
        @media (prefers-reduced-motion: reduce) {
          .pz-bob, .pz-shake { animation: none !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="pz-top" style={{ position: 'relative', zIndex: 2 }}>
        <button onClick={handleExit} style={{ background: 'rgba(255,255,255,.85)', border: '1.5px solid rgba(124,79,224,.25)', color: '#5b21b6', borderRadius: 12, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.85)', border: '1.5px solid rgba(16,185,129,.4)', color: '#065f46', borderRadius: 20, padding: '6px 14px' }}>
            🧩 Puzzle Pals
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEP_ORDER.map((s, i) => (
              <div key={s} style={{ width: 11, height: 11, borderRadius: '50%', background: i < stepIndex ? '#34d399' : i === stepIndex ? '#fbbf24' : 'rgba(58,46,107,.18)', boxShadow: i === stepIndex ? '0 0 8px #fbbf24' : 'none' }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pz-main">

        {/* Board */}
        <div className="pz-board">
          <div className="pz-grid">
            <div/>
            <BoardCell cellRef={topRef} stepKey="top" item={round.board.top} filled={placed.includes('top')} justFilled={justFilled === 'top'} isCurrent={currentStepKey === 'top'} hintOn={hint}/>
            <BoardCell cellRef={nextToRef} stepKey="nextTo" item={round.board.nextTo} filled={placed.includes('nextTo')} justFilled={justFilled === 'nextTo'} isCurrent={currentStepKey === 'nextTo'} hintOn={hint}/>
            <BoardCell cellRef={underRef} stepKey="under" item={round.board.under} filled={placed.includes('under')} justFilled={justFilled === 'under'} isCurrent={currentStepKey === 'under'} hintOn={hint}/>
          </div>
        </div>

        {/* Side column */}
        <div className="pz-side">

          {/* Find this piece */}
          <div style={{ background: 'rgba(255,255,255,.9)', border: '1.5px solid rgba(124,79,224,.18)', borderRadius: 20, padding: '18px 22px' }}>
            <div style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: 1, color: '#7c6aa6', textTransform: 'uppercase', marginBottom: 8 }}>
              Find this piece · {levelMeta.label.toUpperCase()} shapes
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {currentTarget && findPieceLine({ item: currentTarget, refItem: currentStepKey === 'top' ? null : round.board[currentStepKey === 'under' ? 'top' : 'under'], stepKey: currentStepKey, lang })}
            </div>
          </div>

          {/* Tray */}
          <div className="pz-tray" style={{ background: 'rgba(255,255,255,.7)', border: '2px dashed rgba(124,79,224,.25)', borderRadius: 24, padding: '22px 18px', minHeight: 150 }}>
            {tray.map((item) => {
              const isGlowing = hint && item.id === currentTarget.id
              const isShaking = shakeId === item.id
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${localColor(item, lang)} ${localName(item, lang)}, ${shapeName(item, lang)} piece`}
                  onPointerDown={handlePointerDown(item)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onKeyDown={handleKeyDown(item)}
                  style={{
                    touchAction: 'none', cursor: 'grab', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    opacity: drag?.item.id === item.id ? 0.25 : 1, outline: 'none',
                  }}
                  className={isShaking ? 'pz-shake' : 'pz-bob'}
                >
                  <PuzzlePiece item={item} size={120} glow={isGlowing}/>
                  <span style={{ background: '#fff', border: '1px solid rgba(124,79,224,.15)', borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 800, color: '#3a2e6b', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                    <ColorDot color={item.color}/>{localColor(item, lang)} {shapeName(item, lang)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Hint line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3a2e6b', opacity: .75, fontSize: 12.5, fontWeight: 700, justifyContent: 'center' }}>
            <HandIcon size={16}/> Drag a piece onto the board, or tap it
          </div>
        </div>
      </div>

      {/* Dragging piece overlay */}
      {drag && (
        <div style={{ position: 'fixed', left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, zIndex: 20, pointerEvents: 'none', transform: 'rotate(-6deg)' }}>
          <PuzzlePiece item={drag.item} size={drag.width || 120} lifted/>
        </div>
      )}

      {/* Pao speech bar */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', gap: 14, padding: '10px 18px 14px', flexShrink: 0, background: 'rgba(255,255,255,.35)', borderTop: '1px solid rgba(255,255,255,.7)', backdropFilter: 'blur(6px)', animation: 'pzFadeIn .5s ease' }}>
        <div style={{ animation: 'pzFloat 3s ease-in-out infinite', flexShrink: 0, overflow: 'visible' }}>
          <PaoLayered pose={paoGame.pose} showFx={paoGame.showFx} size={110} />
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.92)', border: '1px solid rgba(124,79,224,.18)', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', minHeight: 64, maxHeight: 90, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0, .1, .06, .16, .03, .12].map((d, i) => (
                <div key={i} style={{ width: 3, height: 18, borderRadius: 4, background: 'rgba(5,150,105,.75)', animation: `pzSoundWave .55s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize: promptNode ? 18 : 14, fontWeight: 600, lineHeight: 1.6, color: '#3a2e6b', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {promptNode
              ? promptNode
              : displayText
                ? <>{displayText}{talking && <span style={{ animation: 'pzCursor .7s step-end infinite', marginLeft: 2, color: '#059669' }}>|</span>}</>
                : <span style={{ color: 'rgba(58,46,107,.4)', fontStyle: 'italic', fontSize: 13 }}>Pao is watching…</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
