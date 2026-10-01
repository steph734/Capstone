// Shared shape mapper between the badges routes — Mongo's snake_case
// document -> a camelCase shape the frontend works with. Matches the live
// `badges` schema (nested `criteria`, no art/badge_type/archival fields).
export function serializeBadge(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    description: doc.description,
    emoji: doc.emoji,
    iconUrl: doc.icon_url,
    themeCode: doc.theme_code,
    // Kept for BadgeMedal, which every existing reward screen already uses.
    shape: doc.art?.shape || 'circle',
    colour: doc.art?.color || 'gold',
    symbol: doc.art?.symbol || 'star',
    banner: !!doc.art?.banner,
    // Derived, not stored — the live schema dropped `badge_type` as its own
    // field, but the admin Badges page still categorizes by it (a
    // complete_specific_game badge reads as "Game", everything else "Milestone").
    badgeType: doc.criteria?.type === 'complete_specific_game' ? 'game_completion' : 'milestone',
    criteriaType: doc.criteria?.type,
    criteriaGameId: doc.criteria?.game_id ? String(doc.criteria.game_id) : null,
    criteriaValue: doc.criteria?.value ?? null,
    unlockItemType: doc.unlock_item_type,
    unlockItemCode: doc.unlock_item_code,
    isActive: !!doc.is_active,
    sortOrder: doc.sort_order,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
