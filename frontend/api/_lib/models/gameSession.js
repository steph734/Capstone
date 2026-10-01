// One document per game played — a durable per-play log, distinct from
// `game_completions` (one running "best score" doc per patient+game, kept
// for backward compatibility with the existing badge/wardrobe evaluator).
import mongoose from 'mongoose'

const resultSchema = new mongoose.Schema(
  {
    correct: { type: Number, default: null },
    attempts: { type: Number, default: null },
    hints_used: { type: Number, default: 0 },
    stars: { type: Number, default: null },
    perfect: { type: Boolean, default: false },
    duration_seconds: { type: Number, default: null },
    detail: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
)

const rewardSchema = new mongoose.Schema(
  {
    xp_earned: { type: Number, default: 0 },
    level_before: { type: Number, default: null },
    level_after: { type: Number, default: null },
    stat_gains: { type: mongoose.Schema.Types.Mixed, default: null },
    badge_codes: { type: [String], default: [] },
    unlocks: {
      type: [{ item_type: String, item_code: String, _id: false }],
      default: [],
    },
  },
  { _id: false }
)

const gameSessionSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    game_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    employee_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    activity_session_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    language: { type: String, enum: ['en', 'tl', 'ceb'], default: 'en' },

    status: { type: String, required: true, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
    started_at: { type: Date, required: true, default: Date.now },
    completed_at: { type: Date, default: null },

    result: { type: resultSchema, default: () => ({}) },
    reward: { type: rewardSchema, default: () => ({}) },
  },
  {
    collection: 'game_sessions',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

gameSessionSchema.index({ patient_id: 1, game_id: 1, status: 1 })
gameSessionSchema.index({ patient_id: 1, status: 1, started_at: -1 })

export const GameSession = mongoose.models.GameSession || mongoose.model('GameSession', gameSessionSchema)
