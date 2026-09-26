// A small local catalog of home-practice games a therapist can build a
// session plan from. Nothing in the app defines game metadata like duration
// or "rounds to finish" centrally yet (the playable game components under
// src/pages/games/ only know their domain, not a duration/difficulty), so
// this is a fresh, purpose-built list for the session planner rather than a
// reuse of something else.
export const EXERCISE_GAMES = [
  { id: 'sort-basket',       name: 'Sort the Basket',   domain: 'Cognitive',    difficulty: 'Easy',   durationMin: 5,  rounds: 8,  description: 'Sort each item into the right basket.' },
  { id: 'puzzle-pals',       name: 'Puzzle Pals',       domain: 'Cognitive',    difficulty: 'Easy',   durationMin: 5,  rounds: 6,  description: 'Place each piece where it belongs.' },
  { id: 'memory-match',      name: 'Memory Match',      domain: 'Cognitive',    difficulty: 'Easy',   durationMin: 8,  rounds: 10, description: 'Flip cards to find matching pairs.' },
  { id: 'sentence-builder',  name: 'Sentence Builder',  domain: 'Cognitive',    difficulty: 'Medium', durationMin: 15, rounds: 10, description: 'Build sentences like a wizard.' },
  { id: 'story-builder',     name: 'Story Builder',     domain: 'Cognitive',    difficulty: 'Hard',   durationMin: 20, rounds: 1,  description: 'Create your own short story.' },
  { id: 'sound-builder',     name: 'Sound Builder',     domain: 'Speech',       difficulty: 'Medium', durationMin: 10, rounds: 8,  description: 'Blend sounds together to build words.' },
  { id: 'picture-word',      name: 'Picture Word',      domain: 'Speech',       difficulty: 'Easy',   durationMin: 6,  rounds: 8,  description: 'Match each picture to the right word.' },
  { id: 'slow-motion-echo',  name: 'Slow Motion Echo',  domain: 'Speech',       difficulty: 'Medium', durationMin: 8,  rounds: 6,  description: 'Repeat sounds slowly and clearly.' },
  { id: 'balance-beam',      name: 'Balance Beam',      domain: 'Physical',     difficulty: 'Medium', durationMin: 10, rounds: 5,  description: 'Practice steady balance and posture.' },
  { id: 'stretch-and-reach', name: 'Stretch & Reach',   domain: 'Physical',     difficulty: 'Easy',   durationMin: 6,  rounds: 6,  description: 'Gentle stretches to build flexibility.' },
  { id: 'reach-and-grab',    name: 'Reach & Grab',      domain: 'Occupational', difficulty: 'Easy',   durationMin: 6,  rounds: 8,  description: 'Practice reaching and fine grasp.' },
  { id: 'button-and-zip',    name: 'Button & Zip',      domain: 'Occupational', difficulty: 'Medium', durationMin: 10, rounds: 5,  description: 'Practice buttons, zippers, and fasteners.' },
]
