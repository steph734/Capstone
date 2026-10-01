// Builds the `ctx` object evaluateCriteria() needs, from this patient's real
// progress: game_completions (legacy per-game best/times-completed, kept for
// badge/item criteria that only need "finished before"), pao_profiles
// (level/XP/streak/category coverage), and patient_badges (already-earned
// badge codes, so `earn_badge` rules can chain off each other).
import { getDb } from './mongo.js'
import { GameCompletion } from './models/gameCompletion.js'
import { PaoProfile } from './models/paoProfile.js'
import { PatientBadge } from './models/patientBadge.js'

// `mongoSession` (optional): when called from inside a transaction (see
// game-sessions-complete.js), this MUST be passed through to every query —
// a transaction's own writes are invisible to reads outside that same
// session until it commits, so omitting it here would silently evaluate
// badge/unlock criteria against stale, pre-update data.
export async function buildUnlockContext(patientId, mongoSession = null) {
  const db = await getDb()
  const opt = mongoSession ? { session: mongoSession } : {}
  // Sequential, not Promise.all — a MongoDB ClientSession can't be shared
  // across concurrent operations; running these in parallel while inside
  // game-sessions-complete.js's transaction silently produced wrong (often
  // empty) results instead of an error.
  const completions = await GameCompletion.find({ patient_id: patientId }).session(mongoSession).lean()
  const profile = await PaoProfile.findOne({ patient_id: patientId }).session(mongoSession).lean()
  const earnedBadges = await PatientBadge.find({ patient_id: patientId }).select('badge_code').session(mongoSession).lean()
  const publishedGames = await db.collection('games').find({ status: 'published' }, { ...opt, projection: { therapy_type: 1 } }).toArray()

  const completionCountByGame = new Map()
  for (const c of completions) completionCountByGame.set(String(c.game_id), c.times_completed || 0)

  const allTherapyTypes = new Set(publishedGames.map((g) => g.therapy_type).filter(Boolean))
  const categoriesCompleted = new Set(profile?.categories_completed || [])
  const allCategoriesComplete = allTherapyTypes.size > 0 && [...allTherapyTypes].every((t) => categoriesCompleted.has(t))

  return {
    completedGameIds: new Set(completions.map((c) => String(c.game_id))),
    perfectGameIds: new Set(completions.filter((c) => c.perfect_score_achieved).map((c) => String(c.game_id))),
    anyPerfect: completions.some((c) => c.perfect_score_achieved),
    completionCountByGame,
    gamesCompleted: profile?.games_completed || 0,
    perfectGames: profile?.perfect_games || 0,
    level: profile?.level || 1,
    totalXp: profile?.total_xp || 0,
    gamesInARow: profile?.games_in_a_row || 0,
    allCategoriesComplete,
    earnedBadgeCodes: new Set((earnedBadges || []).map((b) => b.badge_code)),
  }
}
