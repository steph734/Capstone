// Shared shape mapper for the pao_items routes. This collection's
// category: 'hair' means "worn in Pao's hair slot" (a hat) — the pao_hair
// collection holds real hairstyles separately — so it's relabelled 'Hats'
// here for the admin UI, which already treats Hair/Hats as separate tabs.
const CATEGORY_TO_UI = { hair: 'Hats', clothes: 'Clothes', pants: 'Pants', shoes: 'Shoes' }
const CATEGORY_TO_DB = { Hats: 'hair', Clothes: 'clothes', Pants: 'pants', Shoes: 'shoes' }

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
