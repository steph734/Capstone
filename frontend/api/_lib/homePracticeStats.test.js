// Tests for the home-practice-vs-therapy figures (run with:  npx vitest run api/_lib/homePracticeStats.test.js).
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ObjectId } from 'mongodb'
import { summarise, compare, buildHomePracticeStats } from './homePracticeStats.js'
import HomePracticeStats from '../../src/pages/therapist/HomePracticeStats.jsx'

const G1 = new ObjectId(), G2 = new ObjectId()
const games = new Map([[String(G1), { name: 'Money Match' }], [String(G2), { name: 'Sort the Basket' }]])
const play = (game, when, ctx, { correct, attempts, hints = 0, xp = 100, stats = { intelligence: 2, focus: 2 }, secs = 90 }) => ({
  game_id: game, context: ctx, completed_at: new Date(when), result: { correct, attempts, hints_used: hints, duration_seconds: secs }, reward: { xp_earned: xp, stat_gains: stats },
})
const weekKeys = ['2026-10-26', '2026-11-02'] // Mondays (Manila)
const plan = { status: 'active', goal_per_game_per_week: 3, created_at: new Date('2026-11-01'), starts_at: new Date('2026-11-01'), ends_at: new Date('2026-11-15'), games: [{ game_id: G1 }, { game_id: G2 }] }

describe('summarise one set of plays', () => {
  it('counts plays, accuracy, mistakes, perfect and mastered, hints, minutes, XP and stats', () => {
    const s = summarise([
      play(G1, '2026-11-03T05:00:00Z', 'home', { correct: 10, attempts: 10 }), // perfect + mastered
      play(G1, '2026-11-04T05:00:00Z', 'home', { correct: 10, attempts: 10, hints: 1 }), // mastered, not perfect (used a hint)
      play(G1, '2026-11-05T05:00:00Z', 'home', { correct: 6, attempts: 10, xp: 25 }), // 4 mistakes
    ])
    expect(s).toMatchObject({ plays: 3, mistakes: 4, perfect: 1, perfectRate: 33, mastered: 2, masteredRate: 67, hints: 1, minutes: 5, xp: 225 })
    expect(s.accuracy).toBe(86.7) // 26 correct of 30 attempts, not an average of percentages
    expect(s.mistakesPerPlay).toBe(1.3)
    expect(s.stats.intelligence).toBe(6)
    expect(s.statsTotal).toBe(12)
  })
  it('handles no plays without dividing by zero', () => {
    expect(summarise([])).toMatchObject({ plays: 0, accuracy: null, mistakesPerPlay: null, perfectRate: null, xp: 0, statsTotal: 0 })
  })
  it('never counts negative mistakes (correct above attempts)', () => {
    expect(summarise([play(G1, '2026-11-03T05:00:00Z', 'home', { correct: 12, attempts: 10 })]).mistakes).toBe(0)
  })
})

describe('home vs therapy comparison (descriptive, cautious)', () => {
  const sess = summarise([play(G1, '2026-10-28T05:00:00Z', 'session', { correct: 6, attempts: 10 }), play(G2, '2026-10-29T05:00:00Z', 'session', { correct: 7, attempts: 10 })])
  const good = summarise(Array.from({ length: 4 }, (_, i) => play(G1, `2026-11-0${i + 2}T05:00:00Z`, 'home', { correct: 10, attempts: 10 })))
  const poor = summarise(Array.from({ length: 4 }, (_, i) => play(G1, `2026-11-0${i + 2}T05:00:00Z`, 'home', { correct: 3, attempts: 10, hints: 2 })))
  const same = summarise([play(G1, '2026-11-02T05:00:00Z', 'home', { correct: 7, attempts: 10 }), play(G1, '2026-11-03T05:00:00Z', 'home', { correct: 6, attempts: 10 }), play(G1, '2026-11-04T05:00:00Z', 'home', { correct: 7, attempts: 10 })])

  it('says "not enough data" with fewer than 3 home plays or no session to compare', () => {
    expect(compare(summarise([]), sess).verdict).toBe('not_enough_data')
    expect(compare(summarise([play(G1, '2026-11-02T05:00:00Z', 'home', { correct: 10, attempts: 10 })]), sess).verdict).toBe('not_enough_data')
    expect(compare(good, summarise([])).verdict).toBe('not_enough_data')
  })
  it('better at home when accuracy, mistakes and perfect finishes are clearly better', () => {
    const c = compare(good, sess, 'Rene')
    expect(c.verdict).toBe('better_at_home')
    expect(c.text).toContain('Rene is doing better in home practice')
    expect(c.text).toContain('100% at home vs 65% in therapy sessions')
  })
  it('lower at home when clearly worse', () => { expect(compare(poor, sess).verdict).toBe('lower_at_home') })
  it('about the same for small differences', () => { expect(compare(same, sess).verdict).toBe('similar') })
})

describe('building the home practice section', () => {
  const sessions = [
    play(G1, '2026-10-28T05:00:00Z', 'session', { correct: 6, attempts: 10, xp: 150 }),
    play(G2, '2026-10-29T05:00:00Z', 'session', { correct: 7, attempts: 10, xp: 150 }),
    play(G1, '2026-11-03T05:00:00Z', 'home', { correct: 10, attempts: 10 }),
    play(G1, '2026-11-04T05:00:00Z', 'home', { correct: 9, attempts: 10 }),
    play(G2, '2026-11-04T06:00:00Z', 'home', { correct: 10, attempts: 10 }),
    play(G2, '2026-11-05T05:00:00Z', 'home', { correct: 10, attempts: 10 }),
  ]
  const out = buildHomePracticeStats({ sessions, plans: [plan], gameById: games, weekKeys, firstName: 'Rene' })

  it('counts home plays per week and per game against the goal', () => {
    expect(out.totals.home.plays).toBe(4)
    expect(out.totals.session.plays).toBe(2)
    expect(out.weeklyPlays.map((w) => w.total)).toEqual([0, 4])
    expect(out.weeklyPlays[1].byGame.map((g) => g.count)).toEqual([2, 2])
    expect(out.weeklyPlays[1].goalTotal).toBe(6) // 3 plays x 2 games
    expect(out.plan.games.map((g) => g.name)).toEqual(['Money Match', 'Sort the Basket'])
  })
  it('keeps home and therapy plays apart per game', () => {
    const money = out.perGame.find((g) => g.name === 'Money Match')
    expect(money.home.plays).toBe(2)
    expect(money.session.plays).toBe(1)
    expect(money.home.mistakes).toBe(1)
    expect(money.session.mistakes).toBe(4)
    expect(money.assigned).toBe(true)
  })
  it('reports XP and character stats earned at home separately from sessions', () => {
    expect(out.totals.home.xp).toBe(400)
    expect(out.totals.session.xp).toBe(300)
    expect(out.xpByWeek[1]).toMatchObject({ homeXp: 400, sessionXp: 0 })
    expect(out.xpByWeek[0]).toMatchObject({ homeXp: 0, sessionXp: 300 })
    expect(out.totals.home.stats.focus).toBe(8)
  })
  it('splits accuracy over time into a home line and a therapy line', () => {
    expect(out.accuracySeries.home).toHaveLength(4)
    expect(out.accuracySeries.session).toHaveLength(2)
  })
  it('compares home with therapy', () => { expect(out.comparison.verdict).toBe('better_at_home') })
  it('with a plan but no home plays yet it still lists the assigned games', () => {
    const empty = buildHomePracticeStats({ sessions: sessions.filter((s) => s.context !== 'home'), plans: [plan], gameById: games, weekKeys, firstName: 'Rene' })
    expect(empty.hasPlan).toBe(true)
    expect(empty.perGame).toHaveLength(2)
    expect(empty.totals.home.plays).toBe(0)
    expect(empty.comparison.verdict).toBe('not_enough_data')
  })
})

describe('the section renders (screen reader text, tables, no crash)', () => {
  const sessions = [
    play(G1, '2026-10-28T05:00:00Z', 'session', { correct: 6, attempts: 10 }),
    play(G1, '2026-11-03T05:00:00Z', 'home', { correct: 10, attempts: 10 }),
    play(G1, '2026-11-04T05:00:00Z', 'home', { correct: 10, attempts: 10 }),
    play(G2, '2026-11-05T05:00:00Z', 'home', { correct: 9, attempts: 10 }),
  ]
  it('shows the verdict, the tables and described charts', () => {
    const data = buildHomePracticeStats({ sessions, plans: [plan], gameById: games, weekKeys, firstName: 'Rene' })
    const html = renderToStaticMarkup(createElement(HomePracticeStats, { data, firstName: 'Rene' }))
    expect(html).toContain('Home practice vs therapy sessions')
    expect(html).toContain('Therapy sessions vs home practice')
    expect(html).toContain('Mistakes per play')
    expect(html).toContain('XP and character stats earned')
    expect(html).toContain('role="img"')
    expect(html).toContain('View as table')
    expect(html).toContain('Money Match')
  })
  it('with no plan and no home plays it explains how the section fills in', () => {
    const data = buildHomePracticeStats({ sessions: [], plans: [], gameById: games, weekKeys, firstName: 'Rene' })
    const html = renderToStaticMarkup(createElement(HomePracticeStats, { data, firstName: 'Rene' }))
    expect(html).toContain('No home practice plan was active in this period')
  })
  it('renders nothing if the server sent no home practice data (older API)', () => {
    expect(renderToStaticMarkup(createElement(HomePracticeStats, { data: undefined }))).toBe('')
  })
})
