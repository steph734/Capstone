// Minimal Mongoose view of the `games` collection — the real $jsonSchema
// validator (built by the games-editor side of the app, see
// backend/models/Game.js) is much larger than anything this pipeline needs
// to read or write, so this only declares the fields the progression system
// touches. `strict: false` so a partial update here never strips the rest
// of a document's real fields.
import mongoose from 'mongoose'

const statGainsSchema = new mongoose.Schema(
  {
    intelligence: { type: Number, default: 0 },
    focus: { type: Number, default: 0 },
    resistance: { type: Number, default: 0 },
    creativity: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
  },
  { _id: false }
)

const gameSchema = new mongoose.Schema(
  {
    name: { type: String },
    therapy_type: { type: String },
    difficulty: { type: String },
    status: { type: String },
    points_per_play: { type: Number, default: 100 },
    unlocks_badge_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    game_type: { type: String, default: null },
    // Added by the Pao-progression work — the Pao level required to start
    // this game, and the stat points it grants on a finish (falls back to a
    // game_type-based default in paoProgression.js when left unset).
    unlock_level: { type: Number, default: 1, min: 1, max: 50 },
    stat_gains: { type: statGainsSchema, default: () => ({}) },
  },
  {
    collection: 'games',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strict: false,
  }
)

export const Game = mongoose.models.Game || mongoose.model('Game', gameSchema)
