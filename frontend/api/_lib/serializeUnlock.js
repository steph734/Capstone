// Shared mapper for the `unlock` achievement sub-document (pao_items and
// pao_hair both carry the same shape, mirroring badges.criteria_*).
export function serializeUnlock(unlock) {
  if (!unlock) return null
  return {
    type: unlock.type,
    gameId: unlock.game_id ? String(unlock.game_id) : null,
    value: unlock.value ?? null,
    badgeCode: unlock.badge_code || null,
  }
}

// `unlock` from the client is either null/undefined (leave untouched or
// clear it) or { type, gameId, value, badgeCode }.
export function unlockToDb(unlock, { mongoose }) {
  if (unlock === null) return null
  if (!unlock || !unlock.type) return undefined
  return {
    type: unlock.type,
    game_id: mongoose.isValidObjectId(unlock.gameId) ? new mongoose.Types.ObjectId(unlock.gameId) : null,
    value: Number.isFinite(unlock.value) ? unlock.value : null,
    badge_code: unlock.badgeCode || null,
  }
}
