// Pao's costume for Spot the Difference ("Pajama Detective"). In-game only: never saved, never changes
// the outfit in Customize Pao, ignores item ownership. The Magnifier prop for the 'hint' reaction is
// below (identical to the Picture Word pack; import that one instead if it is already installed).
import React from 'react';

export const SPOT_COSTUME = {
  name: 'Pajama Detective',
  // existing Pao item keys
  look: { hair: null, hat: 'bunny', clothes: 'tee', pants: 'star', shoes: 'sandals' },
};
export const PAO_VIEWBOX = '-30 -66 250 322';

// Moon pillow + sparkles. Render over the Pao SVG in a position: relative wrapper, same width, height and viewBox.
export function MoonPillow({ width, height, viewBox = PAO_VIEWBOX }) {
  return (
    <svg viewBox={viewBox} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <g transform="translate(122 168) rotate(-12)">
        <rect width="50" height="34" rx="12" fill="#F9C5DD" stroke="#DB7AA6" strokeWidth="3" />
        <path d="M26 8a10 10 0 1 0 8 15a8 8 0 0 1 -8 -15z" fill="#FFF4B8" stroke="#E0B63A" strokeWidth="2" />
        <circle cx="14" cy="26" r="2" fill="#fff" />
      </g>
      <path d="M168 37l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFD43B" />
      <path d="M14 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff" />
    </svg>
  );
}

// Magnifier for the 'hint' reaction.
export function Magnifier({ width, height, viewBox = PAO_VIEWBOX }) {
  return (
    <svg viewBox={viewBox} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <g className="sd-lens">
        <g transform="translate(178 150) scale(.85)">
          <path d="M18 20L46 54" stroke="#92400E" strokeWidth="11" strokeLinecap="round" />
          <path d="M18 20L46 54" stroke="#D97706" strokeWidth="5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="30" fill="#BAE6FD" fillOpacity=".55" stroke="#F59E0B" strokeWidth="9" />
          <path d="M-16 -10a20 20 0 0 1 14 -14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".85" />
        </g>
        <path d="M196 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFD43B" />
      </g>
    </svg>
  );
}
export const SPOT_PROP_CSS = `
@keyframes sdGlint { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
@keyframes sdRing  { 0%,100% { opacity:.45 } 50% { opacity:1 } }
.sd-lens { transform-box: fill-box; transform-origin: center; animation: sdGlint 1.6s ease-in-out infinite; }
.sd-hint-ring { animation: sdRing 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sd-lens, .sd-hint-ring { animation: none; } }
`;
