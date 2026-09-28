// Shared shape mapper between the badges routes — Mongo's snake_case
// document -> the camelCase shape GamifiedBadgesPage.jsx already works with.
export function serializeBadge(doc) {
  return {
    id: String(doc._id),
    code: doc.code,
    name: doc.name,
    description: doc.description,
    shape: doc.art?.shape,
    colour: doc.art?.color,
    symbol: doc.art?.symbol,
    banner: !!doc.art?.banner,
    badgeType: doc.badge_type,
    criteriaType: doc.criteria_type,
    criteriaGameId: doc.criteria_game_id ? String(doc.criteria_game_id) : null,
    criteriaValue: doc.criteria_value,
    unlockItemCode: doc.unlock_item_code,
    isActive: !!doc.is_active,
    isArchived: !!doc.is_archived,
    earnedCount: doc.earned_count,
    sortOrder: doc.sort_order,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}
