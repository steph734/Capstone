// Pao reactions for Story Builder. Uses ONLY existing pose and expression keys, plus optional prop overlays.
// Pose keys:  relax wave cheer hello jump dance groove tada think shy hug lean
// Face keys:  happy proud wink excited laugh surprised silly cool love sleepy sad grumpy
export const STORY_REACTIONS = {
  ready:     { pose: 'hello', expression: 'happy',   prop: null,     lines: ['Which story shall we build today?'] },
  listening: { pose: 'relax', expression: 'happy',   prop: 'phones', lines: ['Listen to the story...'] },       // while narration audio plays
  correct:   { pose: 'cheer', expression: 'excited', prop: null,     lines: ['Yes! That is just right!', 'Yes! {answer}!'] },
  tryAgain:  { pose: 'shy',   expression: 'silly',   prop: null,     lines: ['Hmm, would Grandma like that?', 'Try a different one!'] },
  hint:      { pose: 'think', expression: 'wink',    prop: 'lens',   lines: ['Think about what {character} said.'] },
  encourage: { pose: 'hug',   expression: 'love',    prop: null,     lines: ['You are doing great. Try once more!'] }, // 2 wrong picks in a row
  streak:    { pose: 'jump',  expression: 'laugh',   prop: null,     lines: ['Wow! {n} in a row!'] },           // 3 steps right on the first try
  finished:  { pose: 'tada',  expression: 'proud',   prop: null,     lines: ['You built the whole story, {name}!'] },
};
export const REACTION_MS = 2200;      // one-off reactions; then restore the child's chosen style. Newest wins, never queue.
export const STREAK_EVERY = 3;
export const ENCOURAGE_AFTER = 2;
// Any costume hat is hidden while the 'phones' prop is shown (the Storyteller crown included).
