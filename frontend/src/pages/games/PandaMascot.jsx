import { useState, useEffect, useRef } from 'react'
import { OUTFIT_MAP } from './PaoOutfits'

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

  const [blink, setBlink] = useState(false)
  const blinkRef = useRef(null)
  useEffect(() => {
    if (!entered || isShy || isSad) return
    const go = () => {
      blinkRef.current = setTimeout(() => {
        setBlink(true)
        setTimeout(() => { setBlink(false); go() }, 140)
      }, 4200 + Math.random() * 1800)
    }
    go()
    return () => clearTimeout(blinkRef.current)
  }, [entered, isShy, isSad])

  const squint = blink || isShy

  return (
    <svg
      viewBox={`0 ${-padTop} 300 ${vbH}`}
      width={pxWidth} height={pxHeight}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        filter: 'drop-shadow(0 18px 38px rgba(0,0,0,0.5))',
        transform: isShy ? 'rotate(-6deg)' : 'rotate(0deg)',
        transition: 'transform 0.4s ease',
        overflow: 'visible',
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
          <stop offset="0%"   stopColor="#A8E8F8"/>
          <stop offset="44%"  stopColor="#52BCDA"/>
          <stop offset="100%" stopColor="#1A8CB8"/>
        </radialGradient>
        <radialGradient id="pm-noseG" cx="34%" cy="28%" r="65%">
          <stop offset="0%"   stopColor="#3a3a3a"/>
          <stop offset="100%" stopColor="#0a0a0a"/>
        </radialGradient>
        <radialGradient id="pm-blushG" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,130,130,0.85)"/>
          <stop offset="100%" stopColor="rgba(255,130,130,0)"/>
        </radialGradient>
        <radialGradient id="pm-mouthG" cx="50%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#cc3333"/>
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
      </defs>

      {/* Ground shadow */}
      <ellipse cx="150" cy="358" rx="88" ry="10" fill="rgba(0,0,0,0.28)">
        <animate attributeName="rx" values="88;82;88" dur="3s" repeatCount="indefinite"/>
      </ellipse>

      {/* Feet */}
      <g filter="url(#pm-fur)">
        <ellipse cx="108" cy="338" rx="46" ry="24" fill="url(#pm-darkG)"/>
        <ellipse cx="192" cy="338" rx="46" ry="24" fill="url(#pm-darkG)"/>
      </g>
      <ellipse cx="108" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>
      <ellipse cx="192" cy="344" rx="34" ry="14" fill="url(#pm-pawG)"/>
      {[-11,-3,5,13].map((dx,i) => <circle key={i} cx={108+dx} cy={341} r="3" fill="#222" opacity="0.55"/>)}
      {[-11,-3,5,13].map((dx,i) => <circle key={i} cx={192+dx} cy={341} r="3" fill="#222" opacity="0.55"/>)}

      {/* Body */}
      <g filter="url(#pm-fur)">
        <ellipse cx="150" cy="272" rx="92" ry="84" fill="url(#pm-bodyG)"/>
      </g>
      <ellipse cx="148" cy="262" rx="58" ry="52" fill="white" opacity="0.45"/>
      <ellipse cx="144" cy="252" rx="32" ry="28" fill="white" opacity="0.3"/>
      <ellipse cx="150" cy="198" rx="72" ry="18" fill="rgba(0,0,0,0.12)"/>

      {/* Arms */}
      <g filter="url(#pm-fur)">
        <ellipse cx="68"  cy="278" rx="34" ry="21" fill="url(#pm-armG)" transform="rotate(-28 68 278)"/>
        <ellipse cx="58"  cy="300" rx="27" ry="19" fill="url(#pm-armG)"/>
        <ellipse cx="232" cy="278" rx="34" ry="21" fill="url(#pm-armG)" transform="rotate(28 232 278)"/>
        <ellipse cx="242" cy="300" rx="27" ry="19" fill="url(#pm-armG)"/>
      </g>
      <ellipse cx="52"  cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
      <ellipse cx="248" cy="308" rx="22" ry="14" fill="url(#pm-pawG)"/>
      {[[-6,-1],[0,-3],[6,-1]].map(([dx,dy],i) => <circle key={i} cx={52+dx}  cy={308+dy} r="2.8" fill="#222" opacity="0.5"/>)}
      {[[-6,-1],[0,-3],[6,-1]].map(([dx,dy],i) => <circle key={i} cx={248+dx} cy={308+dy} r="2.8" fill="#222" opacity="0.5"/>)}

      {/* Raised / shy arms */}
      {(isShy || isExcited) && (
        <g filter="url(#pm-fur)" opacity="0.95">
          <ellipse cx="90"  cy="158" rx="30" ry="18" fill="url(#pm-armG)" transform="rotate(-55 90 158)"/>
          <ellipse cx="210" cy="158" rx="30" ry="18" fill="url(#pm-armG)" transform="rotate(55 210 158)"/>
          <ellipse cx="78"  cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
          <ellipse cx="222" cy="142" rx="24" ry="16" fill="url(#pm-pawG)"/>
        </g>
      )}

      {/* Head */}
      <g filter="url(#pm-fur)">
        <circle cx="150" cy="138" r="114" fill="url(#pm-headG)"/>
      </g>

      {/* Specular highlights */}
      <ellipse cx="102" cy="84" rx="40" ry="28" fill="white" opacity="0.38" transform="rotate(-28 102 84)"/>
      <ellipse cx="106" cy="82" rx="22" ry="14" fill="white" opacity="0.42" transform="rotate(-28 106 82)"/>
      <ellipse cx="110" cy="80" rx="10" ry="7"  fill="white" opacity="0.55" transform="rotate(-28 110 80)"/>

      {/* Ears — drawn after head so they sit on top */}
      <g filter="url(#pm-fineFur)">
        <circle cx="57"  cy="50" r="38" fill="url(#pm-darkG)"/>
        <circle cx="243" cy="50" r="38" fill="url(#pm-darkG)"/>
      </g>
      <circle cx="57"  cy="50" r="24" fill="#222"/>
      <circle cx="243" cy="50" r="24" fill="#222"/>
      {/* cute pink inner ear */}
      <ellipse cx="57"  cy="54" rx="12" ry="14" fill="rgba(255,140,160,0.52)"/>
      <ellipse cx="243" cy="54" rx="12" ry="14" fill="rgba(255,140,160,0.52)"/>
      <ellipse cx="50"  cy="42" rx="9" ry="6" fill="rgba(80,80,80,0.45)" transform="rotate(-20 50 42)"/>
      <ellipse cx="236" cy="42" rx="9" ry="6" fill="rgba(80,80,80,0.45)" transform="rotate(20 236 42)"/>

      {/* Eye patches */}
      <g filter="url(#pm-fineFur)">
        <ellipse cx="103" cy="148" rx="41" ry="38" fill="url(#pm-darkG)" transform="rotate(-13 103 148)"/>
        <ellipse cx="197" cy="148" rx="41" ry="38" fill="url(#pm-darkG)" transform="rotate(13 197 148)"/>
      </g>
      <ellipse cx="96"  cy="138" rx="12" ry="9" fill="rgba(80,80,80,0.3)" transform="rotate(-13 96 138)"/>
      <ellipse cx="190" cy="138" rx="12" ry="9" fill="rgba(80,80,80,0.3)" transform="rotate(13 190 138)"/>

      {/* Eye whites — slightly bigger for cuter look */}
      <circle cx="106" cy="145" r="28" fill="white"/>
      <circle cx="194" cy="145" r="28" fill="white"/>

      {/* Eyes */}
      {squint ? (
        <>
          <ellipse cx="106" cy="145" rx="26" ry="5" fill="#1a1a1a"/>
          <ellipse cx="194" cy="145" rx="26" ry="5" fill="#1a1a1a"/>
          {isShy && <>
            <line x1="72"  y1="165" x2="88"  y2="170" stroke="#ff8888" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
            <line x1="68"  y1="172" x2="85"  y2="175" stroke="#ff8888" strokeWidth="2"   strokeLinecap="round" opacity="0.5"/>
            <line x1="212" y1="165" x2="228" y2="170" stroke="#ff8888" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
            <line x1="215" y1="172" x2="232" y2="175" stroke="#ff8888" strokeWidth="2"   strokeLinecap="round" opacity="0.5"/>
          </>}
        </>
      ) : isSad ? (
        <>
          {/* bigger teal iris */}
          <circle cx="106" cy="148" r="22" fill="url(#pm-irisG)"/>
          <circle cx="194" cy="148" r="22" fill="url(#pm-irisG)"/>
          <circle cx="106" cy="151" r="13" fill="#111"/>
          <circle cx="194" cy="151" r="13" fill="#111"/>
          {/* big sparkle */}
          <circle cx="116" cy="138" r="10" fill="white"/>
          <circle cx="204" cy="138" r="10" fill="white"/>
          <circle cx="100" cy="157" r="4"  fill="white" opacity="0.48"/>
          <circle cx="188" cy="157" r="4"  fill="white" opacity="0.48"/>
          {/* sad brows */}
          <path d="M 78,106 Q 96,94 126,108"  fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
          <path d="M 174,108 Q 204,94 222,106" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
          <ellipse cx="118" cy="192" rx="5" ry="13" fill="#90c8ff" opacity=".85"/>
        </>
      ) : (
        <>
          {/* big bright teal iris */}
          <circle cx="106" cy="148" r="22" fill="url(#pm-irisG)"/>
          <circle cx="194" cy="148" r="22" fill="url(#pm-irisG)"/>
          {/* dark pupil */}
          <circle cx="106" cy="151" r="13" fill="#111"/>
          <circle cx="194" cy="151" r="13" fill="#111"/>
          {/* large white sparkle — key cute feature */}
          <circle cx="116" cy="137" r="10" fill="white"/>
          <circle cx="204" cy="137" r="10" fill="white"/>
          {/* small secondary glint */}
          <circle cx="99"  cy="158" r="4.5" fill="white" opacity="0.50"/>
          <circle cx="187" cy="158" r="4.5" fill="white" opacity="0.50"/>
          {(isHappy || isExcited) && (
            <>
              <path d="M 76,102 Q 107,90 138,102"  fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
              <path d="M 162,102 Q 193,90 224,102" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round"/>
            </>
          )}
        </>
      )}

      {/* Nose */}
      <ellipse cx="150" cy="180" rx="13" ry="9" fill="url(#pm-noseG)"/>
      <ellipse cx="145" cy="176" rx="5"  ry="3" fill="white" opacity="0.38"/>

      {/* Mouth */}
      {mouthOpen ? (
        <>
          <ellipse cx="150" cy="196" rx="14" ry="11" fill="url(#pm-mouthG)" stroke="#111" strokeWidth="1.5"/>
          <ellipse cx="150" cy="202" rx="8"  ry="5"  fill="#e87070"/>
          <rect x="141" y="188" width="18" height="5" rx="2" fill="white" opacity="0.88"/>
        </>
      ) : (
        <path
          d={isHappy || isExcited
            ? 'M 128 190 Q 150 212 172 190'
            : 'M 136 190 Q 150 206 164 190'}
          stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round"
        />
      )}

      {/* Cheek blush — always clearly visible, cuter */}
      <ellipse cx="72"  cy="172" rx="30" ry="19" fill="url(#pm-blushG)" opacity={isShy ? 1 : 0.68}/>
      <ellipse cx="228" cy="172" rx="30" ry="19" fill="url(#pm-blushG)" opacity={isShy ? 1 : 0.68}/>

      {/* Outfit accessories */}
      {['shoes','pants','clothes','hair'].map(cat => {
        const id = accessories[cat]
        if (!id || id === 'none') return null
        const Comp = OUTFIT_MAP[cat]?.[id]
        return Comp ? <Comp key={`${cat}-${id}`}/> : null
      })}
    </svg>
  )
}
