import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger, getPointerPressure } from '../../utils/gameplayLogger'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'

// ─── Puzzle Pals ───────────────────────────────────────────────────────────────
//
// Inspired by classic wooden inset puzzles: label the shape and colour of
// each piece ("Square!" "Blue piece!"), practice positional words while
// placing them ("on top", "next to", "under"), and frame every placement as
// something Pao and the child solve together ("Let's find this one
// together!"). Three pieces, three positional relationships, one small
// board — enough to build spatial vocabulary without overwhelming.

const ANIMAL_POOL = [
  { id: 'lion',     name: 'Lion',     emoji: '🦁', color: '#f59e0b', colorName: 'Orange' },
  { id: 'zebra',    name: 'Zebra',    emoji: '🦓', color: '#374151', colorName: 'Black and White' },
  { id: 'elephant', name: 'Elephant', emoji: '🐘', color: '#3b82f6', colorName: 'Blue' },
  { id: 'giraffe',  name: 'Giraffe',  emoji: '🦒', color: '#eab308', colorName: 'Yellow' },
  { id: 'bear',     name: 'Bear',     emoji: '🐻', color: '#92400e', colorName: 'Brown' },
]

// Board is a 2x2 grid — 'top' sits above 'under', and 'under' sits beside
// 'nextTo' — so every placement teaches a real spatial relationship to the
// piece placed right before it.
const STEP_ORDER = ['top', 'under', 'nextTo']
const POSITION_WORD = { top: 'on top', under: 'under', nextTo: 'next to' }

const NUDGE_LINES = [
  'Hmm, not quite! Let us look again!',
  'Almost! Try another piece!',
  'That is a different friend! Keep looking together!',
  'Good try! Let us find the right one!',
]

const FINISH_LINE = `Wow, you finished the whole puzzle! You are such a great problem solver! High five!`

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function praiseFor(animal, stepKey) {
  const word = POSITION_WORD[stepKey]
  return pick([
    `Yay! ${animal.colorName} ${animal.name}! Right ${word}!`,
    `Ta-da! You found the ${animal.colorName} square piece! It goes ${word}!`,
    `Amazing teamwork! That piece fits right ${word}!`,
    `Yes! ${animal.name} piece, ${animal.colorName} and square, right ${word}!`,
  ])
}

function promptFor(stepKey, animal, refAnimal) {
  if (stepKey === 'top') {
    return `Let's find this one together! Look for the ${animal.colorName} ${animal.name} piece — it goes right ON TOP!`
  }
  if (stepKey === 'under') {
    return `Now let's find the ${animal.colorName} ${animal.name}! This piece goes right UNDER the ${refAnimal.name}!`
  }
  return `Last piece! Find the ${animal.colorName} ${animal.name} — it goes right NEXT TO the ${refAnimal.name}!`
}

// ─── Puzzle slot — the dashed outline a piece snaps into ──────────────────────

function PuzzleSlot({ animal, filled, justFilled }) {
  const tint = filled ? `${animal.color}2a` : 'rgba(255,255,255,.04)'
  const border = filled ? animal.color : `${animal.color}70`
  return (
    <div style={{
      position: 'relative', width: 96, height: 96, borderRadius: 16,
      border: `3px dashed ${border}`, background: tint,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background .3s, border-color .3s',
      animation: justFilled ? 'pzSlotPop .5s cubic-bezier(.34,1.56,.64,1)' : 'none',
    }}>
      <div style={{
        position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
        width: 26, height: 26, borderRadius: '50%', border: `3px dashed ${border}`, background: tint,
      }}/>
      <span style={{ fontSize: 42, opacity: filled ? 1 : 0.16, filter: filled ? 'none' : 'grayscale(1)' }}>
        {animal.emoji}
      </span>
      {!filled && (
        <span style={{ position: 'absolute', bottom: 5, fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: .4, textTransform: 'uppercase' }}>
          Square
        </span>
      )}
    </div>
  )
}

// ─── Tray piece — the tappable puzzle piece waiting to be placed ─────────────

function TrayPiece({ animal, onTap, shake }) {
  return (
    <button
      onClick={onTap}
      aria-label={`${animal.colorName} ${animal.name} puzzle piece`}
      style={{
        position: 'relative', width: 84, height: 84, borderRadius: 16, border: 'none', cursor: 'pointer',
        background: animal.color, boxShadow: `0 8px 18px ${animal.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: shake ? 'pzShake .45s ease' : 'pzPieceBob 2.6s ease-in-out infinite',
      }}
    >
      <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', width: 22, height: 22, borderRadius: '50%', background: animal.color }}/>
      <span style={{ fontSize: 38 }}>{animal.emoji}</span>
    </button>
  )
}

// ─── Puzzle Pro badge ──────────────────────────────────────────────────────────

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

function FinishScreen({ onReplay, onExit }) {
  const [talking, setTalking]     = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const [badgeShown, setBadgeShown] = useState(false)
  const mouthRef = useRef(null)

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
    const t = setTimeout(() => {
      setBadgeShown(true)
      speakPao(FINISH_LINE, { onStart: () => setTalking(true), onEnd: () => setTalking(false) })
    }, 500)
    return () => { clearTimeout(t); stopPaoVoice() }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'hidden' }}>
      <style>{`
        @keyframes pzFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pzBadgePop { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes pzFadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ animation: 'pzFloat 2.5s ease-in-out infinite' }}>
        <PandaMascot entered={true} mouthOpen={mouthOpen} pandaState="excited" pxWidth={150}/>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 34 }}><span>⭐</span><span>⭐</span><span>⭐</span></div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, textAlign: 'center' }}>Puzzle complete!</h1>
      {badgeShown && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'pzFadeUp .5s both', background: 'rgba(52,211,153,.08)', border: '2px solid rgba(52,211,153,.3)', borderRadius: 24, padding: '16px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(110,231,183,.8)', letterSpacing: 1.5, textTransform: 'uppercase' }}>🎉 Badge Earned!</div>
          <PuzzleBadge animate={true}/>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#6ee7b7' }}>Puzzle Pro</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Unlocks new Customize items for Pao!</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onReplay} style={{ background: '#34d399', border: 'none', color: '#062e21', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Play Again 🧩</button>
        <button onClick={onExit} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function PuzzlePiecesGame({ onExit, patientId = 'alvrin', exerciseId = 'puzzle-pieces', domain = 'Cognitive' }) {
  const buildRound = () => {
    const picks = shuffle(ANIMAL_POOL).slice(0, 3)
    return STEP_ORDER.reduce((acc, step, i) => ({ ...acc, [step]: picks[i] }), {})
  }

  const [round, setRound]           = useState(buildRound)
  const [stepIndex, setStepIndex]   = useState(0)
  const [placed, setPlaced]         = useState([])
  const [locked, setLocked]         = useState(false)
  const [tray, setTray]             = useState([])
  const [justFilled, setJustFilled] = useState(null)
  const [shakeId, setShakeId]       = useState(null)
  const [talking, setTalking]       = useState(false)
  const [mouthOpen, setMouthOpen]   = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [done, setDone]             = useState(false)

  const mouthRef = useRef(null)
  const shakeTimerRef = useRef(null)
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

  const speak = (text) => {
    setDisplayText('')
    speakPao(text, {
      pitch: 1.62, rate: 1.08,
      onStart: () => setTalking(true),
      onEnd:   () => setTalking(false),
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  // Set up tray + intro prompt whenever a new round starts.
  useEffect(() => {
    setTray(shuffle(STEP_ORDER.map(step => round[step])))
    const stepKey = STEP_ORDER[0]
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    const t = setTimeout(() => speak(promptFor(stepKey, round[stepKey])), 500)
    return () => clearTimeout(t)
  }, [round]) // eslint-disable-line

  const currentStepKey = STEP_ORDER[stepIndex]
  const currentTarget  = round[currentStepKey]

  const handlePieceTap = (animal, e) => {
    if (locked) return
    const isCorrect = animal.id === currentTarget.id
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect, inputMethod: 'tap', touchPressure: getPointerPressure(e) })

    if (!isCorrect) {
      setShakeId(animal.id)
      clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => setShakeId(null), 450)
      speak(pick(NUDGE_LINES))
      return
    }

    // Fill the slot immediately — only the next prompt's narration waits.
    setTray(prev => prev.filter(a => a.id !== animal.id))
    setPlaced(prev => [...prev, currentStepKey])
    setJustFilled(currentStepKey)
    setLocked(true)
    speak(praiseFor(animal, currentStepKey))
    loggerRef.current.log('praise_shown', {})

    const nextIndex = stepIndex + 1
    setStepIndex(nextIndex)
    setTimeout(() => {
      if (nextIndex >= STEP_ORDER.length) {
        logExitOnce()
        setTimeout(() => setDone(true), 1400)
        return
      }
      setLocked(false)
      const nextKey = STEP_ORDER[nextIndex]
      const refKey  = nextKey === 'under' ? 'top' : 'under'
      promptShownAtRef.current = Date.now()
      loggerRef.current.log('prompt_shown', {})
      speak(promptFor(nextKey, round[nextKey], round[refKey]))
    }, 1600)
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

  if (done) return <FinishScreen onReplay={handleReplay} onExit={handleExit}/>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes pzFloat     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pzPieceBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pzShake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes pzSlotPop   { 0%{transform:scale(.7)} 60%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes pzSoundWave { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes pzCursor    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pzFadeIn    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pzSlideIn   { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.35)', borderRadius: 20, padding: '5px 13px' }}>
            🧩 Puzzle Pals
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEP_ORDER.map((s, i) => (
              <div key={s} style={{ width: 11, height: 11, borderRadius: '50%', background: i < stepIndex ? '#34d399' : i === stepIndex ? '#fbbf24' : 'rgba(255,255,255,.18)', boxShadow: i === stepIndex ? '0 0 8px #fbbf24' : 'none' }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 20px 8px' }}>
        {/* Board — 2x2 grid: top-right slot, then under + next-to on the bottom row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 96px)', gridTemplateRows: 'repeat(2, 96px)', gap: 16 }}>
          <div/>
          <PuzzleSlot animal={round.top} filled={placed.includes('top')} justFilled={justFilled === 'top'}/>
          <PuzzleSlot animal={round.nextTo} filled={placed.includes('nextTo')} justFilled={justFilled === 'nextTo'}/>
          <PuzzleSlot animal={round.under} filled={placed.includes('under')} justFilled={justFilled === 'under'}/>
        </div>

        {/* Tray of unplaced pieces */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', minHeight: 84 }}>
          {tray.map(animal => (
            <TrayPiece key={animal.id} animal={animal} shake={shakeId === animal.id} onTap={(e) => handlePieceTap(animal, e)}/>
          ))}
        </div>
      </div>

      {/* Pao speech bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '10px 18px 14px', flexShrink: 0, background: 'rgba(255,255,255,.03)', borderTop: '1px solid rgba(255,255,255,.07)', animation: 'pzFadeIn .5s ease' }}>
        <div style={{ animation: 'pzFloat 3s ease-in-out infinite', flexShrink: 0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={110} pandaState="happy"/>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.13)', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', minHeight: 64, maxHeight: 90, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0, .1, .06, .16, .03, .12].map((d, i) => (
                <div key={i} style={{ width: 3, height: 18, borderRadius: 4, background: 'rgba(52,211,153,.85)', animation: `pzSoundWave .55s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, color: 'rgba(255,255,255,.92)' }}>
            {displayText
              ? <>{displayText}{talking && <span style={{ animation: 'pzCursor .7s step-end infinite', marginLeft: 2, color: '#6ee7b7' }}>|</span>}</>
              : <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 13 }}>Pao is watching…</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
