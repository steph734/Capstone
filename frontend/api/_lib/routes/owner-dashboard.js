import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { buildOwnerDashboard } from '../ownerDashboard.js'

// GET /api/owner/dashboard -> every figure on the Owner dashboard, from MongoDB. Owner / Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner', 'Super Admin'] })
    if (!ctx) return
    res.setHeader('Cache-Control', 'no-store')
    return res.json(await buildOwnerDashboard(ctx.db))
  } catch (err) {
    console.error('owner dashboard error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load the dashboard.' })
  }
}
