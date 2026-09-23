import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger, getPointerPressure } from '../../utils/gameplayLogger'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'
import { SORT_BASKET_LINES, pickLine, pickRandomLine } from '../../utils/paoLines'

// ─── Item pool by category ─────────────────────────────────────────────────────
// Categorisation is the skill being taught here — a shirt and socks belong
// together not because they look alike, but because they're both clothes.

const ITEMS_BY_CATEGORY = {
  food: [
    { label: 'Apple',  emoji: '🍎', article: 'an' },
    { label: 'Banana', emoji: '🍌', article: 'a'  },
    { label: 'Bread',  emoji: '🍞', article: 'a'  },
    { label: 'Milk',   emoji: '🥛', article: 'a'  },
    { label: 'Cookie', emoji: '🍪', article: 'a'  },
    { label: 'Pizza',  emoji: '🍕', article: 'a'  },
    { label: 'Egg',    emoji: '🥚', article: 'an' },
    { label: 'Carrot', emoji: '🥕', article: 'a'  },
  ],
  clothes: [
    { label: 'Shirt',  emoji: '👕', article: 'a' },
    { label: 'Hat',    emoji: '🧢', article: 'a' },
    { label: 'Shoe',   emoji: '👟', article: 'a' },
    { label: 'Jacket', emoji: '🧥', article: 'a' },
    { label: 'Glove',  emoji: '🧤', article: 'a' },
    { label: 'Sock',   emoji: '🧦', article: 'a' },
    { label: 'Scarf',  emoji: '🧣', article: 'a' },
    { label: 'Dress',  emoji: '👗', article: 'a' },
  ],
  toys: [
    { label: 'Teddy Bear', emoji: '🧸', article: 'a' },
    { label: 'Ball',       emoji: '⚽', article: 'a' },
    { label: 'Kite',       emoji: '🪁', article: 'a' },
    { label: 'Toy Car',    emoji: '🚗', article: 'a' },
    { label: 'Balloon',    emoji: '🎈', article: 'a' },
    { label: 'Puzzle',     emoji: '🧩', article: 'a' },
    { label: 'Robot',      emoji: '🤖', article: 'a' },
    { label: 'Drum',       emoji: '🥁', article: 'a' },
  ],
}

const BINS = [
  { id: 'food',    label: 'Food',    emoji: '🍽️', color: '#f59e0b' },
  { id: 'clothes', label: 'Clothes', emoji: '👕', color: '#6366f1' },
  { id: 'toys',    label: 'Toys',    emoji: '🧸', color: '#ec4899' },
]

const ITEMS_PER_CATEGORY_PER_SESSION = 3 // 3 x 3 categories = 9 items, ~2-3 min

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function buildSession() {
  const picks = Object.keys(ITEMS_BY_CATEGORY).flatMap((cat) =>
    shuffle(ITEMS_BY_CATEGORY[cat]).slice(0, ITEMS_PER_CATEGORY_PER_SESSION).map((item) => ({ ...item, category: cat })),
  )
  return shuffle(picks)
}

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

// ─── Basket Sorter badge ────────────────────────────────────────────────────────

function BasketBadge({ animate = false }) {
  return (
    <div style={{
      width: 100, height: 100, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fbbf24 0%, #d97706 60%, #78350f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
      border: '4px solid #fde68a', boxShadow: '0 0 22px rgba(251,191,36,.55)',
      animation: animate ? 'sbBadgePop .7s cubic-bezier(.34,1.56,.64,1) both' : 'none',
    }}>
      🧺
    </div>
  )
}

// ─── Finish screen ────────────────────────────────────────────────────────────

function FinishScreen({ score, total, onReplay, onExit, lang = 'en' }) {
  const pct      = score / total
  const stars    = pct >= 0.85 ? 3 : pct >= 0.55 ? 2 : 1
  const scoreMsg = pickLine(
    stars === 3 ? SORT_BASKET_LINES.finishStars3 : stars === 2 ? SORT_BASKET_LINES.finishStars2 : SORT_BASKET_LINES.finishStars1,
    lang,
  )

  const [badgeShown, setBadgeShown] = useState(false)
  const [talking,    setTalking]    = useState(false)
  const [mouthOpen,  setMouthOpen]  = useState(false)
  const mouthRef = useRef(null)

  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 160)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => {
    const speak = (text, onDone) => speakPao(text, {
      pitch: 1.62, rate: 1.08,
      onStart: () => setTalking(true),
      onEnd:   () => { setTalking(false); onDone?.() },
    })
    const t = setTimeout(() => {
      speak(`${pickLine(SORT_BASKET_LINES.scoreLine, lang, score, total)} ${scoreMsg}`, () => {
        setTimeout(() => {
          try {
            const earned = JSON.parse(localStorage.getItem('pao_badges') || '[]')
            if (!earned.includes('Basket Sorter')) {
              localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Basket Sorter']))
            }
          } catch {}
          setBadgeShown(true)
          speak(pickLine(SORT_BASKET_LINES.badgeScript, lang))
        }, 700)
      })
    }, 500)
    return () => { clearTimeout(t); stopPaoVoice() }
  }, []) // eslint-disable-line

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, overflow: 'hidden' }}>
      <style>{`
        @keyframes sbFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes sbBadgePop { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes sbFadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sbPop      { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }
      `}</style>
      <div style={{ animation: 'sbFloat 2.5s ease-in-out infinite' }}>
        <PandaMascot entered={true} mouthOpen={mouthOpen} pandaState="excited" pxWidth={150}/>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 34, animation: 'sbPop .6s .2s cubic-bezier(.34,1.56,.64,1) both' }}>
        {Array.from({ length: 3 }, (_, i) => <span key={i} style={{ opacity: i < stars ? 1 : .2, filter: i < stars ? 'none' : 'grayscale(1)' }}>⭐</span>)}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, textAlign: 'center' }}>{score} / {total} Sorted!</h1>
      {badgeShown && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'sbFadeUp .5s both', background: 'rgba(251,191,36,.08)', border: '2px solid rgba(251,191,36,.3)', borderRadius: 24, padding: '16px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(253,230,138,.8)', letterSpacing: 1.5, textTransform: 'uppercase' }}>🎉 Badge Earned!</div>
          <BasketBadge animate={true}/>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fde68a' }}>Basket Sorter</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Unlocks new Customize items for Pao!</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onReplay} style={{ background: '#f59e0b', border: 'none', color: '#3a2306', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Play Again 🧺</button>
        <button onClick={onExit} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function SortTheBasketGame({ onExit, patientId = 'alvrin', exerciseId = 'sort-basket', domain = 'Cognitive', lang = 'en' }) {
  const [items]        = useState(buildSession)
  const [current,      setCurrent]      = useState(0)
  const [wrongCount,   setWrongCount]   = useState(0)
  const [locked,       setLocked]       = useState(false)
  const [resultBinId,  setResultBinId]  = useState(null)
  const [resultType,   setResultType]   = useState(null) // 'correct' | 'wrong'
  const [itemAnim,     setItemAnim]     = useState('sbBob')
  const [score,        setScore]        = useState(0)
  const [done,         setDone]         = useState(false)

  const [talking,     setTalking]     = useState(false)
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [displayText, setDisplayText] = useState('')

  const mouthRef = useRef(null)
  const timerRef = useRef(null)

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
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 155)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    clearInterval(mouthRef.current)
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

  // New item → reset per-item state and prompt.
  useEffect(() => {
    if (!items[current]) return
    setWrongCount(0); setLocked(false); setResultBinId(null); setResultType(null); setItemAnim('sbBob')
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    const t = setTimeout(() => speak(pickLine(SORT_BASKET_LINES.prompt, lang)), 350)
    return () => clearTimeout(t)
  }, [current]) // eslint-disable-line

  const item = items[current]
  const assistMode = wrongCount >= 2

  const handleBinTap = (binId, touchPressure = null) => {
    if (locked || !item) return
    if (assistMode && binId !== item.category) return // errorless learning — wrong bins are inert

    const isCorrect = binId === item.category
    setLocked(true)
    setResultBinId(binId)
    setResultType(isCorrect ? 'correct' : 'wrong')

    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect, inputMethod: 'tap', touchPressure })

    if (isCorrect) {
      if (wrongCount === 0) setScore(s => s + 1)
      setItemAnim('sbCorrectPop')
      playChime()
      const binLabel = BINS.find(b => b.id === binId)?.label || binId
      speak(pickLine(SORT_BASKET_LINES.correctFor, lang, item.label, item.article, binLabel))
      loggerRef.current.log('praise_shown', {})
      timerRef.current = setTimeout(() => {
        if (current + 1 >= items.length) { setDone(true); logExitOnce() }
        else setCurrent(c => c + 1)
      }, 2000)
    } else {
      setItemAnim('sbShake')
      speak(pickRandomLine(SORT_BASKET_LINES.wrongTry, lang))
      const nextWrong = wrongCount + 1
      timerRef.current = setTimeout(() => {
        setWrongCount(nextWrong)
        setResultBinId(null); setResultType(null); setItemAnim('sbBob')
        setLocked(false)
        if (nextWrong >= 2) {
          const correctLabel = BINS.find(b => b.id === item.category)?.label || item.category
          setTimeout(() => speak(pickLine(SORT_BASKET_LINES.assistFor, lang, correctLabel)), 250)
        }
      }, 1100)
    }
  }

  const handleDrop = (e, binId) => {
    e.preventDefault()
    handleBinTap(binId)
  }

  const handleReplay = () => {
    stopPaoVoice()
    setCurrent(0); setScore(0); setDone(false)
    setDisplayText(''); setTalking(false)
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    sessionEndedRef.current = false
  }

  const handleExit = () => {
    logExitOnce()
    stopPaoVoice()
    onExit()
  }

  if (done) return <FinishScreen score={score} total={items.length} onReplay={handleReplay} onExit={handleExit} lang={lang}/>
  if (!item) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes sbFloat      { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-10px)} }
        @keyframes sbBob        { 0%,100%{transform:scale(1)}            50%{transform:scale(1.05)} }
        @keyframes sbCorrectPop { 0%{transform:scale(1) rotate(0)} 30%{transform:scale(1.25) rotate(-8deg)} 60%{transform:scale(0.4) rotate(6deg)} 100%{transform:scale(0.4) rotate(0)} }
        @keyframes sbShake      { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-7px)} 80%{transform:translateX(7px)} }
        @keyframes sbBinCorrect { 0%{transform:scale(1)} 40%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes sbBinWrong   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        @keyframes sbSlideIn    { from{opacity:0;transform:translateY(14px) scale(.92)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes sbSoundWave  { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes sbCursor     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes sbFadeIn     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sbPulse      { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.5)} 50%{box-shadow:0 0 0 10px rgba(245,158,11,0)} }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', boxSizing: 'border-box', flexShrink: 0 }}>
        <button onClick={handleExit} style={topBtnStyle}>← All Games</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '5px 13px', letterSpacing: .5 }}>
            🧺 Sort the Basket
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {items.map((_, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i < current ? '#10b981' : i === current ? '#f59e0b' : 'rgba(255,255,255,.18)', transition: 'background .35s', boxShadow: i === current ? '0 0 8px #f59e0b' : 'none' }}/>
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, background: 'rgba(255,215,0,.12)', border: '1px solid rgba(255,215,0,.3)', borderRadius: 20, padding: '5px 14px' }}>⭐ {score}</div>
        </div>
      </div>

      {/* ── Game content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 20px 8px', boxSizing: 'border-box', overflow: 'hidden' }}>

        <p style={{ fontSize: 12, opacity: .4, letterSpacing: 1.2, textTransform: 'uppercase', margin: 0 }}>
          Item {current + 1} of {items.length}
        </p>

        {/* The item to sort */}
        <div
          draggable={!locked}
          onDragStart={(e) => e.dataTransfer.setData('text/plain', 'item')}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            cursor: locked ? 'default' : 'grab',
          }}
        >
          <div style={{ fontSize: 92, lineHeight: 1, animation: `${itemAnim} ${itemAnim === 'sbBob' ? '2.4s ease-in-out infinite' : '0.5s ease forwards'}`, filter: 'drop-shadow(0 10px 20px rgba(255,255,255,.1))', userSelect: 'none' }}>
            {item.emoji}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 30, padding: '5px 18px' }}>
            {item.label}
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, opacity: .55, letterSpacing: .3 }}>
          Tap or drag it to the right basket!
        </div>

        {/* Three bins */}
        <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 560, justifyContent: 'center' }}>
          {BINS.map((bin, i) => {
            const isResultBin = resultBinId === bin.id
            const isCorrectFlash = isResultBin && resultType === 'correct'
            const isWrongFlash   = isResultBin && resultType === 'wrong'
            const dimmed = assistMode && bin.id !== item.category
            return (
              <button
                key={bin.id}
                onClick={() => handleBinTap(bin.id)}
                onDragOver={(e) => { if (!dimmed) e.preventDefault() }}
                onDrop={(e) => { if (!dimmed) handleDrop(e, bin.id) }}
                disabled={dimmed}
                style={{
                  flex: 1, maxWidth: 170, padding: '20px 10px', borderRadius: 20, border: '2px solid',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  cursor: dimmed ? 'not-allowed' : 'pointer',
                  transition: 'background .25s, border-color .25s, opacity .3s',
                  animation: isCorrectFlash ? 'sbBinCorrect .45s ease' : isWrongFlash ? 'sbBinWrong .4s ease' : `sbSlideIn .4s ease ${i * .08}s both${!assistMode ? ', sbPulse 2.6s ease infinite' : ''}`,
                  background: isCorrectFlash ? 'rgba(16,185,129,.22)' : isWrongFlash ? 'rgba(239,68,68,.22)' : `${bin.color}22`,
                  borderColor: isCorrectFlash ? '#10b981' : isWrongFlash ? '#ef4444' : `${bin.color}70`,
                  opacity: dimmed ? .3 : 1,
                  color: '#fff',
                }}
              >
                <span style={{ fontSize: 42 }}>{bin.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: .3 }}>{bin.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Pao speech bar ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 14,
        padding: '10px 18px 14px', boxSizing: 'border-box', flexShrink: 0,
        background: 'rgba(255,255,255,.03)',
        borderTop: '1px solid rgba(255,255,255,.07)',
        animation: 'sbFadeIn .5s ease',
      }}>
        <div style={{ animation: 'sbFloat 3s ease-in-out infinite', flexShrink: 0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={115} pandaState="normal"/>
        </div>
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.13)',
          borderRadius: '4px 18px 18px 18px',
          padding: '12px 16px',
          minHeight: 64, maxHeight: 90,
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 6,
        }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0, .1, .06, .16, .03, .12].map((d, i) => (
                <div key={i} style={{ width: 3, height: 18, borderRadius: 4, background: 'rgba(168,130,255,.85)', animation: `sbSoundWave .55s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, color: 'rgba(255,255,255,.92)' }}>
            {displayText
              ? <>{displayText}{talking && <span style={{ animation: 'sbCursor .7s step-end infinite', marginLeft: 2, color: '#b084ff' }}>|</span>}</>
              : <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 13 }}>Pao is watching…</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

const topBtnStyle = { background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
