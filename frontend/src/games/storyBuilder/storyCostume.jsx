// Pao's costume for Story Builder ("Storyteller"). In-game only: never saved, never changes Customize Pao,
// ignores item ownership. Magnifier ('lens') and headphones ('phones') props are in the Picture Word pack.
import React from 'react';

export const STORY_COSTUME = {
  name: 'Storyteller',
  look: { hair: null, hat: 'crown', clothes: 'tee', pants: 'jeans', shoes: 'sandals' }, // existing Pao item keys
};
export const PAO_VIEWBOX = '-30 -66 250 322';

// Story scroll and quill. Render over the Pao SVG in a position: relative wrapper, same width, height and viewBox.
export function StoryScroll({ width, height, viewBox = PAO_VIEWBOX }) {
  return (
    <svg viewBox={viewBox} width={width} height={height} aria-hidden="true"
         style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      <g transform="translate(130 170) rotate(-10)">
        <rect width="36" height="26" rx="4" fill="#FEF3C7" stroke="#B45309" strokeWidth="2.6" />
        <ellipse cx="0" cy="13" rx="4" ry="15" fill="#FCD34D" stroke="#B45309" strokeWidth="2.4" />
        <ellipse cx="36" cy="13" rx="4" ry="15" fill="#FCD34D" stroke="#B45309" strokeWidth="2.4" />
        <path d="M9 8h20M9 14h20M9 20h12" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M146 24Q166 -4 176 -12Q170 8 156 26z" fill="#fff" stroke="#9CA3AF" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
