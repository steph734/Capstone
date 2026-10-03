// Unit tests for the progression math and the shared rule checker.
// Run with: node --test api/_lib/paoProgression.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  xpToNextLevel, applyXp, computeXpEarned, xpMultiplier, statGainsForGame,
  applyStatGains, isPerfectResult, manilaDayRange, MAX_LEVEL,
} from './paoProgression.js'
import { evaluateCriteria } from './evaluateUnlock.js'

const ctx = (over = {}) => ({
  completedGameIds: new Set(), perfectGameIds: new Set(), anyPerfect: false,
  completionCountByGame: new Map(), gamesCompleted: 0, perfectGames: 0, level: 1,
  totalXp: 0, gamesInARow: 0, allCategoriesComplete: false, earnedBadgeCodes: new Set(),
  ...over,
})

test('XP to next level follows 100 + (level - 1) * 50', () => {
  assert.equal(xpToNextLevel(1), 100)
  assert.equal(xpToNextLevel(2), 150)
  assert.equal(xpToNextLevel(10), 550)
})

test('applyXp carries leftover XP and allows several level-ups at once', () => {
  assert.deepEqual(applyXp(1, 0, 100), { level: 2, xp: 0, levelsGained: 1 })
  // 100 to reach 2, then 150 to reach 3 — 260 covers both with 10 left over.
  assert.deepEqual(applyXp(1, 0, 260), { level: 3, xp: 10, levelsGained: 2 })
})

test('applyXp stops at the max level', () => {
  const r = applyXp(MAX_LEVEL, 0, 1_000_000)
  assert.equal(r.level, MAX_LEVEL)
  assert.equal(r.levelsGained, 0)
})

test('first finish earns 1.5x, the fourth same-day finish earns 0.25x', () => {
  assert.equal(xpMultiplier({ isFirstFinish: true, finishesTodayIncludingThis: 1 }), 1.5)
  assert.equal(xpMultiplier({ isFirstFinish: false, finishesTodayIncludingThis: 3 }), 1)
  assert.equal(xpMultiplier({ isFirstFinish: false, finishesTodayIncludingThis: 4 }), 0.25)
  assert.equal(computeXpEarned({ points_per_play: 100 }, { isFirstFinish: true, finishesTodayIncludingThis: 1 }), 150)
})

test('stat gains fall back to the game type when no explicit gains are set', () => {
  assert.deepEqual(statGainsForGame({ game_type: 'picture_match' }), { memory: 2, focus: 2 })
  assert.equal(statGainsForGame({ stat_gains: { speed: 3 }, game_type: 'picture_match' }).speed, 3)
})

test('stats gain the game bonus plus +1 per level and never exceed 100', () => {
  const { stats, gains } = applyStatGains({ intelligence: 99, focus: 5, resistance: 5, creativity: 5, speed: 5, memory: 5 }, { intelligence: 4 }, 2)
  assert.equal(stats.intelligence, 100)
  assert.equal(gains.intelligence, 1)
  assert.equal(stats.focus, 7)
})

test('a session is perfect only with no wrong tries and no hints', () => {
  assert.equal(isPerfectResult({ correct: 5, attempts: 5, hintsUsed: 0 }), true)
  assert.equal(isPerfectResult({ correct: 5, attempts: 6, hintsUsed: 0 }), false)
  assert.equal(isPerfectResult({ correct: 5, attempts: 5, hintsUsed: 1 }), false)
})

test('the Manila day is a fixed UTC+8 window', () => {
  const { start, end } = manilaDayRange(new Date('2026-10-02T17:00:00Z')) // 01:00 on Oct 3 in Manila
  assert.equal(start.toISOString(), '2026-10-02T16:00:00.000Z')
  assert.equal(end.toISOString(), '2026-10-03T16:00:00.000Z')
})

test('rule checker: counts and thresholds (value null means 1)', () => {
  const c = ctx({ gamesCompleted: 3, completionCountByGame: new Map([['g1', 2]]) })
  assert.equal(evaluateCriteria({ type: 'complete_any_game', value: null }, c), true)
  assert.equal(evaluateCriteria({ type: 'complete_any_game', value: 5 }, c), false)
  assert.equal(evaluateCriteria({ type: 'complete_specific_game', gameId: 'g1', value: 2 }, c), true)
  assert.equal(evaluateCriteria({ type: 'complete_specific_game', gameId: 'g1', value: 3 }, c), false)
})

test('rule checker: level, XP, streak and categories', () => {
  const c = ctx({ level: 5, totalXp: 500, gamesInARow: 5, allCategoriesComplete: true })
  assert.equal(evaluateCriteria({ type: 'reach_level', value: 5 }, c), true)
  assert.equal(evaluateCriteria({ type: 'total_xp', value: 501 }, c), false)
  assert.equal(evaluateCriteria({ type: 'games_in_a_row', value: 5 }, c), true)
  assert.equal(evaluateCriteria({ type: 'all_categories' }, c), true)
  assert.equal(evaluateCriteria({ type: 'all_categories' }, ctx()), false)
})

test('rule checker: earn_badge needs the badge already earned, free is always true', () => {
  const c = ctx({ earnedBadgeCodes: new Set(['word_picture']) })
  assert.equal(evaluateCriteria({ type: 'earn_badge', badgeCode: 'word_picture' }, c), true)
  assert.equal(evaluateCriteria({ type: 'earn_badge', badgeCode: 'other' }, c), false)
  assert.equal(evaluateCriteria({ type: 'free' }, ctx()), true)
})
