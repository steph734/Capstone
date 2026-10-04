import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'

// /api/games/:gameId for the admin Games library.
//   GET   -> one game
//   PATCH -> update its status (draft / published / archived) and basic fields
// Deleting games is not supported here yet.
const STATUSES = ['draft', 'published', 'archived']

export default async function handler(req, res) {
  const gameId = String(req.params?.gameId || '')
  if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ error: 'Invalid game id.' })

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const _id = new mongoose.Types.ObjectId(gameId)

    if (req.method === 'GET') {
      const d = await db.collection('games').findOne({ _id })
      if (!d) return res.status(404).json({ error: 'Game not found.' })
      return res.status(200).json({
        game: {
          id: String(d._id), name: d.name, description: d.description || '', therapyType: d.therapy_type || null,
          difficulty: d.difficulty || null, gameType: d.game_type || null, pointsPerPlay: Number(d.points_per_play) || 0,
          status: d.status || 'draft', testPlayed: !!d.test_played,
        },
      })
    }

    const body = req.body || {}
    const set = { updated_at: new Date() }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: 'Status must be draft, published or archived.' })
      set.status = body.status
      if (body.status === 'published') set.published_at = new Date()
    }
    if (typeof body.name === 'string' && body.name.trim()) set.name = body.name.trim()
    if (typeof body.description === 'string') set.description = body.description
    if (body.pointsPerPlay !== undefined && Number.isFinite(Number(body.pointsPerPlay))) set.points_per_play = Number(body.pointsPerPlay)

    const result = await db.collection('games').updateOne({ _id }, { $set: set })
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Game not found.' })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('games (admin item) error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the game.' })
  }
}
