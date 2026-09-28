// Tracks, per patient per game, whether/how well they've finished it — the
// signal the wardrobe `unlock` fields (complete_specific_game, perfect_score,
// etc.) and badge criteria are evaluated against. One document per
// (patient_id, game_id) pair, updated in place on every replay.
import mongoose from 'mongoose'

const gameCompletionSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  game_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  game_name: { type: String, default: null },
  times_completed: { type: Number, default: 1, min: 0 },
  best_score: { type: Number, default: null },
  best_max_score: { type: Number, default: null },
  perfect_score_achieved: { type: Boolean, default: false },
  first_completed_at: { type: Date, default: Date.now },
  last_completed_at: { type: Date, default: Date.now },
}, {
  collection: 'game_completions',
  versionKey: false,
})

gameCompletionSchema.index({ patient_id: 1, game_id: 1 }, { unique: true })

export const GameCompletion = mongoose.models.GameCompletion
  || mongoose.model('GameCompletion', gameCompletionSchema)
