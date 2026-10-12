// GET /api/owner/gamified/overview?email=&branch=&therapist=&range=7|30|90
// -> owner-only gamification overview across all branches (or one branch /
// therapist). Role is checked server-side against the users collection.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { requireOwner, buildOverview } from '../ownerGamified.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireOwner(req, res)
    if (!ctx) return
    const days = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30
    const branchId = mongoose.isValidObjectId(req.query.branch) ? String(req.query.branch) : ''
    const therapistId = mongoose.isValidObjectId(req.query.therapist) ? String(req.query.therapist) : ''
    return res.status(200).json(await buildOverview(ctx.db, { branchId, therapistId, days }))
  } catch (err) {
    console.error('owner/gamified/overview error:', err)
    return res.status(500).json({ error: err.message || 'Could not load stats.' })
  }
}
