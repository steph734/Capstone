import { useState, useEffect, useRef } from 'react'
import { OUTFIT_MAP } from './PaoOutfits'

// ── Click reactions ──────────────────────────────────────────────────────────
const CLICK_REACTIONS = [
  { anim: 'pao-jump',   dur: 700 },
  { anim: 'pao-wiggle', dur: 750 },
  { anim: 'pao-bounce', dur: 800 },
  { anim: 'pao-shake',  dur: 550 },
  { anim: 'pao-spin',   dur: 650 },
]

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
  @keyframes pao-jump {
    0%   { transform: translateY(0)    scaleX(1)    scaleY(1);    }
    25%  { transform: translateY(-55px) scaleX(0.90) scaleY(1.10); }
    50%  { transform: translateY(-70px) scaleX(0.88) scaleY(1.12); }
    70%  { transform: translateY(-35px) scaleX(0.92) scaleY(1.08); }
    85%  { transform: translateY(10px)  scaleX(1.12) scaleY(0.90); }
    100% { transform: translateY(0)    scaleX(1)    scaleY(1);    }
  }
  @keyframes pao-wiggle {
    0%   { transform: rotate(0deg);   }
    12%  { transform: rotate(-18deg); }
    25%  { transform: rotate(18deg);  }
    37%  { transform: rotate(-14deg); }
    50%  { transform: rotate(14deg);  }
    62%  { transform: rotate(-9deg);  }
    75%  { transform: rotate(9deg);   }
    87%  { transform: rotate(-4deg);  }
    100% { transform: rotate(0deg);   }
  }
  @keyframes pao-bounce {
    0%   { transform: translateY(0)    scaleY(1);    }
    20%  { transform: translateY(-32px) scaleY(1.06); }
    35%  { transform: translateY(4px)  scaleY(0.93); }
    55%  { transform: translateY(-18px) scaleY(1.03); }
    70%  { transform: translateY(2px)  scaleY(0.97); }
    85%  { transform: translateY(-8px)  scaleY(1.01); }
    100% { transform: translateY(0)    scaleY(1);    }
  }
  @keyframes pao-shake {
    0%,100% { transform: translateX(0) rotate(0deg);     }
    18%  { transform: translateX(-14px) rotate(-6deg);  }
    36%  { transform: translateX(14px)  rotate(6deg);   }
    54%  { transform: translateX(-10px) rotate(-4deg);  }
    72%  { transform: translateX(10px)  rotate(4deg);   }
    90%  { transform: translateX(-5px)  rotate(-2deg);  }
  }
  @keyframes pao-spin {
    0%   { transform: rotate(0deg)   scale(1);    }
    30%  { transform: rotate(180deg) scale(1.08); }
    70%  { transform: rotate(330deg) scale(1.04); }
    100% { transform: rotate(360deg) scale(1);    }
  }
  @keyframes pao-sparkle {
    0%   { opacity: 0; transform: translate(-50%,-50%) scale(0) rotate(-20deg); }
    25%  { opacity: 1; transform: translate(-50%,-50%) scale(1.4) rotate(10deg); }
    65%  { opacity: 0.9; transform: translate(-50%,-50%) scale(1.1) rotate(0deg) translateY(-8px); }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(0.6) translateY(-18px); }
  }
  @keyframes pao-heart {
    0%   { opacity: 0; transform: translate(-50%,-50%) scale(0) translateY(0); }
    20%  { opacity: 1; transform: translate(-50%,-50%) scale(1.3) translateY(-5px); }
    80%  { opacity: 0.7; transform: translate(-50%,-50%) scale(1) translateY(-25px); }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(0.7) translateY(-40px); }
  }
  @keyframes pao-ear-wiggle {
    0%,100% { transform: rotate(0deg); }
    30%  { transform: rotate(-14deg); }
    60%  { transform: rotate(12deg);  }
    80%  { transform: rotate(-8deg);  }
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
export default function PandaMascot({
  entered, mouthOpen, pxWidth = 260, onClick,
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

  const [blink,        setBlink]        = useState(false)
  const [clickAnim,    setClickAnim]    = useState('')
  const [showSparkles, setShowSparkles] = useState(false)
  const [sparkKey,     setSparkKey]     = useState(0)
  const [talkFrame,    setTalkFrame]    = useState(0)

  const blinkTimer  = useRef(null)
  const animTimer   = useRef(null)
  const talkTimer   = useRef(null)

  // Auto-blink
  useEffect(() => {
    if (!entered || isShy || isSad) return
    const schedule = () => {
      blinkTimer.current = setTimeout(() => {
        setBlink(true)
        setTimeout(() => { setBlink(false); schedule() }, 150)
      }, 3000 + Math.random() * 2200)
    }
    schedule()
    return () => clearTimeout(blinkTimer.current)
  }, [entered, isShy, isSad])

  // Talking frame cycle — gives a "bobbing" feel beyond just mouth
  useEffect(() => {
    if (isTalking) {
      talkTimer.current = setInterval(() => setTalkFrame(f => (f + 1) % 4), 180)
    } else {
      clearInterval(talkTimer.current)
      setTalkFrame(0)
    }
    return () => clearInterval(talkTimer.current)
  }, [isTalking])

  useEffect(() => () => {
    clearTimeout(blinkTimer.current)
    clearTimeout(animTimer.current)
    clearInterval(talkTimer.current)
  }, [])

  const squint = blink || isShy

  // Handle click — pick random reaction + burst sparkles
  const handleClick = (e) => {
    e.stopPropagation()
    if (onClick) onClick()
    const reaction = CLICK_REACTIONS[Math.floor(Math.random() * CLICK_REACTIONS.length)]
    setClickAnim(reaction.anim)
    setShowSparkles(true)
    setSparkKey(k => k + 1)
    clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => {
      setClickAnim('')
      setShowSparkles(false)
    }, reaction.dur + 200)
  }

  // Talking bob offset — head bobs slightly on each frame
  const talkBobY = isTalking ? [0, -4, -7, -4][talkFrame] : 0
  // Arm swing when talking
  const armSwing  = isTalking ? [-10, 5, 15, 5][talkFrame] : 0
  const armSwingR = isTalking ? [10, -5, -15, -5][talkFrame] : 0

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onClick={handleClick}>
      <style>{PAO_STYLES}</style>

      {/* Sparkle burst */}
      {SPARKLES.map((s, i) => (
        <Spark key={`${sparkKey}-${i}`} {...s} active={showSparkles} />
      ))}

      {/* Click-animation wrapper */}
      <div style={{
        animation: clickAnim
          ? `${clickAnim} ${(CLICK_REACTIONS.find(r => r.anim === clickAnim)?.dur ?? 600)}ms cubic-bezier(.34,1.56,.64,1) both`
          : 'none',
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
            <radialGradient id="pm-headG" cx="33%" cy="26%" r="72%" fx="33%" fy="26%">
              <stop offset="0%"   stopColor="#ffffff"/>
              <stop offset="28%"  stopColor="#f7f7f7"/>
              <stop offset="62%"  stopColor="#e2e2e2"/>
              <stop offset="100%" stopColor="#b8b8b8"/>
            </radialGradient>
            <radialGradient id="pm-bodyG" cx="36%" cy="28%" r="70%" fx="36%" fy="28%">
              <stop offset="0%"   stopColor="#f8f8f8"/>
              <stop offset="55%"  stopColor="#e0e0e0"/>
              <stop offset="100%" stopColor="#b5b5b5"/>
            </radialGradient>
            <radialGradient id="pm-darkG" cx="32%" cy="28%" r="68%">
              <stop offset="0%"   stopColor="#4e4e4e"/>
              <stop offset="45%"  stopColor="#282828"/>
              <stop offset="100%" stopColor="#080808"/>
            </radialGradient>
            <radialGradient id="pm-armG" cx="28%" cy="22%" r="72%">
              <stop offset="0%"   stopColor="#505050"/>
              <stop offset="100%" stopColor="#101010"/>
            </radialGradient>
            <radialGradient id="pm-pawG" cx="38%" cy="30%" r="65%">
              <stop offset="0%"   stopColor="#888"/>
              <stop offset="100%" stopColor="#3a3a3a"/>
            </radialGradient>
            <radialGradient id="pm-irisG" cx="36%" cy="28%" r="72%">
              <stop offset="0%"   stopColor="#C8F0FF"/>
              <stop offset="44%"  stopColor="#52BCDA"/>
              <stop offset="100%" stopColor="#1A8CB8"/>
            </radialGradient>
            <radialGradient id="pm-noseG" cx="34%" cy="28%" r="65%">
              <stop offset="0%"   stopColor="#3a3a3a"/>
              <stop offset="100%" stopColor="#0a0a0a"/>
            </radialGradient>
            <radialGradient id="pm-blushG" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(255,110,140,0.95)"/>
              <stop offset="60%"  stopColor="rgba(255,130,150,0.55)"/>
              <stop offset="100%" stopColor="rgba(255,130,130,0)"/>
            </radialGradient>
            <radialGradient id="pm-mouthG" cx="50%" cy="30%" r="70%">
              <stop offset="0%"   stopColor="#dd4444"/>
              <stop offset="100%" stopColor="#8b1515"/>
            </radialGradient>

            <filter id="pm-fur" x="-12%" y="-12%" width="124%" height="124%">
              <feTurbulence type="fractalNoise" baseFrequency="0.042" numOctaves="4" seed="7" result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="pm-fineFur" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="3" seed="3" result="noise"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="pm-glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>

          {/* ── Ground shadow (breathes when talking) ── */}
          <ellipse cx="150" cy="358" rx="88" ry="10" fill="rgba(0,0,0,0.28)">
            <animate attributeName="rx" values={isTalking ? "88;76;88" : "88;82;88"} dur={isTalking ? "0.45s" : "3s"} repeatCount="indefinite"/>
          </ellipse>

          {/* ── Feet ── */}
          <g filter="url(#pm-fur)">
            <ellipse cx="108" cy="338" rx="46" ry="24" fill="url(#pm-darkG)"/>
            <ellipse cx="192" cy="338" rx="46" ry="24" fill="url(#pm-darkG)"/>
          </g>
          <ellipse cx="108" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>
          <ellipse cx="192" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>
          {[-11,-3,5,13].map((dx,i) => <circle key={i} cx={108+dx} cy={341} r="3" fill="#222" opacity="0.55"/>)}
          {[-11,-3,5,13].map((dx,i) => <circle key={i} cx={192+dx} cy={341} r="3" fill="#222" opacity="0.55"/>)}

          {/* ── Body ── */}
          <g filter="url(#pm-fur)">
            <ellipse cx="150" cy="272" rx="92" ry="84" fill="url(#pm-bodyG)">
              {isTalking && (
                <animate attributeName="ry" values="84;90;84;79;84" dur="0.45s" repeatCount="indefinite"/>
              )}
            </ellipse>
          </g>
          <ellipse cx="148" cy="262" rx="58" ry="52" fill="white" opacity="0.45"/>
          <ellipse cx="144" cy="252" rx="32" ry="28" fill="white" opacity="0.3"/>
          <ellipse cx="150" cy="198" rx="72" ry="18" fill="rgba(0,0,0,0.12)"/>

          {/* ── Left arm (animated when talking) ── */}
          <g transform={`rotate(${armSwing} 68 278)`} style={{ transformOrigin: '68px 278px', transition: 'transform 0.18s ease' }}>
            <g filter="url(#pm-fur)">
              <ellipse cx="68"  cy="278" rx="34" ry="21" fill="url(#pm-armG)" transform="rotate(-28 68 278)"/>
              <ellipse cx="58"  cy="300" rx="27" ry="19" fill="url(#pm-armG)"/>
            </g>
            <ellipse cx="52"  cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
            {[[-6,-1],[0,-3],[6,-1]].map(([dx,dy],i) => <circle key={i} cx={52+dx} cy={308+dy} r="2.8" fill="#222" opacity="0.5"/>)}
          </g>

          {/* ── Right arm (animated when talking) ── */}
          <g transform={`rotate(${armSwingR} 232 278)`} style={{ transformOrigin: '232px 278px', transition: 'transform 0.18s ease' }}>
            <g filter="url(#pm-fur)">
              <ellipse cx="232" cy="278" rx="34" ry="21" fill="url(#pm-armG)" transform="rotate(28 232 278)"/>
              <ellipse cx="242" cy="300" rx="27" ry="19" fill="url(#pm-armG)"/>
            </g>
            <ellipse cx="248" cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
            {[[-6,-1],[0,-3],[6,-1]].map(([dx,dy],i) => <circle key={i} cx={248+dx} cy={308+dy} r="2.8" fill="#222" opacity="0.5"/>)}
          </g>

          {/* ── Raised shy / excited arms ── */}
          {(isShy || isExcited) && (
            <g filter="url(#pm-fur)" opacity="0.95">
              <ellipse cx="90"  cy="158" rx="30" ry="18" fill="url(#pm-armG)" transform="rotate(-55 90 158)"/>
              <ellipse cx="210" cy="158" rx="30" ry="18" fill="url(#pm-armG)" transform="rotate(55 210 158)"/>
              <ellipse cx="78"  cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
              <ellipse cx="222" cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
            </g>
          )}

          {/* ── Talking wave arms ── */}
          {isTalking && !isShy && !isExcited && (
            <g filter="url(#pm-fur)" opacity="0.9">
              <ellipse cx="78"  cy="175" rx="28" ry="17" fill="url(#pm-armG)" transform="rotate(-50 78 175)">
                <animateTransform attributeName="transform" type="rotate" values="-50 78 175; -65 78 175; -45 78 175; -50 78 175" dur="0.45s" repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx="222" cy="175" rx="28" ry="17" fill="url(#pm-armG)" transform="rotate(50 222 175)">
                <animateTransform attributeName="transform" type="rotate" values="50 222 175; 65 222 175; 45 222 175; 50 222 175" dur="0.45s" repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx="66"  cy="158" rx="20" ry="13" fill="url(#pm-pawG)">
                <animate attributeName="cy" values="158;145;158" dur="0.45s" repeatCount="indefinite"/>
                <animate attributeName="cx" values="66;60;66"   dur="0.45s" repeatCount="indefinite"/>
              </ellipse>
              <ellipse cx="234" cy="158" rx="20" ry="13" fill="url(#pm-pawG)">
                <animate attributeName="cy" values="158;145;158" dur="0.45s" repeatCount="indefinite"/>
                <animate attributeName="cx" values="234;240;234" dur="0.45s" repeatCount="indefinite"/>
              </ellipse>
            </g>
          )}

          {/* ── Head group (bobs when talking) ── */}
          <g transform={`translate(0 ${talkBobY})`} style={{ transition: 'transform 0.18s ease' }}>
            <g filter="url(#pm-fur)">
              <circle cx="150" cy="138" r="114" fill="url(#pm-headG)"/>
            </g>

            {/* Specular highlights */}
            <ellipse cx="102" cy="84" rx="40" ry="28" fill="white" opacity="0.38" transform="rotate(-28 102 84)"/>
            <ellipse cx="106" cy="82" rx="22" ry="14" fill="white" opacity="0.42" transform="rotate(-28 106 82)"/>
            <ellipse cx="110" cy="80" rx="10" ry="7"  fill="white" opacity="0.55" transform="rotate(-28 110 80)"/>

            {/* ── Left ear (wiggles when talking) ── */}
            <g transform-origin="57 50">
              <g filter="url(#pm-fineFur)">
                <circle cx="57" cy="50" r="38" fill="url(#pm-darkG)"/>
              </g>
              <circle cx="57" cy="50" r="24" fill="#222"/>
              <ellipse cx="57" cy="54" rx="14" ry="16" fill="rgba(255,110,150,0.65)"/>
              <ellipse cx="50" cy="42" rx="9" ry="6" fill="rgba(80,80,80,0.45)" transform="rotate(-20 50 42)"/>
              {isTalking && (
                <animateTransform attributeName="transform" type="rotate" values="0 57 88; -12 57 88; 10 57 88; -6 57 88; 0 57 88" dur="0.55s" repeatCount="indefinite" additive="sum"/>
              )}
            </g>

            {/* ── Right ear (wiggles when talking) ── */}
            <g transform-origin="243 50">
              <g filter="url(#pm-fineFur)">
                <circle cx="243" cy="50" r="38" fill="url(#pm-darkG)"/>
              </g>
              <circle cx="243" cy="50" r="24" fill="#222"/>
              <ellipse cx="243" cy="54" rx="14" ry="16" fill="rgba(255,110,150,0.65)"/>
              <ellipse cx="236" cy="42" rx="9" ry="6" fill="rgba(80,80,80,0.45)" transform="rotate(20 236 42)"/>
              {isTalking && (
                <animateTransform attributeName="transform" type="rotate" values="0 243 88; 12 243 88; -10 243 88; 6 243 88; 0 243 88" dur="0.55s" repeatCount="indefinite" additive="sum"/>
              )}
            </g>

            {/* Eye patches */}
            <g filter="url(#pm-fineFur)">
              <ellipse cx="103" cy="148" rx="43" ry="40" fill="url(#pm-darkG)" transform="rotate(-13 103 148)"/>
              <ellipse cx="197" cy="148" rx="43" ry="40" fill="url(#pm-darkG)" transform="rotate(13 197 148)"/>
            </g>
            <ellipse cx="96"  cy="138" rx="12" ry="9" fill="rgba(80,80,80,0.3)" transform="rotate(-13 96 138)"/>
            <ellipse cx="190" cy="138" rx="12" ry="9" fill="rgba(80,80,80,0.3)" transform="rotate(13 190 138)"/>

            {/* Eye whites — big for expressiveness */}
            <circle cx="106" cy="145" r="30" fill="white"/>
            <circle cx="194" cy="145" r="30" fill="white"/>

            {/* ── Eyes ── */}
            {squint ? (
              <>
                <ellipse cx="106" cy="145" rx="27" ry="5" fill="#1a1a1a"/>
                <ellipse cx="194" cy="145" rx="27" ry="5" fill="#1a1a1a"/>
                {/* Little curved happy lines above squinted eyes */}
                <path d="M 82,128 Q 106,116 130,128" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
                <path d="M 170,128 Q 194,116 218,128" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round"/>
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
                <circle cx="106" cy="152" r="14" fill="#111"/>
                <circle cx="194" cy="152" r="14" fill="#111"/>
                {/* Large sparkle */}
                <circle cx="118" cy="137" r="11" fill="white"/>
                <circle cx="206" cy="137" r="11" fill="white"/>
                <circle cx="100" cy="158" r="4.5" fill="white" opacity="0.5"/>
                <circle cx="188" cy="158" r="4.5" fill="white" opacity="0.5"/>
                {/* Sad brows */}
                <path d="M 78,106 Q 96,94 126,108"  fill="none" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round"/>
                <path d="M 174,108 Q 204,94 222,106" fill="none" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round"/>
                {/* Tear */}
                <ellipse cx="118" cy="196" rx="5.5" ry="14" fill="#90c8ff" opacity=".9"/>
              </>
            ) : (
              <>
                {/* Big bright iris */}
                <circle cx="106" cy="148" r="24" fill="url(#pm-irisG)"/>
                <circle cx="194" cy="148" r="24" fill="url(#pm-irisG)"/>
                {/* Dark pupil */}
                <circle cx="106" cy="152" r="14" fill="#111"/>
                <circle cx="194" cy="152" r="14" fill="#111"/>
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
                    <path d="M 76,102 Q 107,88 138,102"  fill="none" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round"/>
                    <path d="M 162,102 Q 193,88 224,102" fill="none" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round"/>
                  </>
                )}

                {/* Talking eye sparkle pulse */}
                {isTalking && (
                  <>
                    <circle cx="118" cy="136" r="11" fill="white">
                      <animate attributeName="r" values="11;14;11" dur="0.45s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="1;0.7;1" dur="0.45s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="206" cy="136" r="11" fill="white">
                      <animate attributeName="r" values="11;14;11" dur="0.45s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="1;0.7;1" dur="0.45s" repeatCount="indefinite"/>
                    </circle>
                  </>
                )}
              </>
            )}

            {/* ── Nose ── */}
            <ellipse cx="150" cy="182" rx="15" ry="10" fill="url(#pm-noseG)"/>
            <ellipse cx="145" cy="178" rx="6"  ry="3.5" fill="white" opacity="0.42"/>

            {/* ── Mouth ── */}
            {mouthOpen ? (
              <>
                {/* Open mouth — bigger and rounder, more expressive */}
                <ellipse cx="150" cy="200" rx="20" ry="16" fill="url(#pm-mouthG)" stroke="#111" strokeWidth="1.5">
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
                stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"
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
