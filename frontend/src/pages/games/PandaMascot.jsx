import { useState, useEffect, useRef } from 'react'
import { OUTFIT_MAP } from './PaoOutfits'

// ── Click reaction — one gentle, predictable bounce (no spin/shake/wiggle,
// which read as chaotic and can overwhelm kids with sensory sensitivities) ──
const CLICK_REACTION_DUR = 700

// Sparkle configs — positioned relative to character center (40% from top)
const SPARKLES = [
  { x: -55, y: -80,  e: '⭐', s: 22, d: 0    },
  { x:  60, y: -80,  e: '✨', s: 20, d: 0.05 },
  { x: -85, y: -10,  e: '💫', s: 18, d: 0.08 },
  { x:  85, y: -10,  e: '🌟', s: 22, d: 0.08 },
  { x: -50, y:  55,  e: '❤️', s: 18, d: 0.12 },
  { x:  55, y:  55,  e: '💛', s: 18, d: 0.12 },
  { x:   0, y: -100, e: '🎉', s: 20, d: 0.04 },
  { x: -25, y: -92,  e: '💚', s: 15, d: 0.07 },
  { x:  25, y: -92,  e: '🔥', s: 15, d: 0.07 },
  { x: -75, y:  30,  e: '🌸', s: 17, d: 0.1  },
  { x:  75, y:  30,  e: '🍬', s: 17, d: 0.1  },
]

// ── CSS animations injected once ─────────────────────────────────────────────
const PAO_STYLES = `
  @keyframes pao-bounce {
    0%   { transform: translateY(0)    scaleY(1);    }
    30%  { transform: translateY(-20px) scaleY(1.05); }
    55%  { transform: translateY(2px)  scaleY(0.96); }
    100% { transform: translateY(0)    scaleY(1);    }
  }
  @keyframes pao-sparkle {
    0%   { opacity: 0; transform: translate(-50%,-50%) scale(0) rotate(-20deg); }
    25%  { opacity: 1; transform: translate(-50%,-50%) scale(1.4) rotate(10deg); }
    65%  { opacity: 0.9; transform: translate(-50%,-50%) scale(1.1) rotate(0deg) translateY(-8px); }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(0.6) translateY(-18px); }
  }
`

// ── Sparkle component ─────────────────────────────────────────────────────────
function Spark({ x, y, e, s, d, active }) {
  if (!active) return null
  return (
    <div style={{
      position: 'absolute',
      top: `calc(40% + ${y}px)`,
      left: `calc(50% + ${x}px)`,
      fontSize: s,
      pointerEvents: 'none',
      zIndex: 20,
      lineHeight: 1,
      animation: `pao-sparkle 0.85s ease-out ${d}s both`,
    }}>
      {e}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
// A warm, simple 2D illustration designed to feel friendly and calm for
// children with Down syndrome / other special needs: soft cream-and-cocoa
// colors instead of stark black-and-white, big warm eyes, and deliberately
// minimal motion — only the mouth animates while talking (no ear/arm/head
// movement), and touch gives one gentle, predictable bounce + sparkles.
export default function PandaMascot({
  mouthOpen, pxWidth = 260, onClick,
  pandaState = 'normal', accessories = {},
  viewPad = { top: 0, bottom: 0 },
}) {
  const padTop   = viewPad.top    || 0
  const padBot   = viewPad.bottom || 0
  const vbH      = 366 + padTop + padBot
  const pxHeight = Math.round(pxWidth * vbH / 300)

  const isShy     = pandaState === 'shy'
  const isHappy   = pandaState === 'happy'
  const isExcited = pandaState === 'excited'
  const isSad     = pandaState === 'sad'
  const isTalking = mouthOpen
  const squint    = isShy

  const [bouncing,     setBouncing]     = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)
  const [sparkKey,     setSparkKey]     = useState(0)
  const [mouthFrame,   setMouthFrame]   = useState('closed')

  const animTimer  = useRef(null)
  const mouthTimer = useRef(null)

  // Mouth open ↔ closed while talking, each frame held ~220-380ms with a
  // little randomness so it reads like natural speech, not a metronome.
  useEffect(() => {
    if (!isTalking) { setMouthFrame('closed'); return }
    let cancelled = false
    const swap = (frame) => {
      mouthTimer.current = setTimeout(() => {
        if (cancelled) return
        setMouthFrame(frame)
        swap(frame === 'open' ? 'closed' : 'open')
      }, 220 + Math.random() * 160)
    }
    swap('open')
    return () => { cancelled = true; clearTimeout(mouthTimer.current) }
  }, [isTalking])

  useEffect(() => () => { clearTimeout(animTimer.current); clearTimeout(mouthTimer.current) }, [])

  // Handle click/touch — one gentle bounce + sparkle burst
  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) onClick()
    setBouncing(true)
    setShowSparkles(true)
    setSparkKey(k => k + 1)
    clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => {
      setBouncing(false)
      setShowSparkles(false)
    }, CLICK_REACTION_DUR + 200)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onClick={handleClick}>
      <style>{PAO_STYLES}</style>

      {/* Sparkle burst */}
      {SPARKLES.map((s, i) => (
        <Spark key={`${sparkKey}-${i}`} {...s} active={showSparkles} />
      ))}

      {/* Click-animation wrapper */}
      <div style={{
        animation: bouncing ? `pao-bounce ${CLICK_REACTION_DUR}ms cubic-bezier(.34,1.56,.64,1) both` : 'none',
        display: 'inline-block',
        cursor: 'pointer',
      }}>
        <svg
          viewBox={`0 ${-padTop} 300 ${vbH}`}
          width={pxWidth}
          height={pxHeight}
          style={{
            filter: 'drop-shadow(0 18px 38px rgba(0,0,0,0.5))',
            overflow: 'visible',
            display: 'block',
          }}
        >
          <defs>
            <radialGradient id="pm-headG" cx="33%" cy="26%" r="75%" fx="33%" fy="26%">
              <stop offset="0%"   stopColor="#ffffff"/>
              <stop offset="100%" stopColor="#eeeeee"/>
            </radialGradient>
            <radialGradient id="pm-bodyG" cx="36%" cy="28%" r="72%" fx="36%" fy="28%">
              <stop offset="0%"   stopColor="#ffffff"/>
              <stop offset="100%" stopColor="#e9e9e9"/>
            </radialGradient>
            <radialGradient id="pm-darkG" cx="32%" cy="28%" r="70%">
              <stop offset="0%"   stopColor="#5a4433"/>
              <stop offset="100%" stopColor="#2a1d13"/>
            </radialGradient>
            <radialGradient id="pm-armG" cx="28%" cy="22%" r="74%">
              <stop offset="0%"   stopColor="#5a4433"/>
              <stop offset="100%" stopColor="#2c1f15"/>
            </radialGradient>
            <radialGradient id="pm-pawG" cx="38%" cy="30%" r="68%">
              <stop offset="0%"   stopColor="#e8c095"/>
              <stop offset="100%" stopColor="#c08f5f"/>
            </radialGradient>
            <radialGradient id="pm-irisG" cx="36%" cy="28%" r="72%">
              <stop offset="0%"   stopColor="#fbe3b8"/>
              <stop offset="100%" stopColor="#7a4d26"/>
            </radialGradient>
            <radialGradient id="pm-noseG" cx="34%" cy="28%" r="68%">
              <stop offset="0%"   stopColor="#4a3626"/>
              <stop offset="100%" stopColor="#201409"/>
            </radialGradient>
            <radialGradient id="pm-blushG" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(255,120,150,0.95)"/>
              <stop offset="60%"  stopColor="rgba(255,140,160,0.55)"/>
              <stop offset="100%" stopColor="rgba(255,140,140,0)"/>
            </radialGradient>
            <radialGradient id="pm-mouthG" cx="50%" cy="30%" r="70%">
              <stop offset="0%"   stopColor="#e05555"/>
              <stop offset="100%" stopColor="#93201f"/>
            </radialGradient>
          </defs>

          {/* ── Ground shadow ── */}
          <ellipse cx="150" cy="358" rx="88" ry="10" fill="rgba(0,0,0,0.22)"/>

          {/* ── Feet ── */}
          <ellipse cx="108" cy="338" rx="46" ry="24" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>
          <ellipse cx="192" cy="338" rx="46" ry="24" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>
          <ellipse cx="108" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>
          <ellipse cx="192" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>

          {/* ── Body ── */}
          <ellipse cx="150" cy="272" rx="92" ry="84" fill="url(#pm-bodyG)" stroke="#2a1d13" strokeWidth="5"/>
          <ellipse cx="148" cy="262" rx="58" ry="52" fill="white" opacity="0.4"/>
          <ellipse cx="144" cy="252" rx="32" ry="28" fill="white" opacity="0.28"/>

          {/* ── Left arm ── */}
          <g>
            <ellipse cx="68"  cy="278" rx="34" ry="21" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4" transform="rotate(-28 68 278)"/>
            <ellipse cx="58"  cy="300" rx="27" ry="19" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4"/>
            <ellipse cx="52"  cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
          </g>

          {/* ── Right arm ── */}
          <g>
            <ellipse cx="232" cy="278" rx="34" ry="21" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4" transform="rotate(28 232 278)"/>
            <ellipse cx="242" cy="300" rx="27" ry="19" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4"/>
            <ellipse cx="248" cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
          </g>

          {/* ── Raised shy / excited arms ── */}
          {(isShy || isExcited) && (
            <g opacity="0.95">
              <ellipse cx="90"  cy="158" rx="30" ry="18" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4" transform="rotate(-55 90 158)"/>
              <ellipse cx="210" cy="158" rx="30" ry="18" fill="url(#pm-armG)" stroke="#2a1d13" strokeWidth="4" transform="rotate(55 210 158)"/>
              <ellipse cx="78"  cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
              <ellipse cx="222" cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
            </g>
          )}

          {/* ── Head group ── */}
          <g>
            <circle cx="150" cy="138" r="114" fill="url(#pm-headG)" stroke="#2a1d13" strokeWidth="5"/>

            {/* Specular highlights */}
            <ellipse cx="102" cy="84" rx="40" ry="28" fill="white" opacity="0.35" transform="rotate(-28 102 84)"/>
            <ellipse cx="106" cy="82" rx="22" ry="14" fill="white" opacity="0.4" transform="rotate(-28 106 82)"/>
            <ellipse cx="110" cy="80" rx="10" ry="7"  fill="white" opacity="0.5" transform="rotate(-28 110 80)"/>

            {/* ── Left ear ── */}
            <g>
              <circle cx="57" cy="50" r="38" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>
              <ellipse cx="57" cy="54" rx="15" ry="17" fill="rgba(255,130,160,0.7)"/>
            </g>

            {/* ── Right ear ── */}
            <g>
              <circle cx="243" cy="50" r="38" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>
              <ellipse cx="243" cy="54" rx="15" ry="17" fill="rgba(255,130,160,0.7)"/>
            </g>

            {/* Eye patches */}
            <circle cx="103" cy="148" r="44" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>
            <circle cx="197" cy="148" r="44" fill="url(#pm-darkG)" stroke="#2a1d13" strokeWidth="4"/>

            {/* Eye whites — big for expressiveness */}
            <circle cx="106" cy="145" r="30" fill="white" stroke="#2a1d13" strokeWidth="2.5"/>
            <circle cx="194" cy="145" r="30" fill="white" stroke="#2a1d13" strokeWidth="2.5"/>

            {/* ── Eyes ── */}
            {squint ? (
              <>
                <ellipse cx="106" cy="145" rx="27" ry="5" fill="#2a1d13"/>
                <ellipse cx="194" cy="145" rx="27" ry="5" fill="#2a1d13"/>
                {/* Little curved happy lines above squinted eyes */}
                <path d="M 82,128 Q 106,116 130,128" fill="none" stroke="#2a1d13" strokeWidth="4" strokeLinecap="round"/>
                <path d="M 170,128 Q 194,116 218,128" fill="none" stroke="#2a1d13" strokeWidth="4" strokeLinecap="round"/>
                {isShy && <>
                  <line x1="72"  y1="165" x2="88"  y2="170" stroke="#ff7799" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
                  <line x1="68"  y1="172" x2="85"  y2="175" stroke="#ff7799" strokeWidth="2"   strokeLinecap="round" opacity="0.5"/>
                  <line x1="212" y1="165" x2="228" y2="170" stroke="#ff7799" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
                  <line x1="215" y1="172" x2="232" y2="175" stroke="#ff7799" strokeWidth="2"   strokeLinecap="round" opacity="0.5"/>
                </>}
              </>
            ) : isSad ? (
              <>
                <circle cx="106" cy="148" r="24" fill="url(#pm-irisG)"/>
                <circle cx="194" cy="148" r="24" fill="url(#pm-irisG)"/>
                <circle cx="106" cy="152" r="14" fill="#2a1d13"/>
                <circle cx="194" cy="152" r="14" fill="#2a1d13"/>
                {/* Large sparkle */}
                <circle cx="118" cy="137" r="11" fill="white"/>
                <circle cx="206" cy="137" r="11" fill="white"/>
                <circle cx="100" cy="158" r="4.5" fill="white" opacity="0.5"/>
                <circle cx="188" cy="158" r="4.5" fill="white" opacity="0.5"/>
                {/* Sad brows */}
                <path d="M 78,106 Q 96,94 126,108"  fill="none" stroke="#2a1d13" strokeWidth="5.5" strokeLinecap="round"/>
                <path d="M 174,108 Q 204,94 222,106" fill="none" stroke="#2a1d13" strokeWidth="5.5" strokeLinecap="round"/>
                {/* Tear */}
                <ellipse cx="118" cy="196" rx="5.5" ry="14" fill="#90c8ff" opacity=".9"/>
              </>
            ) : (
              <>
                {/* Big bright iris */}
                <circle cx="106" cy="148" r="24" fill="url(#pm-irisG)"/>
                <circle cx="194" cy="148" r="24" fill="url(#pm-irisG)"/>
                {/* Dark pupil */}
                <circle cx="106" cy="152" r="14" fill="#2a1d13"/>
                <circle cx="194" cy="152" r="14" fill="#2a1d13"/>
                {/* Large white sparkle — key cute feature */}
                <circle cx="118" cy="136" r="11" fill="white"/>
                <circle cx="206" cy="136" r="11" fill="white"/>
                {/* Small secondary glint */}
                <circle cx="99"  cy="160" r="5" fill="white" opacity="0.55"/>
                <circle cx="187" cy="160" r="5" fill="white" opacity="0.55"/>
                {/* Shimmer dot on iris */}
                <circle cx="122" cy="132" r="5" fill="white" opacity="0.8"/>
                <circle cx="210" cy="132" r="5" fill="white" opacity="0.8"/>

                {/* Happy / excited brows */}
                {(isHappy || isExcited || isTalking) && (
                  <>
                    <path d="M 76,102 Q 107,88 138,102"  fill="none" stroke="#2a1d13" strokeWidth="5.5" strokeLinecap="round"/>
                    <path d="M 162,102 Q 193,88 224,102" fill="none" stroke="#2a1d13" strokeWidth="5.5" strokeLinecap="round"/>
                  </>
                )}
              </>
            )}

            {/* ── Nose ── */}
            <ellipse cx="150" cy="182" rx="15" ry="10" fill="url(#pm-noseG)" stroke="#2a1d13" strokeWidth="2.5"/>
            <ellipse cx="145" cy="178" rx="6"  ry="3.5" fill="white" opacity="0.4"/>

            {/* ── Mouth — the only thing that animates while talking ── */}
            {isTalking && mouthFrame === 'open' ? (
              <>
                <ellipse cx="150" cy="200" rx="20" ry="16" fill="url(#pm-mouthG)" stroke="#2a1d13" strokeWidth="1.5">
                  <animate attributeName="ry" values="16;20;16" dur="0.35s" repeatCount="indefinite"/>
                </ellipse>
                <ellipse cx="150" cy="208" rx="11" ry="7"  fill="#e87070"/>
                {/* Tongue */}
                <ellipse cx="150" cy="212" rx="9" ry="5" fill="#ff9999" opacity="0.85"/>
                <rect x="138" y="191" width="24" height="6" rx="2.5" fill="white" opacity="0.9"/>
              </>
            ) : (
              /* Closed mouth — wider warmer smile */
              <path
                d={isHappy || isExcited || isTalking
                  ? 'M 122 192 Q 150 220 178 192'
                  : 'M 130 192 Q 150 212 170 192'}
                stroke="#2a1d13" strokeWidth="3.5" fill="none" strokeLinecap="round"
              />
            )}

            {/* ── Cheek blush — warm and prominent ── */}
            <ellipse cx="70"  cy="174" rx="34" ry="22" fill="url(#pm-blushG)" opacity={isShy ? 1 : (isTalking ? 0.85 : 0.72)}/>
            <ellipse cx="230" cy="174" rx="34" ry="22" fill="url(#pm-blushG)" opacity={isShy ? 1 : (isTalking ? 0.85 : 0.72)}/>

            {/* Extra sparkle hearts when excited */}
            {isExcited && <>
              <text x="46"  y="120" fontSize="18" textAnchor="middle" style={{ userSelect:'none' }}>💕</text>
              <text x="254" y="120" fontSize="18" textAnchor="middle" style={{ userSelect:'none' }}>💕</text>
            </>}
          </g>{/* end head group */}

          {/* ── Outfit accessories ── */}
          {['shoes','pants','clothes','hair'].map(cat => {
            const id = accessories[cat]
            if (!id || id === 'none') return null
            const Comp = OUTFIT_MAP[cat]?.[id]
            return Comp ? <Comp key={`${cat}-${id}`}/> : null
          })}
        </svg>
      </div>
    </div>
  )
}
