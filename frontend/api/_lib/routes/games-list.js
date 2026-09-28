import { getMongo, getDb } from '../mongo.js'

// GET /api/games/list -> published games, for "which game" pickers (badge
// criteria, wardrobe-item unlock conditions). Read-only, so this talks to
// the `games` collection with the native driver rather than a Mongoose
// model — its own $jsonSchema validator (built by the games-editor side of
// the app) is a lot larger than anything this endpoint needs to enforce.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const docs = await db.collection('games')
      .find({ status: 'published' })
      .project({ name: 1, therapy_type: 1, difficulty: 1 })
      .sort({ name: 1 })
      .toArray()

    return res.status(200).json({
      games: docs.map((d) => ({
        id: String(d._id),
        name: d.name,
        therapyType: d.therapy_type || null,
        difficulty: d.difficulty || null,
      })),
    })
  } catch (err) {
    console.error('games/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load games.' })
  }
}
