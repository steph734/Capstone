// Matches the `pao_hair` collection's $jsonSchema validator — Pao's actual
// hairstyles (as opposed to hats, which live in `pao_items` with
// category: 'hair'). Unlike pao_items, this collection's enums already
// cover every style/pattern the designer offers, so nothing here needs
// hiding.
import mongoose from 'mongoose'
import { unlockSchema } from './unlockSchema.js'

export const PAO_HAIR_STYLES = ['tuft', 'bangs', 'curly', 'spiky', 'bun', 'ponytail', 'pigtails', 'long']
export const PAO_HAIR_PATTERNS = [
  'solid', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'zigzag',
  'snowflakes', 'candycane', 'bats', 'flowers', 'confetti',
]
// Drawn hair clips (see HAIR_CLIPS in PaoDesignedOutfit.jsx) — the clip is
// an id painted in tie_color client-side, not a free-form emoji.
export const PAO_HAIR_CLIPS = ['bow', 'heart', 'star', 'flower', 'butterfly', 'barrette', 'snap', 'pearls', 'bobby']

const paoHairSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: null, maxlength: 200 },
    emoji: { type: String, default: null, maxlength: 16 },
    theme_code: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    unlock: { type: unlockSchema, default: null },
    style: { type: String, required: true, enum: PAO_HAIR_STYLES },
    hair_color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    tie_color: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    pattern: { type: String, required: true, enum: PAO_HAIR_PATTERNS },
    pattern_color: { type: String, default: null, match: /^#[0-9a-fA-F]{6}$/ },
    clip: { type: String, default: null, enum: [...PAO_HAIR_CLIPS, null] },
    is_active: { type: Boolean, required: true, default: true },
    sort_order: { type: Number, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'pao_hair',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

paoHairSchema.index({ code: 1 }, { unique: true })

export const PaoHair = mongoose.models.PaoHair || mongoose.model('PaoHair', paoHairSchema)
