import { getMongo, getDb } from '../mongo.js'

// GET /api/games/by-name?name=Money%20Match -> one game's full playable
// definition (levels, zones, support settings) plus its badge name, for the
// generic game screens. Drafts are returned too, so a game can be test played
// before it is published; `status` tells the client which it is.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const name = String(req.query.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Missing name.' })

  try {
    await getMongo()
    const db = await getDb()
    const g = await db.collection('games').findOne({ name })
    if (!g) return res.status(404).json({ error: 'Game not found.' })

    const badge = g.unlocks_badge_id ? await db.collection('badges').findOne({ _id: g.unlocks_badge_id }) : null

    return res.status(200).json({
      game: {
        id: String(g._id),
        name: g.name,
        description: g.description || '',
        gameType: g.game_type || null,
        therapyType: g.therapy_type || null,
        pointsPerPlay: Number(g.points_per_play) || 100,
        statGains: g.stat_gains || {},
        badge: badge ? { code: badge.code, name: badge.name, emoji: badge.emoji || null } : null,
        typeSettings: g.type_settings || {},
        levels: g.levels || [],
        support: g.support || {},
        status: g.status,
      },
    })
  } catch (err) {
    console.error('games/by-name error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the game.' })
  }
}
