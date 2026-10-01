// Matches the LIVE `badges` collection's $jsonSchema validator exactly (this
// collection was migrated to this shape — nested `criteria`, no more
// art/badge_type/criteria_type-flat/archival-lifecycle fields — as part of
// the Pao-progression schema rollout; this model replaces the pre-migration
// version that the admin badge UI was still built against).
import mongoose from 'mongoose'

// Not part of the live $jsonSchema validator (which only requires `emoji`),
// but kept as an additional field — $jsonSchema without
// `additionalProperties:false` allows extra properties, and the whole app's
// existing BadgeMedal rendering (GamifiedFullPage, every game's finish
// screen, BadgeCasePage, the admin badge builder) depends on shape/colour/
// symbol. Dropping it would silently blank out every badge medal in the app.
const badgeArtSchema = new mongoose.Schema(
  {
    shape: { type: String, enum: ['circle', 'octagon', 'hexagon', 'scallop', 'shield', 'star', 'diamond', 'flower', 'rounded', 'gear'], default: 'circle' },
    color: { type: String, enum: ['gold', 'silver', 'bronze', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'], default: 'gold' },
    symbol: { type: String, default: 'star' },
    banner: { type: Boolean, default: false },
  },
  { _id: false }
)

const criteriaSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['complete_any_game', 'complete_specific_game', 'perfect_score', 'reach_level', 'total_xp', 'games_in_a_row', 'all_categories'],
    },
    game_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    value: { type: mongoose.Schema.Types.Int32, default: null, min: 1 },
  },
  { _id: false }
)

const badgeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: null, maxlength: 200 },
    emoji: { type: String, default: null, maxlength: 16 },
    icon_url: { type: String, default: null },
    theme_code: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    art: { type: badgeArtSchema, default: () => ({}) },
    criteria: { type: criteriaSchema, required: true },
    unlock_item_type: { type: String, default: null, enum: ['item', 'hair', null] },
    unlock_item_code: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    is_active: { type: Boolean, required: true, default: true },
    sort_order: { type: mongoose.Schema.Types.Int32, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Also not part of the live validator, also kept as additional fields —
    // the admin Badges page's archive/restore/soft-delete lifecycle and its
    // "can't delete, N patients already earned this" guard both depend on
    // these (mirrors the same pattern other lifecycle-tracked collections in
    // this app already use, e.g. speech_to_text_recordings).
    earned_count: { type: mongoose.Schema.Types.Int32, required: true, default: 0, min: 0 },
    status: { type: String, required: true, enum: ['active', 'archived', 'deleted'], default: 'active' },
    is_archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date, default: null },
    archived_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    is_deleted: { type: Boolean, required: true, default: false },
    deleted_at: { type: Date, default: null },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    purge_after: { type: Date, default: null },
    restored_at: { type: Date, default: null },
    restored_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'badges',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

badgeSchema.index({ code: 1 }, { unique: true })

export const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema)
