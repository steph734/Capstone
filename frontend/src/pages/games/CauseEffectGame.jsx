import { useState, useEffect, useRef } from 'react'
import PandaMascot from './PandaMascot'
import { useAnalytics } from '../../context/AnalyticsContext'
import { createSessionId, createEventLogger, getPointerPressure } from '../../utils/gameplayLogger'

// ─── Cause & Effect Explorer ───────────────────────────────────────────────────
//
// The earliest cognitive "rung" before multi-step games like Category Sort or
// Sequencing Cards: just I touched something → something happened because of
// it. One tap, one immediate, exaggerated, unmistakable result. No wrong
// answers, no timer, no penalty — every tap works. Pao is the constant
// throughline here (not a generic frog/bell/balloon) so the child is playing
// *with* the same friend the whole time, only the props around him change.
//
// Stage 1 — one object (Pao), always the same spot, always the same result.
// Stage 2 — three objects, each with its own distinct effect, so the child
//           starts associating which object causes which outcome.
// Stage 3 — same three objects, but the "hot zone" shrinks (Pao's nose, the
//           bell's clapper, the balloon's knot) — precision, no new demands.

const STAGE1_TAPS_NEEDED = 5
const STAGE2_TAPS_PER_OBJECT = 2
const STAGE3_TAPS_PER_OBJECT = 2

const PAO_EXCLAIM     = ['Boing! Hehe!', 'Wheee! Again!', 'Ta-da! You did that!', 'Hehe! One more time!', 'Yay! You made it happen!']
const BELL_EXCLAIM    = ['Ding, ding, ding!', 'Ring-a-ling!', 'Ding dong!']
const BALLOON_EXCLAIM = ['Pop! Boom!', 'Whee, pop!', 'Bang, pop!']

const INTRO_LINE     = `Tap me and see what happens! Go ahead, try it!`
const STAGE2_INTRO    = `Yay! Let us try something new! Three friends to tap now — see what each one does!`
const STAGE3_INTRO    = `Now let us tap juuust the right spot! Look for the little glowing circle!`
const FINISH_LINE     = `Wow, you are such a great explorer! You found out what happens every single time!`

function pgSpeak(text, { rate = 1.05, pitch = 1.65, onStart, onEnd } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = rate; utt.pitch = pitch; utt.volume = 1
  if (onStart) utt.onstart = onStart
  utt.onend = () => onEnd?.()
  utt.onerror = () => onEnd?.()
  const go = () => {
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find(v => v.lang.startsWith('en') && /zira/i.test(v.name)) ||
              voices.find(v => v.lang.startsWith('en') && /samantha/i.test(v.name)) ||
              voices.find(v => v.lang === 'en-US') ||
              voices.find(v => v.lang.startsWith('en')) || voices[0]
    if (v) utt.voice = v
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length > 0) go()
  else window.speechSynthesis.onvoiceschanged = go
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Pao's tap reactions — a small rotating set of gentle actions so Pao feels
// as lively as the bell/balloon, without the violent spin/shake the mascot
// deliberately avoids. Each action pairs a brief expression change (arms /
// brows already built into PandaMascot's pandaState) with a soft flourish
// on the wrapper and a floating emoji above his head. ─────────────────────────
const PAO_ACTIONS = [
  { state: 'excited', emoji: '🎉', flourish: 'ceCheerHop' },
  { state: 'happy',   emoji: '👋', flourish: 'ceWaveTilt' },
  { state: 'shy',     emoji: '💗', flourish: 'ceGiggleSquash' },
  { state: 'excited', emoji: '⭐', flourish: 'ceSparkleSpin' },
  { state: 'happy',   emoji: '🎈', flourish: 'ceCheerHop' },
]

// ─── Pao card — wraps PandaMascot with a randomized action per tap ───────────

function PaoCard({ mouthOpen, pxWidth, onTap, hotZoneOnly, boxWidth, boxHeight, hotZoneTop = 96 }) {
  const [action, setAction]     = useState(null)
  const [flourish, setFlourish] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const timerRef = useRef(null)

  const trigger = () => {
    setAction(pick(PAO_ACTIONS))
    setFlourish(true)
    setBurstKey(k => k + 1)
    onTap()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setFlourish(false); setAction(null) }, 750)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div style={{ position: 'relative', width: boxWidth, height: boxHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'inline-block', animation: flourish && action ? `${action.flourish} .75s ease` : 'none' }}>
        <PandaMascot
          entered={true}
          mouthOpen={mouthOpen}
          pandaState={action?.state || 'happy'}
          pxWidth={pxWidth}
          onClick={hotZoneOnly ? undefined : trigger}
        />
      </div>
      {action && (
        <div key={burstKey} style={{ position: 'absolute', top: '10%', left: '50%', fontSize: Math.round(pxWidth * 0.18), animation: 'ceEmojiFloat .75s ease-out both', pointerEvents: 'none' }}>
          {action.emoji}
        </div>
      )}
      {hotZoneOnly && (
        <button onPointerUp={trigger} style={{ ...hotZoneStyle(6, hotZoneTop), width: 30, height: 30 }} aria-label="Tap Pao's nose"/>
      )}
    </div>
  )
}

// ─── Bell prop — swings and rings on tap ──────────────────────────────────────

function BellCard({ onTap, hotZoneOnly }) {
  const [ringing, setRinging] = useState(false)
  const timerRef = useRef(null)

  const trigger = (e) => {
    onTap(e)
    setRinging(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setRinging(false), 700)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div style={{ position: 'relative', width: 150, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 96, transformOrigin: '50% 10%', animation: ringing ? 'ceBellSwing .7s ease' : 'none', filter: 'drop-shadow(0 10px 18px rgba(255,255,255,.12))' }}>🔔</div>
      {hotZoneOnly ? (
        <button onPointerUp={trigger} style={hotZoneStyle(6, 70)} aria-label="Tap the bell's clapper"/>
      ) : (
        <button onPointerUp={trigger} style={fullCardHitStyle} aria-label="Tap the bell"/>
      )}
    </div>
  )
}

// ─── Balloon prop — pops, then magically re-inflates ──────────────────────────

function BalloonCard({ onTap, hotZoneOnly }) {
  const [popping, setPopping] = useState(false)
  const [hidden, setHidden]   = useState(false)
  const timerRef = useRef(null)
  const respawnRef = useRef(null)

  const trigger = (e) => {
    if (hidden) return
    onTap(e)
    setPopping(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setPopping(false); setHidden(true) }, 260)
    clearTimeout(respawnRef.current)
    respawnRef.current = setTimeout(() => setHidden(false), 950)
  }

  useEffect(() => () => { clearTimeout(timerRef.current); clearTimeout(respawnRef.current) }, [])

  return (
    <div style={{ position: 'relative', width: 150, height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {!hidden && (
        <div style={{ fontSize: 96, animation: popping ? 'ceBalloonPop .26s ease-in forwards' : 'ceBalloonBob 2.4s ease-in-out infinite', filter: 'drop-shadow(0 10px 18px rgba(255,255,255,.12))' }}>🎈</div>
      )}
      {hidden && ['#f59e0b', '#ec4899', '#10b981', '#6366f1'].map((c, i) => (
        <div key={i} style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, background: c, animation: `ceConfetti .6s ease-out ${i * 0.05}s both`, left: `${45 + i * 4}%`, top: '45%' }}/>
      ))}
      {!hidden && (hotZoneOnly ? (
        <button onPointerUp={trigger} style={hotZoneStyle(6, 128)} aria-label="Tap the balloon's knot"/>
      ) : (
        <button onPointerUp={trigger} style={fullCardHitStyle} aria-label="Tap the balloon"/>
      ))}
    </div>
  )
}

function hotZoneStyle(size, top) {
  return {
    position: 'absolute', left: '50%', top, transform: 'translate(-50%,-50%)',
    width: size === 6 ? 34 : size, height: size === 6 ? 34 : size, borderRadius: '50%',
    background: 'rgba(20,184,166,.35)', border: '2px solid #14b8a6',
    animation: 'cePulseRing 1.3s ease-in-out infinite', cursor: 'pointer', padding: 0,
  }
}

const fullCardHitStyle = { position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }

// ─── Finish screen ────────────────────────────────────────────────────────────

function FinishScreen({ onReplay, onExit }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
      <div style={{ animation: 'ceFloat 2.5s ease-in-out infinite' }}>
        <PandaMascot entered={true} mouthOpen={false} pandaState="excited" pxWidth={150}/>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 34 }}>
        <span>⭐</span><span>⭐</span><span>⭐</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, textAlign: 'center', color: '#fff' }}>You are a great explorer!</h1>
      <p style={{ fontSize: 13, opacity: .65, maxWidth: 420, textAlign: 'center', margin: 0 }}>
        You figured out what happens every time you tap. That is such an important first step!
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={onReplay} style={{ background: '#fbbf24', border: 'none', color: '#1a1430', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Play Again 👆</button>
        <button onClick={onExit} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 14, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>← All Games</button>
      </div>
    </div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

export default function CauseEffectGame({ onExit, patientId = 'alvrin', exerciseId = 'cause-effect-explorer', domain = 'Cognitive' }) {
  const [stage, setStage]     = useState(1) // 1 | 2 | 3
  const [caption, setCaption] = useState('')
  const [talking, setTalking] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)
  const [stage1Taps, setStage1Taps] = useState(0)
  const [objectTaps, setObjectTaps] = useState({ pao: 0, bell: 0, balloon: 0 })
  const [done, setDone] = useState(false)

  const mouthRef = useRef(null)
  const { submitEventBatch } = useAnalytics()
  const sessionIdRef      = useRef(createSessionId())
  const loggerRef         = useRef(createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch }))
  const promptShownAtRef  = useRef(Date.now())
  const sessionEndedRef   = useRef(false)

  const logExitOnce = () => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true
    loggerRef.current.log('exit', {})
  }

  useEffect(() => {
    if (talking) mouthRef.current = setInterval(() => setMouthOpen(p => !p), 170)
    else { clearInterval(mouthRef.current); setMouthOpen(false) }
    return () => clearInterval(mouthRef.current)
  }, [talking])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    logExitOnce()
  }, []) // eslint-disable-line

  const speak = (text) => {
    setCaption(text)
    pgSpeak(text, { onStart: () => setTalking(true), onEnd: () => setTalking(false) })
  }

  useEffect(() => {
    const t = setTimeout(() => speak(INTRO_LINE), 500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line

  const logTap = (touchPressure) => {
    const responseTimeMs = promptShownAtRef.current ? Date.now() - promptShownAtRef.current : null
    loggerRef.current.log('response_given', { responseTimeMs, isCorrect: true, inputMethod: 'tap', touchPressure })
    promptShownAtRef.current = Date.now()
  }

  const handlePaoTap = () => {
    logTap(null)
    speak(pick(PAO_EXCLAIM))
    if (stage === 1) {
      const next = stage1Taps + 1
      setStage1Taps(next)
      if (next >= STAGE1_TAPS_NEEDED) {
        setTimeout(() => { setStage(2); setCaption(''); setTimeout(() => speak(STAGE2_INTRO), 300) }, 900)
      }
    } else {
      bumpObjectTap('pao')
    }
  }

  const bumpObjectTap = (key) => {
    setObjectTaps(prev => {
      const next = { ...prev, [key]: prev[key] + 1 }
      const target = stage === 2 ? STAGE2_TAPS_PER_OBJECT : STAGE3_TAPS_PER_OBJECT
      const allDone = next.pao >= target && next.bell >= target && next.balloon >= target
      if (allDone) {
        setTimeout(() => {
          if (stage === 2) { setStage(3); setObjectTaps({ pao: 0, bell: 0, balloon: 0 }); setCaption(''); setTimeout(() => speak(STAGE3_INTRO), 300) }
          else { logExitOnce(); setCaption(''); setTimeout(() => speak(FINISH_LINE), 300); setTimeout(() => setDone(true), 1800) }
        }, 700)
      }
      return next
    })
  }

  const handleObjectTap = (key, exclaims) => (e) => {
    logTap(getPointerPressure(e))
    speak(pick(exclaims))
    bumpObjectTap(key)
  }

  const handleReplay = () => {
    sessionIdRef.current = createSessionId()
    loggerRef.current = createEventLogger({ patientId, exerciseId, sessionId: sessionIdRef.current, domain, onFlush: submitEventBatch })
    sessionEndedRef.current = false
    setStage(1); setStage1Taps(0); setObjectTaps({ pao: 0, bell: 0, balloon: 0 }); setCaption(''); setDone(false)
    promptShownAtRef.current = Date.now()
    setTimeout(() => speak(INTRO_LINE), 500)
  }

  const handleExit = () => {
    logExitOnce()
    window.speechSynthesis?.cancel()
    onExit()
  }

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes ceFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
      <FinishScreen onReplay={handleReplay} onExit={handleExit}/>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%,#1a1430 0%,#0a0a0f 100%)', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes ceFloat       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes ceCheerHop    { 0%{transform:translateY(0) scale(1)} 35%{transform:translateY(-22px) scale(1.08)} 60%{transform:translateY(2px) scale(0.97)} 100%{transform:translateY(0) scale(1)} }
        @keyframes ceWaveTilt    { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-8deg)} 50%{transform:rotate(6deg)} 75%{transform:rotate(-4deg)} }
        @keyframes ceGiggleSquash{ 0%{transform:scale(1,1)} 40%{transform:scale(1.08,0.9)} 70%{transform:scale(0.95,1.05)} 100%{transform:scale(1,1)} }
        @keyframes ceSparkleSpin { 0%{transform:rotate(0) scale(1)} 50%{transform:rotate(6deg) scale(1.06)} 100%{transform:rotate(0) scale(1)} }
        @keyframes ceEmojiFloat  { 0%{opacity:0;transform:translate(-50%,-50%) scale(.4)} 30%{opacity:1;transform:translate(-50%,-60%) scale(1.15)} 100%{opacity:0;transform:translate(-50%,-95%) scale(.9)} }
        @keyframes ceBellSwing   { 0%,100%{transform:rotate(0)} 20%{transform:rotate(18deg)} 40%{transform:rotate(-16deg)} 60%{transform:rotate(10deg)} 80%{transform:rotate(-6deg)} }
        @keyframes ceBalloonPop  { 0%{transform:scale(1)} 60%{transform:scale(1.35)} 100%{transform:scale(0);opacity:0} }
        @keyframes ceBalloonBob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes ceConfetti    { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(50px) scale(.4);opacity:0} }
        @keyframes cePulseRing   { 0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,.6)} 50%{box-shadow:0 0 0 10px rgba(20,184,166,0)} }
        @keyframes ceFadeIn      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ceCaptionPop  { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
        <button onClick={handleExit} style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← All Games
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.35)', borderRadius: 20, padding: '5px 13px' }}>
            👆 {stage === 1 ? 'One friend to tap' : stage === 2 ? 'Which does what?' : 'Tap just the right spot'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ width: 11, height: 11, borderRadius: '50%', background: s < stage ? '#10b981' : s === stage ? '#fbbf24' : 'rgba(255,255,255,.18)', boxShadow: s === stage ? '0 0 8px #fbbf24' : 'none' }}/>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '0 20px 30px' }}>
        {stage === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <PaoCard mouthOpen={mouthOpen} pxWidth={220} onTap={handlePaoTap}/>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: STAGE1_TAPS_NEEDED }, (_, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < stage1Taps ? '#fbbf24' : 'rgba(255,255,255,.15)' }}/>
              ))}
            </div>
          </div>
        )}

        {(stage === 2 || stage === 3) && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <PaoCard mouthOpen={mouthOpen} pxWidth={110} onTap={handlePaoTap} hotZoneOnly={stage === 3} boxWidth={150} boxHeight={190}/>
              <ObjectDots count={objectTaps.pao} target={stage === 2 ? STAGE2_TAPS_PER_OBJECT : STAGE3_TAPS_PER_OBJECT}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <BellCard onTap={handleObjectTap('bell', BELL_EXCLAIM)} hotZoneOnly={stage === 3}/>
              <ObjectDots count={objectTaps.bell} target={stage === 2 ? STAGE2_TAPS_PER_OBJECT : STAGE3_TAPS_PER_OBJECT}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <BalloonCard onTap={handleObjectTap('balloon', BALLOON_EXCLAIM)} hotZoneOnly={stage === 3}/>
              <ObjectDots count={objectTaps.balloon} target={stage === 2 ? STAGE2_TAPS_PER_OBJECT : STAGE3_TAPS_PER_OBJECT}/>
            </div>
          </div>
        )}

        {/* Pao's caption / speech line */}
        <div key={caption} style={{
          minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 20, padding: '10px 24px', maxWidth: 480, textAlign: 'center',
          animation: caption ? 'ceCaptionPop .35s cubic-bezier(.34,1.56,.64,1)' : 'none',
        }}>
          {talking && (
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginRight: 10 }}>
              {[0, .1, .06, .16, .03].map((d, i) => (
                <div key={i} style={{ width: 3, height: 14, borderRadius: 4, background: 'rgba(251,191,36,.85)', animation: `ceFadeIn .5s ease ${d}s` }}/>
              ))}
            </div>
          )}
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {caption || 'Tap and see what happens!'}
          </span>
        </div>
      </div>
    </div>
  )
}

function ObjectDots({ count, target }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: target }, (_, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < count ? '#10b981' : 'rgba(255,255,255,.15)' }}/>
      ))}
    </div>
  )
}
