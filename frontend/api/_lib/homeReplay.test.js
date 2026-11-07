// Tests for home practice: which child a guardian account plays as, and what a REPLAY earns.
// (run with:  npx vitest run api/_lib/homeReplay.test.js)
import { describe, expect, it } from 'vitest'
import { ObjectId } from 'mongodb'
import { pickPatientByEmail } from './resolvePatient.js'
import { computeXpEarned, applyStatGains, statGainsForGame, xpMultiplier } from './paoProgression.js'

// A tiny fake database: rows for find(), canned results for each aggregate().
function fakeDb({ patients, sessionPlans = [], plays = [], profiles = [], homePlans = [] }) {
  const rows = { patients, pao_profiles: profiles }
  const agg = { session_game_plans: sessionPlans, game_sessions: plays, home_practice_plans: homePlans }
  return {
    collection: (name) => ({
      find: () => { const c = { sort: () => c, toArray: async () => rows[name] || [] }; return c },
      aggregate: () => ({ toArray: async () => agg[name] || [] }),
    }),
  }
}
const kid = (name, created) => ({ _id: new ObjectId(), first_name: name, last_name: 'Baterbonia', email: 'mom@example.com', created_at: new Date(created) })

describe('which child does the guardian account play as?', () => {
  const old = kid('Rene', '2026-10-01')
  const newer = kid('Rene', '2026-11-07')
  const other = kid('Jeo', '2026-10-15')

  it('with one record it is just that record', async () => {
    expect(String((await pickPatientByEmail(fakeDb({ patients: [old] }), 'mom@example.com'))._id)).toBe(String(old._id))
  })

  it('the child with an ACTIVE home plan wins over an older record with more session history', async () => {
    const db = fakeDb({
      patients: [old, newer],
      sessionPlans: [{ _id: old._id, n: 8, last: new Date('2026-10-20') }], // old record: lots of past sessions
      plays: [{ _id: old._id, n: 40 }],
      homePlans: [{ _id: newer._id, created: new Date('2026-11-08') }], // newer record: the plan the therapist just sent home
    })
    expect(String((await pickPatientByEmail(db, 'mom@example.com'))._id)).toBe(String(newer._id))
  })

  it('when two children have active home plans, the most recently created plan wins', async () => {
    const db = fakeDb({
      patients: [other, newer],
      homePlans: [{ _id: other._id, created: new Date('2026-11-01') }, { _id: newer._id, created: new Date('2026-11-08') }],
    })
    expect(String((await pickPatientByEmail(db, 'mom@example.com'))._id)).toBe(String(newer._id))
  })

  it("a game plan for TODAY's therapy session beats a home plan (the child in session right now)", async () => {
    const now = new Date('2026-11-08T03:00:00Z') // 11:00 AM Manila
    const db = fakeDb({
      patients: [other, newer],
      sessionPlans: [{ _id: other._id, n: 1, last: new Date('2026-11-07T16:00:00Z') }], // plan_date = Nov 8 00:00 Manila
      homePlans: [{ _id: newer._id, created: new Date('2026-11-08') }],
    })
    expect(String((await pickPatientByEmail(db, 'mom@example.com', undefined, now))._id)).toBe(String(other._id))
  })

  it('an expired / cancelled home plan does not count (only active ones are looked at)', async () => {
    const db = fakeDb({ patients: [old, newer], sessionPlans: [{ _id: old._id, n: 3, last: new Date('2026-10-20') }], homePlans: [] })
    expect(String((await pickPatientByEmail(db, 'mom@example.com'))._id)).toBe(String(old._id))
  })
})

describe('what a REPLAY of an already-finished game earns', () => {
  const game = { points_per_play: 100, game_type: 'sort_place', stat_gains: { intelligence: 2, focus: 2 } }

  it('keeps giving XP every time (first finish is boosted, normal replays are 1x)', () => {
    const first = computeXpEarned(game, { isFirstFinish: true, finishesTodayIncludingThis: 1 })
    const replay = computeXpEarned(game, { isFirstFinish: false, finishesTodayIncludingThis: 1 })
    expect(first).toBe(150)
    expect(replay).toBe(100)
    expect(replay).toBeGreaterThan(0)
  })

  it('stops over-farming: after 3 plays of the same game in a day the XP drops to a quarter (still above zero)', () => {
    expect(xpMultiplier({ isFirstFinish: false, finishesTodayIncludingThis: 3 })).toBe(1)
    expect(xpMultiplier({ isFirstFinish: false, finishesTodayIncludingThis: 4 })).toBe(0.25)
    expect(computeXpEarned(game, { isFirstFinish: false, finishesTodayIncludingThis: 4 })).toBe(25)
  })

  it('character stats rise on every play, not only the first', () => {
    const gains = statGainsForGame(game)
    const afterFirst = applyStatGains({ intelligence: 10, focus: 10 }, gains, 0)
    const afterReplay = applyStatGains(afterFirst.stats, gains, 0)
    expect(afterFirst.stats.intelligence).toBe(12)
    expect(afterReplay.stats.intelligence).toBe(14)
    expect(afterReplay.gains.focus).toBe(2)
  })
})
