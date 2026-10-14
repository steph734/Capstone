// Super Admin "Games" page API (Super Admin checked on the server).
//
//   GET    /api/admin/games/overview        every game + 30-day usage, stats and owner requests
//   POST   /api/admin/games/:id/duplicate   copy a builder game as a new draft
//   DELETE /api/admin/games/:id             { confirmName } delete a game that was never played
//
// Publish / unpublish go through /api/admin/builder/games/:id/publish|unpublish
// (they run the "ready to publish" checklist); approve / decline go through
// /api/admin/game-requests. Every one of those writes an audit_logs row.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { manilaMidnightUtc, weightedAccuracy } from '../ownerGamified.js'
import { serializeRequest } from '../gameRequests.js'
import { sanitizeDoc } from '../builderDoc.js'
import { createDraftGame } from '../gameCreate.js'

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra })

export default async function handler(req, res) {
  const id = req.params?.id
  const action = req.params?.action || ''
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { db, user, ip } = ctx

    // ── Overview ────────────────────────────────────────────────────────
    if (!id) {
      if (req.method !== 'GET') return fail(res, 405, 'Method not allowed')
      const from = manilaMidnightUtc(29)
      const toExclusive = manilaMidnightUtc(-1)
      const [games, sessions, playedAgg, requests] = await Promise.all([
        db.collection('games').find({}, { projection: { 'builder.doc.levels': 0, levels: 0, type_settings: 0, support: 0 } }).toArray(),
        db.collection('game_sessions').find({ status: 'completed', completed_at: { $gte: from, $lt: toExclusive } }, { projection: { game_id: 1, patient_id: 1, result: 1 } }).toArray(),
        db.collection('game_sessions').aggregate([{ $group: { _id: '$game_id', n: { $sum: 1 } } }]).toArray(),
        db.collection('game_requests').find({ status: { $ne: 'withdrawn' } }).sort({ created_at: -1 }).toArray(),
      ])
      const played = new Map(playedAgg.map((p) => [String(p._id), p.n]))
      const completions = await db.collection('game_completions').aggregate([{ $group: { _id: '$game_id', n: { $sum: 1 } } }]).toArray().catch(() => [])
      for (const c of completions) played.set(String(c._id), Math.max(played.get(String(c._id)) || 0, c.n))
      const byGame = new Map()
      for (const s of sessions) { const k = String(s.game_id); if (!byGame.has(k)) byGame.set(k, []); byGame.get(k).push(s) }

      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
      const out = games.map((g) => {
        const k = String(g._id)
        const ss = byGame.get(k) || []
        const acc = weightedAccuracy(ss)
        const published = g.status === 'published'
        return {
          id: k, name: g.name, description: g.description || '',
          skill: g.skill_area || g.therapy_type || 'cognitive', therapyType: g.therapy_type || null,
          difficulty: g.difficulty || 'easy',
          ageRange: g.age_range ? { min: g.age_range.min ?? null, max: g.age_range.max ?? null } : null,
          points: Number(g.points_per_play) || 0, icon: g.icon || null,
          status: g.status || 'draft',
          // never published = Draft; published once and hidden again = Unpublished
          state: published ? 'published' : g.published_at ? 'unpublished' : 'draft',
          builtIn: !g.builder?.doc,
          usage: { plays: ss.length, accuracy: acc === null ? null : Math.round(acc), patients: new Set(ss.map((s) => String(s.patient_id))).size },
          everPlayed: played.get(k) || 0,
          createdAt: g.created_at || null, updatedAt: g.updated_at || null,
        }
      })
      return res.status(200).json({
        games: out,
        stats: {
          total: out.length,
          addedThisMonth: games.filter((g) => g.created_at && g.created_at >= monthStart).length,
          published: out.filter((g) => g.state === 'published').length,
          notPublished: out.filter((g) => g.state !== 'published').length,
        },
        requests: requests.map((r) => serializeRequest(r, { ownerName: r.owner_name })),
      })
    }

    if (!ObjectId.isValid(id)) return fail(res, 400, 'Invalid game id.')
    const _id = new ObjectId(id)
    const game = await db.collection('games').findOne({ _id })
    if (!game) return fail(res, 404, 'Game not found.')

    // ── Duplicate ───────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'duplicate') {
      if (!game.builder?.doc) return fail(res, 409, 'Built-in games have no builder layout to copy.')
      const doc = sanitizeDoc(game.builder.doc)
      let name = `${game.name} (copy)`.slice(0, 80)
      for (let n = 2; await db.collection('games').findOne({ name }); n += 1) name = `${game.name.slice(0, 70)} (copy ${n})`
      doc.meta.name = name
      doc.meta.testPlayed = false
      const made = await createDraftGame(db, user, doc, { note: `Duplicated from ${game.name}` })
      await audit(db, { user, action: 'game_duplicate', ip, meta: { gameId: String(made.id), name, from: id } })
      return res.status(201).json({ id: String(made.id), name })
    }

    // ── Delete (only a game nobody ever played) ─────────────────────────
    if (req.method === 'DELETE' && !action) {
      if (!game.builder?.doc) return fail(res, 409, 'Built-in games can be unpublished but not deleted.', { code: 'BUILT_IN' })
      const plays = await db.collection('game_sessions').countDocuments({ game_id: _id })
      const done = await db.collection('game_completions').countDocuments({ game_id: _id }).catch(() => 0)
      if (plays + done > 0) return fail(res, 409, `This game has been played ${Math.max(plays, done)} time${Math.max(plays, done) === 1 ? '' : 's'}. Unpublish it instead so patients keep their scores and history.`, { code: 'PLAYED', plays: Math.max(plays, done) })
      if (String(req.body?.confirmName || '') !== game.name) return fail(res, 400, 'Type the game’s exact name to confirm.', { code: 'CONFIRM' })
      await db.collection('games').deleteOne({ _id })
      await db.collection('game_versions').deleteMany({ game_id: _id })
      if (game.unlocks_badge_id) {
        const badge = await db.collection('badges').findOne({ _id: game.unlocks_badge_id })
        if (badge && !(await db.collection('patient_badges').findOne({ badge_code: badge.code }))) await db.collection('badges').deleteOne({ _id: badge._id })
      }
      await audit(db, { user, action: 'game_delete', ip, meta: { gameId: id, name: game.name } })
      return res.status(200).json({ ok: true })
    }

    return fail(res, 404, 'Not found.')
  } catch (err) {
    console.error('admin/games error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
