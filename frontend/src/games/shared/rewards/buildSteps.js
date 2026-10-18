// Turns the server's reward response into the steps to show. Steps with nothing new are skipped.
// Order: Badge (first time) -> XP -> Level up (only if the level changed) -> Stats -> Outfit -> All done.
export function buildSteps(reward) {
  if (!reward) return []
  if (reward.exit) return [{ kind: 'keepGoing' }]
  const badges = reward.badges || []
  const unlocks = reward.unlocks || []
  const stats = (reward.gameStats || []).filter((s) => s.gained > 0)
  const xp = Number(reward.xpEarned) || 0
  const leveled = Boolean(reward.leveledUp)
  if (!badges.length && !unlocks.length && !stats.length && !xp && !leveled) return [{ kind: 'replay' }]
  const steps = []
  badges.forEach((badge) => steps.push({ kind: 'badge', badge }))
  if (xp > 0) steps.push({ kind: 'xp' })
  if (leveled) steps.push({ kind: 'level' })
  if (stats.length) steps.push({ kind: 'stats', stats })
  unlocks.forEach((unlock) => steps.push({ kind: 'outfit', unlock }))
  steps.push({ kind: 'allDone' })
  return steps
}

// XP needed to go from `level` to the next one (same formula as the server: 100 + 50 per level after the first).
export const xpToNextLevel = (level) => 100 + (Math.max(1, level) - 1) * 50

// Bar numbers for the XP step.
export function xpNumbers(reward) {
  const gained = Number(reward.xpEarned) || 0
  const levelBefore = reward.levelBefore ?? reward.profile?.level ?? 1
  const levelAfter = reward.levelAfter ?? levelBefore
  const leveled = levelAfter > levelBefore
  const after = reward.profile?.xp ?? gained
  const before = reward.xpBefore ?? Math.max(0, after - gained)
  const cap = leveled ? xpToNextLevel(levelBefore) : (reward.profile?.xpToNext ?? xpToNextLevel(levelAfter))
  return { gained, before, after: leveled ? cap : after, cap, level: leveled ? levelBefore : levelAfter, levelBefore, levelAfter, next: reward.profile?.xpToNext ?? xpToNextLevel(levelAfter) }
}

export const SPEECH = {
  badge: 'You earned a badge!',
  xp: 'Look at all these stars!',
  stats: 'I got stronger!',
  gift: 'A present! What is inside?',
  wearing: 'Do I look nice?',
  allDone: 'Thank you for playing with me!',
  replay: 'Great job again!',
  keepGoing: "Good try! Let's finish next time.",
  levelUp: (n) => `I grew! I am level ${n} now!`,
}
