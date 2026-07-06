import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger, getPointerPressure } from '../../utils/gameplayLogger'
import { speakPao, stopPaoVoice } from '../../utils/paoVoice'

// ─── Little Red Riding Hood — an interactive branching story ─────────────────
//
// Three short scenarios, each targeting a different skill:
//   1. Basket Organizer     — categorization & working memory: tap only the
//      items that belong in a gift basket.
//   2. The Path Fork        — executive function: weigh a trade-off (short
//      path with an obstacle vs. a longer, clear one) rather than pick a
//      single correct answer.
//   3. The Wolf's Question  — social-emotional learning: three different,
//      equally valid responses, each with its own social consequence shown
//      through an icon + short line rather than "right/wrong" text.

const BASKET_ITEMS = [
  { id: 'flowers', emoji: '💐', label: 'Flowers',    correct: true  },
  { id: 'cookies', emoji: '🍪', label: 'Cookies',    correct: true  },
  { id: 'toy',     emoji: '🧸', label: 'Toy Bear',   correct: true  },
  { id: 'rock',    emoji: '🪨', label: 'Heavy Rock', correct: false },
  { id: 'shoe',    emoji: '👞', label: 'Old Shoe',   correct: false },
]
const BASKET_TARGET = BASKET_ITEMS.filter(i => i.correct).length
const OBSTACLE_TAPS_NEEDED = 3

const WOLF_OPTIONS = [
  {
    id: 'truth', icon: '💬', label: 'Open', line: `"I'm going to Grandma's house through the woods!"`,
    feedback: `That was honest! But now the Wolf knows exactly where Grandma lives. Being open is kind — just remember to think about who you share plans with.`,
  },
  {
    id: 'silent', icon: '🛡️', label: 'Cautious', line: `Say nothing and walk away.`,
    feedback: `Smart thinking! Walking away keeps your plans private and keeps you safe around strangers.`,
  },
  {
    id: 'question', icon: '🤔', label: 'Curious', line: `"Why do you want to know?"`,
    feedback: `Good instinct! Asking a question back helps you understand why someone wants to know something.`,
  },
]

const INTRO_LINE  = `Let's help Little Red Riding Hood get to Grandma's house! First, let's pack her basket with the right things!`
const PATH_LINE   = `Yay! The basket is all packed! Time to head into the woods! Oh look, the path splits in two — which way should Red go?`
const WOLF_LINE   = `A big Wolf steps out from behind a tree! "Well hello there, Little Red! Where are you off to today?" the Wolf asks with a sly smile.`
const FINISH_LINE = `Wonderful! You helped Little Red Riding Hood all the way through the woods! You thought carefully about every single choice — what a great story explorer!`

const BASKET_CHEERS = [`Yes! That belongs in Grandma's basket!`, `Perfect pick!`, `Great choice for Grandma!`]
const BASKET_NUDGES = [`Hmm, Grandma probably does not need that!`, `Let's find something else for the basket!`, `That one does not quite fit — try another!`]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Badge ────────────────────────────────────────────────────────────────────

function StoryBadge({ animate = false }) {
  return (
    <div style={{
      width: 100, height: 100, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #a78bfa 0%, #7c3aed 60%, #4c1d95 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
      border: '4px solid #c4b5fd', boxShadow: '0 0 22px rgba(167,139,250,.55)',
      animation: animate ? 'lrBadgePop .7s cubic-bezier(.34,1.56,.64,1) both' : 'none',
    }}>
      📖
    </div>
  )
}

// ─── Finish screen ────────────────────────────────────────────────────────────

function FinishScreen({ onReplay, onExit }) {
  const [talking, setTalking]       = useState(false)
  const [mouthOpen, setMouthOpen]   = useState(false)
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
      if (!earned.includes('Story Explorer')) {
        localStorage.setItem('pao_badges', JSON.stringify([...earned, 'Story Explorer']))
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
        @keyframes lrFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes lrBadgePop { 0%{transform:scale(0) rotate(-15deg)} 65%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes lrFadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={{ animation: 'lrFloat 2.5s ease-in-out infinite' }}>
        <PandaMascot entered={true} mouthOpen={mouthOpen} pandaState="excited" pxWidth={150}/>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 34 }}><span>⭐</span><span>⭐</span><span>⭐</span></div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, textAlign: 'center' }}>Story complete!</h1>
      {badgeShown && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'lrFadeUp .5s both', background: 'rgba(167,139,250,.08)', border: '2px solid rgba(167,139,250,.3)', borderRadius: 24, padding: '16px 32px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(196,181,253,.8)', letterSpacing: 1.5, textTransform: 'uppercase' }}>🎉 Badge Earned!</div>
          <StoryBadge animate={true}/>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#c4b5fd' }}>Story Explorer</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Unlocks new Customize items for Pao!</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onReplay} style={{ background: '#a78bfa', border: 'none', color: '#2e1065', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Play Again 📖</button>
        <button onClick={onExit} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function LittleRedRidingHoodGame({ onExit, patientId = 'alvrin', exerciseId = 'story-red-riding-hood', domain = 'Cognitive' }) {
  // intro | basket | path | obstacle | safewalk | wolf | wolfFeedback
  const [scene, setScene]               = useState('intro')
  const [basketTray, setBasketTray]     = useState(() => shuffle(BASKET_ITEMS))
  const [basketPacked, setBasketPacked] = useState([])
  const [shakeId, setShakeId]           = useState(null)
  const [obstacleTaps, setObstacleTaps] = useState(0)
  const [wolfChoice, setWolfChoice]     = useState(null)
  const [talking, setTalking]           = useState(false)
  const [mouthOpen, setMouthOpen]       = useState(false)
  const [displayText, setDisplayText]   = useState('')
  const [done, setDone]                 = useState(false)

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
      pitch: 1.62, rate: 1.06,
      onStart: () => setTalking(true),
      onEnd:   () => setTalking(false),
      onWord:  (partial) => setDisplayText(partial),
    })
  }

  const showPrompt = (text) => {
    promptShownAtRef.current = Date.now()
    loggerRef.current.log('prompt_shown', {})
    speak(text)
  }

  // Intro line on mount
  useEffect(() => {
    const t  = setTimeout(() => showPrompt(INTRO_LINE), 500)
    const t2 = setTimeout(() => setScene('basket'), 600)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, []) // eslint-disable-line

  // ── 1. Basket Organizer — categorization & working memory ────────────────
  const handleBasketTap = (item, e) => {
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: item.correct, inputMethod: 'tap', touchPressure: getPointerPressure(e) })

    if (!item.correct) {
      setShakeId(item.id)
      clearTimeout(shakeTimerRef.current)
      shakeTimerRef.current = setTimeout(() => setShakeId(null), 450)
      speak(pick(BASKET_NUDGES))
      return
    }

    setBasketTray(prev => prev.filter(i => i.id !== item.id))
    speak(pick(BASKET_CHEERS))
    loggerRef.current.log('praise_shown', {})

    setBasketPacked(prev => {
      const next = [...prev, item]
      if (next.length >= BASKET_TARGET) {
        setTimeout(() => { showPrompt(PATH_LINE); setScene('path') }, 1500)
      }
      return next
    })
  }

  // ── 2. The Path Fork — executive function ─────────────────────────────────
  const handlePathChoice = (choiceId, e) => {
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: null, inputMethod: 'tap', touchPressure: getPointerPressure(e) })

    if (choiceId === 'fastest') {
      setScene('obstacle')
      showPrompt(`Red takes the fast path! But uh oh — a fallen branch is blocking the way. Tap it a few times to clear it!`)
    } else {
      setScene('safewalk')
      showPrompt(`Red takes the safe path. It is a longer walk, but calm and clear the whole way.`)
      setTimeout(proceedToWolf, 2600)
    }
  }

  const handleObstacleTap = (e) => {
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: true, inputMethod: 'tap', touchPressure: getPointerPressure(e) })
    setObstacleTaps(prev => {
      const next = prev + 1
      if (next >= OBSTACLE_TAPS_NEEDED) {
        showPrompt(`Great job! You cleared the path — that was fast thinking!`)
        setTimeout(proceedToWolf, 1600)
      }
      return next
    })
  }

  function proceedToWolf() {
    setScene('wolf')
    showPrompt(WOLF_LINE)
  }

  // ── 3. The Wolf's Question — social-emotional learning ────────────────────
  const handleWolfChoice = (option, e) => {
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: null, inputMethod: 'tap', touchPressure: getPointerPressure(e) })
    setWolfChoice(option)
    setScene('wolfFeedback')
    showPrompt(option.feedback)
    setTimeout(() => {
      logExitOnce()
      setTimeout(() => setDone(true), 400)
    }, 3200)
  }

  const handleReplay = () => {
    stopPaoVoice()
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    sessionEndedRef.current = false
    setBasketTray(shuffle(BASKET_ITEMS)); setBasketPacked([]); setShakeId(null)
    setObstacleTaps(0); setWolfChoice(null); setDone(false)
    setScene('intro')
    setTimeout(() => showPrompt(INTRO_LINE), 500)
    setTimeout(() => setScene('basket'), 600)
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
        @keyframes lrFloat        { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes lrItemBob      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes lrShake        { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes lrSlideIn      { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
        @keyframes lrSoundWave    { 0%,100%{transform:scaleY(.35)} 50%{transform:scaleY(1)} }
        @keyframes lrCursor       { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes lrFadeIn       { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lrBranchWiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-6deg)} 75%{transform:rotate(6deg)} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.35)', borderRadius: 20, padding: '5px 13px' }}>
          🧺 Little Red Riding Hood
        </div>
      </div>

      {/* Scene content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 20px 8px', overflow: 'hidden' }}>

        {scene === 'intro' && (
          <div style={{ fontSize: 70, animation: 'lrFloat 2.4s ease-in-out infinite' }}>📖</div>
        )}

        {scene === 'basket' && (
          <>
            <div style={{ fontSize: 60 }}>🧺</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: BASKET_TARGET }, (_, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < basketPacked.length ? '#34d399' : 'rgba(255,255,255,.15)' }}/>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {basketTray.map(item => (
                <button key={item.id} onClick={(e) => handleBasketTap(item, e)} style={{
                  width: 90, borderRadius: 16, border: '2px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)',
                  cursor: 'pointer', padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  animation: shakeId === item.id ? 'lrShake .45s ease' : 'lrItemBob 2.6s ease-in-out infinite',
                }}>
                  <span style={{ fontSize: 34 }}>{item.emoji}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#fff' }}>{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {scene === 'path' && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={(e) => handlePathChoice('fastest', e)} style={pathCardStyle('#f59e0b')}>
              <span style={{ fontSize: 30 }}>🏃</span>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Fastest Path</div>
              <div style={{ fontSize: 12, opacity: .7 }}>Shorter, but there might be obstacles!</div>
            </button>
            <button onClick={(e) => handlePathChoice('safest', e)} style={pathCardStyle('#3b82f6')}>
              <span style={{ fontSize: 30 }}>🛡️</span>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Safest Path</div>
              <div style={{ fontSize: 12, opacity: .7 }}>Takes longer, but nice and clear!</div>
            </button>
          </div>
        )}

        {scene === 'obstacle' && (
          <>
            <button onClick={handleObstacleTap} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 90, animation: 'lrBranchWiggle .5s ease-in-out infinite' }} aria-label="Move the fallen branch">
              🪵
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: OBSTACLE_TAPS_NEEDED }, (_, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < obstacleTaps ? '#f59e0b' : 'rgba(255,255,255,.15)' }}/>
              ))}
            </div>
          </>
        )}

        {scene === 'safewalk' && (
          <div style={{ fontSize: 60, animation: 'lrFloat 2.2s ease-in-out infinite' }}>🌲🚶‍♀️🌲</div>
        )}

        {(scene === 'wolf' || scene === 'wolfFeedback') && (
          <>
            <div style={{ fontSize: 60 }}>🐺</div>
            {scene === 'wolf' && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 620 }}>
                {WOLF_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={(e) => handleWolfChoice(opt, e)} style={pathCardStyle('#8b5cf6', 170)}>
                    <span style={{ fontSize: 26 }}>{opt.icon}</span>
                    <div style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: .4 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, opacity: .8, fontStyle: 'italic' }}>{opt.line}</div>
                  </button>
                ))}
              </div>
            )}
            {scene === 'wolfFeedback' && wolfChoice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.35)', borderRadius: 20, padding: '10px 20px', animation: 'lrSlideIn .4s ease' }}>
                <span style={{ fontSize: 24 }}>{wolfChoice.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{wolfChoice.label} choice</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pao speech bar */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '10px 18px 14px', flexShrink: 0, background: 'rgba(255,255,255,.03)', borderTop: '1px solid rgba(255,255,255,.07)', animation: 'lrFadeIn .5s ease' }}>
        <div style={{ animation: 'lrFloat 3s ease-in-out infinite', flexShrink: 0 }}>
          <PandaMascot entered={true} mouthOpen={mouthOpen} pxWidth={110} pandaState="happy"/>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.13)', borderRadius: '4px 18px 18px 18px', padding: '12px 16px', minHeight: 64, maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {[0, .1, .06, .16, .03, .12].map((d, i) => (
                <div key={i} style={{ width: 3, height: 18, borderRadius: 4, background: 'rgba(167,139,250,.85)', animation: `lrSoundWave .55s ease-in-out ${d}s infinite` }}/>
              ))}
            </div>
          )}
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, color: 'rgba(255,255,255,.92)' }}>
            {displayText
              ? <>{displayText}{talking && <span style={{ animation: 'lrCursor .7s step-end infinite', marginLeft: 2, color: '#c4b5fd' }}>|</span>}</>
              : <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic', fontSize: 13 }}>Pao is watching…</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function pathCardStyle(color, width = 200) {
  return {
    width, textAlign: 'center', cursor: 'pointer', background: `${color}1f`, border: `2px solid ${color}60`,
    borderRadius: 18, padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    animation: 'lrSlideIn .4s ease both', color: '#fff',
  }
}
