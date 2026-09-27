export const initialGames = [
  { id: 1, name: 'Memory Match', type: 'Cognitive', level: 'Easy', status: 'Published', description: 'Card matching for memory recall.', points: 10 },
  { id: 2, name: 'Sound Builder', type: 'Speech', level: 'Medium', status: 'Draft', description: 'Drag sounds to build words.', points: 15 },
  { id: 3, name: 'Balance Quest', type: 'Physical', level: 'Hard', status: 'Published', description: 'Movement game with timed balance tasks.', points: 20 },
  { id: 4, name: 'Picture-Word Matching', type: 'Speech', level: 'Easy', status: 'Published', description: 'Match each picture to the right word.', points: 10 },
]

// Games a branch owner has requested the Super Admin build — surfaced at the
// top of the Games library so a request can be approved straight into the
// creation workspace (prefilling the Add Game form) or declined.
export const initialGameRequests = [
  {
    id: 101,
    name: 'Color Sorting',
    ownerName: 'Liza Fernandez',
    branch: 'Branch A',
    submitted: 'Sep 22',
    type: 'Cognitive',
    level: 'Easy',
    description: 'Sort objects by color to build visual discrimination in younger patients.',
  },
  {
    id: 102,
    name: 'Breath Balloon',
    ownerName: 'Marco Dela Cruz',
    branch: 'Branch B',
    submitted: 'Sep 21',
    type: 'Speech',
    level: 'Medium',
    description: 'Blow into the mic to inflate a balloon for breath-control practice.',
  },
  {
    id: 103,
    name: 'Pinch & Place',
    ownerName: 'Angela Reyes',
    branch: 'Branch C',
    submitted: 'Sep 19',
    type: 'Occupational',
    level: 'Medium',
    description: 'Drag small items into slots to train fine-motor precision.',
  },
]

// A badge's `type` (Milestone vs Game) is derived from its `trigger` at save
// time (see TRIGGERS in GamifiedBadgesPage.jsx) but stored here too so
// filtering/counting doesn't need to re-derive it. `earnedCount` (how many
// patients have unlocked it) has no real data source anywhere in the app
// yet — it's a plausible seed value, same as the rest of this file.
export const initialBadges = [
  {
    id: 1, name: 'First Steps', shape: 'circle', colour: 'gold', symbol: 'medal',
    type: 'Milestone', trigger: 'first-game', gameId: null, unlocksPaoItem: 'party_hat',
    status: 'Active', earnedCount: 12,
  },
  {
    id: 2, name: 'Streak Master', shape: 'shield', colour: 'bronze', symbol: 'flame',
    type: 'Milestone', trigger: 'streak', gameId: null, unlocksPaoItem: null,
    status: 'Active', earnedCount: 2,
  },
  {
    id: 3, name: 'Word Wizard', shape: 'star', colour: 'purple', symbol: 'sparkle',
    type: 'Game', trigger: 'specific-game', gameId: 4, unlocksPaoItem: 'wizard_hat',
    status: 'Active', earnedCount: 5,
  },
  {
    id: 4, name: 'Perfect Score', shape: 'hexagon', colour: 'teal', symbol: 'star',
    type: 'Milestone', trigger: 'perfect-score', gameId: null, unlocksPaoItem: 'flower_crown',
    status: 'Hidden', earnedCount: 0,
  },
]

export const defaultPointRules = [
  { id: 'complete-easy', label: 'Complete an Easy game', points: 10 },
  { id: 'complete-medium', label: 'Complete a Medium game', points: 20 },
  { id: 'complete-hard', label: 'Complete a Hard game', points: 35 },
  { id: 'earn-badge', label: 'Earn a badge', points: 15 },
  { id: 'daily-streak', label: 'Daily streak bonus', points: 5 },
  { id: 'level-up', label: 'Level up bonus', points: 25 },
]
