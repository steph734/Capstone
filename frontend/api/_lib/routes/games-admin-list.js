import { getMongo, getDb } from '../mongo.js'

// GET /api/games -> every game in the `games` collection (drafts, published
// and archived), for the admin Games library. The published-only picker list
// lives at /api/games/list.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const db = await getDb()
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
  } catch (err) {
    console.error('games (admin list) error:', err)
    return res.status(500).json({ error: err.message || 'Could not load games.' })
  }
}
