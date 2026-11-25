// Pao's costume for Slow-Motion Echo ("Pond Explorer"). In-game only: never saved, never changes
// the outfit in Customize Pao, ignores item ownership.
import React from 'react';

export const ECHO_COSTUME = {
  name: 'Pond Explorer',
  // existing Pao item keys
  look: { hair: 'flower', hat: null, clothes: 'raincoat', pants: 'shorts', shoes: 'rain' },
};

// Turtle backpack overlay. Render over the Pao SVG in a position: relative wrapper,
// same width, height and viewBox (default '-30 -66 250 322').
export function TurtleBackpack({ width, height, viewBox = '-30 -66 250 322' }) {
  return (
    <svg viewBox={viewBox} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <path d="M58 142L92 204M126 142L92 204" stroke="#8A5A2B" strokeWidth="5" strokeLinecap="round" />
      <g transform="translate(62 170)">
        <path d="M-14 6C-14 -14 -2 -20 0 -20C14 -20 14 -14 14 6z" fill="#34A56A" stroke="#1F7A4A" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M0 -20V6M-14 -6H14" stroke="#1F7A4A" strokeWidth="2" opacity=".7" />
        <circle cx="18" cy="2" r="6" fill="#7ED494" stroke="#2F8F55" strokeWidth="2" />
      </g>
    </svg>
  );
}
