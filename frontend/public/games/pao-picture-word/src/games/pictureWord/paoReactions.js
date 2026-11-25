// Pao reactions for the Picture Word game.
// Each reaction uses ONLY existing pose and expression keys, plus an optional prop overlay.
// Pose keys:  relax wave cheer hello jump dance groove tada think shy hug lean
// Face keys:  happy proud wink excited laugh surprised silly cool love sleepy sad grumpy
// Lines are static text; the game may pick one at random per reaction.
export const PICTURE_WORD_REACTIONS = {
  ready:     { pose: 'hello',  expression: 'happy',     prop: null,     lines: ['Let us read some {category} words!', 'Ready? Here we go!'] },
  listening: { pose: 'relax',  expression: 'happy',     prop: 'phones', lines: ['Listen carefully. Which word is this?', 'Press Hear it and listen.'] },
  thinking:  { pose: 'think',  expression: 'happy',     prop: null,     lines: ['Take your time. You can do it!', 'Hmm, which one could it be?'] },
  correct:   { pose: 'cheer',  expression: 'excited',   prop: null,     lines: ['Yes! {word}! You read it so well!', 'That is right!', 'Great reading!'] },
  streak:    { pose: 'jump',   expression: 'laugh',     prop: null,     lines: ['Wow! {n} in a row!', 'You are on fire!'] },
  oops:      { pose: 'relax',  expression: 'surprised', prop: null,     lines: ['Oops! Have another look.', 'Almost! Try again.'] },
  encourage: { pose: 'hug',    expression: 'love',      prop: null,     lines: ['You are so close. I believe in you!'] },   // after 2 wrong answers on the same word
  hint:      { pose: 'think',  expression: 'wink',      prop: 'lens',   lines: ['Look at the first letter. It starts with {letter}!'] },
  finished:  { pose: 'tada',   expression: 'proud',     prop: null,     lines: ['You read them all!', 'Super reading, {name}!'] },
};

// Timing: show a reaction for 2200 ms, then return to 'listening' (while audio plays) or 'ready' (idle).
export const REACTION_MS = 2200;
// Idle: if the child has not answered for 8000 ms, play 'thinking' once.
export const IDLE_THINKING_MS = 8000;
// Streak: play 'streak' on every 3rd correct answer in a row, otherwise 'correct'.
export const STREAK_EVERY = 3;
