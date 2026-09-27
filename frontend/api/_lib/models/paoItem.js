// Matches the `clothes` collection's $jsonSchema validator. Holds Pao's
// hats, clothes, pants and shoes — real hairstyles live in the separate
// `pao_hair` collection instead (see paoHair.js).
import mongoose from 'mongoose'

export const PAO_ITEM_CATEGORIES = ['hats', 'clothes', 'pants', 'shoes']
export const PAO_ITEM_STYLES = [
  'beanie', 'cap', 'tophat', 'crown', 'bow', 'headband', 'witch', 'santa', 'antlers', 'bunny', 'party',
  'tee', 'sweater', 'hoodie', 'vest', 'scarf', 'cape',
  'pants', 'shorts', 'skirt', 'joggers',
  'sneakers', 'boots', 'slippers', 'sandals',
]
export const PAO_ITEM_PATTERNS = [
  'solid', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'zigzag',
  'snowflakes', 'candycane', 'bats', 'flowers', 'confetti',
]

const paoItemDesignSchema = new mongoose.Schema(
  {
    style: { type: String, required: true, enum: PAO_ITEM_STYLES },
    main_color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    trim_color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    pattern: { type: String, required: true, enum: PAO_ITEM_PATTERNS },
    pattern_color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    decal: { type: String, default: null, maxlength: 16 },
  },
  { _id: false }
)

const paoItemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, required: true, enum: PAO_ITEM_CATEGORIES },
    description: { type: String, default: null, maxlength: 200 },
    emoji: { type: String, default: null, maxlength: 16 },
    is_builtin: { type: Boolean, required: true, default: false },
    theme_code: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    design: { type: paoItemDesignSchema, default: null },
    is_active: { type: Boolean, required: true, default: true },
    sort_order: { type: Number, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'clothes',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

paoItemSchema.index({ code: 1 }, { unique: true })

export const PaoItem = mongoose.models.PaoItem || mongoose.model('PaoItem', paoItemSchema)
