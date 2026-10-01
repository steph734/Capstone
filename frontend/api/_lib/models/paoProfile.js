// One document per patient — Pao's level, XP, stats and equipped outfit.
// This is the server-side source of truth that was missing: before this,
// level/XP only ever lived in the browser's localStorage (ProgressContext),
// so it reset per-device and could never gate real unlock rules like
// reach_level / total_xp / games_in_a_row / all_categories.
import mongoose from 'mongoose'

const statsSchema = new mongoose.Schema(
  {
    intelligence: { type: Number, required: true, default: 5, min: 0, max: 100 },
    focus: { type: Number, required: true, default: 5, min: 0, max: 100 },
    resistance: { type: Number, required: true, default: 5, min: 0, max: 100 },
    creativity: { type: Number, required: true, default: 5, min: 0, max: 100 },
    speed: { type: Number, required: true, default: 5, min: 0, max: 100 },
    memory: { type: Number, required: true, default: 5, min: 0, max: 100 },
  },
  { _id: false }
)

const equippedSchema = new mongoose.Schema(
  {
    hair: { type: String, default: null },
    hats: { type: String, default: null },
    clothes: { type: String, default: null },
    pants: { type: String, default: null },
    shoes: { type: String, default: null },
  },
  { _id: false }
)

const paoProfileSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    level: { type: Number, required: true, default: 1, min: 1, max: 50 },
    xp: { type: Number, required: true, default: 0, min: 0 },
    total_xp: { type: Number, required: true, default: 0, min: 0 },
    stats: { type: statsSchema, required: true, default: () => ({}) },

    games_completed: { type: Number, required: true, default: 0, min: 0 },
    perfect_games: { type: Number, required: true, default: 0, min: 0 },
    games_in_a_row: { type: Number, required: true, default: 0, min: 0 },
    best_games_in_a_row: { type: Number, required: true, default: 0, min: 0 },
    categories_completed: { type: [String], default: [] },

    equipped: { type: equippedSchema, required: true, default: () => ({}) },

    voice_language: { type: String, enum: ['en', 'tl', 'ceb'], default: 'en' },
    last_played_at: { type: Date, default: null },
  },
  {
    collection: 'pao_profiles',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

paoProfileSchema.index({ patient_id: 1 }, { unique: true })

export const PaoProfile = mongoose.models.PaoProfile || mongoose.model('PaoProfile', paoProfileSchema)
