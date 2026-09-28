// Shared "unlock" sub-schema for pao_items (clothes) and pao_hair — the
// same achievement rules a badge's criteria already uses, plus `free`
// (always available) and `earn_badge` (piggyback on a specific badge).
// `unlock: null` on a document means it's only reachable through some
// badge's own unlock_item_code, not directly.
import mongoose from 'mongoose'

export const UNLOCK_TYPES = [
  'free', 'complete_any_game', 'complete_specific_game', 'perfect_score',
  'reach_level', 'total_xp', 'games_in_a_row', 'all_categories', 'earn_badge',
]

export const unlockSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: UNLOCK_TYPES },
    game_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    value: { type: Number, default: null, min: 1 },
    badge_code: { type: String, default: null, match: /^[a-z0-9_]+$/ },
  },
  { _id: false }
)
