// Matches the `badges` collection's $jsonSchema validator.
import mongoose from 'mongoose'

const badgeArtSchema = new mongoose.Schema(
  {
    shape: {
      type: String,
      required: true,
      enum: ['circle', 'octagon', 'hexagon', 'scallop', 'shield', 'star', 'diamond', 'flower', 'rounded', 'gear'],
    },
    color: {
      type: String,
      required: true,
      enum: ['gold', 'silver', 'bronze', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'],
    },
    symbol: {
      type: String,
      required: true,
      enum: [
        'star', 'heart', 'leaf', 'drop', 'trophy', 'bolt', 'crown', 'flake', 'brain', 'target',
        'flame', 'book', 'rocket', 'puzzle', 'music', 'sun', 'medal', 'shield', 'paw', 'key',
      ],
    },
  },
  { _id: false }
)

const badgeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: null, maxlength: 150 },
    art: { type: badgeArtSchema, required: true },
    badge_type: { type: String, required: true, enum: ['game_completion', 'milestone'] },
    criteria_type: {
      type: String,
      required: true,
      enum: [
        'complete_specific_game', 'complete_any_game', 'perfect_score',
        'reach_level', 'total_xp', 'games_in_a_row', 'all_categories',
      ],
    },
    criteria_game_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    criteria_value: { type: Number, default: null },
    unlock_item_code: { type: String, default: null },
    is_active: { type: Boolean, required: true, default: true },
    earned_count: { type: Number, required: true, default: 0, min: 0 },
    sort_order: { type: Number, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'badges',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// `code` is the badge's stable natural key (slugified from the name) — one
// per code, same spirit as a username/slug uniqueness constraint elsewhere
// in this app.
badgeSchema.index({ code: 1 }, { unique: true })

export const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema)
