// Pao reactions for Slow-Motion Echo.
// Uses ONLY existing pose and expression keys, plus optional prop overlays (see PaoProps.jsx).
// Pose keys:  relax wave cheer hello jump dance groove tada think shy hug lean
// Face keys:  happy proud wink excited laugh surprised silly cool love sleepy sad grumpy
export const ECHO_REACTIONS = {
  ready:     { pose: 'hello',  expression: 'happy',     prop: null,     lines: ['Let us echo some words!', 'Ready to echo? Let us go nice and slow!'] },
  listening: { pose: 'relax',  expression: 'happy',     prop: 'phones', lines: ['Listen closely. Here comes the word!'] },
  yourTurn:  { pose: 'relax',  expression: 'surprised', prop: 'echo',   lines: ['Your turn! Say it back, nice and slow.'] },
  beats:     { pose: 'groove', expression: 'happy',     prop: 'beats',  lines: ['{syllables}'] },              // e.g. "pen... cil..." while each syllable plays
  great:     { pose: 'cheer',  expression: 'excited',   prop: null,     lines: ['Yes! {word}! What a super echo!', 'Great echo!'] },
  slower:    { pose: 'relax',  expression: 'happy',     prop: 'turtle', lines: ['Almost! Turtles go slowly. Let us try again.'] },
  encourage: { pose: 'hug',    expression: 'love',      prop: null,     lines: ['You are so close. I believe in you!'] },  // after 2 slower tries on the same word
  streak:    { pose: 'jump',   expression: 'laugh',     prop: null,     lines: ['Wow! {n} in a row!'] },
  finished:  { pose: 'tada',   expression: 'proud',     prop: null,     lines: ['Slow and steady. You did it, {name}!'] },
};
export const REACTION_MS = 2200;      // how long a one-off reaction stays
export const STREAK_EVERY = 3;        // 'streak' on every 3rd first-try echo in a row
// While audio plays use 'listening' (or 'beats' when echoing one syllable at a time).
// While waiting for the child use 'yourTurn'. Restore the child's chosen style afterwards.
