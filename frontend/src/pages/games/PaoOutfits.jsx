// SVG outfit accessories for Pao — all designed for viewBox="0 0 300 366"
// Head center (150,138) r≈114 | Body ellipse (150,272) rx=92 ry=84
// Feet L(108,338) R(192,338) | Arms L(68,278) R(232,278)

// ─── star helper ─────────────────────────────────────────────────────────────
function star(cx, cy, r1=5.5, r2=2.4, n=5) {
  return Array.from({length:n*2}, (_,i) => {
    const a = (i*Math.PI/n) - Math.PI/2
    const r = i%2===0 ? r1 : r2
    return `${(cx+r*Math.cos(a)).toFixed(1)},${(cy+r*Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

// ═══ HAIR ════════════════════════════════════════════════════════════════════

export function HairWizardHat() {
  return (
    <g>
      <ellipse cx="150" cy="57" rx="76" ry="18" fill="#1e0536" opacity=".28"/>
      <polygon points="150,-26 80,52 220,52" fill="#7c3aed"/>
      <polygon points="150,-26 80,52 134,52" fill="#4c1d95" opacity=".5"/>
      <polygon points="150,-26 156,4 172,52 156,52" fill="rgba(255,255,255,.1)"/>
      <ellipse cx="150" cy="52" rx="76" ry="18" fill="#b45309"/>
      <ellipse cx="150" cy="48" rx="64" ry="13" fill="#fbbf24"/>
      <ellipse cx="130" cy="44" rx="26" ry="7" fill="rgba(255,255,255,.22)"/>
      {[[130,12],[154,4],[173,28],[139,38],[165,43]].map(([x,y],i)=>(
        <polygon key={i} points={star(x,y,5.5,2.4)} fill="#fde68a"/>
      ))}
      <circle cx="150" cy="-26" r="5.5" fill="#fde68a" opacity=".9"/>
      <line x1="143" y1="-34" x2="157" y2="-34" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
      <line x1="150" y1="-38" x2="150" y2="-28" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
    </g>
  )
}

export function HairPartyHat() {
  const cols=['#fbbf24','#f43f5e','#8b5cf6','#3b82f6','#34d399','#fb923c']
  return (
    <g>
      <polygon points="150,-10 92,50 208,50" fill="#f43f5e"/>
      <polygon points="150,-10 92,50 128,50" fill="#be123c" opacity=".4"/>
      {[[120,40,100,50],[142,24,122,50],[160,30,148,50],[176,40,164,50]].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.55)" strokeWidth="3.5" strokeLinecap="round"/>
      ))}
      <ellipse cx="150" cy="50" rx="60" ry="13" fill="#be123c"/>
      <ellipse cx="136" cy="46" rx="24" ry="7" fill="rgba(255,255,255,.2)"/>
      <circle cx="150" cy="-18" r="15" fill="white"/>
      {cols.map((c,i)=>(
        <circle key={i} cx={150+Math.cos(i*60*Math.PI/180)*9} cy={-18+Math.sin(i*60*Math.PI/180)*9} r="5" fill={c}/>
      ))}
      <circle cx="150" cy="-18" r="4" fill="#fde68a"/>
    </g>
  )
}

export function HairFlowerCrown() {
  const fl=[
    {x:90,y:66,c:'#f472b6',s:10},{x:110,y:44,c:'#fbbf24',s:11},
    {x:130,y:30,c:'#fb7185',s:10},{x:150,y:26,c:'#a78bfa',s:12},
    {x:170,y:30,c:'#f472b6',s:10},{x:190,y:44,c:'#4ade80',s:11},
    {x:210,y:66,c:'#60a5fa',s:10},
  ]
  return (
    <g>
      <path d="M 86,72 Q 110,44 150,28 Q 190,44 214,72" fill="none" stroke="#4ade80" strokeWidth="4.5" strokeLinecap="round"/>
      {fl.map((f,fi)=>(
        <g key={fi}>
          {[0,60,120,180,240,300].map((a,i)=>{
            const r=a*Math.PI/180
            return <ellipse key={i} cx={f.x+Math.cos(r)*f.s} cy={f.y+Math.sin(r)*f.s} rx={f.s*.48} ry={f.s*.72} fill={f.c} opacity=".88" transform={`rotate(${a+90},${f.x+Math.cos(r)*f.s},${f.y+Math.sin(r)*f.s})`}/>
          })}
          <circle cx={f.x} cy={f.y} r={f.s*.38} fill="#fef08a"/>
        </g>
      ))}
    </g>
  )
}

export function HairBunnyEars() {
  return (
    <g>
      <ellipse cx="96" cy="-10" rx="25" ry="56" fill="white" stroke="#e5e7eb" strokeWidth="2"/>
      <ellipse cx="96" cy="-12" rx="14" ry="42" fill="#fca5a5" opacity=".72"/>
      <ellipse cx="91" cy="-22" rx="5.5" ry="15" fill="rgba(255,255,255,.45)"/>
      <ellipse cx="204" cy="-10" rx="25" ry="56" fill="white" stroke="#e5e7eb" strokeWidth="2"/>
      <ellipse cx="204" cy="-12" rx="14" ry="42" fill="#fca5a5" opacity=".72"/>
      <ellipse cx="199" cy="-22" rx="5.5" ry="15" fill="rgba(255,255,255,.45)"/>
    </g>
  )
}

export function HairBackwardsCap() {
  return (
    <g>
      <ellipse cx="84" cy="70" rx="42" ry="12" fill="#1d4ed8" transform="rotate(-8 84 70)"/>
      <ellipse cx="72" cy="67" rx="30" ry="8" fill="#2563eb" opacity=".6" transform="rotate(-8 72 67)"/>
      <path d="M 82,70 Q 78,14 150,10 Q 222,14 218,70 Z" fill="#3b82f6"/>
      <path d="M 82,70 Q 80,16 126,12 Q 150,10 150,46 Q 118,42 82,70" fill="#60a5fa" opacity=".38"/>
      <circle cx="150" cy="11" r="5" fill="#2563eb"/>
      <line x1="150" y1="11" x2="150" y2="70" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4,3" opacity=".55"/>
      <circle cx="150" cy="44" r="12" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.5"/>
      <text x="150" y="49" textAnchor="middle" fontSize="13" fill="white" fontWeight="900" fontFamily="Arial,sans-serif">P</text>
      <rect x="112" y="66" width="28" height="8" rx="4" fill="#1d4ed8"/>
      <rect x="124" y="66" width="4" height="8" rx="1" fill="#60a5fa"/>
    </g>
  )
}

// ═══ CLOTHES ══════════════════════════════════════════════════════════════════

export function ClothesRainbowTee() {
  const stripes=[['#ef4444',200],['#f97316',218],['#eab308',236],['#22c55e',254],['#3b82f6',272],['#8b5cf6',290],['#ec4899',308]]
  return (
    <g>
      <defs><clipPath id="crt"><ellipse cx="150" cy="272" rx="91" ry="83"/></clipPath></defs>
      <ellipse cx="150" cy="272" rx="91" ry="83" fill="#fff7ed" opacity=".92"/>
      <g clipPath="url(#crt)">
        {stripes.map(([c,y])=><rect key={y} x="58" y={y} width="184" height="18" fill={c} opacity=".82"/>)}
      </g>
      <path d="M 126,200 Q 150,213 174,200" fill="none" stroke="#dc2626" strokeWidth="5" strokeLinecap="round"/>
      <ellipse cx="68"  cy="278" rx="34" ry="21" fill="#ef4444" opacity=".82" transform="rotate(-28 68 278)"/>
      <ellipse cx="58"  cy="300" rx="27" ry="19" fill="#f97316" opacity=".82"/>
      <ellipse cx="232" cy="278" rx="34" ry="21" fill="#ef4444" opacity=".82" transform="rotate(28 232 278)"/>
      <ellipse cx="242" cy="300" rx="27" ry="19" fill="#f97316" opacity=".82"/>
    </g>
  )
}

export function ClothesAstronaut() {
  return (
    <g>
      <defs><clipPath id="cast"><ellipse cx="150" cy="272" rx="93" ry="85"/></clipPath></defs>
      <ellipse cx="150" cy="272" rx="93" ry="85" fill="#e5e7eb" opacity=".95"/>
      <g clipPath="url(#cast)">
        <line x1="150" y1="190" x2="150" y2="355" stroke="#9ca3af" strokeWidth="2.5" opacity=".4"/>
        <line x1="58"  y1="272" x2="242" y2="272" stroke="#9ca3af" strokeWidth="2"   opacity=".35"/>
        <rect x="115" y="220" width="28" height="18" rx="4" fill="#3b82f6" opacity=".8"/>
        <rect x="157" y="220" width="28" height="18" rx="4" fill="#ef4444" opacity=".75"/>
        <circle cx="150" cy="282" r="28" fill="#dbeafe" stroke="#6b7280" strokeWidth="3"/>
        <circle cx="150" cy="282" r="22" fill="#bfdbfe"/>
        <ellipse cx="142" cy="274" rx="8" ry="6" fill="rgba(255,255,255,.5)"/>
      </g>
      <ellipse cx="150" cy="202" rx="40" ry="13" fill="#d1d5db" stroke="#9ca3af" strokeWidth="2"/>
      <ellipse cx="148" cy="198" rx="28" ry="8" fill="rgba(255,255,255,.3)"/>
      <ellipse cx="68"  cy="278" rx="36" ry="22" fill="#e5e7eb" opacity=".95" stroke="#9ca3af" strokeWidth="1.5" transform="rotate(-28 68 278)"/>
      <ellipse cx="58"  cy="300" rx="28" ry="20" fill="#d1d5db" opacity=".95" stroke="#9ca3af" strokeWidth="1.5"/>
      <ellipse cx="232" cy="278" rx="36" ry="22" fill="#e5e7eb" opacity=".95" stroke="#9ca3af" strokeWidth="1.5" transform="rotate(28 232 278)"/>
      <ellipse cx="242" cy="300" rx="28" ry="20" fill="#d1d5db" opacity=".95" stroke="#9ca3af" strokeWidth="1.5"/>
    </g>
  )
}

export function ClothesHeroTee() {
  return (
    <g>
      <defs><clipPath id="cht"><ellipse cx="150" cy="272" rx="91" ry="83"/></clipPath></defs>
      <path d="M 95,205 Q 56,295 66,345 Q 100,358 130,312 Q 150,360 170,312 Q 200,358 234,345 Q 244,295 205,205" fill="#6d28d9" opacity=".88"/>
      <ellipse cx="150" cy="272" rx="91" ry="83" fill="#dc2626" opacity=".92"/>
      <g clipPath="url(#cht)">
        <rect x="62" y="295" width="176" height="15" fill="#fbbf24"/>
        <rect x="141" y="290" width="18" height="24" rx="3" fill="#d97706"/>
        <polygon points="155,220 144,253 157,253 145,285 170,246 156,246 167,220" fill="#fde68a"/>
      </g>
      <path d="M 118,198 L 150,222 L 182,198" fill="#b91c1c" stroke="#b91c1c" strokeWidth="3" strokeLinejoin="round"/>
      <ellipse cx="68"  cy="278" rx="34" ry="21" fill="#dc2626" opacity=".92" transform="rotate(-28 68 278)"/>
      <ellipse cx="58"  cy="300" rx="27" ry="19" fill="#b91c1c" opacity=".92"/>
      <ellipse cx="232" cy="278" rx="34" ry="21" fill="#dc2626" opacity=".92" transform="rotate(28 232 278)"/>
      <ellipse cx="242" cy="300" rx="27" ry="19" fill="#b91c1c" opacity=".92"/>
    </g>
  )
}

export function ClothesCozyHoodie() {
  return (
    <g>
      <defs><clipPath id="cch"><ellipse cx="150" cy="272" rx="91" ry="83"/></clipPath></defs>
      <ellipse cx="150" cy="272" rx="91" ry="83" fill="#7c3aed" opacity=".9"/>
      <g clipPath="url(#cch)">
        <path d="M 108,286 Q 150,280 192,286 Q 192,328 150,330 Q 108,328 108,286 Z" fill="#6d28d9" opacity=".85"/>
        <ellipse cx="150" cy="306" rx="7" ry="6" fill="#5b21b6" opacity=".7"/>
        {[[-11,-6],[11,-6],[-14,2],[14,2]].map(([dx,dy],i)=>(
          <ellipse key={i} cx={150+dx} cy={306+dy} rx="3.5" ry="4" fill="#5b21b6" opacity=".7"/>
        ))}
        <line x1="150" y1="198" x2="150" y2="282" stroke="#6d28d9" strokeWidth="3" strokeDasharray="7,5" opacity=".5"/>
      </g>
      {/* Panda-ear hood bumps visible below head */}
      <circle cx="104" cy="195" r="18" fill="#6d28d9"/>
      <circle cx="104" cy="187" r="11" fill="#5b21b6"/>
      <circle cx="196" cy="195" r="18" fill="#6d28d9"/>
      <circle cx="196" cy="187" r="11" fill="#5b21b6"/>
      <path d="M 106,206 Q 150,225 194,206" fill="#6d28d9" stroke="#5b21b6" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="68"  cy="278" rx="34" ry="21" fill="#7c3aed" opacity=".92" transform="rotate(-28 68 278)"/>
      <ellipse cx="58"  cy="300" rx="27" ry="19" fill="#7c3aed" opacity=".92"/>
      <ellipse cx="232" cy="278" rx="34" ry="21" fill="#7c3aed" opacity=".92" transform="rotate(28 232 278)"/>
      <ellipse cx="242" cy="300" rx="27" ry="19" fill="#7c3aed" opacity=".92"/>
      <ellipse cx="52"  cy="308" rx="22" ry="14" fill="#6d28d9" opacity=".9"/>
      <ellipse cx="248" cy="308" rx="22" ry="14" fill="#6d28d9" opacity=".9"/>
    </g>
  )
}

export function ClothesStarOveralls() {
  return (
    <g>
      <defs><clipPath id="cso"><ellipse cx="150" cy="272" rx="91" ry="83"/></clipPath></defs>
      <ellipse cx="150" cy="272" rx="91" ry="83" fill="#1d4ed8" opacity=".88"/>
      <g clipPath="url(#cso)">
        <rect x="118" y="196" width="64" height="60" rx="6" fill="#2563eb"/>
        <polygon points={star(150,208,10,4.5)} fill="#fbbf24"/>
        <rect x="122" y="218" width="20" height="16" rx="3" fill="#1d4ed8"/>
        <circle cx="122" cy="200" r="5.5" fill="#93c5fd" stroke="#1e40af" strokeWidth="1.5"/>
        <circle cx="178" cy="200" r="5.5" fill="#93c5fd" stroke="#1e40af" strokeWidth="1.5"/>
        {[80,108,146,168,202,222].map((x,i)=>(
          <rect key={i} x={x} y={256} width="6" height="13" rx="3" fill="#3b82f6" opacity=".7"/>
        ))}
      </g>
      <ellipse cx="68"  cy="278" rx="34" ry="21" fill="#1d4ed8" opacity=".85" transform="rotate(-28 68 278)"/>
      <ellipse cx="58"  cy="300" rx="27" ry="19" fill="#1d4ed8" opacity=".85"/>
      <ellipse cx="232" cy="278" rx="34" ry="21" fill="#1d4ed8" opacity=".85" transform="rotate(28 232 278)"/>
      <ellipse cx="242" cy="300" rx="27" ry="19" fill="#1d4ed8" opacity=".85"/>
    </g>
  )
}

// ═══ PANTS ════════════════════════════════════════════════════════════════════

const PANTS_PATH = "M 60,282 Q 62,362 108,362 Q 138,364 150,356 Q 162,364 192,362 Q 238,362 240,282 Q 198,298 150,298 Q 102,298 60,282 Z"

export function PantsPolkaDots() {
  const dots=[[88,300,'#f43f5e'],[120,316,'#fbbf24'],[148,302,'#a78bfa'],[178,318,'#34d399'],[208,304,'#3b82f6'],[96,336,'#fb923c'],[134,348,'#ec4899'],[166,336,'#fbbf24'],[200,348,'#a78bfa'],[72,324,'#34d399'],[218,328,'#f43f5e'],[110,322,'#3b82f6']]
  return (
    <g>
      <defs><clipPath id="ppd"><path d={PANTS_PATH}/></clipPath></defs>
      <path d={PANTS_PATH} fill="#1e1b4b" opacity=".88"/>
      <g clipPath="url(#ppd)">
        {dots.map(([x,y,c],i)=><circle key={i} cx={x} cy={y} r="8" fill={c} opacity=".85"/>)}
      </g>
      <rect x="62" y="280" width="176" height="10" rx="5" fill="#312e81" opacity=".9"/>
    </g>
  )
}

export function PantsCargo() {
  return (
    <g>
      <defs><clipPath id="pca"><path d={PANTS_PATH}/></clipPath></defs>
      <path d={PANTS_PATH} fill="#65a30d" opacity=".88"/>
      <g clipPath="url(#pca)">
        <rect x="66" y="302" width="38" height="28" rx="4" fill="#4d7c0f" stroke="#365314" strokeWidth="1.5"/>
        <line x1="66" y1="313" x2="104" y2="313" stroke="#365314" strokeWidth="1.5" opacity=".7"/>
        <circle cx="85" cy="302" r="3" fill="#365314"/>
        <rect x="196" y="302" width="38" height="28" rx="4" fill="#4d7c0f" stroke="#365314" strokeWidth="1.5"/>
        <line x1="196" y1="313" x2="234" y2="313" stroke="#365314" strokeWidth="1.5" opacity=".7"/>
        <circle cx="215" cy="302" r="3" fill="#365314"/>
        {[84,108,144,164,196,224].map((x,i)=>(
          <rect key={i} x={x} y={282} width="5" height="11" rx="2" fill="#4d7c0f"/>
        ))}
      </g>
      <rect x="62" y="280" width="176" height="11" rx="5.5" fill="#78350f" opacity=".9"/>
      <rect x="138" y="280" width="24" height="11" rx="3" fill="#92400e"/>
      <rect x="146" y="281" width="8" height="9" rx="1" fill="#b45309"/>
    </g>
  )
}

export function PantsPajamas() {
  const stripes=['#bfdbfe','#93c5fd','#bfdbfe','#93c5fd','#bfdbfe','#93c5fd','#bfdbfe','#93c5fd','#bfdbfe']
  // tiny moon and star SVG shapes instead of emoji text
  const moons=[[88,320],[172,312],[82,348],[214,320]]
  const stars=[[122,344],[202,336],[160,316]]
  return (
    <g>
      <defs><clipPath id="ppj"><path d={PANTS_PATH}/></clipPath></defs>
      <path d={PANTS_PATH} fill="#bfdbfe" opacity=".9"/>
      <g clipPath="url(#ppj)">
        {stripes.map((c,i)=><rect key={i} x="60" y={282+i*10} width="180" height="10" fill={c} opacity=".7"/>)}
        {moons.map(([x,y],i)=>(
          <g key={i} opacity=".45">
            <circle cx={x} cy={y} r="5.5" fill="#93c5fd"/>
            <circle cx={x+2.5} cy={y-1.5} r="4" fill="#bfdbfe"/>
          </g>
        ))}
        {stars.map(([x,y],i)=>(
          <polygon key={i} points={star(x,y,4.5,2)} fill="#fde68a" opacity=".5"/>
        ))}
      </g>
      <rect x="62" y="280" width="176" height="11" rx="5.5" fill="#93c5fd" opacity=".9"/>
      <line x1="62" y1="285" x2="238" y2="285" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="6,3" opacity=".55"/>
    </g>
  )
}

export function PantsDenimOveralls() {
  return (
    <g>
      <defs><clipPath id="pdo"><path d={PANTS_PATH}/></clipPath></defs>
      <path d={PANTS_PATH} fill="#1e40af" opacity=".9"/>
      <g clipPath="url(#pdo)">
        {[298,313,328,343,358].map(y=>(
          <line key={y} x1="62" y1={y} x2="238" y2={y} stroke="#1d4ed8" strokeWidth="1" opacity=".35"/>
        ))}
        <line x1="150" y1="282" x2="150" y2="362" stroke="#2563eb" strokeWidth="2" opacity=".4"/>
        {[80,110,148,166,202,222].map((x,i)=>(
          <rect key={i} x={x} y={282} width="5" height="12" rx="2" fill="#2563eb" opacity=".65"/>
        ))}
      </g>
      <rect x="62" y="280" width="176" height="11" rx="5.5" fill="#1e3a8a" opacity=".95"/>
      {[80,118,182,220].map((x,i)=>(
        <circle key={i} cx={x} cy={285} r="3" fill="#fbbf24" opacity=".8"/>
      ))}
    </g>
  )
}

// ═══ SHOES ════════════════════════════════════════════════════════════════════

export function ShoesRockets() {
  return (
    <g>
      {/* Left shoe */}
      <ellipse cx="108" cy="340" rx="46" ry="24" fill="#f8fafc" opacity=".96"/>
      <ellipse cx="108" cy="342" rx="34" ry="14" fill="#dbeafe"/>
      <ellipse cx="100" cy="337" rx="16" ry="7" fill="rgba(255,255,255,.45)" transform="rotate(-5 100 337)"/>
      <path d="M 70,344 Q 66,358 72,364 Q 78,356 76,344 Z" fill="#ef4444"/>
      <path d="M 70,352 Q 66,362 72,367 Q 77,359 75,350 Z" fill="#fbbf24"/>
      {[[88,356],[82,350],[78,358]].map(([x,y],i)=>(
        <polygon key={i} points={star(x,y,4,1.8)} fill="#fbbf24" opacity=".8"/>
      ))}
      {/* Right shoe */}
      <ellipse cx="192" cy="340" rx="46" ry="24" fill="#f8fafc" opacity=".96"/>
      <ellipse cx="192" cy="342" rx="34" ry="14" fill="#dbeafe"/>
      <ellipse cx="184" cy="337" rx="16" ry="7" fill="rgba(255,255,255,.45)" transform="rotate(-5 184 337)"/>
      <path d="M 230,344 Q 234,358 228,364 Q 222,356 224,344 Z" fill="#ef4444"/>
      <path d="M 230,352 Q 234,362 228,367 Q 223,359 225,350 Z" fill="#fbbf24"/>
      {[[212,356],[218,350],[222,358]].map(([x,y],i)=>(
        <polygon key={i} points={star(x,y,4,1.8)} fill="#fbbf24" opacity=".8"/>
      ))}
    </g>
  )
}

export function ShoesRainBoots() {
  return (
    <g>
      {/* Left boot */}
      <ellipse cx="108" cy="332" rx="42" ry="20" fill="#fbbf24" opacity=".95"/>
      <ellipse cx="108" cy="344" rx="44" ry="20" fill="#fbbf24" opacity=".95"/>
      <ellipse cx="108" cy="352" rx="38" ry="13" fill="#f59e0b"/>
      <ellipse cx="108" cy="328" rx="40" ry="11" fill="#fde68a" opacity=".9"/>
      <ellipse cx="102" cy="325" rx="20" ry="7" fill="rgba(255,255,255,.28)"/>
      <ellipse cx="108" cy="362" rx="26" ry="5" fill="#93c5fd" opacity=".38"/>
      {/* Right boot */}
      <ellipse cx="192" cy="332" rx="42" ry="20" fill="#fbbf24" opacity=".95"/>
      <ellipse cx="192" cy="344" rx="44" ry="20" fill="#fbbf24" opacity=".95"/>
      <ellipse cx="192" cy="352" rx="38" ry="13" fill="#f59e0b"/>
      <ellipse cx="192" cy="328" rx="40" ry="11" fill="#fde68a" opacity=".9"/>
      <ellipse cx="186" cy="325" rx="20" ry="7" fill="rgba(255,255,255,.28)"/>
      <ellipse cx="192" cy="362" rx="26" ry="5" fill="#93c5fd" opacity=".38"/>
    </g>
  )
}

export function ShoesBallet() {
  return (
    <g>
      {/* Left flat */}
      <ellipse cx="108" cy="340" rx="44" ry="21" fill="#f9a8d4" opacity=".95"/>
      <ellipse cx="108" cy="346" rx="36" ry="13" fill="#fbcfe8"/>
      <ellipse cx="136" cy="337" rx="11" ry="6" fill="rgba(255,255,255,.4)" transform="rotate(-12 136 337)"/>
      {/* Bow */}
      <ellipse cx="100" cy="326" rx="8" ry="5" fill="#f472b6" transform="rotate(-20 100 326)"/>
      <ellipse cx="116" cy="326" rx="8" ry="5" fill="#f472b6" transform="rotate(20 116 326)"/>
      <circle cx="108" cy="328" r="4.5" fill="#ec4899"/>
      <path d="M 100,330 Q 94,322 88,318" fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M 116,330 Q 122,322 128,318" fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Right flat */}
      <ellipse cx="192" cy="340" rx="44" ry="21" fill="#f9a8d4" opacity=".95"/>
      <ellipse cx="192" cy="346" rx="36" ry="13" fill="#fbcfe8"/>
      <ellipse cx="220" cy="337" rx="11" ry="6" fill="rgba(255,255,255,.4)" transform="rotate(12 220 337)"/>
      <ellipse cx="184" cy="326" rx="8" ry="5" fill="#f472b6" transform="rotate(-20 184 326)"/>
      <ellipse cx="200" cy="326" rx="8" ry="5" fill="#f472b6" transform="rotate(20 200 326)"/>
      <circle cx="192" cy="328" r="4.5" fill="#ec4899"/>
      <path d="M 184,330 Q 178,322 172,318" fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M 200,330 Q 206,322 212,318" fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round"/>
    </g>
  )
}

export function ShoesHighTops() {
  return (
    <g>
      {/* Left high-top body */}
      <path d="M 65,340 Q 63,313 108,311 Q 153,313 151,340 Z" fill="#0f172a" opacity=".92"/>
      <ellipse cx="108" cy="340" rx="44" ry="22" fill="#1e293b" opacity=".95"/>
      <ellipse cx="108" cy="350" rx="44" ry="13" fill="#f1f5f9"/>
      <ellipse cx="108" cy="348" rx="40" ry="10" fill="white"/>
      {/* Laces */}
      {[316,322,328,334].map((y,i)=>(
        <line key={i} x1={84+i*2} y1={y} x2={132-i*2} y2={y} stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".9"/>
      ))}
      <polygon points={star(108,318,5.5,2.5)} fill="#fbbf24" opacity=".92"/>
      {/* Right high-top */}
      <path d="M 149,340 Q 147,313 192,311 Q 237,313 235,340 Z" fill="#0f172a" opacity=".92"/>
      <ellipse cx="192" cy="340" rx="44" ry="22" fill="#1e293b" opacity=".95"/>
      <ellipse cx="192" cy="350" rx="44" ry="13" fill="#f1f5f9"/>
      <ellipse cx="192" cy="348" rx="40" ry="10" fill="white"/>
      {[316,322,328,334].map((y,i)=>(
        <line key={i} x1={168+i*2} y1={y} x2={216-i*2} y2={y} stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".9"/>
      ))}
      <polygon points={star(192,318,5.5,2.5)} fill="#fbbf24" opacity=".92"/>
    </g>
  )
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const OUTFIT_MAP = {
  hair: {
    wizard_hat:    HairWizardHat,
    party_hat:     HairPartyHat,
    flower_crown:  HairFlowerCrown,
    backwards_cap: HairBackwardsCap,
    bunny_ears:    HairBunnyEars,
  },
  clothes: {
    rainbow_tee:  ClothesRainbowTee,
    astronaut:    ClothesAstronaut,
    hero_tee:     ClothesHeroTee,
    cozy_hoodie:  ClothesCozyHoodie,
    overalls:     ClothesStarOveralls,
  },
  pants: {
    polka_dots:  PantsPolkaDots,
    cargo:       PantsCargo,
    pajamas:     PantsPajamas,
    overalls_b:  PantsDenimOveralls,
  },
  shoes: {
    rockets:    ShoesRockets,
    rain_boots: ShoesRainBoots,
    ballet:     ShoesBallet,
    hightops:   ShoesHighTops,
  },
}

// Cropped viewBoxes for item card thumbnails
export const THUMB_VB = {
  hair:    '72 -44 156 106',
  clothes: '50 188 200 170',
  pants:   '50 272 200 100',
  shoes:   '54 308 192 64',
}

export function OutfitThumbnail({ category, itemId, width = 72 }) {
  const Comp = OUTFIT_MAP[category]?.[itemId]
  if (!Comp) return null
  const vb   = THUMB_VB[category] || '0 0 300 366'
  const [,, vw, vh] = vb.split(' ').map(Number)
  return (
    <svg viewBox={vb} width={width} height={Math.round(width * vh / vw)}
      style={{ display:'block', overflow:'visible' }}>
      <Comp/>
    </svg>
  )
}
