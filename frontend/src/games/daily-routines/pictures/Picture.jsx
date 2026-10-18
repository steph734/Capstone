// Simple flat pictures (100x100) for every task and step. No emojis, no files to load.
const INK = '#3a2e6b'
const SKIN = '#f3c9a0'
const water = (x, y, h = 30) => <path d={`M${x} ${y} v${h}`} stroke="#5bb8f0" strokeWidth="7" strokeLinecap="round" />
const Tap = () => (<><rect x="40" y="10" width="38" height="12" rx="6" fill="#9aa4bd" /><rect x="40" y="10" width="12" height="28" rx="5" fill="#9aa4bd" /></>)
const Hand = ({ x, y, r = 0 }) => <rect x={x} y={y} width="24" height="34" rx="12" fill={SKIN} stroke="#d9a878" strokeWidth="2.5" transform={`rotate(${r} ${x + 12} ${y + 17})`} />
const Bubbles = ({ pts }) => pts.map(([a, b, r], i) => <circle key={i} cx={a} cy={b} r={r} fill="#e8f6ff" stroke="#9bd4f0" strokeWidth="2" />)
const Egg = ({ x = 50, y = 50, s = 1 }) => (<g transform={`translate(${x} ${y}) scale(${s})`}><ellipse cx="0" cy="0" rx="16" ry="20" fill="#fff" stroke="#e6dcc6" strokeWidth="3" /></g>)
const Person = ({ x, y, s = 1, shirt = '#6aa6ff', hair = '#5a3a1f' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}><rect x="-16" y="16" width="32" height="34" rx="10" fill={shirt} /><circle r="18" fill={SKIN} /><path d="M-18 -2 q2 -20 18 -20 q16 0 18 20 q-9 -9 -18 -9 q-9 0 -18 9z" fill={hair} /><circle cx="-6" cy="2" r="2.2" fill={INK} /><circle cx="6" cy="2" r="2.2" fill={INK} /><path d="M-5 9 q5 4 10 0" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" /></g>
)
const BedArt = ({ moon }) => (<>
  <rect x="8" y="52" width="84" height="26" rx="6" fill="#8a7cf0" /><rect x="8" y="34" width="12" height="52" rx="4" fill="#6a4fd0" /><rect x="80" y="44" width="12" height="42" rx="4" fill="#6a4fd0" />
  <rect x="22" y="40" width="30" height="16" rx="8" fill="#fff" /><rect x="22" y="56" width="58" height="20" rx="4" fill="#ffd23f" />
  {moon && <path d="M72 10 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22z" fill="#ffd96a" />}
</>)
const Brush = () => (<>
  <rect x="14" y="62" width="70" height="12" rx="6" fill="#4a86e0" transform="rotate(-25 14 62)" /><rect x="58" y="30" width="26" height="10" rx="4" fill="#fff" stroke="#cfd6e6" strokeWidth="2" transform="rotate(-25 58 30)" />
  <path d="M70 26 q8 -2 12 4" stroke="#6ec6ff" strokeWidth="6" fill="none" strokeLinecap="round" /><Bubbles pts={[[30, 32, 7], [46, 20, 5], [20, 50, 5]]} />
</>)
const Bread = ({ x = 14, y = 40, tint = '#f0c27a' }) => (<g><path d={`M${x} ${y + 30} v-18 q0 -14 16 -14 h40 q16 0 16 14 v18z`} fill={tint} stroke="#d9a050" strokeWidth="3" strokeLinejoin="round" /></g>)
const Pan = ({ egg }) => (<>
  <rect x="62" y="48" width="34" height="9" rx="4" fill="#4a4f66" /><ellipse cx="40" cy="52" rx="36" ry="15" fill="#2f3347" />{egg && <><ellipse cx="38" cy="50" rx="26" ry="10" fill="#fff" /><circle cx="38" cy="49" r="8" fill="#ffc83d" /></>}
</>)

const ART = {
  'morning:wake': (<><rect x="6" y="56" width="88" height="24" rx="6" fill="#8a7cf0" /><rect x="6" y="40" width="12" height="46" rx="4" fill="#6a4fd0" /><rect x="16" y="46" width="30" height="14" rx="7" fill="#fff" /><circle cx="34" cy="44" r="12" fill={SKIN} /><circle cx="30" cy="42" r="1.8" fill={INK} /><circle cx="38" cy="42" r="1.8" fill={INK} /><circle cx="76" cy="22" r="11" fill="#ffd23f" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="76" y1="4" x2="76" y2="8" stroke="#ffb020" strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 45} 76 22)`} />)}</>),
  'morning:toilet': (<><rect x="30" y="10" width="40" height="28" rx="6" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><rect x="26" y="38" width="48" height="12" rx="6" fill="#eef1f8" stroke="#cfd6e6" strokeWidth="3" /><path d="M30 50 q0 30 20 30 q20 0 20 -30z" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><rect x="40" y="80" width="20" height="8" rx="3" fill="#cfd6e6" /><circle cx="64" cy="18" r="3" fill="#9aa4bd" /></>),
  'morning:teeth': <Brush />,
  'morning:face': (<><circle cx="50" cy="52" r="32" fill={SKIN} /><circle cx="38" cy="48" r="3.6" fill={INK} /><circle cx="62" cy="48" r="3.6" fill={INK} /><path d="M40 64 q10 8 20 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M20 30 q30 -22 60 0 q-6 -12 -30 -12 q-24 0 -30 12z" fill="#5a3a1f" /><Bubbles pts={[[22, 70, 7], [78, 66, 8], [70, 82, 5]]} />{water(86, 20, 14)}</>),
  'morning:dress': (<path d="M30 14 l-22 16 l10 16 l12 -8 v44 h40 v-44 l12 8 l10 -16 l-22 -16 q-8 10 -20 10 q-12 0 -20 -10z" fill="#6aa6ff" stroke="#4a86e0" strokeWidth="3" strokeLinejoin="round" />),
  'morning:breakfast': (<><path d="M10 48 h80 q-4 36 -40 36 q-36 0 -40 -36z" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><ellipse cx="50" cy="48" rx="40" ry="8" fill="#ffd9a0" />{[[30, 46], [44, 44], [58, 46], [70, 44], [50, 48]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="5" fill={['#f0a050', '#ffd23f', '#ef7a5a'][i % 3]} />)}<rect x="72" y="14" width="8" height="34" rx="4" fill="#cfd6e6" transform="rotate(20 76 30)" /></>),

  'handwashing:water': (<><Tap />{water(46, 40, 38)}<Bubbles pts={[[38, 86, 4], [58, 84, 3]]} /><ellipse cx="50" cy="90" rx="34" ry="6" fill="#bfe3f7" /></>),
  'handwashing:wet': (<><Tap />{water(46, 38, 20)}<Hand x={26} y={52} r={-10} /><Hand x={52} y={52} r={10} /><Bubbles pts={[[22, 50, 3], [80, 54, 3]]} /></>),
  'handwashing:soap': (<><rect x="26" y="56" width="48" height="30" rx="10" fill="#ff9ec7" stroke="#ef6aa0" strokeWidth="3" /><text x="50" y="76" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui">SOAP</text><Hand x={36} y={14} r={-6} /><Bubbles pts={[[30, 40, 7], [68, 36, 8], [56, 18, 5]]} /></>),
  'handwashing:scrub': (<><Hand x={22} y={34} r={-14} /><Hand x={54} y={34} r={14} /><Bubbles pts={[[14, 28, 8], [50, 18, 10], [84, 30, 8], [36, 80, 7], [68, 82, 9], [50, 56, 6]]} /><path d="M40 60 l20 0" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></>),
  'handwashing:rinse': (<><Tap />{water(46, 38, 14)}<Hand x={26} y={50} r={-10} /><Hand x={52} y={50} r={10} />{[[30, 38], [60, 40], [74, 46]].map(([a, b], i) => <path key={i} d={`M${a} ${b} q4 8 0 12`} stroke="#5bb8f0" strokeWidth="4" fill="none" strokeLinecap="round" />)}<Bubbles pts={[[20, 78, 4], [78, 80, 3]]} /></>),
  'handwashing:dry': (<><rect x="14" y="20" width="72" height="56" rx="6" fill="#ffc83d" /><path d="M14 36 h72 M14 52 h72 M14 68 h72" stroke="#f0a500" strokeWidth="3" /><Hand x={30} y={30} r={-8} /><Hand x={52} y={30} r={8} />{Array.from({ length: 6 }, (_, i) => <line key={i} x1={20 + i * 12} y1="76" x2={19 + i * 12} y2="86" stroke="#f0a500" strokeWidth="3" strokeLinecap="round" />)}</>),

  'egg:help': (<><Person x={40} y={34} s={1.3} shirt="#ef7aa0" hair="#3a2414" /><Person x={78} y={64} s={0.7} shirt="#6aa6ff" /><g><rect x="56" y="4" width="34" height="22" rx="10" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><text x="73" y="21" textAnchor="middle" fontSize="16" fontWeight="800" fill="#7c5cf0" fontFamily="system-ui">?</text></g></>),
  'egg:pan': (<><rect x="6" y="64" width="88" height="24" rx="5" fill="#cfd6e6" /><circle cx="30" cy="76" r="9" fill="#4a4f66" /><circle cx="70" cy="76" r="9" fill="#4a4f66" /><g transform="translate(2 8)"><Pan /></g></>),
  'egg:crack': (<><path d="M20 24 q14 -14 28 0 l-6 10 l-6 -6 l-6 8z" fill="#fff" stroke="#e6dcc6" strokeWidth="3" strokeLinejoin="round" /><path d="M52 18 q16 -6 26 8 l-10 6 l-4 -8z" fill="#fff" stroke="#e6dcc6" strokeWidth="3" strokeLinejoin="round" /><circle cx="46" cy="52" r="9" fill="#ffc83d" /><g transform="translate(0 28)"><Pan /></g></>),
  'egg:cook': (<><g transform="translate(0 8)"><Pan egg /></g>{[[30, 20], [48, 16], [64, 22]].map(([a, b], i) => <path key={i} d={`M${a} ${b + 14} q-6 -8 0 -14`} stroke="#c5ccdb" strokeWidth="4" fill="none" strokeLinecap="round" />)}</>),
  'egg:plate': (<><ellipse cx="50" cy="62" rx="42" ry="18" fill="#cfd6e6" /><ellipse cx="50" cy="58" rx="42" ry="18" fill="#f3f6fc" stroke="#b7c0d8" strokeWidth="2.5" /><ellipse cx="50" cy="56" rx="22" ry="9" fill="#fff" stroke="#eee6cf" strokeWidth="2" /><circle cx="50" cy="55" r="7" fill="#ffc83d" /></>),
  'egg:off': (<><rect x="10" y="40" width="80" height="46" rx="8" fill="#cfd6e6" /><circle cx="32" cy="60" r="14" fill="#4a4f66" /><circle cx="68" cy="60" r="14" fill="#4a4f66" /><circle cx="50" cy="24" r="14" fill="#fff" stroke="#9aa4bd" strokeWidth="3" /><line x1="50" y1="14" x2="50" y2="26" stroke="#ef4d5e" strokeWidth="4" strokeLinecap="round" /><text x="50" y="82" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ef4d5e" fontFamily="system-ui">OFF</text></>),

  'sandwich:wash': (<><Tap />{water(46, 38, 20)}<Hand x={26} y={52} r={-10} /><Hand x={52} y={52} r={10} /><Bubbles pts={[[22, 50, 5], [80, 54, 6], [50, 84, 5]]} /></>),
  'sandwich:bread': (<><Bread x={6} y={26} /><Bread x={30} y={44} tint="#f6d08e" /></>),
  'sandwich:butter': (<><Bread x={12} y={44} /><rect x="16" y="46" width="68" height="10" rx="5" fill="#ffe27a" /><rect x="50" y="14" width="40" height="10" rx="4" fill="#cfd6e6" transform="rotate(28 50 14)" /><rect x="44" y="10" width="14" height="10" rx="4" fill="#8a5a2b" transform="rotate(28 50 14)" /></>),
  'sandwich:cheese': (<><Bread x={12} y={46} /><polygon points="12,50 88,50 76,32 24,32" fill="#ffd23f" stroke="#e0a800" strokeWidth="3" strokeLinejoin="round" /><circle cx="40" cy="42" r="3" fill="#f5b400" /><circle cx="62" cy="40" r="2.5" fill="#f5b400" /></>),
  'sandwich:top': (<><Bread x={12} y={52} /><polygon points="14,54 86,54 78,46 22,46" fill="#ffd23f" /><g transform="translate(0 -14)"><Bread x={12} y={20} tint="#f6d08e" /></g></>),
  'sandwich:cut': (<><polygon points="10,76 90,76 90,30" fill="#f0c27a" stroke="#d9a050" strokeWidth="3" strokeLinejoin="round" /><polygon points="10,76 10,30 90,30" fill="#f6d08e" stroke="#d9a050" strokeWidth="3" strokeLinejoin="round" /><line x1="10" y1="76" x2="90" y2="30" stroke="#ffd23f" strokeWidth="6" /><path d="M72 14 l16 12" stroke="#9aa4bd" strokeWidth="5" strokeLinecap="round" /></>),

  'bedtime:bath': (<><path d="M8 52 h84 q-4 32 -24 32 h-36 q-20 0 -24 -32z" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><Bubbles pts={[[24, 44, 9], [44, 38, 11], [66, 42, 9], [80, 36, 6]]} /><rect x="22" y="84" width="8" height="8" fill="#9aa4bd" /><rect x="70" y="84" width="8" height="8" fill="#9aa4bd" /><circle cx="52" cy="18" r="8" fill={SKIN} /></>),
  'bedtime:pajamas': (<><path d="M30 14 l-20 18 l10 14 l10 -8 v44 h40 v-44 l10 8 l10 -14 l-20 -18 q-10 8 -20 8 q-10 0 -20 -8z" fill="#8a7cf0" stroke="#6a4fd0" strokeWidth="3" strokeLinejoin="round" />{[[38, 50], [58, 62], [46, 74], [62, 44]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="3.6" fill="#ffd23f" />)}</>),
  'bedtime:teeth': <Brush />,
  'bedtime:story': (<><path d="M50 26 q-20 -10 -40 -2 v54 q20 -8 40 2z" fill="#ffd9a0" stroke="#e0a458" strokeWidth="3" strokeLinejoin="round" /><path d="M50 26 q20 -10 40 -2 v54 q-20 -8 -40 2z" fill="#fff3d6" stroke="#e0a458" strokeWidth="3" strokeLinejoin="round" /><path d="M20 38 h20 M20 48 h20 M60 38 h20 M60 48 h20" stroke="#c9965a" strokeWidth="3" strokeLinecap="round" /></>),
  'bedtime:light': (<><circle cx="50" cy="40" r="22" fill="#e9e4f5" stroke="#b9b0d8" strokeWidth="3" /><rect x="40" y="60" width="20" height="14" rx="4" fill="#9aa4bd" /><rect x="42" y="74" width="16" height="8" rx="3" fill="#7b86a3" /><path d="M42 36 q8 10 16 0" stroke="#b9b0d8" strokeWidth="3" fill="none" /><rect x="76" y="30" width="16" height="30" rx="4" fill="#fff" stroke="#cfd6e6" strokeWidth="3" /><rect x="80" y="44" width="8" height="12" rx="2" fill="#7c5cf0" /></>),
  'bedtime:sleep': (<><BedArt moon /><g fill="#7c5cf0" fontWeight="800" fontFamily="system-ui"><text x="28" y="30" fontSize="16">Z</text><text x="42" y="18" fontSize="12">z</text></g></>),

  // The 5 task covers
  'cover:morning': (<><circle cx="50" cy="48" r="18" fill="#ffd23f" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="50" y1="14" x2="50" y2="22" stroke="#ffb020" strokeWidth="5" strokeLinecap="round" transform={`rotate(${i * 45} 50 48)`} />)}<rect x="14" y="72" width="72" height="12" rx="6" fill="#8fe0b0" /></>),
  'cover:handwashing': (<><Tap />{water(46, 38, 16)}<Hand x={24} y={54} r={-10} /><Hand x={52} y={54} r={10} /><Bubbles pts={[[20, 50, 5], [80, 56, 6]]} /></>),
  'cover:egg': (<><g transform="translate(4 8)"><Pan egg /></g></>),
  'cover:sandwich': (<><Bread x={10} y={54} /><polygon points="10,58 90,58 80,44 20,44" fill="#ffd23f" /><rect x="10" y="30" width="80" height="14" rx="6" fill="#8fe0b0" /><g transform="translate(0 -16)"><Bread x={10} y={22} tint="#f6d08e" /></g></>),
  'cover:bedtime': (<BedArt moon />),
}

export const hasArt = (key) => Boolean(ART[key])

export default function Picture({ name, className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label={name.split(':')[1]} focusable="false">
      {ART[name] || <circle cx="50" cy="50" r="28" fill="#f0e4d2" />}
    </svg>
  )
}
