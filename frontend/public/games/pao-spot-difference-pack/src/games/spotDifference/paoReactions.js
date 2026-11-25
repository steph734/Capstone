// Pao reactions for Spot the Difference.
// Uses ONLY existing pose and expression keys, plus an optional prop overlay (see spotCostume.jsx / PaoProps).
// Pose keys:  relax wave cheer hello jump dance groove tada think shy hug lean
// Face keys:  happy proud wink excited laugh surprised silly cool love sleepy sad grumpy
export const SPOT_REACTIONS = {
  ready:     { pose: 'hello', expression: 'happy',    prop: null,   lines: ['Let us spot {total} differences!', 'Tap what looks different!'] },
  found:     { pose: 'cheer', expression: 'excited',  prop: null,   lines: ['Yes! You found it!', 'Yes! The {thing} is different. {left} to go!'] },
  oneToGo:   { pose: 'lean',  expression: 'excited',  prop: null,   lines: ['Just one more. You can do it!'] },   // when exactly 1 is left
  streak:    { pose: 'jump',  expression: 'laugh',    prop: null,   lines: ['Wow! Super sharp eyes!'] },          // 3 finds in a row with no wrong tap
  notQuite:  { pose: 'shy',   expression: 'silly',    prop: null,   lines: ['Oops! Those two match.', 'That part is the same in both pictures.'] },
  hint:      { pose: 'think', expression: 'wink',     prop: 'lens', lines: ['Look near the {area}. Count them!'] },
  encourage: { pose: 'hug',   expression: 'love',     prop: null,   lines: ['Take your time. I believe in you!'] }, // 3 wrong taps in a row
  finished:  { pose: 'tada',  expression: 'proud',    prop: null,   lines: ['You spotted them all, {name}!'] },
};
export const REACTION_MS = 2200;   // how long a one-off reaction stays; then restore the child's chosen style
export const STREAK_EVERY = 3;     // finds in a row with no wrong tap
export const ENCOURAGE_AFTER = 3;  // wrong taps in a row
// Newest reaction wins; never queue. Wrong taps are never red and never play a buzzer.
