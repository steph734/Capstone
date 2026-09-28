// Shared shape mapper for the pao_hair routes.
import { serializeUnlock } from './serializeUnlock.js'

export function serializePaoHair(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    category: 'Hair',
    description: doc.description,
    emoji: doc.emoji,
    theme: doc.theme_code || null,
    unlock: serializeUnlock(doc.unlock),
    isBuiltin: false,
    design: {
      style: doc.style,
      main: doc.hair_color,
      trim: doc.tie_color,
      pattern: doc.pattern,
      patternColor: doc.pattern_color || '#ffffff',
      decal: doc.clip || '',
    },
    isActive: !!doc.is_active,
    sortOrder: doc.sort_order,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
