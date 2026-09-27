import { getMongo } from '../mongo.js'
import { Badge } from '../models/badge.js'
import { serializeBadge } from '../serializeBadge.js'

// GET /api/badges/list -> every badge (active and hidden) for the admin
// Badges page — patients only ever see the active ones, but the admin view
// needs both to manage the library.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const badges = await Badge.find({}).sort({ sort_order: 1, created_at: 1 }).lean()
    return res.status(200).json({ badges: badges.map(serializeBadge) })
  } catch (err) {
    console.error('badges/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load badges.' })
  }
}
