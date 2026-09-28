// Shared shape mapper for the clothes (hats/clothes/pants/shoes) routes.
import { serializeUnlock } from './serializeUnlock.js'

const CATEGORY_TO_UI = { hats: 'Hats', clothes: 'Clothes', pants: 'Pants', shoes: 'Shoes' }
const CATEGORY_TO_DB = { Hats: 'hats', Clothes: 'clothes', Pants: 'pants', Shoes: 'shoes' }

export function dbCategoryFromUi(uiCategory) {
  return CATEGORY_TO_DB[uiCategory] || null
}

export function serializePaoItem(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    category: CATEGORY_TO_UI[doc.category] || doc.category,
    description: doc.description,
    emoji: doc.emoji,
    theme: doc.theme_code || null,
    unlock: serializeUnlock(doc.unlock),
    isBuiltin: !!doc.is_builtin,
    design: doc.design ? {
      style: doc.design.style,
      main: doc.design.main_color,
      trim: doc.design.trim_color,
      pattern: doc.design.pattern,
      patternColor: doc.design.pattern_color,
      decal: doc.design.decal || '',
    } : null,
    isActive: !!doc.is_active,
    sortOrder: doc.sort_order,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
