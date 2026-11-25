// Prop overlays for Pao in Slow-Motion Echo. Render over the Pao SVG inside a position: relative wrapper,
// same width, height and viewBox (default '-30 -66 250 322').
import React from 'react';
// The headphones drawing is identical to the Picture Word one (same paths), so it is shared, not copied.
import { Headphones } from '../pictureWord/PaoProps';

export const PAO_VIEWBOX = '-30 -66 250 322';

export function PaoProp({ kind, width, height }) {
  if (!kind) return null;
  return (
    <svg viewBox={PAO_VIEWBOX} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {kind === 'phones' && <Headphones />}
      {kind === 'echo' && <EchoRings />}
      {kind === 'beats' && <Beats />}
      {kind === 'turtle' && <TurtleFriend />}
    </svg>
  );
}

function EchoRings() {
  const R = [['M170 84q14 14 0 28', 1], ['M184 72q22 26 0 52', 0.75], ['M198 60q30 40 0 76', 0.5],
             ['M14 84q-14 14 0 28', 1], ['M0 72q-22 26 0 52', 0.75], ['M-14 60q-30 40 0 76', 0.5]];
  return (
    <g className="ec-rings" fill="none" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round">
      {R.map(([d, o], i) => <path key={i} d={d} opacity={o} />)}
    </g>
  );
}

// Syllable beat dots above the head. Pass `count` (1 to 4) and `active` (0-based index) to light them up in turn.
export function Beats({ count = 3, active = -1 }) {
  const pts = { 1: [[92, -14, 13]], 2: [[64, -6, 12], [120, -6, 12]], 3: [[48, 4, 11], [92, -14, 13], [136, 4, 11]], 4: [[36, 10, 10], [72, -8, 12], [112, -8, 12], [148, 10, 10]] }[count] || [];
  return (
    <g className="ec-beats">
      <path d="M44 6Q92 -34 140 6" fill="none" stroke="#F59E0B" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
      {pts.map(([x, y, r], i) => (
        <g key={i} opacity={active < 0 || active === i ? 1 : 0.55}>
          <circle cx={x} cy={y} r={r} fill="#FFD43B" stroke="#F59E0B" strokeWidth="3.4" />
          <text x={x} y={y + 5} textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="800" fontSize={r + 1} fill="#8A5A00">{i + 1}</text>
        </g>
      ))}
    </g>
  );
}

// Small turtle that sits next to Pao's feet. Slides in from the right (see CSS).
function TurtleFriend() {
  return (
    <g className="ec-turtle" transform="translate(150 204) scale(.46)">
      <ellipse cx="38" cy="86" rx="12" ry="9" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="3" />
      <ellipse cx="98" cy="86" rx="12" ry="9" fill="#5FBF7A" stroke="#2F8F55" strokeWidth="3" />
      <circle cx="118" cy="56" r="19" fill="#7ED494" stroke="#2F8F55" strokeWidth="3" />
      <circle cx="124" cy="52" r="3.6" fill="#1B3B2A" /><circle cx="125.2" cy="50.8" r="1.2" fill="#fff" />
      <path d="M118 63q6 5 13 1" stroke="#1B3B2A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M14 82C14 36 40 20 70 20C100 20 126 36 126 82z" fill="#34A56A" stroke="#1F7A4A" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M70 20L56 40L70 58L84 40zM56 40L30 44M84 40L110 44M70 58L70 82" fill="none" stroke="#1F7A4A" strokeWidth="2.8" strokeLinejoin="round" opacity=".7" />
      <path d="M70 20L56 40L70 58L84 40z" fill="#5FD08C" />
    </g>
  );
}

export const PAO_PROP_CSS = `
@keyframes ecWave { 0%,100% { opacity:.35 } 50% { opacity:1 } }
@keyframes ecRing { 0% { opacity:0 } 40% { opacity:1 } 100% { opacity:0 } }
@keyframes ecBeat { 0%,100% { transform: scale(1) } 50% { transform: scale(1.18) } }
@keyframes ecWalk { from { transform: translate(40px,204px) scale(.46) } to { transform: translate(150px,204px) scale(.46) } }
.ec-waves { animation: ecWave 1.2s ease-in-out infinite; }
.ec-rings path { animation: ecRing 1.4s ease-out infinite; }
.ec-rings path:nth-child(2), .ec-rings path:nth-child(5) { animation-delay: .2s; }
.ec-rings path:nth-child(3), .ec-rings path:nth-child(6) { animation-delay: .4s; }
.ec-beats circle { transform-box: fill-box; transform-origin: center; animation: ecBeat 1.1s ease-in-out infinite; }
.ec-turtle { animation: ecWalk 1.8s ease-out both; }
@media (prefers-reduced-motion: reduce) { .ec-waves, .ec-rings path, .ec-beats circle, .ec-turtle { animation: none; } }
`;
