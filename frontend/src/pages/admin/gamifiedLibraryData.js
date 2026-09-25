export const initialGames = [
  { id: 1, name: 'Memory Match', type: 'Cognitive', level: 'Easy', status: 'Published', description: 'Card matching for memory recall.', points: 10 },
  { id: 2, name: 'Sound Builder', type: 'Speech', level: 'Medium', status: 'Draft', description: 'Drag sounds to build words.', points: 15 },
  { id: 3, name: 'Balance Quest', type: 'Physical', level: 'Hard', status: 'Published', description: 'Movement game with timed balance tasks.', points: 20 },
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

export const initialBadges = [
  { id: 1, name: 'First Steps', icon: '🥇', points: 10, criteria: 'Complete your first game', status: 'Active' },
  { id: 2, name: 'Streak Master', icon: '🔥', points: 50, criteria: 'Play 7 days in a row', status: 'Active' },
  { id: 3, name: 'Perfectionist', icon: '💯', points: 100, criteria: 'Finish a game with a perfect score', status: 'Active' },
  { id: 4, name: 'Explorer', icon: '🧭', points: 30, criteria: 'Try every therapy game category', status: 'Hidden' },
]

export const defaultPointRules = [
  { id: 'complete-easy', label: 'Complete an Easy game', points: 10 },
  { id: 'complete-medium', label: 'Complete a Medium game', points: 20 },
  { id: 'complete-hard', label: 'Complete a Hard game', points: 35 },
  { id: 'earn-badge', label: 'Earn a badge', points: 15 },
  { id: 'daily-streak', label: 'Daily streak bonus', points: 5 },
  { id: 'level-up', label: 'Level up bonus', points: 25 },
]
