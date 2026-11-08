// GET /api/clinic/plan -> the clinic's plan tier (the Owner's subscription) for any signed-in user.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { clinicTierInfo } from '../clinicPlan.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Patient', 'Therapist', 'Owner', 'Super Admin'], idle: false })
    if (!ctx) return
    const { tier, why } = await clinicTierInfo(ctx.db)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ tier, gamified: tier === 'gold', why })
  } catch (err) {
    console.error('clinic/plan error:', err.message)
    return res.status(500).json({ error: 'Could not check the plan.' })
  }
}
