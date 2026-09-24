export const initialGames = [
  { id: 1, name: 'Memory Match', type: 'Cognitive', level: 'Easy', status: 'Published', description: 'Card matching for memory recall.' },
  { id: 2, name: 'Sound Builder', type: 'Speech', level: 'Medium', status: 'Draft', description: 'Drag sounds to build words.' },
  { id: 3, name: 'Balance Quest', type: 'Physical', level: 'Hard', status: 'Published', description: 'Movement game with timed balance tasks.' },
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
