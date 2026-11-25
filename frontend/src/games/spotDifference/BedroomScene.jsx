// Pao's bedroom picture pair (viewBox 640x400). side="A" or "B". Four differences, same as the mock-ups.
// If the game already has an equivalent scene with the same differences, keep it and only restyle the frame.
// Overlay markers (found ring, hint spotlight, wrong-tap ring) are drawn in the same 640x400 space.
import React from 'react';

export const BEDROOM_DIFFS = {
  sock: { cx: 310, cy: 340, r: 36, label: 'Blue sock',          only: 'A' },
  lamp: { cx: 334, cy: 202, r: 44, label: 'Lamp colour',        only: null },  // A orange, B red
  book: { cx: 300, cy: 138, r: 32, label: 'Extra book',         only: 'B' },
  sun:  { cx: 158, cy: 78,  r: 26, label: 'Sun in the picture', only: 'A' },
};

export default function BedroomScene({ side = 'A', found = [], hint = null, miss = null, id = 'bed' }) {
  const A = side === 'A';
  const lamp = A ? '#F59E0B' : '#E5484D';
  const lampDark = A ? '#B45309' : '#9F1239';
  const clip = `${id}-${side}-clip`;
  const mask = `${id}-${side}-mask`;
  return (
    <svg viewBox="0 0 640 400" width="100%" height="100%" style={{ display: 'block' }} role="img"
         aria-label={`Picture ${side}: Pao's bedroom`}>
      <defs><clipPath id={clip}><rect width="640" height="400" rx="26" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="640" height="300" fill="#FDEBD6" /><rect y="300" width="640" height="100" fill="#D9B88E" /><rect y="294" width="640" height="10" fill="#C9A173" />
        {/* picture frame */}
        <rect x="80" y="54" width="100" height="76" rx="6" fill="#B9784A" /><rect x="87" y="61" width="86" height="62" rx="2" fill="#EAF7E4" />
        <path d="M87 123L112 92L130 108L146 90L173 123z" fill="#7BC74D" />
        {A && <circle cx="158" cy="78" r="8" fill="#FFC83D" />}
        {/* shelf and books */}
        <rect x="226" y="158" width="150" height="9" rx="3" fill="#8A5535" />
        <rect x="238" y="116" width="16" height="42" rx="2" fill="#3B82F6" /><rect x="256" y="120" width="16" height="38" rx="2" fill="#EF4444" /><rect x="274" y="118" width="16" height="40" rx="2" fill="#22A559" />
        {!A && <rect x="292" y="114" width="16" height="44" rx="2" fill="#8B5CF6" />}
        <path d="M334 158a14 14 0 0 1 28 0z" fill="#F59E0B" />
        {/* window */}
        <rect x="452" y="54" width="158" height="110" rx="10" fill="#fff" />
        {[[460, 62, 46], [534, 62, 46], [460, 114, 42], [534, 114, 42]].map(([x, y, h]) => <rect key={x + '-' + y} x={x} y={y} width="68" height={h} rx="3" fill="#BFE4F8" />)}
        <circle cx="568" cy="88" r="20" fill="#FFC045" />
        {/* nightstand and lamp */}
        <rect x="300" y="246" width="70" height="52" rx="5" fill="#C48C57" /><rect x="300" y="246" width="70" height="8" rx="4" fill="#D9A56E" />
        <rect x="331" y="218" width="6" height="28" fill="#6B7280" /><polygon points="312,218 356,218 346,186 322,186" fill={lamp} /><rect x="322" y="186" width="24" height="5" rx="2" fill={lampDark} opacity=".35" />
        {/* bed */}
        <rect x="34" y="240" width="26" height="130" rx="7" fill="#8B5A3C" /><rect x="56" y="290" width="144" height="50" rx="9" fill="#fff" />
        <rect x="118" y="292" width="160" height="44" rx="11" fill="#9B72E0" /><rect x="62" y="272" width="62" height="24" rx="12" fill="#fff" stroke="#D9DEE8" strokeWidth="2" /><rect x="262" y="334" width="16" height="36" rx="3" fill="#8B5A3C" />
        {/* rug, cat, ball */}
        <ellipse cx="430" cy="352" rx="120" ry="28" fill="#F1A9C0" /><path d="M360 352H500" stroke="#F8D0DC" strokeWidth="5" strokeLinecap="round" />
        <path d="M390 342q-24 -2 -22 -22q2 -8 10 -4" stroke="#F28A2E" strokeWidth="9" fill="none" strokeLinecap="round" />
        <ellipse cx="424" cy="344" rx="40" ry="19" fill="#F28A2E" /><circle cx="470" cy="330" r="18" fill="#F28A2E" />
        <polygon points="458,320 462,298 474,314" fill="#F28A2E" /><polygon points="476,314 488,298 490,322" fill="#F28A2E" />
        <circle cx="465" cy="330" r="2.4" fill="#5B2A0E" /><circle cx="477" cy="330" r="2.4" fill="#5B2A0E" />
        <circle cx="578" cy="358" r="27" fill="#E8484F" /><path d="M553 354Q578 340 603 354" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" /><path d="M553 364Q578 376 603 364" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
        {A && (
          <g transform="translate(72 0)">
            <path d="M214 310h24v26q14 4 20 14q4 12 -8 12h-36z" fill="#3B82F6" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="214" y="310" width="24" height="9" fill="#93C5FD" />
          </g>
        )}
        {/* hint spotlight */}
        {hint && (() => { const d = BEDROOM_DIFFS[hint]; return (
          <g>
            <defs><mask id={mask}><rect width="640" height="400" fill="#fff" /><circle cx={d.cx} cy={d.cy} r={d.r + 10} fill="#000" /></mask></defs>
            <rect width="640" height="400" fill="#1B2B6B" opacity=".42" mask={`url(#${mask})`} />
            <g className="sd-hint-ring"><circle cx={d.cx} cy={d.cy} r={d.r + 18} fill="none" stroke="#FFD43B" strokeWidth="5" opacity=".45" /><circle cx={d.cx} cy={d.cy} r={d.r + 10} fill="none" stroke="#FFB020" strokeWidth="6" strokeDasharray="3 12" strokeLinecap="round" /></g>
          </g>); })()}
        {/* found rings (draw on BOTH pictures) */}
        {found.map((k) => { const d = BEDROOM_DIFFS[k]; return (
          <g key={k}>
            <circle cx={d.cx} cy={d.cy} r={d.r} fill="rgba(34,197,94,.14)" stroke="#fff" strokeWidth="11" /><circle cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke="#22C55E" strokeWidth="6" />
            <g transform={`translate(${d.cx + d.r * 0.72} ${d.cy - d.r * 0.72})`}><circle r="15" fill="#22C55E" stroke="#fff" strokeWidth="4" /><path d="M-6 0L-2 5L7 -5" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
          </g>); })}
        {/* wrong tap: soft orange, never red */}
        {miss && (<g><circle cx={miss.x} cy={miss.y} r="30" fill="rgba(251,146,60,.18)" stroke="#fff" strokeWidth="10" /><circle cx={miss.x} cy={miss.y} r="30" fill="none" stroke="#FB923C" strokeWidth="5" strokeDasharray="8 7" strokeLinecap="round" /><circle cx={miss.x} cy={miss.y} r="6" fill="#FB923C" /></g>)}
      </g>
    </svg>
  );
}
