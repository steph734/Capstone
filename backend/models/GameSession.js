const mongoose = require('mongoose');

// One document per completed gamified-activity session (a patient finishing
// a round of Puzzle Pals, Picture-Word Matching, etc. in GamifiedFullPage on
// the frontend). Distinct from the `games` collection (models/Game.js),
// which holds the game *catalog* (definitions authored by a Super Admin) —
// this collection is the per-play activity log. patient_id is the lowercase
// demo-patient key used across the frontend's local contexts (e.g. 'alvrin')
// rather than a real Mongo ref — there's no Patient collection yet, so this
// stays denormalized like Attendance's employee_name and branch_name.
const gameSessionSchema = new mongoose.Schema(
  {
    patient_id: { type: String, required: true, trim: true, lowercase: true },
    patient_name: { type: String, default: null },
    game_id: { type: String, default: null },
    game_name: { type: String, default: null },
    domain: { type: String, required: true },
    difficulty: { type: String, default: null },
    accuracy: { type: Number, default: null },
    duration_minutes: { type: Number, default: 0 },
    xp_earned: { type: Number, default: 0 },
    completed_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'game_sessions',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Every lookup here is "this patient's game sessions, most recent first".
gameSessionSchema.index({ patient_id: 1, completed_at: -1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
