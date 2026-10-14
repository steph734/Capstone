// Creating a draft game (and its "finish this game" badge). Shared by the Game
// Builder's first autosave, "Approve & build" on an owner request, and
// Duplicate on the Games page.
import { ObjectId, Int32 } from 'mongodb'
import { Badge } from './models/badge.js'
import { applyRequestUpdate } from './gameRequests.js'
import { gameFields } from './builderDoc.js'

const slugify = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'badge'

export async function createGameBadge(name, gameId, userId) {
  let code = slugify(name)
  for (let n = 2; await Badge.exists({ code }); n += 1) code = `${slugify(name)}_${n}`
  return Badge.create({
    code, name, description: `Finishes ${name}.`, emoji: '🏅',
    art: { shape: 'circle', color: 'gold', symbol: 'star', banner: false },
    criteria: { type: 'complete_specific_game', game_id: gameId, value: new Int32(1) },
    is_active: true, created_by: userId || null,
  })
}

// Inserts a draft game from a builder document and records version 1.
export async function createDraftGame(db, user, doc, { sourceId = null, note = null } = {}) {
  const now = new Date()
  const _id = new ObjectId()
  const badge = await createGameBadge(doc.meta.name, _id, user._id)
  await db.collection('games').insertOne({
    _id, ...gameFields(doc), status: 'draft', test_played: false, source_request_id: sourceId,
    unlocks_badge_id: badge._id, builder: { version: 1, doc }, created_by: user._id, updated_by: user._id,
    published_at: null, created_at: now, updated_at: now,
  })
  await db.collection('game_versions').insertOne({ game_id: _id, version: 1, kind: 'create', doc, saved_by: user._id, saved_at: now, note })
  if (sourceId) {
    await db.collection('game_requests').updateOne({ _id: sourceId }, { $set: { linked_game_id: _id } })
    try {
      const r = await db.collection('game_requests').findOne({ _id: sourceId })
      if (r?.status === 'approved') await applyRequestUpdate(db, sourceId, { status: 'dev', message: 'We have started building this game.' })
    } catch (err) {
      console.error('advancing request failed:', err.message)
    }
  }
  return { id: _id, version: 1, savedAt: now }
}
