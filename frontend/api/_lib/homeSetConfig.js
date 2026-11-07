// The one place for the home-practice "set" rules. The server uses these to decide mastery and validate a new set,
// and sends them to the therapist page (GET /api/therapist/home-sets -> config) so both always agree.
export const MASTERED_PLAYS_REQUIRED = 3 // a game is mastered after this many plays at the accuracy below
export const MASTERED_ACCURACY = 100 // percent
export const MIN_SET_GAMES = 2
export const MAX_SET_GAMES = 4
export const UNDO_WINDOW_MS = 10000 // how long the "Undo" button stays on screen
export const UNDO_GRACE_MS = 5000 // extra time the server still accepts an undo (network delay)
export const STARTING_LEVELS = ['warmup', 'continue']
