import RhymePicture, { hasPicture } from '../../rhyme-time/pictures/Picture'

// Flat pictures for every Sound Hunt word. Words Rhyme Time already draws are reused from there.
const INK = '#3a2e6b'

const ART = {
  ball: (<>
    <circle cx="50" cy="50" r="36" fill="#ff5c7a" />
    <path d="M14 50 h72 M50 14 v72" stroke="#fff" strokeWidth="5" />
    <path d="M26 24 q22 26 0 52 M74 24 q-22 26 0 52" stroke="#ffc83d" strokeWidth="5" fill="none" />
    <ellipse cx="36" cy="34" rx="6" ry="3.5" fill="#fff" opacity=".6" transform="rotate(-35 36 34)" />
  </>),
  banana: (<>
    <path d="M18 26 q-4 46 52 52 q14 2 18 -6 q-6 2 -14 0 q-44 -8 -38 -46z" fill="#ffd23f" stroke="#e0a800" strokeWidth="3" strokeLinejoin="round" />
    <path d="M22 24 l-4 -8 l8 2z" fill="#7a5a1c" />
    <path d="M30 36 q4 30 44 38" stroke="#e8b400" strokeWidth="3" fill="none" strokeLinecap="round" />
  </>),
  milk: (<>
    <polygon points="30,40 42,16 58,16 70,40" fill="#fff" stroke="#cfd6e6" strokeWidth="3" strokeLinejoin="round" />
    <rect x="28" y="38" width="44" height="52" rx="4" fill="#fff" stroke="#cfd6e6" strokeWidth="3" />
    <rect x="28" y="52" width="44" height="22" fill="#6ec6ff" />
    <circle cx="50" cy="63" r="7" fill="#fff" /><circle cx="46" cy="61" r="1.6" fill={INK} /><circle cx="54" cy="61" r="1.6" fill={INK} />
    <rect x="42" y="12" width="16" height="8" fill="#6ec6ff" />
  </>),
  monkey: (<>
    <circle cx="20" cy="52" r="13" fill="#8a5a2b" /><circle cx="20" cy="52" r="7" fill="#f3d3a8" />
    <circle cx="80" cy="52" r="13" fill="#8a5a2b" /><circle cx="80" cy="52" r="7" fill="#f3d3a8" />
    <circle cx="50" cy="48" r="32" fill="#8a5a2b" />
    <path d="M30 42 q20 -8 40 0 q4 18 -20 22 q-24 -4 -20 -22z" fill="#f3d3a8" />
    <circle cx="40" cy="48" r="4.2" fill={INK} /><circle cx="60" cy="48" r="4.2" fill={INK} />
    <ellipse cx="50" cy="62" rx="12" ry="9" fill="#e8bd8e" /><circle cx="46" cy="60" r="1.8" fill={INK} /><circle cx="54" cy="60" r="1.8" fill={INK} />
    <path d="M42 68 q8 6 16 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </>),
  sock: (<>
    <path d="M34 10 h28 v42 l22 16 q10 10 -4 20 q-14 8 -30 -4 l-16 -12 q-6 -6 -6 -14z" fill="#6aa6ff" stroke="#4a86e0" strokeWidth="3" strokeLinejoin="round" />
    <rect x="34" y="10" width="28" height="14" fill="#ef5a6f" />
    <path d="M70 76 q8 8 -2 14 q-12 4 -22 -6z" fill="#ffd23f" opacity=".95" />
    <path d="M38 34 h20 M38 42 h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
  </>),
  soap: (<>
    <rect x="16" y="42" width="68" height="40" rx="14" fill="#ff9ec7" stroke="#ef6aa0" strokeWidth="3" />
    <text x="50" y="68" textAnchor="middle" fontSize="18" fontWeight="800" fill="#fff" fontFamily="system-ui">SOAP</text>
    {[[28, 28, 10], [50, 20, 7], [70, 30, 12], [86, 14, 6]].map(([a, b, r], i) => <circle key={i} cx={a} cy={b} r={r} fill="#dff3ff" stroke="#9bd4f0" strokeWidth="2" />)}
  </>),
  pen: (<>
    <g transform="rotate(-40 50 50)">
      <rect x="40" y="6" width="20" height="62" rx="5" fill="#4a86e0" />
      <rect x="40" y="6" width="20" height="14" rx="5" fill="#2f5fd0" />
      <polygon points="40,68 60,68 50,90" fill="#f3d3a8" /><polygon points="46,82 54,82 50,90" fill={INK} />
      <rect x="62" y="12" width="5" height="34" rx="2" fill="#2f5fd0" />
    </g>
  </>),
  pizza: (<>
    <path d="M50 88 L10 22 q40 -24 80 0z" fill="#ffd9a0" stroke="#e0a458" strokeWidth="3" strokeLinejoin="round" />
    <path d="M14 28 q36 -18 72 0" stroke="#e0a458" strokeWidth="8" fill="none" strokeLinecap="round" />
    <path d="M18 32 q32 -14 64 0 L50 82z" fill="#ffc83d" />
    {[[40, 40], [58, 44], [48, 60]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r="6.5" fill="#ef4d5e" />)}
    <circle cx="60" cy="56" r="2.6" fill="#4cbd75" /><circle cx="36" cy="52" r="2.6" fill="#4cbd75" />
  </>),
  bed: (<>
    <rect x="8" y="46" width="84" height="28" rx="6" fill="#6aa6ff" />
    <rect x="8" y="30" width="14" height="60" rx="4" fill="#8a5a2b" /><rect x="78" y="40" width="14" height="50" rx="4" fill="#8a5a2b" />
    <rect x="22" y="36" width="32" height="16" rx="8" fill="#fff" stroke="#cfd6e6" strokeWidth="3" />
    <rect x="22" y="52" width="56" height="22" rx="4" fill="#ffd23f" />
    <path d="M30 60 h40 M30 68 h40" stroke="#f5b400" strokeWidth="3" />
  </>),
  bus: (<>
    <rect x="8" y="26" width="84" height="48" rx="10" fill="#ffc83d" stroke="#e0a800" strokeWidth="3" />
    {[16, 38, 60].map((a) => <rect key={a} x={a} y="34" width="18" height="16" rx="3" fill="#cdeeff" />)}
    <rect x="76" y="34" width="12" height="22" rx="3" fill="#cdeeff" />
    <rect x="8" y="58" width="84" height="6" fill="#ef4d5e" />
    <circle cx="28" cy="76" r="10" fill={INK} /><circle cx="28" cy="76" r="4" fill="#cfd6e6" />
    <circle cx="72" cy="76" r="10" fill={INK} /><circle cx="72" cy="76" r="4" fill="#cfd6e6" />
  </>),
}

export const hasWordPicture = (word) => Boolean(ART[word]) || hasPicture(word)

export default function Picture({ word, className }) {
  if (!ART[word]) return <RhymePicture word={word} className={className} />
  return (
    <svg className={className} viewBox="0 0 100 100" role="img" aria-label={word} focusable="false">
      {ART[word]}
    </svg>
  )
}
