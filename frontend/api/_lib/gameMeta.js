// What each game trains, in one place. Used only by the next-set recommendation (homeSetRecommend.js).
//   builds    the character stats the game exercises (intelligence, focus, resistance, creativity, speed, memory)
//   supports  short tags the therapist's objectives for a set point at (for example "sequencing", "daily routines")
//   skill     a plain phrase used in sentences such as "Copy the Colors gains show sequencing and working memory are growing"
// A game that is missing here simply has no "Builds" or "Supports" row and is ranked by what the data says (new for the patient, etc.).
// Add a game by adding a line; nothing else needs to change.
export const GAME_META = {
  'money match': { builds: ['intelligence', 'memory'], supports: ['money skills', 'sorting'], skill: 'money skills' },
  'copy the colors': { builds: ['memory', 'focus'], supports: ['sequencing', 'working memory'], skill: 'sequencing and working memory' },
  'sort the basket': { builds: ['intelligence', 'speed'], supports: ['sorting', 'categorizing'], skill: 'sorting and categorizing' },
  'puzzle pals': { builds: ['resistance', 'intelligence', 'focus'], supports: ['problem-solving', 'persistence'], skill: 'problem-solving' },
  'feed pao': { builds: ['memory', 'focus', 'creativity'], supports: ['sequencing', 'daily routines'], skill: 'sequencing in daily routines' },
  'emergency ready': { builds: ['intelligence', 'memory'], supports: ['daily routines', 'safety'], skill: 'safety routines' },
}
export const metaFor = (name) => GAME_META[String(name || '').toLowerCase()] || null

export const STAT_LABEL = { intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }

// A draft objective for the patient's lowest character stat. `supports` links it to the games above.
export const STAT_OBJECTIVE = {
  resistance: { text: 'Strengthen problem-solving and persistence', supports: ['problem-solving', 'persistence'] },
  memory: { text: 'Strengthen working memory and sequencing', supports: ['sequencing', 'working memory'] },
  focus: { text: 'Build attention and focus', supports: ['sequencing', 'problem-solving'] },
  intelligence: { text: 'Practice problem-solving and sorting', supports: ['problem-solving', 'sorting', 'categorizing'] },
  creativity: { text: 'Encourage flexible, creative thinking', supports: ['sequencing', 'daily routines'] },
  speed: { text: 'Practice quick, accurate responses', supports: ['sorting', 'categorizing'] },
}
