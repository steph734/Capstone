// Descriptive figures that compare a child's HOME PRACTICE plays with their THERAPY SESSION plays.
// Used by the therapist's Patient Stats page (see gamifiedPatientStats.js). Descriptive only: it reports what was
// recorded and how the two settings compare; it does not predict or diagnose.
//
// Definitions (shown to the therapist on the page):
//   play              one completed game
//   accuracy          correct / attempts, summed over the plays (not an average of percentages)
//   mistakes          attempts - correct, i.e. tries that were not right (never below 0)
//   perfect finish    no mistakes and no hints (the same rule the reward system uses)
//   mastered          a play that finished at 100% accuracy
//   XP / stats        exactly what the server awarded for each play (replays still earn XP and stats;
//                     badges and clothes are only ever given the first time)
import { manilaDayKey, mondayWeekKey } from './manilaWeeks.js'

export const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const r1 = (n) => Math.round(n * 10) / 10

const correctOf = (s) => Number(s.result?.correct) || 0
const attemptsOf = (s) => Number(s.result?.attempts) || 0
const mistakesOf = (s) => Math.max(0, attemptsOf(s) - correctOf(s))
const hintsOf = (s) => Number(s.result?.hints_used) || 0
const accuracyOf = (s) => (attemptsOf(s) > 0 ? (Math.min(correctOf(s), attemptsOf(s)) / attemptsOf(s)) * 100 : null)
const isPerfect = (s) => attemptsOf(s) > 0 && mistakesOf(s) === 0 && hintsOf(s) === 0
const isMastered = (s) => attemptsOf(s) > 0 && mistakesOf(s) === 0

// One bundle of figures for a list of plays.
export function summarise(plays) {
  const n = plays.length
  let correct = 0, attempts = 0, mistakes = 0, hints = 0, perfect = 0, mastered = 0, seconds = 0, xp = 0
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
  for (const s of plays) {
    correct += Math.min(correctOf(s), attemptsOf(s)); attempts += attemptsOf(s); mistakes += mistakesOf(s); hints += hintsOf(s)
    if (isPerfect(s)) perfect += 1
    if (isMastered(s)) mastered += 1
    seconds += Math.min(3600, Number(s.result?.duration_seconds) || 0)
    xp += Number(s.reward?.xp_earned) || 0
    for (const k of STAT_KEYS) stats[k] += Number(s.reward?.stat_gains?.[k]) || 0
  }
  return {
    plays: n,
    accuracy: attempts > 0 ? r1((correct / attempts) * 100) : null,
    mistakes, mistakesPerPlay: n ? r1(mistakes / n) : null,
    perfect, perfectRate: n ? Math.round((perfect / n) * 100) : null,
    mastered, masteredRate: n ? Math.round((mastered / n) * 100) : null,
    hints, hintsPerPlay: n ? r1(hints / n) : null,
    minutes: Math.round(seconds / 60),
    xp, stats, statsTotal: STAT_KEYS.reduce((a, k) => a + stats[k], 0),
  }
}

const MIN_HOME_PLAYS = 3 // fewer than this is too little to compare fairly
const MIN_SESSION_PLAYS = 1

// A plain-language comparison. "Better" needs a clear gap on at least two of the three measures and no clear loss.
export function compare(home, session, firstName = 'The child') {
  if (home.plays < MIN_HOME_PLAYS || session.plays < MIN_SESSION_PLAYS || home.accuracy == null || session.accuracy == null) {
    const need = []
    if (home.plays < MIN_HOME_PLAYS) need.push(`at least ${MIN_HOME_PLAYS} home plays (so far ${home.plays})`)
    if (session.plays < MIN_SESSION_PLAYS) need.push('a therapy-session play to compare with')
    return { verdict: 'not_enough_data', text: `Not enough data yet to compare fairly. Needs ${need.join(' and ') || 'more plays'}.` }
  }
  const accDiff = r1(home.accuracy - session.accuracy)
  const mistakeDiff = r1((home.mistakesPerPlay ?? 0) - (session.mistakesPerPlay ?? 0)) // negative = fewer mistakes at home
  const perfectDiff = (home.perfectRate ?? 0) - (session.perfectRate ?? 0)
  const marks = [accDiff >= 5 ? 1 : accDiff <= -5 ? -1 : 0, mistakeDiff <= -0.5 ? 1 : mistakeDiff >= 0.5 ? -1 : 0, perfectDiff >= 10 ? 1 : perfectDiff <= -10 ? -1 : 0]
  const better = marks.filter((m) => m === 1).length
  const worse = marks.filter((m) => m === -1).length
  const verdict = better >= 2 && worse === 0 ? 'better_at_home' : worse >= 2 && better === 0 ? 'lower_at_home' : 'similar'
  const parts = [
    `Accuracy is ${home.accuracy}% at home vs ${session.accuracy}% in therapy sessions (${accDiff >= 0 ? '+' : ''}${accDiff} points).`,
    `Mistakes per play: ${home.mistakesPerPlay} at home vs ${session.mistakesPerPlay} in sessions.`,
    `Perfect finishes: ${home.perfectRate}% at home vs ${session.perfectRate}% in sessions.`,
  ]
  const lead = {
    better_at_home: `${firstName} is doing better in home practice than in therapy sessions.`,
    lower_at_home: `${firstName} is doing less well in home practice than in therapy sessions.`,
    similar: `${firstName} is doing about the same at home and in therapy sessions.`,
  }[verdict]
  return { verdict, text: `${lead} ${parts.join(' ')}` }
}

// sessions: the patient's completed plays in the range (home ones have context 'home'); plans: home practice plans
// that overlap the range; gameById: Map(id -> { name }); weekKeys: Monday keys of the range, oldest first.
export function buildHomePracticeStats({ sessions, plans, gameById, weekKeys, firstName }) {
  const isHome = (s) => s.context === 'home'
  const home = sessions.filter(isHome)
  const therapy = sessions.filter((s) => !isHome(s))

  // The plan to talk about: the active one, else the newest in the range.
  const plan = [...plans].sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0) || new Date(b.created_at) - new Date(a.created_at))[0] || null
  const planGameIds = plan ? plan.games.map((g) => String(g.game_id)) : []
  const nameOf = (id) => gameById.get(String(id))?.name || 'Game'

  // Games to show: everything assigned for home, plus anything actually played at home.
  const gameIds = [...new Set([...planGameIds, ...home.map((s) => String(s.game_id))])]
  const perGame = gameIds.map((id) => {
    const h = home.filter((s) => String(s.game_id) === id)
    const t = therapy.filter((s) => String(s.game_id) === id)
    const last = h.length ? h[h.length - 1].completed_at : null
    return { gameId: id, name: nameOf(id), assigned: planGameIds.includes(id), home: summarise(h), session: summarise(t), lastHomeAt: last ? new Date(last).toISOString() : null }
  })

  // Home plays per week (stacked by game), with the therapist's goal (plays per game per week).
  const goal = plan?.goal_per_game_per_week || null
  const weeklyPlays = weekKeys.map((wk, i) => {
    const inWeek = home.filter((s) => mondayWeekKey(s.completed_at) === wk)
    return {
      weekStart: wk, label: `Wk ${i + 1}`, total: inWeek.length,
      byGame: gameIds.map((id) => ({ gameId: id, count: inWeek.filter((s) => String(s.game_id) === id).length })),
      goalTotal: goal ? goal * planGameIds.length : null,
    }
  })

  // Accuracy of every play over time, home vs therapy.
  const series = (list) => list.filter((s) => accuracyOf(s) != null).map((s) => ({ date: manilaDayKey(s.completed_at), value: r1(accuracyOf(s)) }))

  // XP and stats earned per week, home vs therapy.
  const xpByWeek = weekKeys.map((wk, i) => {
    const h = summarise(home.filter((s) => mondayWeekKey(s.completed_at) === wk))
    const t = summarise(therapy.filter((s) => mondayWeekKey(s.completed_at) === wk))
    return { weekStart: wk, label: `Wk ${i + 1}`, homeXp: h.xp, sessionXp: t.xp, homeStats: h.statsTotal, sessionStats: t.statsTotal }
  })

  const totals = { home: summarise(home), session: summarise(therapy) }
  return {
    hasPlan: Boolean(plan),
    plan: plan ? {
      status: plan.status, goalPerGamePerWeek: goal, startsAt: plan.starts_at, endsAt: plan.ends_at,
      games: planGameIds.map((id) => ({ gameId: id, name: nameOf(id) })),
    } : null,
    totals,
    comparison: compare(totals.home, totals.session, firstName),
    perGame,
    weeklyPlays,
    accuracySeries: { home: series(home), session: series(therapy) },
    xpByWeek,
    minHomePlays: MIN_HOME_PLAYS,
  }
}
