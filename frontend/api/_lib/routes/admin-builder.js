// Game Builder API — Super Admin only (checked on the server from the session).
//
//   GET  /api/admin/builder/games/:id             load a game's builder document + history list
//   POST /api/admin/builder/games                 create (first autosave of a new game)
//   PUT  /api/admin/builder/games/:id             save { doc, baseVersion, kind: 'autosave' | 'draft' }
//   POST /api/admin/builder/games/:id/publish     publish (blocked until the checklist passes)
//   POST /api/admin/builder/games/:id/unpublish   hide it again (patient history is kept)
//   POST /api/admin/builder/games/:id/restore     { version } make an older version current
//   POST /api/admin/builder/games/:id/test-played record that a test play was completed
//
// The document is stored on the game as `builder: { version, doc }` and its
// meta is mirrored onto the columns the rest of the app already reads. Every
// manual save / publish / restore keeps a full copy in `game_versions`.
import { ObjectId, Int32 } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { applyRequestUpdate } from '../gameRequests.js'
import { sanitizeDoc, checklist, gameFields, blankDoc } from '../builderDoc.js'
import { createDraftGame } from '../gameCreate.js'
import { audit } from '../noteAccess.js'

const CHECKPOINT_MS = 10 * 60 * 1000
const MAX_VERSIONS = 100
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra })

async function addVersion(db, gameId, version, kind, doc, userId, note = null) {
  await db.collection('game_versions').insertOne({ game_id: gameId, version, kind, doc, saved_by: userId, saved_at: new Date(), note })
  const total = await db.collection('game_versions').countDocuments({ game_id: gameId })
  if (total > MAX_VERSIONS) {
    const old = await db.collection('game_versions').find({ game_id: gameId, kind: 'autosave' }).sort({ saved_at: 1 }).limit(total - MAX_VERSIONS).project({ _id: 1 }).toArray()
    if (old.length) await db.collection('game_versions').deleteMany({ _id: { $in: old.map((o) => o._id) } })
  }
}

// A game built from an owner's request moves that request along (and notifies the owner).
async function advanceRequest(db, requestId, to, message) {
  if (!requestId) return
  try {
    const reqDoc = await db.collection('game_requests').findOne({ _id: requestId })
    if (!reqDoc) return
    if (to === 'dev' && reqDoc.status === 'approved') await applyRequestUpdate(db, requestId, { status: 'dev', message })
    if (to === 'live') {
      if (reqDoc.status === 'approved') await applyRequestUpdate(db, requestId, { status: 'dev' })
      const cur = await db.collection('game_requests').findOne({ _id: requestId })
      if (cur && cur.status === 'dev') await applyRequestUpdate(db, requestId, { status: 'live', message })
    }
  } catch (err) {
    console.error('advancing request failed:', err.message)
  }
}

export default async function handler(req, res) {
  const action = req.params?.action || ''
  const idParam = req.params?.id
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { db, user } = ctx
    const body = req.body || {}

    // ── Create ──────────────────────────────────────────────────────────
    if (!idParam) {
      if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')
      const doc = sanitizeDoc(body.doc || blankDoc())
      const sourceId = ObjectId.isValid(body.sourceRequestId) ? new ObjectId(String(body.sourceRequestId)) : null
      const made = await createDraftGame(db, user, doc, { sourceId })
      return res.status(201).json({ id: String(made.id), version: made.version, savedAt: made.savedAt })
    }

    if (!ObjectId.isValid(idParam)) return fail(res, 400, 'Invalid game id.')
    const _id = new ObjectId(idParam)
    const game = await db.collection('games').findOne({ _id })
    if (!game) return fail(res, 404, 'Game not found.')
    const legacy = !game.builder?.doc
    const version = game.builder?.version || 0

    // ── Load ────────────────────────────────────────────────────────────
    if (req.method === 'GET' && !action) {
      const rows = await db.collection('game_versions').find({ game_id: _id }, { projection: { doc: 0 } }).sort({ version: -1 }).limit(60).toArray()
      const people = await db.collection('users').find({ _id: { $in: rows.map((r) => r.saved_by).filter(Boolean) } }, { projection: { full_name: 1 } }).toArray()
      const nameBy = new Map(people.map((p) => [String(p._id), p.full_name]))
      const seeded = legacy ? sanitizeDoc({
        meta: { name: game.name, description: game.description || '', therapyType: game.therapy_type, difficulty: game.difficulty, ageMin: game.age_range?.min ?? null, ageMax: game.age_range?.max ?? null, pointsPerPlay: game.points_per_play, therapistNote: game.therapist_note || '' },
        levels: [{ id: 'lv1', title: 'Level 1', elements: [] }],
      }) : game.builder.doc
      return res.status(200).json({
        game: { id: idParam, name: game.name, status: game.status, testPlayed: !!game.test_played, legacy, sourceRequestId: game.source_request_id ? String(game.source_request_id) : null },
        doc: seeded, version,
        versions: rows.map((r) => ({ version: r.version, kind: r.kind, savedAt: r.saved_at, by: nameBy.get(String(r.saved_by)) || 'Unknown', note: r.note })),
      })
    }

    // ── Save ────────────────────────────────────────────────────────────
    if (req.method === 'PUT' && !action) {
      if (legacy && body.allowLegacyMeta !== true) return fail(res, 409, 'This is a built-in game: only its details can be changed here.', { code: 'LEGACY' })
      if (Number.isFinite(Number(body.baseVersion)) && Number(body.baseVersion) !== version) {
        return fail(res, 409, 'This game was changed somewhere else. Reload to get the latest version.', { code: 'STALE', version })
      }
      const doc = sanitizeDoc(body.doc)
      const kind = body.kind === 'draft' ? 'draft' : 'autosave'
      const now = new Date()
      const next = version + 1
      const set = { ...gameFields(doc), updated_by: user._id, updated_at: now }
      if (legacy) { delete set.game_type } // a built-in game keeps its own type
      else set['builder'] = { version: next, doc }
      if (game.status === 'published') set.status = 'published'
      await db.collection('games').updateOne({ _id }, { $set: set })
      const last = await db.collection('game_versions').findOne({ game_id: _id }, { sort: { saved_at: -1 }, projection: { saved_at: 1 } })
      if (!legacy && (kind === 'draft' || !last || now - last.saved_at > CHECKPOINT_MS)) await addVersion(db, _id, next, kind === 'draft' ? 'draft' : 'autosave', doc, user._id)
      return res.status(200).json({ version: legacy ? version : next, savedAt: now })
    }

    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')

    if (action === 'test-played') {
      await db.collection('games').updateOne({ _id }, { $set: { test_played: true, updated_at: new Date() } })
      return res.status(200).json({ ok: true })
    }

    if (action === 'publish') {
      if (!legacy) {
        const result = checklist(sanitizeDoc(game.builder.doc), { testPlayed: !!game.test_played })
        if (!result.ready) return fail(res, 400, 'This game is not ready to publish yet.', { checklist: result })
      }
      const now = new Date()
      await db.collection('games').updateOne({ _id }, { $set: { status: 'published', published_at: now, updated_by: user._id, updated_at: now } })
      if (!legacy) await addVersion(db, _id, version, 'publish', game.builder.doc, user._id)
      await audit(db, { user, action: 'game_publish', ip: ctx.ip, meta: { gameId: idParam, name: game.name } })
      await advanceRequest(db, game.source_request_id, 'live', `"${game.name}" is now live in the Activity Library.`)
      return res.status(200).json({ ok: true, status: 'published' })
    }

    if (action === 'unpublish') {
      // Hidden from patients and therapists; sessions, scores and badges already earned stay.
      await db.collection('games').updateOne({ _id }, { $set: { status: 'draft', updated_by: user._id, updated_at: new Date() } })
      await audit(db, { user, action: 'game_unpublish', ip: ctx.ip, meta: { gameId: idParam, name: game.name } })
      return res.status(200).json({ ok: true, status: 'draft' })
    }

    if (action === 'restore') {
      if (legacy) return fail(res, 409, 'This game has no builder history.')
      const row = await db.collection('game_versions').findOne({ game_id: _id, version: Number(body.version) })
      if (!row) return fail(res, 404, 'That version no longer exists.')
      const doc = sanitizeDoc(row.doc)
      const now = new Date()
      const next = version + 1
      await db.collection('games').updateOne({ _id }, { $set: { ...gameFields(doc), builder: { version: next, doc }, updated_by: user._id, updated_at: now } })
      await addVersion(db, _id, next, 'restore', doc, user._id, `Restored version ${row.version}`)
      return res.status(200).json({ version: next, doc, savedAt: now })
    }

    return fail(res, 404, 'Not found.')
  } catch (err) {
    console.error('admin/builder error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
