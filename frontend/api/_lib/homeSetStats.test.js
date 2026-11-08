// Tests for the set-scoped Patient Stats section (run with:  npx vitest run api/_lib/homeSetStats.test.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'

vi.mock('./models/homePracticePlan.js', () => ({ HomePracticePlan: { findOne: () => ({ sort: () => ({ lean: async () => null }) }) } }))
vi.mock('./sessionRecommendations.js', () => ({ notify: async () => {} }))
const { buildSetStats, gameNote, weeksFrom } = await import('./homeSetStats.js')

const P = new ObjectId()
const NOTE_ID = new ObjectId()
const G = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()]
const NAMES = ['Money Match', 'Copy the Colors', 'Sort the Basket', 'Puzzle Pals', 'Feed Pao']
const at = (d) => new Date(`2026-${d}T05:00:00Z`)
const play = (g, when, ctx, correct, attempts = 10, xp = 100) => ({ _id: new ObjectId(), patient_id: P, game_id: G[g], status: 'completed', context: ctx, completed_at: at(when), result: { correct, attempts, hints_used: 0, duration_seconds: 120 }, reward: { xp_earned: xp, stat_gains: { focus: 1 } } })

let state
function fakeDb() {
  const arr = (rows) => ({ sort: () => arr(rows), toArray: async () => rows })
  return {
    collection: (name) => ({
      home_sets: { find: () => arr(state.sets), findOne: async () => state.sets.find((s) => s.status === 'active') || null, countDocuments: async () => state.sets.length },
      patients: { findOne: async () => ({ first_name: 'Rene' }) },
      games: { find: () => arr(G.map((_id, i) => ({ _id, name: NAMES[i] }))) },
      home_practice_plans: { find: () => arr([]) },
      therapy_notes: { findOne: async (q) => state.notes.find((n) => String(n._id) === String(q._id) && n.status === 'signed') || null },
      game_sessions: { find: () => arr(state.plays.filter((p) => p.status === 'completed')) },
    }[name]),
  }
}
const set1 = () => ({ _id: new ObjectId(), patient_id: P, set_number: 1, status: 'completed', plan_id: null, started_at: at('10-21'), completed_at: at('11-08'), game_ids: [G[0], G[1], G[2]], use_at_home: true, use_in_therapy: true, soap_draft_id: NOTE_ID, next_session: null })
const set2 = () => ({ _id: new ObjectId(), patient_id: P, set_number: 2, status: 'active', plan_id: null, started_at: at('11-08'), completed_at: null, game_ids: [G[3], G[4]], use_at_home: true, use_in_therapy: true, soap_note_id: null, next_session: { date: '2026-11-15', start: '10:00' } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-20T00:00:00Z')) // the dates below are fixed, so the clock is too
  state = { sets: [set1(), set2()], plays: [], notes: [{ _id: NOTE_ID, status: 'signed', signed_at: at('11-08') }] }
  // Set 1: 3 home plays per game plus 1 therapy play on the first day of the set
  const acc = [[10, 9, 10], [6, 8, 9], [8, 10, 10]]
  acc.forEach((a, g) => { state.plays.push(play(g, '10-21', 'session', g === 1 ? 4 : 10)); a.forEach((c, i) => state.plays.push(play(g, `10-${24 + i * 3}`, 'home', c))) })
  state.plays.push(play(3, '10-01', 'session', 10)) // a therapy play of a Set 2 game from before it was in any set
})

afterEach(() => vi.useRealTimers())

describe('game note under a card', () => {
  const list = (...a) => a.map((accuracy, i) => ({ n: i + 1, accuracy }))
  it('describes finished games from the 3 play accuracies', () => {
    expect(gameNote('A', list(100, 90, 100)).text).toBe('★ Finished · steady at 97%')
    expect(gameNote('A', list(60, 80, 90)).text).toBe('★ Finished · up +30 pts from play 1 to play 3')
    expect(gameNote('A', list(80, 100, 100)).text).toBe('★ Finished · 100% on the last 2 plays')
    expect(gameNote('A', list(100, 100, 100)).text).toBe('★ Finished · steady at 100%')
    expect(gameNote('A', list(100, 80, 60)).text).toContain('down 40 pts')
  })
  it('shows plays used for 1-2 plays and "Not played yet" for none', () => {
    expect(gameNote('A', list(80, 90)).text).toBe('2 of 3 plays used')
    expect(gameNote('A', [])).toEqual({ tone: 'grey', text: 'Not played yet' })
  })
})

describe('weeks start on the day the set started', () => {
  it('Wk 1 begins at the start date and plays map to their week', () => {
    const { weekKeys, weekOf } = weeksFrom(at('11-08'), at('11-26'))
    expect(weekKeys).toEqual(['2026-11-08', '2026-11-15', '2026-11-22'])
    expect(weekOf(at('11-09'))).toBe('2026-11-08')
    expect(weekOf(at('11-16'))).toBe('2026-11-15')
  })
})

describe('Patient Stats scoped to a set', () => {
  it('defaults to the current set and lists only its games, from zero', async () => {
    const r = await buildSetStats(fakeDb(), { patientId: P })
    expect(r.selected).toMatchObject({ kind: 'current', number: 2, playsUsed: 0, playsAllowed: 6 })
    expect(r.data.perGame.map((g) => g.name)).toEqual(['Puzzle Pals', 'Feed Pao'])
    expect(r.data.totals.home.plays).toBe(0)
    expect(r.data.perGame.every((g) => g.playList.length === 0)).toBe(true)
    expect(r.data.totals.session.plays).toBe(0) // the older therapy play of Puzzle Pals is before the set's day
    expect(r.insight).toContain('Set 2 just started')
    expect(r.insight).toContain('Set 1 results stay saved')
    expect(r.referenceAverage).toMatchObject({ label: 'Set 1 average 89%' })
    expect(r.sets.map((s) => s.number)).toEqual([2, 1])
  })
  it('the finished set keeps its results: 9 home plays, play chips, notes and SOAP info', async () => {
    const r = await buildSetStats(fakeDb(), { patientId: P, setParam: String(state.sets[0]._id) })
    expect(r.selected).toMatchObject({ kind: 'finished', number: 1, finished: true, playsUsed: 9, playsAllowed: 9, soapDone: true, homePlays: 9, therapyPlays: 3, fair: true })
    const copy = r.data.perGame.find((g) => g.name === 'Copy the Colors')
    expect(copy.playList.map((p) => p.accuracy)).toEqual([60, 80, 90])
    expect(copy.note.text).toBe('★ Finished · up +30 pts from play 1 to play 3')
    expect(copy.home.accuracy).toBe(76.7)
    expect(r.data.totals.home.plays).toBe(9)
    expect(r.insight).toContain('Set 1 finished')
    expect(r.insight).toContain('Copy the Colors improved by 30 points')
    expect(r.referenceAverage).toBeNull() // only shown while viewing the current set
  })
  it('never counts a 4th home play', async () => {
    state.plays.push(play(0, '11-01', 'home', 10))
    const r = await buildSetStats(fakeDb(), { patientId: P, setParam: String(state.sets[0]._id) })
    expect(r.data.perGame.find((g) => g.name === 'Money Match').playList).toHaveLength(3)
    expect(r.data.totals.home.plays).toBe(9)
  })
  it('all sets combines every set', async () => {
    state.plays.push(play(3, '11-09', 'home', 9))
    const r = await buildSetStats(fakeDb(), { patientId: P, setParam: 'all', days: 90 })
    expect(r.selected.kind).toBe('all')
    expect(r.data.perGame.map((g) => g.name).sort()).toEqual([...NAMES].sort())
    expect(r.data.totals.home.plays).toBe(10)
  })
  it('a patient with no sets gets an empty list (the old empty state)', async () => {
    state.sets = []
    const r = await buildSetStats(fakeDb(), { patientId: P })
    expect(r).toMatchObject({ sets: [], selected: null })
  })
  it('XP weeks start at the set start', async () => {
    const r = await buildSetStats(fakeDb(), { patientId: P, setParam: String(state.sets[0]._id) })
    expect(r.data.xpByWeek[0].label).toBe('Wk 1')
    expect(r.data.xpByWeek.reduce((a, w) => a + w.homeXp, 0)).toBe(900)
  })
})
