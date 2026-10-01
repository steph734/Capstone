import { xpToNextLevel, MAX_LEVEL } from './paoProgression.js'

export function serializePaoProfile(doc) {
  if (!doc) return null
  return {
    patientId: String(doc.patient_id),
    level: doc.level,
    xp: doc.xp,
    xpToNext: doc.level >= MAX_LEVEL ? null : xpToNextLevel(doc.level),
    totalXp: doc.total_xp,
    stats: doc.stats || {},
    gamesCompleted: doc.games_completed || 0,
    perfectGames: doc.perfect_games || 0,
    gamesInARow: doc.games_in_a_row || 0,
    bestGamesInARow: doc.best_games_in_a_row || 0,
    categoriesCompleted: doc.categories_completed || [],
    equipped: doc.equipped || {},
    voiceLanguage: doc.voice_language || 'en',
    lastPlayedAt: doc.last_played_at || null,
  }
}
