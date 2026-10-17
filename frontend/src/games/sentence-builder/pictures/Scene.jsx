// A simple flat scene (330x214) for every sentence. No emojis, no external files.
const INK = '#3a2e6b'

const Room = ({ children, window: win }) => (
  <>
    <rect width="330" height="214" fill="#fdeed8" />
    <rect y="152" width="330" height="62" fill="#ecd3a6" />
    {win && <g><rect x="212" y="26" width="84" height="74" rx="4" fill="#cfeeff" stroke="#8a5a2b" strokeWidth="6" /><path d="M254 26 v74 M212 63 h84" stroke="#8a5a2b" strokeWidth="4" /><circle cx="232" cy="46" r="8" fill="#fff3b0" /></g>}
    {children}
  </>
)
const Outdoor = ({ children }) => (
  <>
    <rect width="330" height="214" fill="#cfeeff" />
    <circle cx="288" cy="40" r="20" fill="#ffd23f" />
    <ellipse cx="70" cy="40" rx="30" ry="12" fill="#fff" /><ellipse cx="92" cy="34" rx="22" ry="12" fill="#fff" />
    <rect y="150" width="330" height="64" fill="#8fd18f" />
    {children}
  </>
)

const Cat = ({ x, y, s = 1, sleeping, big }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M60 0 q36 -6 30 -34" stroke="#f5a54a" strokeWidth="12" fill="none" strokeLinecap="round" />
    <ellipse cx="22" cy="-6" rx="58" ry="30" fill="#f5a54a" />
    <path d="M10 -32 q8 8 14 0 M34 -30 q8 8 14 0" stroke="#d9822b" strokeWidth="4" fill="none" strokeLinecap="round" />
    <polygon points="-44,-26 -40,-52 -22,-34" fill="#f5a54a" /><polygon points="-6,-30 -2,-54 14,-38" fill="#f5a54a" />
    <ellipse cx="-22" cy="-14" rx="28" ry="24" fill="#f5a54a" />
    {sleeping
      ? <path d="M-36 -16 q6 6 12 0 M-18 -16 q6 6 12 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      : <><circle cx="-32" cy="-16" r="3.5" fill={INK} /><circle cx="-14" cy="-16" r="3.5" fill={INK} /></>}
    <polygon points="-27,-8 -19,-8 -23,-3" fill="#ff7a8a" />
    {big && null}
  </g>
)

const Dog = ({ x, y, s = 1, run }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M70 -30 q18 -16 10 -34" stroke="#c48a4c" strokeWidth="11" fill="none" strokeLinecap="round" />
    <ellipse cx="22" cy="-26" rx="56" ry="26" fill="#c48a4c" />
    {run
      ? <><path d="M-6 -6 l-26 14 M-6 -6 l-8 22 M44 -6 l24 14 M44 -6 l2 22" stroke="#a86f3b" strokeWidth="11" strokeLinecap="round" /></>
      : <><rect x="-10" y="-8" width="11" height="30" rx="5" fill="#a86f3b" /><rect x="46" y="-8" width="11" height="30" rx="5" fill="#a86f3b" /></>}
    <ellipse cx="-30" cy="-48" rx="22" ry="22" fill="#c48a4c" />
    <ellipse cx="-50" cy="-48" rx="9" ry="20" fill="#8a5a2b" />
    <ellipse cx="-24" cy="-38" rx="12" ry="9" fill="#f3d9b2" />
    <circle cx="-30" cy="-52" r="3.5" fill={INK} /><ellipse cx="-24" cy="-42" rx="4.5" ry="3.5" fill={INK} />
  </g>
)

const Bird = ({ x, y, s = 1, sing, fly }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="22" ry="17" fill="#4aa8e8" />
    <circle cx="-16" cy="-12" r="12" fill="#4aa8e8" />
    <polygon points="-27,-12 -38,-9 -27,-5" fill="#ffb020" />
    <circle cx="-18" cy="-14" r="2.6" fill={INK} />
    <path d="M18 -2 l16 -6 l-4 12z" fill="#2f86c4" />
    {fly ? <path d="M-4 -6 q-14 -22 -30 -14 q8 10 18 18z" fill="#7cc2f3" /> : <ellipse cx="2" cy="2" rx="12" ry="8" fill="#7cc2f3" />}
    {sing && <g fill="none" stroke="#e0457b" strokeWidth="3" strokeLinecap="round"><path d="M-48 -26 q-6 6 0 12" /><path d="M-58 -30 q-10 12 0 24" /></g>}
  </g>
)

const Person = ({ x, y, s = 1, shirt = '#6aa6ff', hair = '#5a3a1f', skin = '#f3c9a0', mouth = 'smile', arms = 'down' }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-24" y="30" width="48" height="52" rx="14" fill={shirt} />
    {arms === 'up' && <><rect x="-40" y="26" width="14" height="40" rx="7" fill={skin} transform="rotate(30 -33 30)" /><rect x="26" y="26" width="14" height="40" rx="7" fill={skin} transform="rotate(-30 33 30)" /></>}
    {arms === 'down' && <><rect x="-36" y="34" width="13" height="40" rx="6" fill={skin} /><rect x="23" y="34" width="13" height="40" rx="6" fill={skin} /></>}
    <circle cx="0" cy="0" r="30" fill={skin} />
    <path d="M-30 -4 q2 -30 30 -30 q28 0 30 30 q-14 -14 -30 -14 q-16 0 -30 14z" fill={hair} />
    <circle cx="-10" cy="2" r="3.5" fill={INK} /><circle cx="10" cy="2" r="3.5" fill={INK} />
    {mouth === 'smile' && <path d="M-9 14 q9 8 18 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />}
    {mouth === 'open' && <ellipse cx="0" cy="16" rx="7" ry="5" fill="#c4466f" />}
    {mouth === 'sad' && <path d="M-9 20 q9 -8 18 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />}
  </g>
)

const SCENES = {
  'cat-sleeps': (win) => (
    <Room window={win}>
      <ellipse cx="150" cy="156" rx="100" ry="20" fill="#f48fb1" /><ellipse cx="150" cy="150" rx="88" ry="14" fill="#ffc2d8" />
      <Cat x={150} y={142} s={1.05} sleeping />
      <g fill="#7c5cf0" fontWeight="800" fontFamily="system-ui"><text x="40" y="60" fontSize="30">Z</text><text x="62" y="40" fontSize="20">z</text></g>
    </Room>
  ),
  'dog-runs': () => (<Outdoor><Dog x={160} y={170} s={1.2} run /><path d="M250 120 h34 M256 136 h40 M250 152 h30" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></Outdoor>),
  'eat-rice': () => (
    <Room>
      <rect y="140" width="330" height="74" fill="#c9965a" />
      <path d="M90 140 h150 q-6 52 -75 52 q-69 0 -75 -52z" fill="#fff" stroke="#cfd6e6" strokeWidth="4" />
      <path d="M100 140 q65 -50 130 0z" fill="#fffdf5" stroke="#eee6cf" strokeWidth="3" />
      {[[130, 128], [155, 118], [180, 124], [200, 132], [145, 134]].map(([a, b], i) => <ellipse key={i} cx={a} cy={b} rx="7" ry="3.5" fill="#f1ead6" transform={`rotate(${i * 25} ${a} ${b})`} />)}
      <path d="M200 70 l54 66 M214 66 l54 66" stroke="#8a5a2b" strokeWidth="6" strokeLinecap="round" />
      <path d="M130 100 q-8 -14 0 -26 M165 96 q-8 -14 0 -26" stroke="#bbb" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
    </Room>
  ),
  'bird-sings': () => (
    <Outdoor>
      <rect x="0" y="108" width="330" height="12" rx="6" fill="#8a5a2b" /><circle cx="270" cy="96" r="30" fill="#4cbd75" /><circle cx="300" cy="110" r="24" fill="#3fa564" />
      <Bird x={165} y={86} s={1.8} sing />
      <g fill="#7c5cf0" fontWeight="800" fontSize="26" fontFamily="system-ui"><text x="40" y="60">♪</text><text x="70" y="36">♫</text></g>
    </Outdoor>
  ),
  'mama-cooks': () => (
    <Room>
      <rect y="120" width="330" height="94" fill="#e6d3b8" /><rect x="170" y="120" width="140" height="20" fill="#9aa4bd" />
      <path d="M190 120 h100 v-26 q-50 -10 -100 0z" fill="#cfd6e6" /><rect x="186" y="84" width="108" height="14" rx="7" fill="#7b86a3" />
      <path d="M215 80 q-8 -14 0 -26 M245 80 q-8 -14 0 -26 M272 80 q-8 -14 0 -26" stroke="#bbb" strokeWidth="4" fill="none" strokeLinecap="round" />
      <Person x={90} y={74} s={1.3} shirt="#ef7aa0" hair="#3a2414" arms="up" />
    </Room>
  ),
  'brush-teeth': () => (
    <Room>
      <rect x="0" y="0" width="330" height="214" fill="#d9f1ff" /><rect y="160" width="330" height="54" fill="#bfe3f5" />
      <Person x={150} y={96} s={1.6} shirt="#ffd23f" hair="#2b1a10" mouth="open" />
      <rect x="170" y="100" width="92" height="12" rx="6" fill="#ef5a6f" transform="rotate(-12 170 100)" /><rect x="164" y="92" width="22" height="20" rx="4" fill="#fff" transform="rotate(-12 170 100)" />
      {[[230, 70, 10], [255, 52, 7], [275, 80, 8], [210, 56, 6]].map(([a, b, r], i) => <circle key={i} cx={a} cy={b} r={r} fill="#fff" stroke="#9bd4f0" strokeWidth="2" />)}
    </Room>
  ),
  'boy-running': () => (<Outdoor><Person x={150} y={70} s={1.4} shirt="#4aa8e8" arms="up" /><path d="M64 120 h40 M56 138 h46 M70 156 h30" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></Outdoor>),
  'fish-swim': () => (
    <>
      <rect width="330" height="214" fill="#8fd3f4" /><rect y="170" width="330" height="44" fill="#e8d29a" />
      <path d="M0 40 q20 -10 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#d6f0ff" strokeWidth="5" fill="none" />
      <g transform="translate(150 100) scale(1.9)"><polygon points="26,0 46,-14 46,14" fill="#ff8a3d" /><ellipse cx="0" cy="0" rx="30" ry="20" fill="#ffa24d" /><circle cx="-14" cy="-4" r="4.5" fill="#fff" /><circle cx="-15" cy="-4" r="2.4" fill={INK} /><path d="M-24 8 q5 4 10 0" stroke={INK} strokeWidth="2" fill="none" /></g>
      {[[60, 120, 9], [78, 94, 6], [265, 70, 8], [280, 98, 5]].map(([a, b, r], i) => <circle key={i} cx={a} cy={b} r={r} fill="none" stroke="#fff" strokeWidth="3" />)}
      <path d="M40 214 q4 -40 -4 -60 M56 214 q-2 -30 6 -44" stroke="#3fa564" strokeWidth="6" fill="none" strokeLinecap="round" />
    </>
  ),
  'red-apples': () => (
    <Room>
      <rect y="150" width="330" height="64" fill="#c9965a" />
      <path d="M70 120 h190 q-8 58 -95 58 q-87 0 -95 -58z" fill="#d9a35c" stroke="#a8742f" strokeWidth="4" />
      {[[110, 112], [150, 100], [195, 108], [232, 116], [130, 128], [175, 124]].map(([a, b], i) => <g key={i}><circle cx={a} cy={b} r="24" fill="#ef4d5e" /><path d={`M${a} ${b - 22} q6 -12 14 -12`} stroke="#4a7a2a" strokeWidth="4" fill="none" strokeLinecap="round" /><ellipse cx={a - 8} cy={b - 8} rx="5" ry="3" fill="#fff" opacity=".5" /></g>)}
    </Room>
  ),
  'baby-crying': () => (
    <Room>
      <rect x="50" y="96" width="230" height="100" rx="12" fill="#ffd9a8" stroke="#c9965a" strokeWidth="5" />
      {[80, 130, 180, 230].map((a) => <line key={a} x1={a} y1="96" x2={a} y2="196" stroke="#c9965a" strokeWidth="5" />)}
      <circle cx="165" cy="104" r="40" fill="#f6d1ad" /><path d="M128 96 q10 -26 37 -26 q27 0 37 26 q-20 -10 -37 -10 q-17 0 -37 10z" fill="#5a3a1f" />
      <path d="M146 98 q6 -5 12 0 M172 98 q6 -5 12 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="165" cy="120" rx="9" ry="7" fill="#c4466f" />
      <path d="M150 106 q-5 14 -2 24 M180 106 q5 14 2 24" stroke="#4aa8e8" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Room>
  ),
  'go-school': () => (
    <Outdoor>
      <rect x="190" y="50" width="120" height="100" fill="#ef7a5a" /><polygon points="180,52 250,14 320,52" fill="#a6442f" />
      <rect x="236" y="104" width="28" height="46" rx="3" fill="#8a5a2b" />{[206, 276].map((a) => <rect key={a} x={a} y="72" width="22" height="22" fill="#cdeeff" stroke="#fff" strokeWidth="3" />)}
      <rect x="248" y="20" width="4" height="22" fill="#8a5a2b" /><rect x="252" y="20" width="18" height="12" fill="#ffd23f" />
      <Person x={60} y={86} s={0.9} shirt="#ef7aa0" hair="#2b1a10" /><Person x={125} y={90} s={0.85} shirt="#4aa8e8" hair="#8a5a2b" />
    </Outdoor>
  ),
  'dog-big': () => (<Outdoor><Dog x={150} y={196} s={2.1} /><g transform="translate(290 190) scale(.6)"><Cat x={0} y={0} /></g></Outdoor>),
  'wash-hands': () => (
    <Room>
      <rect width="330" height="214" fill="#d9f1ff" />
      <rect x="150" y="14" width="40" height="22" rx="8" fill="#9aa4bd" /><rect x="162" y="30" width="16" height="22" fill="#9aa4bd" />
      <path d="M170 56 v40" stroke="#6ec6ff" strokeWidth="8" strokeLinecap="round" />
      <g fill="#f3c9a0" stroke="#d9a878" strokeWidth="3"><rect x="96" y="98" width="62" height="78" rx="28" transform="rotate(-10 127 137)" /><rect x="176" y="98" width="62" height="78" rx="28" transform="rotate(10 207 137)" /></g>
      {[[110, 90, 10], [140, 80, 7], [225, 86, 9], [250, 106, 6], [190, 150, 8]].map(([a, b, r], i) => <circle key={i} cx={a} cy={b} r={r} fill="#fff" stroke="#9bd4f0" strokeWidth="2" />)}
    </Room>
  ),
  'girl-reads': () => (
    <Room>
      <Person x={150} y={78} s={1.4} shirt="#c58af0" hair="#2b1a10" />
      <path d="M100 150 l50 -10 l50 10 v44 l-50 -10 l-50 10z" fill="#ffd23f" stroke="#c9961f" strokeWidth="4" strokeLinejoin="round" /><line x1="150" y1="140" x2="150" y2="184" stroke="#c9961f" strokeWidth="4" />
      <path d="M112 156 l30 -6 M112 168 l30 -6 M158 150 l30 6 M158 162 l30 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </Room>
  ),
  'mom-coffee': () => (
    <Room>
      <Person x={130} y={76} s={1.45} shirt="#ef7aa0" hair="#3a2414" />
      <g transform="translate(220 120)"><path d="M0 0 h56 v34 q0 22 -28 22 q-28 0 -28 -22z" fill="#fff" stroke="#cfd6e6" strokeWidth="4" /><path d="M56 8 q22 0 22 18 q0 16 -22 16" stroke="#cfd6e6" strokeWidth="6" fill="none" /><rect x="6" y="4" width="44" height="8" fill="#6b3a1a" /></g>
      <path d="M234 100 q-8 -14 0 -26 M254 100 q-8 -14 0 -26" stroke="#bbb" strokeWidth="4" fill="none" strokeLinecap="round" />
    </Room>
  ),
  'birds-sky': () => (
    <>
      <rect width="330" height="214" fill="#8fd3f4" /><ellipse cx="80" cy="150" rx="46" ry="16" fill="#fff" /><ellipse cx="260" cy="170" rx="56" ry="18" fill="#fff" /><circle cx="290" cy="36" r="20" fill="#ffd23f" />
      <Bird x={110} y={80} s={1.4} fly /><Bird x={210} y={56} s={1.1} fly /><Bird x={250} y={120} s={0.9} fly />
    </>
  ),
  'sun-hot': () => (
    <>
      <rect width="330" height="214" fill="#ffe9b0" /><rect y="164" width="330" height="50" fill="#f2cf7e" />
      <g transform="translate(165 92)">
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-66" x2="0" y2="-84" stroke="#ff9a1f" strokeWidth="8" strokeLinecap="round" transform={`rotate(${i * 30})`} />)}
        <circle r="54" fill="#ffc83d" /><circle cx="-18" cy="-6" r="5" fill={INK} /><circle cx="18" cy="-6" r="5" fill={INK} /><path d="M-18 16 q18 14 36 0" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="-34" cy="12" r="6" fill="#ff9a8a" opacity=".7" /><circle cx="34" cy="12" r="6" fill="#ff9a8a" opacity=".7" />
      </g>
      <path d="M30 190 q8 -10 16 0 t16 0 M250 190 q8 -10 16 0 t16 0" stroke="#ff9a1f" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
}

export default function Scene({ id, window: win, className }) {
  const art = SCENES[id]
  return (
    <svg className={className} viewBox="0 0 330 214" role="img" aria-label={id} preserveAspectRatio="xMidYMid slice" focusable="false">
      {art ? art(win) : <rect width="330" height="214" fill="#fdeed8" />}
    </svg>
  )
}
