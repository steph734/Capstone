// Shared criteria evaluator for both badges (badge_type/criteria_*) and
// wardrobe items (unlock.type/game_id/value/badge_code) — the two shapes
// differ in field names but mean the same thing, so callers normalize into
// { type, gameId, value, badgeCode } before calling this.
//
// `ctx` is the patient's progress signal:
//   completedGameIds: Set<string> — every game_id they've finished at least once
//   perfectGameIds: Set<string> — game_ids where a perfect score was achieved
//   anyPerfect: boolean — true if any completion anywhere was perfect
//   earnedBadgeCodes: Set<string> — badge codes already known to be earned
export function evaluateCriteria({ type, gameId, value, badgeCode }, ctx) {
  const gid = gameId ? String(gameId) : null
  switch (type) {
    case 'free':
      return true
    case 'complete_any_game':
      return ctx.completedGameIds.size > 0
    case 'complete_specific_game':
      return gid ? ctx.completedGameIds.has(gid) : false
    case 'perfect_score':
      return gid ? ctx.perfectGameIds.has(gid) : ctx.anyPerfect
    case 'earn_badge':
      return badgeCode ? ctx.earnedBadgeCodes.has(badgeCode) : false
    // reach_level / total_xp / games_in_a_row / all_categories need patient
    // stats (level, XP, streaks, category coverage) this app doesn't track
    // anywhere yet — treat as not-yet-achievable rather than guessing.
    case 'reach_level':
    case 'total_xp':
    case 'games_in_a_row':
    case 'all_categories':
    default:
      return false
  }
}
