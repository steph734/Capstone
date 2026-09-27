import { getMongo } from '../mongo.js'
import { PaoHair } from '../models/paoHair.js'
import { serializePaoHair } from '../serializePaoHair.js'

// GET /api/pao-hair/list -> every hairstyle Pao can wear. No built-in
// seed here (unlike pao_items) — every hairstyle in this collection was
// designed by an admin, there's no hand-drawn "original" hair art.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const items = await PaoHair.find({}).sort({ sort_order: 1, created_at: 1 }).lean()
    return res.status(200).json({ items: items.map(serializePaoHair) })
  } catch (err) {
    console.error('pao-hair/list error:', err)
    return res.status(500).json({ error: err.message || "Could not load Pao's hairstyles." })
  }
}
