// The frontend's picture-cue keys (used in SpeechFeaturesUI's CUE_MAP) don't
// match the DB's snake_case enum values one for one, so routes translate
// through this in both directions.
export const CUE_FRONTEND_TO_DB = { look: 'look', listen: 'listen', turn: 'your_turn', wait: 'wait', great: 'great_job' }
export const CUE_DB_TO_FRONTEND = { look: 'look', listen: 'listen', your_turn: 'turn', wait: 'wait', great_job: 'great' }
