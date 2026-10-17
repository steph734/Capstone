// Simple flat pictures for every word the game uses (100x100, no emojis, no external files).
const OUT = '#3a2e6b'

const ART = {
  cat: (<>
    <polygon points="24,44 28,14 46,34" fill="#f5a54a" /><polygon points="76,44 72,14 54,34" fill="#f5a54a" />
    <polygon points="29,36 31,22 40,33" fill="#ffd0d0" /><polygon points="71,36 69,22 60,33" fill="#ffd0d0" />
    <circle cx="50" cy="56" r="29" fill="#f5a54a" />
    <path d="M44 30 q6 6 12 0 M36 36 q3 6 4 10 M64 36 q-3 6 -4 10" stroke="#d9822b" strokeWidth="4" fill="none" strokeLinecap="round" />
    <ellipse cx="50" cy="66" rx="14" ry="10" fill="#ffe8cc" />
    <circle cx="40" cy="53" r="4.5" fill={OUT} /><circle cx="60" cy="53" r="4.5" fill={OUT} />
    <polygon points="46,61 54,61 50,66" fill="#ff7a8a" />
    <path d="M50 66 v4 M50 70 q-5 4 -9 1 M50 70 q5 4 9 1" stroke={OUT} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M20 62 h14 M20 70 l13 -3 M80 62 h-14 M80 70 l-13 -3" stroke={OUT} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  hat: (<>
    <ellipse cx="50" cy="76" rx="38" ry="11" fill="#2f2a6e" />
    <ellipse cx="50" cy="72" rx="38" ry="11" fill="#4a44b8" />
    <rect x="30" y="22" width="40" height="50" rx="4" fill="#4a44b8" />
    <ellipse cx="50" cy="22" rx="20" ry="6" fill="#6a63e0" />
    <rect x="30" y="56" width="40" height="10" fill="#ef5a6f" /><circle cx="56" cy="61" r="4" fill="#ffc83d" />
  </>),
  dog: (<>
    <ellipse cx="22" cy="52" rx="11" ry="24" fill="#8a5a2b" transform="rotate(12 22 52)" />
    <ellipse cx="78" cy="52" rx="11" ry="24" fill="#8a5a2b" transform="rotate(-12 78 52)" />
    <circle cx="50" cy="52" r="29" fill="#c48a4c" />
    <ellipse cx="50" cy="64" rx="16" ry="12" fill="#f3d9b2" />
    <circle cx="40" cy="48" r="4.5" fill={OUT} /><circle cx="60" cy="48" r="4.5" fill={OUT} />
    <ellipse cx="50" cy="58" rx="7" ry="5" fill={OUT} />
    <path d="M50 63 v5 M50 68 q-5 5 -10 1 M50 68 q5 5 10 1" stroke={OUT} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <ellipse cx="50" cy="74" rx="4" ry="3" fill="#ff7a8a" />
  </>),
  log: (<>
    <rect x="14" y="34" width="62" height="34" fill="#9a6a3a" />
    <ellipse cx="76" cy="51" rx="12" ry="17" fill="#c9965a" /><ellipse cx="76" cy="51" rx="7" ry="10.5" fill="none" stroke="#9a6a3a" strokeWidth="2.5" />
    <ellipse cx="76" cy="51" rx="2.5" ry="4" fill="#9a6a3a" />
    <ellipse cx="14" cy="51" rx="12" ry="17" fill="#8a5a2b" />
    <path d="M26 42 h34 M30 54 h28 M24 62 h30" stroke="#7a4d22" strokeWidth="2" strokeLinecap="round" />
  </>),
  sun: (<>
    {Array.from({ length: 8 }, (_, i) => <line key={i} x1="50" y1="9" x2="50" y2="22" stroke="#ffb020" strokeWidth="6" strokeLinecap="round" transform={`rotate(${i * 45} 50 50)`} />)}
    <circle cx="50" cy="50" r="26" fill="#ffd23f" />
    <circle cx="41" cy="46" r="3.5" fill={OUT} /><circle cx="59" cy="46" r="3.5" fill={OUT} />
    <circle cx="35" cy="56" r="4" fill="#ff9aa8" opacity=".8" /><circle cx="65" cy="56" r="4" fill="#ff9aa8" opacity=".8" />
    <path d="M40 58 q10 10 20 0" stroke={OUT} strokeWidth="3" fill="none" strokeLinecap="round" />
  </>),
  bun: (<>
    <ellipse cx="50" cy="68" rx="36" ry="12" fill="#e9b872" />
    <path d="M14 62 q0 -36 36 -36 q36 0 36 36 z" fill="#f2c27f" />
    <path d="M14 62 q0 -36 36 -36 q36 0 36 36" fill="none" stroke="#d99a4c" strokeWidth="3" />
    {[[36, 44], [50, 38], [64, 44], [44, 52], [58, 54]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="3.6" ry="2" fill="#fff4dc" transform={`rotate(${i * 30} ${x} ${y})`} />)}
    <rect x="14" y="62" width="72" height="8" rx="4" fill="#d99a4c" />
  </>),
  bee: (<>
    <ellipse cx="34" cy="34" rx="16" ry="22" fill="#cfeeff" stroke="#8ccbec" strokeWidth="2" transform="rotate(-25 34 34)" />
    <ellipse cx="62" cy="32" rx="16" ry="22" fill="#cfeeff" stroke="#8ccbec" strokeWidth="2" transform="rotate(25 62 32)" />
    <ellipse cx="50" cy="60" rx="30" ry="24" fill="#ffd23f" />
    <path d="M42 38 q-5 22 0 44 M58 38 q5 22 0 44" stroke={OUT} strokeWidth="8" fill="none" />
    <circle cx="76" cy="56" r="3.6" fill={OUT} /><circle cx="68" cy="54" r="3.2" fill={OUT} />
    <path d="M70 62 q4 4 8 0" stroke={OUT} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M72 42 q4 -10 10 -12 M64 40 q0 -10 4 -14" stroke={OUT} strokeWidth="2" fill="none" strokeLinecap="round" />
  </>),
  tree: (<>
    <rect x="43" y="56" width="14" height="34" rx="3" fill="#8a5a2b" />
    <circle cx="50" cy="34" r="22" fill="#3fa564" /><circle cx="32" cy="50" r="18" fill="#4cbd75" /><circle cx="68" cy="50" r="18" fill="#4cbd75" />
    <circle cx="44" cy="36" r="3.5" fill="#ef5a6f" /><circle cx="60" cy="46" r="3.5" fill="#ef5a6f" /><circle cx="34" cy="52" r="3.5" fill="#ef5a6f" />
  </>),
  cake: (<>
    <rect x="12" y="50" width="76" height="34" rx="6" fill="#f48fb1" />
    <rect x="12" y="50" width="76" height="12" rx="6" fill="#fff1f6" />
    <path d="M12 56 q8 12 16 0 t16 0 t16 0 t16 0 t12 0" fill="#fff1f6" />
    <rect x="22" y="30" width="56" height="22" rx="5" fill="#ffd0e0" />
    <path d="M22 38 q7 9 14 0 t14 0 t14 0 t14 0" fill="#fff" />
    <rect x="47" y="14" width="6" height="18" fill="#6ec6ff" /><path d="M50 4 q6 6 0 12 q-6 -6 0 -12z" fill="#ffb020" />
  </>),
  lake: (<>
    <rect x="6" y="14" width="88" height="72" rx="10" fill="#d9f1ff" />
    <polygon points="6,50 30,26 52,50" fill="#8fbf9a" /><polygon points="40,50 66,22 94,50" fill="#6fae85" />
    <circle cx="78" cy="26" r="8" fill="#ffd23f" />
    <path d="M6 50 h88 v36 a10 10 0 0 1 -10 0 h-68 a10 10 0 0 1 -10 0z" fill="#4aa8e8" />
    <path d="M16 62 q6 -5 12 0 t12 0 M50 74 q6 -5 12 0 t12 0 M20 78 q6 -5 12 0" stroke="#c7ebff" strokeWidth="3" fill="none" strokeLinecap="round" />
  </>),
  fish: (<>
    <polygon points="72,50 96,30 96,70" fill="#ff8a3d" />
    <ellipse cx="46" cy="50" rx="32" ry="22" fill="#ffa24d" />
    <path d="M36 32 q8 18 0 36" stroke="#ff7a1f" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="28" cy="45" r="5" fill="#fff" /><circle cx="27" cy="45" r="2.8" fill={OUT} />
    <path d="M18 56 q5 4 10 0" stroke={OUT} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M44 28 q8 -10 16 0" fill="#ff7a1f" />
  </>),
  dish: (<>
    <ellipse cx="50" cy="64" rx="42" ry="16" fill="#cfd6e6" />
    <ellipse cx="50" cy="60" rx="42" ry="16" fill="#f3f6fc" stroke="#b7c0d8" strokeWidth="2.5" />
    <ellipse cx="50" cy="60" rx="26" ry="9" fill="#e1e7f5" />
    <circle cx="42" cy="58" r="6" fill="#ef5a6f" /><circle cx="56" cy="60" r="5" fill="#ffc83d" /><circle cx="50" cy="54" r="4" fill="#4cbd75" />
  </>),
  car: (<>
    <path d="M10 60 q0 -14 14 -16 l10 -14 h30 l14 14 q16 2 16 16 v10 h-84z" fill="#ef4d5e" />
    <path d="M38 34 h24 l10 12 h-44z" fill="#cdeeff" /><line x1="50" y1="34" x2="50" y2="46" stroke="#ef4d5e" strokeWidth="3" />
    <circle cx="28" cy="72" r="11" fill={OUT} /><circle cx="28" cy="72" r="5" fill="#cfd6e6" />
    <circle cx="74" cy="72" r="11" fill={OUT} /><circle cx="74" cy="72" r="5" fill="#cfd6e6" />
    <rect x="88" y="58" width="6" height="6" rx="2" fill="#ffd23f" />
  </>),
  star: <polygon points="50,8 61,36 92,38 68,57 76,88 50,70 24,88 32,57 8,38 39,36" fill="#ffd23f" stroke="#ffb020" strokeWidth="4" strokeLinejoin="round" />,
  bug: (<>
    <circle cx="50" cy="26" r="13" fill={OUT} />
    <path d="M42 15 q-4 -8 -10 -8 M58 15 q4 -8 10 -8" stroke={OUT} strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="45" cy="25" r="3" fill="#fff" /><circle cx="56" cy="25" r="3" fill="#fff" />
    <ellipse cx="50" cy="60" rx="32" ry="30" fill="#ef4d5e" /><line x1="50" y1="32" x2="50" y2="90" stroke={OUT} strokeWidth="3" />
    {[[36, 52], [64, 52], [38, 72], [62, 72]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.5" fill={OUT} />)}
  </>),
  rug: (<>
    <polygon points="22,30 92,30 78,76 8,76" fill="#7c5ce0" />
    <polygon points="30,38 84,38 73,68 19,68" fill="#f48fb1" />
    <polygon points="38,45 76,45 68,61 30,61" fill="#ffd23f" />
    {Array.from({ length: 8 }, (_, i) => <line key={i} x1={10 + i * 9} y1="76" x2={8 + i * 9} y2="86" stroke="#7c5ce0" strokeWidth="3" strokeLinecap="round" />)}
  </>),
  pig: (<>
    <polygon points="24,38 20,14 42,28" fill="#f48fb1" /><polygon points="76,38 80,14 58,28" fill="#f48fb1" />
    <circle cx="50" cy="54" r="31" fill="#ffa9c4" />
    <ellipse cx="50" cy="62" rx="15" ry="11" fill="#ff86ad" />
    <ellipse cx="45" cy="62" rx="2.6" ry="4" fill="#c4466f" /><ellipse cx="55" cy="62" rx="2.6" ry="4" fill="#c4466f" />
    <circle cx="38" cy="46" r="4.5" fill={OUT} /><circle cx="62" cy="46" r="4.5" fill={OUT} />
    <circle cx="28" cy="58" r="4" fill="#ff86ad" opacity=".7" /><circle cx="72" cy="58" r="4" fill="#ff86ad" opacity=".7" />
  </>),
  wig: (<>
    {[[26, 42], [38, 30], [52, 26], [66, 30], [76, 42], [22, 58], [80, 58], [28, 72], [72, 72]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="14" fill={i % 2 ? '#8a5ae0' : '#a77cf0'} />)}
    <ellipse cx="50" cy="52" rx="26" ry="24" fill="#8a5ae0" />
    <path d="M32 46 q18 -14 36 0 v20 q-18 8 -36 0z" fill="#ffd9b0" />
    <path d="M30 40 q20 -10 40 0 q-14 14 -40 0z" fill="#8a5ae0" />
  </>),
  mouse: (<>
    <circle cx="24" cy="30" r="17" fill="#b9bfd0" /><circle cx="24" cy="30" r="10" fill="#ffc2d1" />
    <circle cx="76" cy="30" r="17" fill="#b9bfd0" /><circle cx="76" cy="30" r="10" fill="#ffc2d1" />
    <ellipse cx="50" cy="58" rx="28" ry="26" fill="#cdd3e2" />
    <ellipse cx="50" cy="68" rx="14" ry="10" fill="#eef1f8" />
    <circle cx="40" cy="52" r="4.2" fill={OUT} /><circle cx="60" cy="52" r="4.2" fill={OUT} />
    <circle cx="50" cy="64" r="4.5" fill="#ff7a8a" />
    <path d="M50 68 q-4 5 -8 2 M50 68 q4 5 8 2" stroke={OUT} strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M20 66 h12 M22 74 l10 -3 M80 66 h-12 M78 74 l-10 -3" stroke={OUT} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  house: (<>
    <rect x="18" y="46" width="64" height="40" fill="#ffd9a8" />
    <polygon points="8,48 50,12 92,48" fill="#ef5a4f" />
    <rect x="42" y="60" width="16" height="26" rx="3" fill="#8a5a2b" /><circle cx="54" cy="74" r="1.8" fill="#ffd23f" />
    <rect x="24" y="54" width="14" height="14" rx="2" fill="#cdeeff" stroke="#8a5a2b" strokeWidth="2" />
    <rect x="62" y="54" width="14" height="14" rx="2" fill="#cdeeff" stroke="#8a5a2b" strokeWidth="2" />
    <rect x="66" y="18" width="9" height="18" fill="#a6442f" />
  </>),
  bear: (<>
    <circle cx="24" cy="28" r="14" fill="#8a5a2b" /><circle cx="24" cy="28" r="7" fill="#e8b98a" />
    <circle cx="76" cy="28" r="14" fill="#8a5a2b" /><circle cx="76" cy="28" r="7" fill="#e8b98a" />
    <circle cx="50" cy="54" r="30" fill="#a86f3b" />
    <ellipse cx="50" cy="65" rx="15" ry="12" fill="#e8c9a0" />
    <circle cx="39" cy="48" r="4.5" fill={OUT} /><circle cx="61" cy="48" r="4.5" fill={OUT} />
    <ellipse cx="50" cy="60" rx="6" ry="4.5" fill={OUT} />
    <path d="M50 64 v4 M50 68 q-5 5 -9 1 M50 68 q5 5 9 1" stroke={OUT} strokeWidth="2.2" fill="none" strokeLinecap="round" />
  </>),
  chair: (<>
    <rect x="26" y="10" width="48" height="46" rx="6" fill="#c9843e" /><rect x="33" y="18" width="34" height="30" rx="4" fill="#e3a864" />
    <rect x="20" y="52" width="60" height="14" rx="5" fill="#a86a2a" />
    <rect x="24" y="64" width="8" height="26" rx="3" fill="#8a5a2b" /><rect x="68" y="64" width="8" height="26" rx="3" fill="#8a5a2b" />
  </>),
  moon: (<>
    <path d="M62 10 a40 40 0 1 0 28 62 a32 32 0 1 1 -28 -62z" fill="#ffd96a" stroke="#ffb020" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="38" cy="58" r="4" fill="#f5be3a" /><circle cx="48" cy="38" r="3" fill="#f5be3a" /><circle cx="46" cy="74" r="3" fill="#f5be3a" />
    <circle cx="80" cy="16" r="3" fill="#ffd96a" /><circle cx="88" cy="40" r="2.2" fill="#ffd96a" />
  </>),
  spoon: (<>
    <ellipse cx="50" cy="30" rx="20" ry="24" fill="#cfd6e6" stroke="#a5aec8" strokeWidth="3" />
    <ellipse cx="46" cy="26" rx="8" ry="12" fill="#eef1f8" />
    <path d="M44 52 h12 l-3 36 q-3 5 -6 0z" fill="#cfd6e6" stroke="#a5aec8" strokeWidth="3" strokeLinejoin="round" />
  </>),
}

export const hasPicture = (word) => Boolean(ART[word])

export default function Picture({ word, className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label={word} focusable="false">
      {ART[word] || <circle cx="50" cy="50" r="30" fill="#d9d2f5" />}
    </svg>
  )
}
