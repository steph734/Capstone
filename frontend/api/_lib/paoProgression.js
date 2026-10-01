// Pure XP/level/stat math for Pao's progression — no DB access, so it's
// trivially unit-testable and the one place this arithmetic is allowed to
// live (per the rule "all calculated on the server, never in the browser").

export const MAX_LEVEL = 50
export const MIN_STAT = 5
export const MAX_STAT = 100

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']

// XP needed to go from `level` to `level + 1`. Level 1 needs 100.
export function xpToNextLevel(level) {
  return 100 + (level - 1) * 50
}

// Applies an XP gain to a level/xp pair, carrying leftover XP across
// however many level-ups it covers, capped at MAX_LEVEL (XP earned past the
// cap is simply not consumed — nothing left to spend it on).
export function applyXp(level, xp, xpGain) {
  let lvl = level
  let cur = xp + xpGain
  let levelsGained = 0
  while (lvl < MAX_LEVEL) {
    const need = xpToNextLevel(lvl)
    if (cur < need) break
    cur -= need
    lvl += 1
    levelsGained += 1
  }
  if (lvl >= MAX_LEVEL) {
    lvl = MAX_LEVEL
  }
  return { level: lvl, xp: cur, levelsGained }
}

// Base XP for a finish, before the first-finish / same-day-repeat
// multipliers below. Mistakes and hints never reduce it.
export function baseXpForGame(game) {
  const n = Number(game?.points_per_play)
  return Number.isFinite(n) && n >= 0 ? n : 100
}

// isFirstFinish: the patient has never finished this game before this session.
// finishesTodayIncludingThis: how many times they've finished THIS game today
// (Asia/Manila calendar day), counting this completion.
export function xpMultiplier({ isFirstFinish, finishesTodayIncludingThis }) {
  if (isFirstFinish) return 1.5
  if (finishesTodayIncludingThis > 3) return 0.25
  return 1
}

export function computeXpEarned(game, { isFirstFinish, finishesTodayIncludingThis }) {
  const base = baseXpForGame(game)
  const mult = xpMultiplier({ isFirstFinish, finishesTodayIncludingThis })
  return Math.round(base * mult)
}

// Fallback stat gains by game_type, used when a game has no explicit
// (non-zero) stat_gains of its own.
const GAME_TYPE_STAT_GAINS = {
  picture_match: { memory: 2, focus: 2 },
  sort_place: { intelligence: 2, focus: 2 },
  choose_picture: { intelligence: 2, focus: 2 },
  step_by_step: { memory: 2, resistance: 2 },
  say_it: { creativity: 2, resistance: 2 },
  move_with_me: { speed: 2, resistance: 2 },
}
const DEFAULT_STAT_GAINS = { intelligence: 1, focus: 1 }

function hasAnyGain(gains) {
  return !!gains && STAT_KEYS.some((k) => Number(gains[k]) > 0)
}

export function statGainsForGame(game) {
  if (hasAnyGain(game?.stat_gains)) {
    const out = {}
    for (const k of STAT_KEYS) out[k] = Math.max(0, Number(game.stat_gains[k]) || 0)
    return out
  }
  return { ...(GAME_TYPE_STAT_GAINS[game?.game_type] || DEFAULT_STAT_GAINS) }
}

// Applies this finish's stat_gains plus +1 to every stat per level gained,
// clamped to [MIN_STAT, MAX_STAT]. Returns { stats, gains } where `gains` is
// the actual delta applied per stat (for the reward screen).
export function applyStatGains(currentStats, gameGains, levelsGained) {
  const stats = {}
  const gains = {}
  for (const k of STAT_KEYS) {
    const before = Number(currentStats?.[k]) || MIN_STAT
    const gain = Math.max(0, Number(gameGains?.[k]) || 0) + Math.max(0, levelsGained)
    const after = Math.min(MAX_STAT, Math.max(MIN_STAT, before + gain))
    stats[k] = after
    gains[k] = after - before
  }
  return { stats, gains }
}

// A session is "perfect" when there were no wrong tries and no hints.
export function isPerfectResult({ correct, attempts, hintsUsed }) {
  const wrong = (Number(attempts) || 0) - (Number(correct) || 0)
  return wrong <= 0 && (Number(hintsUsed) || 0) === 0
}

// Asia/Manila has no DST (fixed UTC+8), so "today" is just a fixed offset
// from UTC — no timezone database needed.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

export function manilaDayRange(date = new Date()) {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - MANILA_OFFSET_MS)
  const endUtc = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - MANILA_OFFSET_MS)
  return { start: startUtc, end: endUtc }
}

export { STAT_KEYS }
