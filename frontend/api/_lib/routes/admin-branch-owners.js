import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

// GET /api/admin/branch-owners -> Owner accounts the Super Admin can assign to a branch.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const users = await ctx.db.collection('users')
      .find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { full_name: 1, email: 1 } })
      .sort({ full_name: 1 }).toArray()
    return res.json({ owners: users.map((u) => ({ id: String(u._id), name: u.full_name, email: u.email })) })
  } catch (err) {
    console.error('branch owners error:', err)
    return res.status(500).json({ error: 'Could not load owners.' })
  }
}
