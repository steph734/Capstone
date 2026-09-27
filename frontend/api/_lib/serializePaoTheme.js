// Shared shape mapper for the pao_themes routes.
export function serializePaoTheme(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    icon: doc.icon,
    bg: doc.background_color,
    colours: doc.colors || [],
    decals: doc.stickers || [],
    setItems: doc.set_items || { hair: null, hats: null, clothes: null, pants: null, shoes: null },
    startsOn: doc.starts_on,
    endsOn: doc.ends_on,
    isActive: !!doc.is_active,
    sortOrder: doc.sort_order,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
