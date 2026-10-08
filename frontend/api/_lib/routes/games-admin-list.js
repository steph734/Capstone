import mongoose from 'mongoose'
import { Int32 } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'
import { Badge } from '../models/badge.js'

// GET  /api/games -> every game in the `games` collection (drafts, published
//      and archived), for the admin Games library. The published-only picker
//      list lives at /api/games/list.
// POST /api/games -> creates a new draft game, and its matching
//      "complete this game" badge, in one go (see createGameBadge below).
const str = (v) => (v == null ? '' : String(v).trim())

function slugify(name) {
  const base = str(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
  return base || 'badge'
}

async function uniqueBadgeCode(base) {
  let code = base
  let n = 2
  while (await Badge.exists({ code })) {
    code = `${base}_${n}`
    n += 1
  }
  return code
}

// Every new game gets its own "finish this game" badge automatically, named
// after the game, so admins don't have to remember to add one by hand.
async function createGameBadge(gameName, gameId, createdBy, session) {
  const code = await uniqueBadgeCode(slugify(gameName))
  const [badge] = await Badge.create([{
    code,
    name: gameName,
    description: `Finishes ${gameName}.`,
    emoji: '🏅',
    art: { shape: 'circle', color: 'gold', symbol: 'star', banner: false },
    criteria: { type: 'complete_specific_game', game_id: gameId, value: new Int32(1) },
    is_active: true,
    created_by: createdBy || null,
  }], { session })
  return badge
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const db = await getDb()

    if (req.method === 'GET') {
      const docs = await db.collection('games').find({}).sort({ name: 1 }).toArray()
      return res.status(200).json({
        games: docs.map((d) => ({
          id: String(d._id),
          name: d.name,
          description: d.description || '',
          therapyType: d.therapy_type || null,
          difficulty: d.difficulty || null,
          gameType: d.game_type || null,
          pointsPerPlay: Number(d.points_per_play) || 0,
          status: d.status || 'draft',
          testPlayed: !!d.test_played,
        })),
      })
    }

    // POST: create the game, then its badge, then link them together.
    const body = req.body || {}
    const name = str(body.name)
    if (!name) return res.status(400).json({ error: 'Name is required.' })

    let createdBy = mongoose.isValidObjectId(body.createdBy) ? new mongoose.Types.ObjectId(body.createdBy) : null
    if (!createdBy) {
      // games.created_by is required and must be a real user — fall back to
      // any admin account rather than failing the whole save over it.
      const admin = (await db.collection('users').findOne({ role: 'Super Admin' })) || (await db.collection('users').findOne({}))
      if (!admin) return res.status(400).json({ error: 'No admin user found to record as the creator.' })
      createdBy = admin._id
    }
    const now = new Date()

    const session = await mongoose.startSession()
    try {
      let gameId = null
      await session.withTransaction(async () => {
        const insertResult = await db.collection('games').insertOne({
          name,
          description: str(body.description) || null,
          therapy_type: str(body.therapyType) || null,
          difficulty: str(body.difficulty) || 'easy',
          game_type: str(body.gameType) || null,
          points_per_play: new Int32(Number(body.pointsPerPlay) || 0),
          status: 'draft',
          test_played: false,
          created_by: createdBy,
          updated_by: createdBy,
          published_at: null,
          created_at: now,
          updated_at: now,
        }, { session })
        gameId = insertResult.insertedId

        const badge = await createGameBadge(name, gameId, createdBy, session)
        await db.collection('games').updateOne({ _id: gameId }, { $set: { unlocks_badge_id: badge._id } }, { session })
      })
      return res.status(201).json({ id: String(gameId) })
    } finally {
      await session.endSession()
    }
  } catch (err) {
    console.error('games (admin list) error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the game.' })
  }
}
