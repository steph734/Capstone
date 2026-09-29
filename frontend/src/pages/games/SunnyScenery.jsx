// Shared sky/sun/clouds/hills backdrop — used by the Game Library
// (GamifiedFullPage) and by any game screen that wants the same sunny scene
// behind it (e.g. Puzzle Pals). The `gfSunPulse` / `gfCloudDrift` keyframes
// these depend on live in each caller's own <style> block, since each
// renders independently and animations don't carry across files.

export function Sun() {
  return (
    <div style={{ position:'absolute', top:'5%', left:'6%', width:130, height:130, animation:'gfSunPulse 5s ease-in-out infinite', pointerEvents:'none' }}>
      <svg viewBox="0 0 120 120" width={130} height={130}>
        <defs>
          <radialGradient id="gfSunGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffe28a"/>
            <stop offset="100%" stopColor="#ffb648"/>
          </radialGradient>
        </defs>
        <g fill="#ffd76a">
          {[...Array(12)].map((_,i) => (
            <rect key={i} x="57" y="2" width="6" height="20" rx="3" transform={`rotate(${i*30} 60 60)`}/>
          ))}
        </g>
        <circle cx="60" cy="60" r="34" fill="url(#gfSunGrad)"/>
        <circle cx="42" cy="66" r="6" fill="#ff9eb0" opacity=".55"/>
        <circle cx="78" cy="66" r="6" fill="#ff9eb0" opacity=".55"/>
        <circle cx="50" cy="57" r="3.5" fill="#7a5324"/>
        <circle cx="70" cy="57" r="3.5" fill="#7a5324"/>
        <path d="M48 69 Q60 79 72 69" stroke="#7a5324" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

export function Cloud({ x, y, size = 100, delay = 0, dur = 7 }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, animation:`gfCloudDrift ${dur}s ease-in-out ${delay}s infinite`, pointerEvents:'none' }}>
      <svg viewBox="0 0 100 60" width={size} height={size * 0.6}>
        <ellipse cx="30" cy="38" rx="26" ry="18" fill="#fff"/>
        <ellipse cx="55" cy="26" rx="23" ry="21" fill="#fff"/>
        <ellipse cx="76" cy="40" rx="20" ry="15" fill="#fff"/>
        <rect x="16" y="36" width="68" height="18" rx="9" fill="#fff"/>
      </svg>
    </div>
  )
}

function Flower({ x, bottom, hue }) {
  return (
    <div style={{ position:'absolute', left:x, bottom, pointerEvents:'none' }}>
      <svg viewBox="0 0 24 24" width={22} height={22}>
        <g fill={hue}>
          <circle cx="12" cy="6" r="4"/>
          <circle cx="18" cy="12" r="4"/>
          <circle cx="12" cy="18" r="4"/>
          <circle cx="6" cy="12" r="4"/>
        </g>
        <circle cx="12" cy="12" r="4" fill="#ffd93d"/>
      </svg>
    </div>
  )
}

const FLOWERS = [
  { x:'3%',  bottom:'16vh', hue:'#ffffff' },
  { x:'9%',  bottom:'11vh', hue:'#f59e0b' },
  { x:'15%', bottom:'15vh', hue:'#ec4899' },
  { x:'86%', bottom:'12vh', hue:'#f59e0b' },
  { x:'91%', bottom:'17vh', hue:'#ffffff' },
  { x:'80%', bottom:'10vh', hue:'#ec4899' },
]

export function HillsScenery() {
  return (
    <>
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ position:'absolute', left:0, right:0, bottom:0, width:'100%', height:'24vh', minHeight:150, pointerEvents:'none' }}>
        <path d="M0,120 C180,40 360,40 500,90 C650,145 750,60 900,70 C1080,82 1200,150 1440,110 L1440,260 L0,260 Z" fill="#8fe07a"/>
        <path d="M0,170 C200,120 380,195 560,160 C720,128 880,180 1000,158 C1150,132 1300,195 1440,160 L1440,260 L0,260 Z" fill="#6bcf5a"/>
      </svg>
      {FLOWERS.map((f,i) => <Flower key={i} {...f}/>)}
    </>
  )
}

export default function SunnyScenery() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg,#87ceeb 0%,#b8e6f5 60%,#d4f1e8 100%)', pointerEvents: 'none' }}>
      <Sun/>
      <Cloud x="8%" y="8%" size={90} delay={0} dur={8}/>
      <Cloud x="70%" y="5%" size={110} delay={1.5} dur={9}/>
      <Cloud x="85%" y="22%" size={70} delay={.6} dur={7}/>
      <HillsScenery/>
    </div>
  )
}
