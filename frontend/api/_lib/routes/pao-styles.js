// GET /api/pao/styles -> active, non-archived poses and expressions
// (24 rows), ordered by type then sort_order.
import { getMongo, getDb } from '../mongo.js'
import { listActiveStyles } from '../paoStyles.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const db = await getDb()
    const items = await listActiveStyles(db)
    res.setHeader('Cache-Control', 'private, max-age=300')
    return res.status(200).json({ items })
  } catch (err) {
    console.error('pao/styles error:', err)
    return res.status(500).json({ error: err.message || 'Could not load poses and expressions.' })
  }
}
