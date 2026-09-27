// Matches the `pao_themes` collection's $jsonSchema validator. A theme is
// a palette + sticker set plus one code per slot (set_items) pointing at
// the pao_hair / pao_items pieces that make up its one-click "theme set" —
// membership is stored here, not as a field on the items themselves.
import mongoose from 'mongoose'

const paoThemeSetItemsSchema = new mongoose.Schema(
  {
    hair: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    hats: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    clothes: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    pants: { type: String, default: null, match: /^[a-z0-9_]+$/ },
    shoes: { type: String, default: null, match: /^[a-z0-9_]+$/ },
  },
  { _id: false }
)

const paoThemeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    icon: { type: String, required: true, maxlength: 16 },
    background_color: { type: String, default: null, match: /^#[0-9a-fA-F]{6}$/ },
    colors: { type: [{ type: String, match: /^#[0-9a-fA-F]{6}$/ }], required: true, validate: (v) => v.length >= 1 && v.length <= 12 },
    stickers: { type: [{ type: String, maxlength: 16 }], default: [], validate: (v) => v.length <= 20 },
    set_items: { type: paoThemeSetItemsSchema, default: null },
    starts_on: { type: Date, default: null },
    ends_on: { type: Date, default: null },
    is_active: { type: Boolean, required: true, default: true },
    sort_order: { type: Number, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  {
    collection: 'pao_themes',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

paoThemeSchema.index({ code: 1 }, { unique: true })

export const PaoTheme = mongoose.models.PaoTheme || mongoose.model('PaoTheme', paoThemeSchema)
