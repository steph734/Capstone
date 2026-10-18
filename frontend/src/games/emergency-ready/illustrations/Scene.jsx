// Calm, friendly flat illustrations (400x260): a child or teen doing one action, plus a short caption.
// No Pao in the scenes (Pao is only the guide in the corner), no injuries, no big flames near people.
const INK = '#2a2150'
export const SKINS = ['#f6d5b8', '#f0c29a', '#d9a070', '#b07840', '#8d5524']

// ---------- people ----------
const POSES = {
  stand: [8, 8], wave: [8, 150], up: [160, 160], point: [8, 92], hold: [-38, -38], both: [60, 60], down: [4, 4], listen: [8, 8],
}

function Person({ x, y, s = 1, skin = 1, hair = '#3a2414', style = 'short', shirt = '#4a86e0', pants = '#2f3f7a', pose = 'stand', kind = 'kid', mouth = 'smile', flip = false }) {
  const sk = SKINS[skin % SKINS.length]
  const [la, ra] = POSES[pose] || POSES.stand
  const crouch = pose === 'crouch'
  const crawl = pose === 'crawl'
  const sit = pose === 'sit'
  const sleeve = shirt
  const head = crouch ? 26 : 0
  const bodyTop = 14 + head
  const bodyH = crouch ? 22 : 36
  const arms = crouch ? [165, 165] : [la, ra]
  const transform = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})${crawl ? ' rotate(-84 0 40)' : ''}`
  return (
    <g transform={transform}>
      {/* legs + shoes */}
      {crouch ? (
        <><rect x="-13" y="58" width="26" height="12" rx="6" fill={pants} /><rect x="-16" y="68" width="14" height="8" rx="4" fill="#3a3a52" /><rect x="2" y="68" width="14" height="8" rx="4" fill="#3a3a52" /></>
      ) : sit ? (
        <><rect x="-11" y="48" width="12" height="30" rx="5" fill={pants} transform="rotate(-90 -11 52) translate(-30 8)" /><rect x="-26" y="52" width="30" height="11" rx="5" fill={pants} /><rect x="-30" y="60" width="12" height="9" rx="4" fill="#3a3a52" /></>
      ) : (
        <><rect x="-10" y="48" width="9" height="30" rx="4" fill={pants} /><rect x="1" y="48" width="9" height="30" rx="4" fill={pants} /><ellipse cx="-6" cy="80" rx="8" ry="4" fill="#3a3a52" /><ellipse cx="6" cy="80" rx="8" ry="4" fill="#3a3a52" /></>
      )}
      {/* body */}
      <rect x="-13" y={bodyTop} width="26" height={bodyH} rx="9" fill={shirt} />
      {kind === 'rescuer' && <rect x="-13" y={bodyTop + 6} width="26" height="9" fill="#ff9f1c" />}
      {kind === 'firefighter' && <rect x="-13" y={bodyTop + 6} width="26" height="9" fill="#f4d03f" />}
      {kind === 'police' && <rect x="-4" y={bodyTop + 6} width="8" height="8" rx="2" fill="#ffd23f" />}
      {/* arms */}
      <g transform={`translate(-12 ${bodyTop + 5}) rotate(${arms[0]})`}><rect x="-4" y="0" width="8" height="22" rx="4" fill={sleeve} /><circle cy="24" r="5" fill={sk} /></g>
      <g transform={`translate(12 ${bodyTop + 5}) rotate(${-arms[1]})`}><rect x="-4" y="0" width="8" height="22" rx="4" fill={sleeve} /><circle cy="24" r="5" fill={sk} /></g>
      {/* head */}
      <circle cx="-14" cy={head} r="4.5" fill={sk} /><circle cx="14" cy={head} r="4.5" fill={sk} />
      <circle cx="0" cy={head} r="14" fill={sk} />
      {style === 'long' && <path d={`M-15 ${head - 2} q0 -18 15 -18 q15 0 15 18 v20 q-4 -4 -4 -14 q-11 -6 -22 0 q0 10 -4 14z`} fill={hair} />}
      {style === 'bun' && <><circle cx="0" cy={head - 19} r="7" fill={hair} /><path d={`M-14 ${head - 2} q0 -14 14 -14 q14 0 14 14 q-8 -7 -14 -7 q-6 0 -14 7z`} fill={hair} /></>}
      {style === 'short' && <path d={`M-14 ${head - 2} q1 -15 14 -15 q13 0 14 15 q-7 -8 -14 -8 q-7 0 -14 8z`} fill={hair} />}
      {style === 'curly' && <>{[-11, -4, 4, 11].map((a, i) => <circle key={i} cx={a} cy={head - 12 + (i % 2) * 2} r="6" fill={hair} />)}</>}
      {kind === 'rescuer' && <path d={`M-16 ${head - 5} q0 -17 16 -17 q16 0 16 17z`} fill="#ffc107" />}
      {kind === 'firefighter' && <path d={`M-17 ${head - 4} q0 -18 17 -18 q17 0 17 18z`} fill="#e5484d" />}
      {kind === 'police' && <path d={`M-15 ${head - 6} q0 -13 15 -13 q15 0 15 13z`} fill="#2f3f7a" />}
      <circle cx="-5" cy={head + 1} r="1.9" fill={INK} /><circle cx="5" cy={head + 1} r="1.9" fill={INK} />
      {mouth === 'smile' && <path d={`M-4.5 ${head + 6} q4.5 4 9 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {mouth === 'open' && <ellipse cx="0" cy={head + 7} rx="3.4" ry="3" fill="#b3374f" />}
      {mouth === 'flat' && <path d={`M-4 ${head + 7} h8`} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />}
    </g>
  )
}

// ---------- backgrounds ----------
const BG = {
  room: () => <><rect width="400" height="260" fill="#fdeee0" /><rect y="190" width="400" height="70" fill="#efd5b6" /></>,
  kitchen: () => <><rect width="400" height="260" fill="#fff1de" /><rect y="190" width="400" height="70" fill="#e9cfae" /><rect y="150" width="400" height="12" fill="#d9b88e" /></>,
  night: () => <><rect width="400" height="260" fill="#2b3558" /><rect y="190" width="400" height="70" fill="#222b49" />{[[40, 40], [120, 70], [330, 50], [280, 100]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="2" fill="#fff" opacity=".5" />)}</>,
  outdoor: () => <><rect width="400" height="260" fill="#cdeafd" /><circle cx="340" cy="50" r="24" fill="#ffd96a" /><ellipse cx="90" cy="50" rx="36" ry="13" fill="#fff" /><rect y="185" width="400" height="75" fill="#9ad99a" /></>,
  street: () => <><rect width="400" height="260" fill="#d7ecfb" /><rect x="0" y="60" width="90" height="140" fill="#f1b98a" /><rect x="310" y="40" width="90" height="160" fill="#a9c2e8" /><rect y="190" width="400" height="70" fill="#9aa4b8" /><path d="M0 225 h400" stroke="#fff" strokeWidth="4" strokeDasharray="22 16" /></>,
  storm: () => <><rect width="400" height="260" fill="#b4c4da" /><ellipse cx="90" cy="46" rx="70" ry="24" fill="#8c9db8" /><ellipse cx="300" cy="36" rx="80" ry="26" fill="#8c9db8" />{Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${20 + i * 24} ${60 + (i % 3) * 30} l-8 18`} stroke="#6f8fb8" strokeWidth="3" strokeLinecap="round" />)}<rect y="195" width="400" height="65" fill="#8fbf95" /></>,
  flood: () => <><rect width="400" height="260" fill="#cfe3f3" /><ellipse cx="300" cy="46" rx="60" ry="20" fill="#fff" /><rect y="190" width="400" height="70" fill="#8cc4ea" /><path d="M0 196 q20 -9 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#d9f0ff" strokeWidth="4" fill="none" /></>,
}

// ---------- props ----------
const PROPS = {
  table: ({ x = 200, y = 160, s = 1 }) => <g transform={`translate(${x} ${y}) scale(${s})`}><rect x="-60" y="0" width="120" height="12" rx="5" fill="#a86f3b" /><rect x="-52" y="12" width="10" height="42" rx="3" fill="#8a5a2b" /><rect x="42" y="12" width="10" height="42" rx="3" fill="#8a5a2b" /></g>,
  lamp: ({ x = 330, y = 40 }) => <g transform={`translate(${x} ${y})`}><line x1="0" y1="-40" x2="0" y2="10" stroke="#9aa4bd" strokeWidth="3" /><path d="M-16 28 q16 -34 32 0z" fill="#ffd96a" /></g>,
  shake: ({ x = 200, y = 214 }) => <g stroke="#f0a500" strokeWidth="4" strokeLinecap="round" fill="none"><path d={`M${x - 150} ${y} l-14 -8 M${x - 150} ${y + 14} l-16 0`} /><path d={`M${x + 150} ${y} l14 -8 M${x + 150} ${y + 14} l16 0`} /></g>,
  shelf: ({ x = 320, y = 70 }) => <g transform={`translate(${x} ${y})`}><rect x="-50" y="40" width="100" height="8" rx="3" fill="#a86f3b" />{[[-34, '#ef7aa0'], [-18, '#6aa6ff'], [0, '#ffd23f']].map(([a, c], i) => <rect key={i} x={a} y="14" width="14" height="26" rx="2" fill={c} transform={i === 2 ? 'rotate(14 6 40)' : undefined} />)}</g>,
  stove: ({ x = 300, y = 120, flame = true }) => <g transform={`translate(${x} ${y})`}><rect x="-60" y="30" width="120" height="70" rx="8" fill="#cfd6e6" stroke="#9aa4bd" strokeWidth="3" /><rect x="-44" y="48" width="50" height="34" rx="4" fill="#4a4f66" /><circle cx="30" cy="54" r="6" fill="#7b86a3" /><circle cx="30" cy="76" r="6" fill="#7b86a3" /><ellipse cx="0" cy="26" rx="36" ry="6" fill="#4a4f66" />{flame && <path d="M0 22 q-10 -18 0 -30 q4 10 10 14 q4 8 -10 16z" fill="#ff7a59" />}</g>,
  smoke: ({ x = 200, y = 40, big }) => <g fill="#aeb6c6" opacity=".85"><ellipse cx={x} cy={y} rx={big ? 150 : 60} ry={big ? 26 : 20} /><ellipse cx={x + 30} cy={y + 14} rx={big ? 110 : 46} ry="16" /></g>,
  alarm: ({ x = 200, y = 40 }) => <g transform={`translate(${x} ${y})`}><circle r="18" fill="#fff" stroke="#9aa4bd" strokeWidth="4" /><circle r="6" fill="#e5484d" opacity=".85" /><g stroke="#e5484d" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8"><path d="M-28 -8 q-6 8 0 16 M-36 -14 q-10 14 0 28" /><path d="M28 -8 q6 8 0 16 M36 -14 q10 14 0 28" /></g></g>,
  door: ({ x = 300, y = 70, hot }) => <g transform={`translate(${x} ${y})`}><rect x="-34" y="0" width="68" height="124" rx="4" fill="#c98f5f" stroke="#8a5a2b" strokeWidth="4" /><circle cx="22" cy="64" r="5" fill="#ffd23f" />{hot && <path d="M-20 -8 q-6 -10 0 -18 M0 -8 q-6 -10 0 -18 M20 -8 q-6 -10 0 -18" stroke="#ef9a6a" strokeWidth="3" fill="none" strokeLinecap="round" />}</g>,
  exit: ({ x = 330, y = 34 }) => <g transform={`translate(${x} ${y})`}><rect x="-44" y="-18" width="88" height="36" rx="6" fill="#16a34a" /><text x="6" y="7" fontSize="17" fontWeight="800" fill="#fff" fontFamily="system-ui">EXIT</text><g fill="#fff"><circle cx="-26" cy="-8" r="3.4" /><path d="M-26 -4 l-6 10 m6 -10 l8 6 m-8 -6 l2 12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" /></g></g>,
  flag: ({ x = 330, y = 120, text = 'MEETING PLACE' }) => <g transform={`translate(${x} ${y})`}><rect x="-2" y="-40" width="4" height="100" fill="#8a5a2b" /><rect x="2" y="-40" width="64" height="30" rx="4" fill="#16a34a" /><text x="34" y="-20" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="system-ui">{text}</text></g>,
  window: ({ x = 310, y = 40, rainy }) => <g transform={`translate(${x} ${y})`}><rect x="-40" y="0" width="80" height="80" rx="4" fill={rainy ? '#9db4cf' : '#cfeeff'} stroke="#8a5a2b" strokeWidth="5" /><path d="M0 0 v80 M-40 40 h80" stroke="#8a5a2b" strokeWidth="4" />{rainy && <path d="M-26 14 l-4 10 M10 30 l-4 10 M-10 56 l-4 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />}</g>,
  tree: ({ x = 80, y = 100, bent }) => <g transform={`translate(${x} ${y})`}><rect x="-6" y="40" width="12" height="60" fill="#8a5a2b" transform={bent ? 'rotate(10 0 100)' : undefined} /><g transform={bent ? 'translate(14 4)' : undefined}><circle cy="22" r="32" fill="#4cbd75" /><circle cx="-24" cy="46" r="22" fill="#3fa564" /></g></g>,
  wind: ({ x = 200, y = 60 }) => <g stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".9"><path d={`M${x - 90} ${y} q30 -14 60 0 t60 0`} /><path d={`M${x - 70} ${y + 24} q30 -14 60 0 t60 0`} /></g>,
  house: ({ x = 80, y = 80 }) => <g transform={`translate(${x} ${y})`}><rect x="-50" y="30" width="100" height="80" fill="#ffd9a8" /><polygon points="-60,32 0,-18 60,32" fill="#ef5a4f" /><rect x="-12" y="64" width="24" height="46" rx="3" fill="#8a5a2b" /><rect x="22" y="48" width="20" height="20" fill="#cdeeff" stroke="#8a5a2b" strokeWidth="3" /></g>,
  water: ({ x = 200, y = 200 }) => <g><path d={`M0 ${y} q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V260 H0z`} fill="#6ec1ee" opacity=".9" /></g>,
  radio: ({ x = 200, y = 170, s = 1 }) => <g transform={`translate(${x} ${y}) scale(${s})`}><rect x="-30" y="0" width="60" height="38" rx="6" fill="#3d4863" /><circle cx="-12" cy="19" r="10" fill="#cfd6e6" /><rect x="6" y="10" width="18" height="8" rx="3" fill="#8fe0b0" /><line x1="-20" y1="0" x2="-34" y2="-22" stroke="#3d4863" strokeWidth="3" /></g>,
  flashlight: ({ x = 200, y = 150, beam = true }) => <g transform={`translate(${x} ${y})`}><rect x="-6" y="-10" width="38" height="16" rx="4" fill="#4a86e0" /><polygon points="32,-14 46,-20 46,16 32,10" fill="#9aa4bd" />{beam && <polygon points="46,-20 130,-60 130,60 46,16" fill="#ffe27a" opacity=".5" />}</g>,
  candle: ({ x = 200, y = 160, off }) => <g transform={`translate(${x} ${y})`}><rect x="-8" y="0" width="16" height="30" rx="3" fill="#fff6d8" stroke="#e6d6a8" strokeWidth="2" /><path d="M0 -4 q-6 -10 0 -18 q6 8 0 18z" fill="#ffb020" />{off && <><circle cx="0" cy="12" r="26" fill="none" stroke="#e5484d" strokeWidth="4" /><line x1="-18" y1="-6" x2="18" y2="30" stroke="#e5484d" strokeWidth="4" /></>}</g>,
  outlet: ({ x = 300, y = 120, off }) => <g transform={`translate(${x} ${y})`}><rect x="-14" y="-18" width="28" height="36" rx="6" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><circle cx="-4" cy="-4" r="2.6" fill="#4a4f66" /><circle cx="6" cy="-4" r="2.6" fill="#4a4f66" /><path d="M-3 8 h8" stroke="#4a4f66" strokeWidth="3" />{off && <><circle r="32" fill="none" stroke="#e5484d" strokeWidth="4" /><line x1="-22" y1="-22" x2="22" y2="22" stroke="#e5484d" strokeWidth="4" /></>}</g>,
  badge911: ({ x = 330, y = 40 }) => <g transform={`translate(${x} ${y})`}><rect x="-38" y="-16" width="76" height="32" rx="16" fill="#fff" stroke="#e5484d" strokeWidth="3" /><text x="0" y="7" textAnchor="middle" fontSize="19" fontWeight="800" fill="#e5484d" fontFamily="system-ui">911</text></g>,
  bench: ({ x = 200, y = 170 }) => <g transform={`translate(${x} ${y})`}><rect x="-50" y="0" width="100" height="10" rx="4" fill="#a86f3b" /><rect x="-44" y="10" width="8" height="26" fill="#8a5a2b" /><rect x="36" y="10" width="8" height="26" fill="#8a5a2b" /></g>,
  speech: ({ x = 200, y = 50, text = '' }) => <g transform={`translate(${x} ${y})`}><rect x="-62" y="-20" width="124" height="38" rx="14" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="800" fill={INK} fontFamily="system-ui">{text}</text></g>,
  sign: ({ x = 320, y = 70, text = 'EVACUATION CENTER' }) => <g transform={`translate(${x} ${y})`}><rect x="-3" y="0" width="6" height="90" fill="#8a5a2b" /><rect x="-58" y="-8" width="116" height="34" rx="6" fill="#2f6fd6" /><text x="0" y="14" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff" fontFamily="system-ui">{text}</text></g>,
  hill: ({ x = 300, y = 120 }) => <g><ellipse cx={x} cy={y + 90} rx="170" ry="80" fill="#8fd19a" /><path d={`M${x - 100} ${y + 40} l20 -10 l20 10 M${x - 40} ${y + 26} l20 -10 l20 10`} stroke="#6fb27a" strokeWidth="3" fill="none" /></g>,
  pole: ({ x = 330, y = 40 }) => <g transform={`translate(${x} ${y})`}><rect x="-4" y="0" width="8" height="170" fill="#8a5a2b" /><rect x="-30" y="12" width="60" height="6" fill="#8a5a2b" /><path d="M-30 18 q30 24 60 0" stroke="#4a4f66" strokeWidth="3" fill="none" /></g>,
  stop: ({ x = 200, y = 60 }) => <g transform={`translate(${x} ${y})`}><circle r="26" fill="#fff" stroke="#e5484d" strokeWidth="5" /><line x1="-17" y1="-17" x2="17" y2="17" stroke="#e5484d" strokeWidth="5" /><g stroke="#4a86e0" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M-14 6 q4 -6 8 0 t8 0" /></g></g>,
  bag: ({ x = 200, y = 160 }) => <g transform={`translate(${x} ${y})`}><rect x="-26" y="0" width="52" height="40" rx="10" fill="#14b8a6" /><path d="M-12 0 q0 -16 12 -16 q12 0 12 16" stroke="#0f766e" strokeWidth="5" fill="none" /></g>,
  crack: ({ x = 200, y = 214 }) => <path d={`M${x - 60} ${y} l20 8 l-10 10 l24 6 l12 -12 l18 8`} stroke="#8a5a2b" strokeWidth="4" fill="none" strokeLinejoin="round" />,
  dark: () => <rect width="400" height="260" fill="#1a2140" opacity=".35" />,
}

function Caption({ text }) {
  if (!text) return null
  return (
    <g>
      <rect x="14" y="214" width="372" height="34" rx="17" fill="#fff" opacity=".94" />
      <text x="200" y="236" textAnchor="middle" fontSize="15" fontWeight="800" fill={INK} fontFamily="'Atkinson Hyperlegible', system-ui, sans-serif">{text}</text>
    </g>
  )
}

// spec = { bg, people: [{x,y,...}], props: [[name, opts]], caption }
export default function Scene({ spec, alt, className }) {
  const bg = BG[spec.bg] || BG.room
  return (
    <svg className={className} viewBox="0 0 400 260" role="img" aria-label={alt || spec.caption} preserveAspectRatio="xMidYMid slice" focusable="false">
      {bg()}
      {(spec.props || []).map(([name, o], i) => { const P = PROPS[name]; return P ? <g key={`p${i}`}>{P(o || {})}</g> : null })}
      {(spec.people || []).map((p, i) => <Person key={`h${i}`} {...p} />)}
      <Caption text={spec.caption} />
    </svg>
  )
}

// ---------- go-bag item icons (100x100) ----------
const ITEMS = {
  water: <><rect x="38" y="14" width="24" height="10" rx="3" fill="#4a86e0" /><rect x="32" y="24" width="36" height="62" rx="12" fill="#cfeeff" stroke="#6ec6ff" strokeWidth="3" /><rect x="34" y="46" width="32" height="38" rx="10" fill="#8fd3f4" /></>,
  flashlight: <><rect x="14" y="40" width="48" height="22" rx="6" fill="#4a86e0" /><polygon points="62,34 82,26 82,76 62,68" fill="#9aa4bd" /><path d="M86 40 l10 -8 M86 52 l12 0 M86 64 l10 8" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" /></>,
  firstaid: <><rect x="16" y="28" width="68" height="52" rx="10" fill="#fff" stroke="#ef7a8a" strokeWidth="4" /><rect x="38" y="20" width="24" height="12" rx="4" fill="#ef7a8a" /><rect x="44" y="38" width="12" height="32" fill="#e5484d" /><rect x="34" y="48" width="32" height="12" fill="#e5484d" /></>,
  canned: <><rect x="26" y="26" width="48" height="56" rx="8" fill="#ff9f1c" /><rect x="26" y="40" width="48" height="26" fill="#fff3d6" /><ellipse cx="50" cy="26" rx="24" ry="6" fill="#d9810a" /></>,
  whistle: <><path d="M22 44 h46 a14 14 0 1 1 -14 14 h-32z" fill="#ffc83d" stroke="#e0a500" strokeWidth="3" /><circle cx="68" cy="58" r="5" fill="#e0a500" /><rect x="66" y="30" width="26" height="12" rx="4" fill="#e0a500" /></>,
  radio: <><rect x="12" y="38" width="76" height="46" rx="8" fill="#3d4863" /><circle cx="34" cy="62" r="13" fill="#cfd6e6" /><rect x="56" y="50" width="22" height="10" rx="3" fill="#8fe0b0" /><line x1="26" y1="38" x2="58" y2="14" stroke="#3d4863" strokeWidth="4" strokeLinecap="round" /></>,
  clothes: <path d="M34 16 l-24 16 l10 16 l12 -8 v44 h36 v-44 l12 8 l10 -16 l-24 -16 q-6 10 -18 10 q-12 0 -18 -10z" fill="#6aa6ff" stroke="#4a86e0" strokeWidth="3" strokeLinejoin="round" />,
  phone: <><rect x="30" y="12" width="40" height="76" rx="8" fill="#3d4863" /><rect x="35" y="22" width="30" height="50" rx="3" fill="#9bd4f0" /><circle cx="50" cy="80" r="3" fill="#cfd6e6" /></>,
  medicine: <><rect x="30" y="38" width="40" height="46" rx="6" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><rect x="28" y="28" width="44" height="14" rx="4" fill="#16a34a" /><rect x="46" y="50" width="8" height="24" fill="#16a34a" /><rect x="38" y="58" width="24" height="8" fill="#16a34a" /></>,
  idcard: <><rect x="12" y="26" width="76" height="50" rx="8" fill="#fff" stroke="#6aa6ff" strokeWidth="4" /><circle cx="34" cy="46" r="9" fill="#f0c29a" /><path d="M22 68 q12 -14 24 0z" fill="#6aa6ff" /><rect x="54" y="40" width="26" height="6" rx="3" fill="#cfd6e6" /><rect x="54" y="54" width="20" height="6" rx="3" fill="#cfd6e6" /></>,
  videogame: <><rect x="10" y="34" width="80" height="40" rx="18" fill="#8a7cf0" stroke="#6a4fd0" strokeWidth="3" /><rect x="24" y="48" width="18" height="6" fill="#fff" /><rect x="30" y="42" width="6" height="18" fill="#fff" /><circle cx="66" cy="46" r="4" fill="#ffd23f" /><circle cx="74" cy="56" r="4" fill="#ff7a8a" /></>,
  teddy: <><circle cx="26" cy="28" r="12" fill="#8a5a2b" /><circle cx="74" cy="28" r="12" fill="#8a5a2b" /><circle cx="50" cy="52" r="30" fill="#a86f3b" /><ellipse cx="50" cy="62" rx="13" ry="10" fill="#e8c9a0" /><circle cx="40" cy="46" r="4" fill={INK} /><circle cx="60" cy="46" r="4" fill={INK} /><ellipse cx="50" cy="58" rx="5" ry="3.6" fill={INK} /></>,
  toys: <><rect x="16" y="46" width="30" height="30" rx="4" fill="#ff7a8a" /><circle cx="68" cy="60" r="18" fill="#6aa6ff" /><polygon points="40,40 56,14 72,40" fill="#ffd23f" /></>,
  candy: <><path d="M26 30 h48 l6 52 h-60z" fill="#f48fb1" stroke="#e0709a" strokeWidth="3" strokeLinejoin="round" /><rect x="22" y="22" width="56" height="12" rx="4" fill="#ff9f1c" />{[[40, 54], [58, 62], [46, 72]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="5" fill={['#ffd23f', '#6aa6ff', '#fff'][i]} />)}</>,
}

export function ItemIcon({ id, className }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">{ITEMS[id] || <circle cx="50" cy="50" r="28" fill="#dfe8f2" />}</svg>
}

export function GoBagArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 200 170" aria-hidden="true" focusable="false">
      <path d="M62 52 q0 -34 38 -34 q38 0 38 34" fill="none" stroke="#0f766e" strokeWidth="14" strokeLinecap="round" />
      <rect x="14" y="48" width="172" height="112" rx="24" fill="#14b8a6" stroke="#0f766e" strokeWidth="8" />
      <rect x="14" y="78" width="172" height="10" fill="#0f766e" />
      <rect x="44" y="96" width="112" height="44" rx="12" fill="#0f766e" opacity=".85" />
      <text x="100" y="127" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" fontFamily="system-ui">GO-BAG</text>
    </svg>
  )
}

export const PEOPLE = {
  boy: { skin: 1, hair: '#3a2414', style: 'short', shirt: '#4a86e0', pants: '#2f3f7a' },
  girl: { skin: 3, hair: '#1f1a14', style: 'long', shirt: '#ef7aa0', pants: '#6a4fd0' },
  boy2: { skin: 2, hair: '#5a3a1f', style: 'curly', shirt: '#16a34a', pants: '#3a3a52' },
  girl2: { skin: 0, hair: '#d9822b', style: 'bun', shirt: '#ffc83d', pants: '#2f6f6a' },
  teen: { skin: 4, hair: '#1a1410', style: 'short', shirt: '#8a7cf0', pants: '#2b3558', s: 1.12 },
  adult: { skin: 2, hair: '#4a3020', style: 'bun', shirt: '#7c5cf0', pants: '#3a3a52', s: 1.25, kind: 'adult' },
  dad: { skin: 3, hair: '#2a2018', style: 'short', shirt: '#0f766e', pants: '#3a3a52', s: 1.25, kind: 'adult' },
  rescuer: { skin: 1, hair: '#3a2414', style: 'short', shirt: '#ff9f1c', pants: '#2f3f7a', s: 1.25, kind: 'rescuer' },
  firefighter: { skin: 2, hair: '#3a2414', style: 'short', shirt: '#e5484d', pants: '#3a3a52', s: 1.25, kind: 'firefighter' },
  police: { skin: 3, hair: '#1a1410', style: 'short', shirt: '#4a6fb0', pants: '#2f3f7a', s: 1.25, kind: 'police' },
  staff: { skin: 0, hair: '#7a4a2a', style: 'long', shirt: '#16a34a', pants: '#3a3a52', s: 1.2, kind: 'adult' },
}
