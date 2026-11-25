// Shared criteria evaluator for both badges (badge_type/criteria_*) and
// wardrobe items (unlock.type/game_id/value/badge_code) — the two shapes
// differ in field names but mean the same thing, so callers normalize into
// { type, gameId, value, badgeCode } before calling this. `value == null`
// means "1" everywhere a threshold applies.
//
// `ctx` is the patient's progress signal — see unlockContext.js for how it's
// built from pao_profiles + game_completions + patient_badges:
//   completedGameIds: Set<string> — every game_id finished at least once
//   perfectGameIds: Set<string> — game_ids where a perfect score was achieved
//   anyPerfect: boolean — true if any completion anywhere was perfect
//   completionCountByGame: Map<string, number> — times_completed per game_id
//   gamesCompleted: number — pao_profiles.games_completed
//   perfectGames: number — pao_profiles.perfect_games
//   level: number — pao_profiles.level
//   totalXp: number — pao_profiles.total_xp
//   gamesInARow: number — pao_profiles.games_in_a_row
//   allCategoriesComplete: boolean — every published therapy_type covered
//   earnedBadgeCodes: Set<string> — badge codes already known to be earned
export function evaluateCriteria({ type, gameId, value, badgeCode, taskKey }, ctx) {
  const gid = gameId ? String(gameId) : null
  const v = value == null ? 1 : value
  switch (type) {
    case 'free':
      return true
    case 'complete_any_game':
      return (ctx.gamesCompleted ?? ctx.completedGameIds.size) >= v
    case 'complete_specific_game':
      if (gid && taskKey) return (ctx.taskCompletionCountByGame?.get(`${gid}|${taskKey}`) || 0) >= v
      return gid ? (ctx.completionCountByGame?.get(gid) || 0) >= v : false
    case 'perfect_score':
      return gid ? ctx.perfectGameIds.has(gid) : (ctx.perfectGames ?? (ctx.anyPerfect ? 1 : 0)) >= v
    case 'reach_level':
      return (ctx.level ?? 0) >= v
    case 'total_xp':
      return (ctx.totalXp ?? 0) >= v
    case 'games_in_a_row':
      return (ctx.gamesInARow ?? 0) >= v
    case 'all_categories':
      return ctx.allCategoriesComplete === true
    case 'earn_badge':
      return badgeCode ? ctx.earnedBadgeCodes.has(badgeCode) : false
    default:
      return false
  }
}

// How far along the patient is toward a countable unlock rule, for the
// progress bar on locked wardrobe cards. Returns { have, need } (have is
// capped at need) or null when the rule has no meaningful count.
export function criteriaProgress({ type, gameId, value, badgeCode }, ctx) {
  const gid = gameId ? String(gameId) : null
  const need = value == null ? 1 : value
  const cap = (have) => ({ have: Math.max(0, Math.min(Number(have) || 0, need)), need })
  switch (type) {
    case 'complete_any_game': return cap(ctx.gamesCompleted ?? ctx.completedGameIds?.size)
    case 'complete_specific_game': return gid ? cap(ctx.completionCountByGame?.get(gid) || 0) : null
    case 'perfect_score': return gid ? { have: ctx.perfectGameIds?.has(gid) ? 1 : 0, need: 1 } : cap(ctx.perfectGames ?? (ctx.anyPerfect ? 1 : 0))
    case 'reach_level': return cap(ctx.level)
    case 'total_xp': return cap(ctx.totalXp)
    case 'games_in_a_row': return cap(ctx.gamesInARow)
    case 'earn_badge': return badgeCode ? { have: ctx.earnedBadgeCodes?.has(badgeCode) ? 1 : 0, need: 1 } : null
    default: return null
  }
}
