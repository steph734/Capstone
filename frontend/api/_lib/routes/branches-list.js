// GET /api/branches -> active branches, for populating Branch dropdowns.
import { getMongo } from '../mongo.js'
import { Branch } from '../models/branch.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const branches = await Branch.find({ status: 'Active' }).sort({ branch_name: 1 }).lean()
    res.json({ branches: branches.map((b) => ({ id: b._id.toString(), branch_name: b.branch_name })) })
  } catch (err) {
    console.error('list branches error:', err)
    res.status(500).json({ error: 'Could not load branches.' })
  }
}
