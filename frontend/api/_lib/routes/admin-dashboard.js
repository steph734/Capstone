import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { buildDashboard, parseRange } from '../adminDashboard.js'

// GET /api/admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
// Everything the Super Admin dashboard shows, in one response. Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const range = parseRange(req.query)
    if (range.error) return res.status(400).json({ error: range.error })
    res.setHeader('Cache-Control', 'no-store')
    return res.json(await buildDashboard(ctx.db, range))
  } catch (err) {
    console.error('admin dashboard error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load the dashboard.' })
  }
}
