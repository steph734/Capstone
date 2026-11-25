// Prop overlays drawn on top of Pao. Render inside a wrapper with position: relative,
// directly over the Pao SVG. Use the SAME viewBox as the Pao render (default '-30 -66 250 322')
// and the same width and height, so the props line up with the head.
import React from 'react';

export const PAO_VIEWBOX = '-30 -66 250 322';

export function PaoProp({ kind, width, height }) {
  if (!kind) return null;
  return (
    <svg viewBox={PAO_VIEWBOX} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {kind === 'phones' && <Headphones />}
      {kind === 'lens' && <Magnifier />}
    </svg>
  );
}

function Headphones() {
  return (
    <g className="pw-phones">
      <path d="M22 86C22 6 162 6 162 86" fill="none" stroke="#5B3FD0" strokeWidth="11" strokeLinecap="round" />
      <path d="M22 86C22 8 162 8 162 86" fill="none" stroke="#9B7BFF" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <rect x="4" y="66" width="32" height="52" rx="15" fill="#7C5CE0" stroke="#4B2BB8" strokeWidth="3" />
      <rect x="148" y="66" width="32" height="52" rx="15" fill="#7C5CE0" stroke="#4B2BB8" strokeWidth="3" />
      <rect x="9" y="74" width="9" height="36" rx="4" fill="#fff" opacity=".35" />
      <rect x="153" y="74" width="9" height="36" rx="4" fill="#fff" opacity=".35" />
      <g className="pw-waves" fill="none" stroke="#38BDF8" strokeWidth="5" strokeLinecap="round">
        <path d="M-6 80q-8 12 0 24M-16 72q-14 20 0 40" />
        <path d="M190 80q8 12 0 24M200 72q14 20 0 40" />
      </g>
    </g>
  );
}

function Magnifier() {
  return (
    <g className="pw-lens">
      <g transform="translate(178 150) scale(.85)">
        <path d="M18 20L46 54" stroke="#92400E" strokeWidth="11" strokeLinecap="round" />
        <path d="M18 20L46 54" stroke="#D97706" strokeWidth="5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="30" fill="#BAE6FD" fillOpacity=".55" stroke="#F59E0B" strokeWidth="9" />
        <path d="M-16 -10a20 20 0 0 1 14 -14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".85" />
      </g>
      <path d="M196 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFD43B" />
    </g>
  );
}

// Optional CSS (add to the game stylesheet). Disabled by prefers-reduced-motion.
export const PAO_PROP_CSS = `
@keyframes pwWave { 0%,100% { opacity:.35 } 50% { opacity:1 } }
@keyframes pwGlint { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
.pw-waves { animation: pwWave 1.2s ease-in-out infinite; }
.pw-lens  { transform-box: fill-box; transform-origin: center; animation: pwGlint 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .pw-waves, .pw-lens { animation: none; } }
`;
