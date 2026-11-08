// Tests for home practice sets: the 3-plays-per-game progress, the SOAP note step, assigning the next set, and Undo
// (run with:  npx vitest run api/_lib/homeSets.test.js). A small in-memory fake stands in for MongoDB.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'

const mocks = vi.hoisted(() => ({ plans: [], notified: [] }))
vi.mock('./models/homePracticePlan.js', () => {
  const match = (p, q) => Object.entries(q).every(([k, v]) => (v && typeof v === 'object' && '$gt' in v ? p[k] > v.$gt : String(p[k]) === String(v)))
  const chain = (rows) => ({ sort: () => chain(rows), lean: async () => rows[0] || null, select: () => chain(rows), then: (ok) => ok(rows[0] || null) })
  return {
    HomePracticePlan: {
      findOne: (q) => chain(mocks.plans.filter((p) => match(p, q))),
      findById: async (id) => mocks.plans.find((p) => String(p._id) === String(id)) || null,
      create: async (doc) => { const d = { _id: new ObjectId(), ...doc }; mocks.plans.push(d); return d },
      updateOne: async (q, u) => { const p = mocks.plans.find((x) => String(x._id) === String(q._id)); if (p) Object.assign(p, u.$set); return {} },
      deleteOne: async (q) => { mocks.plans = mocks.plans.filter((x) => String(x._id) !== String(q._id)); return {} },
      find: () => chain(mocks.plans),
    },
  }
})
vi.mock('./sessionRecommendations.js', () => ({ notify: async (_db, n) => { mocks.notified.push(n) } }))

const { masteryForGames, setIsComplete, statusOf, assignNewSet, undoNewSet, syncActiveSet, linkSoapNote, homeSetSummary } = await import('./homeSets.js')
const { MASTERED_PLAYS_REQUIRED } = await import('./homeSetConfig.js')

const P = new ObjectId(), EMP = { _id: new ObjectId(), first_name: 'Edward' }
const G = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()]
const day = (n) => new Date(Date.now() - n * 86400000)
const perfect = (game, when, context = 'home') => ({ patient_id: P, game_id: game, status: 'completed', context, completed_at: when, result: { correct: 10, attempts: 10 } })
const flawed = (game, when, context = 'home') => ({ patient_id: P, game_id: game, status: 'completed', context, completed_at: when, result: { correct: 8, attempts: 10 } })

function fakeDb(state) {
  const arr = (rows) => ({ sort: () => arr(rows), toArray: async () => rows })
  const sets = () => state.sets
  return {
    collection: (name) => ({
      home_sets: {
        findOne: async (q) => sets().find((s) => Object.entries(q).every(([k, v]) => String(s[k]) === String(v))) || null,
        find: () => arr(sets()), countDocuments: async () => sets().length,
        insertOne: async (d) => { const _id = new ObjectId(); sets().push({ _id, ...d }); return { insertedId: _id } },
        updateOne: async (q, u) => { const s = sets().find((x) => String(x._id) === String(q._id)); if (s) Object.assign(s, u.$set); return {} },
        deleteOne: async (q) => { state.sets = sets().filter((x) => String(x._id) !== String(q._id)); return {} },
      },
      games: { find: (q) => arr(state.games.filter((g) => !q._id || q._id.$in.some((i) => String(i) === String(g._id)))) },
      patients: { findOne: async () => ({ _id: P, first_name: 'Rene', last_name: 'B', email: 'rene@x.com', guardian_email: 'mom@x.com' }) },
      appointments: { findOne: async () => ({ _id: new ObjectId(), session_date: new Date('2026-11-15T00:00:00Z'), start_time: '10:00' }) },
      game_sessions: {
        find: (q) => arr(state.plays.filter((p) => q.game_id.$in.some((i) => String(i) === String(p.game_id)) && p.completed_at >= q.completed_at.$gte && (!q.completed_at.$lte || p.completed_at <= q.completed_at.$lte) && (!q.context || p.context === q.context))),
        countDocuments: async () => state.plays.filter((p) => p.completed_at >= state.sets.at(-1).started_at).length,
      },
      therapy_notes: { findOne: async (q) => state.notes.find((n) => String(n._id) === String(q._id) && String(n.patient_id) === String(q.patient_id) && (!q.employee_id || String(n.employee_id) === String(q.employee_id))) || null },
      notifications: { deleteMany: async () => { state.notificationsDeleted = true; return {} } },
    }[name]),
  }
}

let state
beforeEach(() => {
  mocks.plans = []; mocks.notified = []
  state = { sets: [], plays: [], notes: [], notificationsDeleted: false, games: G.map((_id, i) => ({ _id, name: `Game ${i + 1}`, status: 'published', description: 'd' })) }
})
const seedSet = (setNumber = 1) => {
  const plan = { _id: new ObjectId(), patient_id: P, status: 'active', created_at: day(10), ends_at: new Date(Date.now() + 20 * 86400000), days: [1, 2, 3], daily_start: '16:00', daily_end: '19:00', daily_limit_minutes: 20, goal_per_game_per_week: 3, notify_caregiver: true, save_to_progress: true, games: [0, 1, 2].map((i) => ({ game_id: G[i], order: i + 1 })) }
  mocks.plans.push(plan)
  state.sets.push({ _id: new ObjectId(), patient_id: P, set_number: setNumber, status: 'active', plan_id: plan._id, started_at: day(10), completed_at: null, game_ids: [G[0], G[1], G[2]], use_in_therapy: true, use_at_home: true })
  return plan
}
const masterAll = () => [0, 1, 2].forEach((i) => [1, 2, 3].forEach((n) => state.plays.push(perfect(G[i], day(10 - n - i * 0.1)))))
// the therapist's SOAP note for the set (the step before choosing the next set)
const writeNote = (setIndex = 0) => { const note = { _id: new ObjectId(), patient_id: P, employee_id: EMP._id }; state.notes.push(note); state.sets[setIndex].soap_note_id = note._id; return note }
const body = (extra = {}) => ({ employee: EMP, patientId: P, gameIds: [G[3], G[4]], startingLevel: 'warmup', useInTherapy: true, useAtHome: true, ...extra })

describe('progress rule: 3 plays per game', () => {
  it('practicing until every play is used, then finished, and mastered when all plays were perfect', () => {
    expect(MASTERED_PLAYS_REQUIRED).toBe(3)
    expect(statusOf(0, 0)).toBe('not_started')
    expect(statusOf(2, 2)).toBe('practicing')
    expect(statusOf(3, 1)).toBe('finished')
    expect(statusOf(3, 3)).toBe('mastered')
  })
  it('counts only plays made at home', async () => {
    state.plays.push(perfect(G[0], day(5), 'session'), perfect(G[0], day(4), 'home'))
    const m = await masteryForGames(fakeDb(state), P, [G[0]], day(10), null, 'home')
    expect(m.get(String(G[0]))).toMatchObject({ plays: 1, status: 'practicing' })
  })
  it('counts only perfect plays since the set started', async () => {
    const db = fakeDb(state)
    state.plays.push(perfect(G[0], day(5)), perfect(G[0], day(4)), flawed(G[0], day(3)), perfect(G[0], day(20)), perfect(G[1], day(2)))
    const m = await masteryForGames(db, P, [G[0], G[1], G[2]], day(10))
    expect(m.get(String(G[0]))).toMatchObject({ plays: 3, masteredPlays: 2, status: 'finished' }) // all 3 plays used, one not perfect
    expect(m.get(String(G[1]))).toMatchObject({ plays: 1, masteredPlays: 1 })
    expect(m.get(String(G[2])).status).toBe('not_started')
    state.plays.push(perfect(G[0], day(1)), perfect(G[0], day(0.5)))
    const again = await masteryForGames(db, P, [G[0]], day(10))
    expect(again.get(String(G[0])).status).toBe('mastered')
    expect(again.get(String(G[0])).masteredAt).toBeInstanceOf(Date)
  })
  it('a set is complete only when every game is finished or mastered', () => {
    expect(setIsComplete([{ status: 'mastered' }, { status: 'practicing' }])).toBe(false)
    expect(setIsComplete([{ status: 'mastered' }, { status: 'finished' }])).toBe(true)
    expect(setIsComplete([])).toBe(false)
  })
})

describe('a set follows the active home plan', () => {
  it('creates set 1 for a patient who already has a plan', async () => {
    const plan = seedSet(); state.sets = []
    const set = await syncActiveSet(fakeDb(state), P)
    expect(set).toMatchObject({ set_number: 1, status: 'active' })
    expect(String(set.plan_id)).toBe(String(plan._id))
    expect(set.game_ids).toHaveLength(3)
  })
})

describe('assign new set', () => {
  it('validates the picks before touching anything', async () => {
    seedSet(); masterAll()
    await expect(assignNewSet(fakeDb(state), body({ gameIds: [G[3]] }))).rejects.toMatchObject({ status: 400 })
    await expect(assignNewSet(fakeDb(state), body({ gameIds: G }))).rejects.toMatchObject({ status: 400 }) // 5 games
    await expect(assignNewSet(fakeDb(state), body({ gameIds: [G[3], G[3]] }))).rejects.toMatchObject({ status: 400 })
    await expect(assignNewSet(fakeDb(state), body({ startingLevel: 'x' }))).rejects.toMatchObject({ status: 400 })
    await expect(assignNewSet(fakeDb(state), body({ useInTherapy: false, useAtHome: false }))).rejects.toMatchObject({ status: 400 })
    expect(state.sets).toHaveLength(1)
  })
  it('refuses while the current set is not complete', async () => {
    seedSet(); state.plays.push(perfect(G[0], day(2)))
    await expect(assignNewSet(fakeDb(state), body())).rejects.toMatchObject({ status: 409 })
    expect(state.sets[0].status).toBe('active')
  })
  it('refuses until the SOAP note for the home practice is written', async () => {
    seedSet(); masterAll()
    await expect(assignNewSet(fakeDb(state), body())).rejects.toMatchObject({ status: 409, message: expect.stringContaining('SOAP note') })
    expect(state.sets[0].status).toBe('active')
    writeNote()
    await expect(assignNewSet(fakeDb(state), body())).resolves.toMatchObject({ setNumber: 2 })
  })
  it('a finished set with imperfect plays can move on too', async () => {
    seedSet(); [0, 1, 2].forEach((i) => [1, 2, 3].forEach((n) => state.plays.push(flawed(G[i], day(10 - n - i * 0.1))))); writeNote()
    await expect(assignNewSet(fakeDb(state), body())).resolves.toMatchObject({ setNumber: 2 })
  })
  it('completes set 1, starts set 2 with a new plan and notifies the family', async () => {
    const oldPlan = seedSet(); masterAll(); writeNote()
    const r = await assignNewSet(fakeDb(state), body())
    expect(r).toMatchObject({ setNumber: 2, goal: 3, games: ['Game 4', 'Game 5'], therapyDate: '2026-11-15' })
    expect(state.sets[0]).toMatchObject({ status: 'completed' })
    expect(state.sets[1]).toMatchObject({ set_number: 2, status: 'active', use_at_home: true })
    expect(oldPlan.status).toBe('cancelled')
    const active = mocks.plans.find((p) => p.status === 'active')
    expect(active.games.map((g) => String(g.game_id))).toEqual([String(G[3]), String(G[4])])
    expect(active.daily_limit_minutes).toBe(20) // settings carry over from the previous plan
    expect(mocks.notified.map((n) => n.email).sort()).toEqual(['mom@x.com', 'rene@x.com'])
    expect(mocks.notified[0].body).toContain('Game 4, Game 5')
  })
  it('counters start from zero for the new set', async () => {
    seedSet(); masterAll(); writeNote()
    await assignNewSet(fakeDb(state), body({ gameIds: [G[0], G[3]] })) // a mastered game may be picked again for review
    const set2 = state.sets[1]
    const m = await masteryForGames(fakeDb(state), P, set2.game_ids, set2.started_at, null, 'home')
    expect(m.get(String(G[0]))).toMatchObject({ plays: 0, masteredPlays: 0, status: 'not_started' })
  })
  it('therapy only: no home plan is created', async () => {
    seedSet(); masterAll(); writeNote()
    await assignNewSet(fakeDb(state), body({ useAtHome: false }))
    expect(state.sets[1]).toMatchObject({ use_at_home: false, plan_id: null })
    expect(mocks.plans.filter((p) => p.status === 'active')).toHaveLength(0)
  })
})

describe('undo', () => {
  it('puts set 1 and its plan back and removes set 2', async () => {
    const oldPlan = seedSet(); masterAll(); writeNote()
    const r = await assignNewSet(fakeDb(state), body())
    await undoNewSet(fakeDb(state), { patientId: P, setId: r.setId })
    expect(state.sets).toHaveLength(1)
    expect(state.sets[0]).toMatchObject({ status: 'active', completed_at: null })
    expect(oldPlan.status).toBe('active')
    expect(mocks.plans).toHaveLength(1)
    expect(state.notificationsDeleted).toBe(true)
  })
  it('is refused after the undo window', async () => {
    seedSet(); masterAll(); writeNote()
    const r = await assignNewSet(fakeDb(state), body())
    state.sets[1].undo.until = new Date(Date.now() - 1000)
    await expect(undoNewSet(fakeDb(state), { patientId: P, setId: r.setId })).rejects.toMatchObject({ status: 409 })
  })
})

describe('SOAP note for a set', () => {
  const assigned = async () => true
  it('links only your own note for this patient', async () => {
    seedSet()
    const note = { _id: new ObjectId(), patient_id: P, employee_id: EMP._id }
    const other = { _id: new ObjectId(), patient_id: new ObjectId(), employee_id: EMP._id }
    state.notes.push(note, other)
    const setId = String(state.sets[0]._id)
    await expect(linkSoapNote(fakeDb(state), { setId, noteId: String(other._id), employee: EMP, assigned })).rejects.toMatchObject({ status: 400 })
    await expect(linkSoapNote(fakeDb(state), { setId, noteId: String(note._id), employee: EMP, assigned: async () => false })).rejects.toMatchObject({ status: 404 })
    await linkSoapNote(fakeDb(state), { setId, noteId: String(note._id), employee: EMP, assigned })
    expect(String(state.sets[0].soap_note_id)).toBe(String(note._id))
  })
  it('prefills the Objective from the plays recorded at home', async () => {
    seedSet(); masterAll(); state.plays.push(perfect(G[0], day(1), 'session'))
    const r = await homeSetSummary(fakeDb(state), { setId: String(state.sets[0]._id), employee: EMP, assigned })
    expect(r.text).toContain('Game 1: 3 of 3 plays at home, accuracy 100%')
    expect(r.text).toContain('Overall: 9 plays')
  })
})
