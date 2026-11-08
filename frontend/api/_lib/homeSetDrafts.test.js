// Tests for the finished-set drafts: the recommendation and its reasons, the auto-written SOAP note, idempotency, review and signing rules
// (run with:  npx vitest run api/_lib/homeSetDrafts.test.js). An in-memory stand-in replaces MongoDB.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'

process.env.SOAP_ENCRYPTION_KEY = '11'.repeat(32)
vi.mock('./models/homePracticePlan.js', () => ({ HomePracticePlan: { findOne: () => ({ sort: () => ({ lean: async () => null }) }) } }))
const mocks = vi.hoisted(() => ({ notified: [] }))
vi.mock('./sessionRecommendations.js', () => ({ notify: async (_db, n) => { mocks.notified.push(n) } }))
const { recommend } = await import('./homeSetRecommend.js')
const { ensureDrafts, draftSections, noteContext, saveReview, redraft, homeNoteSignBlock, recommendationFor, SUBJECTIVE_MARK } = await import('./homeSetDrafts.js')
const { decryptField } = await import('./soapCrypto.js')

const P = new ObjectId(), EMP = { _id: new ObjectId(), first_name: 'Edward', last_name: 'B', email: 'ed@clinic.test' }
const G = ['Money Match', 'Copy the Colors', 'Sort the Basket', 'Puzzle Pals', 'Feed Pao', 'Emergency Ready'].map((name) => ({ _id: new ObjectId(), name, status: 'published', description: `${name} description` }))
const at = (d) => new Date(`2026-${d}T05:00:00Z`)
const play = (g, when, ctx, correct) => ({ _id: new ObjectId(), patient_id: P, game_id: G[g]._id, status: 'completed', context: ctx, completed_at: at(when), result: { correct, attempts: 10, hints_used: 0, duration_seconds: 120 }, reward: { xp_earned: 100, stat_gains: { focus: 1 } } })

let state
function fakeDb() {
  const arr = (rows) => ({ sort: () => arr(rows), toArray: async () => rows })
  const match = (d, q) => Object.entries(q).every(([k, v]) => (v && typeof v === 'object' && '$ne' in v ? String(d[k]) !== String(v.$ne) : v === null ? d[k] == null : String(d[k]) === String(v)))
  const setPath = (o, path, v) => { const p = path.split('.'); let c = o; p.slice(0, -1).forEach((k) => { c[k] = c[k] || {}; c = c[k] }); c[p.at(-1)] = v }
  return {
    collection: (name) => ({
      home_sets: {
        find: () => arr(state.sets), findOne: async (q) => state.sets.find((s) => match(s, q)) || null, countDocuments: async () => state.sets.length,
        updateOne: async (q, u) => {
          const s = state.sets.find((x) => match(x, q)); if (!s) return { modifiedCount: 0 }
          for (const [k, v] of Object.entries(u.$set || {})) setPath(s, k, v)
          for (const [k, v] of Object.entries(u.$push || {})) { const cur = k.split('.').reduce((o, p) => (o ? o[p] : undefined), s) || []; setPath(s, k, [...cur, ...(v.$each || [v])]) }
          return { modifiedCount: 1 }
        },
      },
      patients: { findOne: async () => ({ first_name: 'Rene', last_name: 'B', primary_condition: 'Autism spectrum' }) },
      pao_profiles: { findOne: async () => ({ stats: { intelligence: 10, focus: 10, resistance: 7, creativity: 7, speed: 7, memory: 9 } }) },
      games: { find: (q) => arr(q.status === 'published' ? G : G.filter((g) => !q._id || q._id.$in.some((i) => String(i) === String(g._id)))) },
      home_practice_plans: { find: () => arr([]), findOne: async () => ({ therapist_id: EMP._id }) },
      employees: { findOne: async () => EMP },
      patient_assign: { findOne: async () => ({ employee_id: EMP._id }) },
      game_sessions: { find: () => arr(state.plays), distinct: async () => [...new Set(state.plays.map((p) => p.game_id))] },
      therapy_notes: {
        insertOne: async (d) => { state.notes.push(d) }, findOne: async (q) => state.notes.find((n) => match(n, q)) || null,
        updateOne: async (q, u) => { const n = state.notes.find((x) => match(x, q)); Object.assign(n, u.$set) },
      },
      soap_note_versions: { insertOne: async (d) => { state.versions.push(d) } },
      audit_logs: { insertOne: async () => {} },
    }[name]),
  }
}
const finishedSet = () => ({ _id: new ObjectId(), patient_id: P, set_number: 1, status: 'active', plan_id: null, started_at: at('10-21'), completed_at: null, game_ids: [G[0]._id, G[1]._id, G[2]._id], use_at_home: true, use_in_therapy: true, finished_at: null, soap_draft_id: null })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T00:00:00Z'))
  mocks.notified = []
  state = { sets: [finishedSet()], notes: [], versions: [], plays: [] }
  const acc = [[10, 9, 10], [6, 8, 9], [8, 10, 10]]
  acc.forEach((a, g) => { state.plays.push(play(g, '10-21', 'session', g === 1 ? 4 : 10)); a.forEach((c, i) => state.plays.push(play(g, `10-${24 + i * 3}`, 'home', c))) })
})
afterEach(() => vi.useRealTimers())

describe('recommended next set', () => {
  const finished = [
    { gameId: 'a', name: 'Money Match', playList: [{ accuracy: 100 }, { accuracy: 90 }, { accuracy: 100 }], avg: 97 },
    { gameId: 'b', name: 'Copy the Colors', playList: [{ accuracy: 60 }, { accuracy: 80 }, { accuracy: 90 }], avg: 77 },
    { gameId: 'c', name: 'Sort the Basket', playList: [{ accuracy: 80 }, { accuracy: 100 }, { accuracy: 100 }], avg: 93 },
  ]
  const candidates = G.slice(3).map((g) => ({ ...g }))
  const stats = { intelligence: 10, focus: 10, resistance: 7, creativity: 7, speed: 7, memory: 9 }
  it('picks 2-3 games, each with reasons built from real data', () => {
    const r = recommend({ finished, candidates, stats, first: 'Rene', setNumber: 1, playDays: 6 })
    expect(r.games.length).toBeGreaterThanOrEqual(2)
    expect(r.games.length).toBeLessThanOrEqual(3)
    expect(r.games[0].name).toBe('Puzzle Pals') // builds Resistance, the lowest stat
    expect(r.games[0].reasons.join(' ')).toContain("Resistance is Rene's lowest stat (7 / 100)")
    expect(r.games[0].reasons.join(' ')).toContain('New for Rene')
    expect(r.games.every((g) => g.reasons.length > 0 && g.startAt)).toBe(true)
    expect(r.insights.map((i) => i.text)).toEqual(expect.arrayContaining(['Copy the Colors +30 pts from play 1 to play 3', 'Resistance is lowest (7 / 100)', 'Played on 6 separate days']))
    expect(r.reviewGame.name).toBe('Copy the Colors')
    expect(r.availableText).toContain('stay available to replay')
  })
  it('never invents a reason when the data is missing (no stats, no history)', () => {
    const r = recommend({ finished, candidates, stats: null, first: 'Rene', playedIds: new Set(candidates.map((c) => String(c._id))), setNumber: 1 })
    expect(r.games.flatMap((g) => g.reasons).join(' ')).not.toContain('lowest stat')
    expect(r.games.flatMap((g) => g.reasons).join(' ')).not.toContain('New for')
  })
  it('switching an objective off changes the ranking', () => {
    const objectives = [{ id: 'x', text: 'Everyday routines', supports: ['daily routines', 'safety'], stats: [], on: true }]
    const r = recommend({ finished, candidates, stats: null, first: 'Rene', objectives, setNumber: 1 })
    expect(['Feed Pao', 'Emergency Ready']).toContain(r.games[0].name)
  })
  it('says so when there are not enough games', () => {
    expect(recommend({ finished, candidates: candidates.slice(0, 1), first: 'Rene' }).short).toContain('Not enough new games')
  })
})

describe('auto-drafted SOAP note', () => {
  it('writes the four sections from the data, with the caregiver placeholder and hedged wording', () => {
    const stats = { selected: { playsUsed: 9, playsAllowed: 9, startedAt: at('10-21'), endedAt: at('11-08') }, data: { totals: { home: { plays: 9, accuracy: 88.9, mistakes: 5, hints: 0, minutes: 66 }, session: { plays: 3, accuracy: 91.9 } }, accuracySeries: { home: [{ date: 'a' }, { date: 'b' }] }, perGame: [
      { name: 'Money Match', home: { accuracy: 97 }, playList: [{ accuracy: 100 }, { accuracy: 90 }, { accuracy: 100 }] },
      { name: 'Copy the Colors', home: { accuracy: 77 }, playList: [{ accuracy: 60 }, { accuracy: 80 }, { accuracy: 90 }] }] }, lowest: { label: 'Resistance', value: 7 } }
    const { text, basedOn } = draftSections({ stats, rec: { games: [{ name: 'Puzzle Pals' }, { name: 'Feed Pao' }], reviewGame: null }, first: 'Rene', setNumber: 1 })
    expect(text.subjective.startsWith(SUBJECTIVE_MARK)).toBe(true)
    expect(text.objective).toContain('9 of 9 home plays used across Money Match and Copy the Colors')
    expect(text.objective).toContain('Copy the Colors 60%, 80%, 90%')
    expect(text.assessment).toContain('Copy the Colors rose from 60% to 90% (+30 pts)')
    expect(text.assessment).toContain("Resistance is still Rene's lowest character stat (7 / 100)")
    expect(text.assessment).not.toMatch(/diagnos|will |predict/i)
    expect(text.plan).toContain('Start Set 2 (Puzzle Pals and Feed Pao)')
    expect(basedOn.objective).toContain('9 home plays')
  })
})

describe('finishing a set', () => {
  it('creates the encrypted draft note and the recommendation once, and tells the therapist', async () => {
    const r = await ensureDrafts(fakeDb(), state.sets[0]._id)
    expect(r.created).toBe(true)
    const set = state.sets[0]
    expect(set.finished_at).toBeInstanceOf(Date)
    expect(set.recommendation.games.length).toBeGreaterThanOrEqual(2)
    expect(set.soap_meta.sections.subjective).toMatchObject({ source: 'auto', reviewed: false })
    const note = state.notes[0]
    expect(note).toMatchObject({ note_type: 'home_practice', status: 'draft', patient_id: P, employee_id: EMP._id, diagnosis: 'Autism spectrum' })
    expect(note.objective).toMatch(/^v1\./) // encrypted at rest
    expect(decryptField(note.subjective, String(note._id), 'subjective')).toContain(SUBJECTIVE_MARK)
    expect(mocks.notified[0]).toMatchObject({ email: 'ed@clinic.test', type: 'home_set_finished' })
    // idempotent
    expect((await ensureDrafts(fakeDb(), set._id)).created).toBe(false)
    expect(state.notes).toHaveLength(1)
  })
  it('does nothing while a game still has plays left', async () => {
    state.plays = state.plays.filter((p) => !(p.context === 'home' && String(p.game_id) === String(G[2]._id) && p.completed_at > at('10-24')))
    expect((await ensureDrafts(fakeDb(), state.sets[0]._id)).created).toBe(false)
    expect(state.notes).toHaveLength(0)
  })
})

describe('reviewing and signing', () => {
  const assigned = async () => true
  const open = async () => { await ensureDrafts(fakeDb(), state.sets[0]._id); return String(state.notes[0]._id) }
  it('context lists the sections, play scores and the next set; edits are detected', async () => {
    const noteId = await open()
    const c = await noteContext(fakeDb(), { noteId, employee: EMP, assigned })
    expect(c).toMatchObject({ status: 'draft', setNumber: 1, locked: false, diagnosis: 'Autism spectrum' })
    expect(c.scores.find((s) => s.name === 'Copy the Colors').plays).toEqual([60, 80, 90])
    expect(Object.values(c.sections).every((s) => !s.edited && !s.reviewed)).toBe(true)
  })
  it('stores the review ticks and an edit history', async () => {
    const noteId = await open()
    await saveReview(fakeDb(), { noteId, reviewed: { objective: true }, edited: ['subjective'], employee: EMP, assigned })
    const c = await noteContext(fakeDb(), { noteId, employee: EMP, assigned })
    expect(c.sections.objective.reviewed).toBe(true)
    expect(c.history[0].sections).toEqual(['subjective'])
  })
  it('signing is blocked until the placeholder is replaced and all four sections are reviewed', async () => {
    const noteId = await open()
    const db = fakeDb()
    const note = state.notes[0]
    const value = { subjective: SUBJECTIVE_MARK + ' ...]' }
    expect(await homeNoteSignBlock(db, note, value)).toContain('Replace the highlighted placeholder')
    expect(await homeNoteSignBlock(db, note, { subjective: 'Caregiver says Rene asked to play.' })).toContain('0 of 4 done')
    await saveReview(db, { noteId, reviewed: { subjective: true, objective: true, assessment: true, plan: true }, edited: [], employee: EMP, assigned })
    expect(await homeNoteSignBlock(db, note, { subjective: 'Caregiver says Rene asked to play.' })).toBeNull()
    expect(await homeNoteSignBlock(db, { note_type: 'session' }, {})).toBeNull() // other notes are untouched
  })
  it('redraft keeps what the therapist typed unless asked to replace it', async () => {
    const noteId = await open()
    const note = state.notes[0]
    const { encryptField } = await import('./soapCrypto.js')
    note.subjective = encryptField('Caregiver says Rene asked to play after school.', noteId, 'subjective')
    const kept = await redraft(fakeDb(), { noteId, employee: EMP, assigned })
    expect(kept.text.subjective).toBe('Caregiver says Rene asked to play after school.')
    expect(kept.text.objective).toContain('9 of 9 home plays')
    const replaced = await redraft(fakeDb(), { noteId, replaceEdits: true, employee: EMP, assigned })
    expect(replaced.text.subjective).toContain(SUBJECTIVE_MARK)
  })
  it('the recommendation view needs the drafts to exist and shows whether the note is signed', async () => {
    await expect(recommendationFor(fakeDb(), { setId: String(state.sets[0]._id), employee: EMP, assigned })).rejects.toMatchObject({ status: 409, code: 'SET_NOT_FINISHED' })
    await open()
    const r = await recommendationFor(fakeDb(), { setId: String(state.sets[0]._id), employee: EMP, assigned })
    expect(r.noteSigned).toBe(false)
    state.notes[0].status = 'signed'
    expect((await recommendationFor(fakeDb(), { setId: String(state.sets[0]._id), employee: EMP, assigned })).noteSigned).toBe(true)
  })
})
