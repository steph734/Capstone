// GET   /api/admin/game-requests?email=   -> every owner request (Super Admin only)
// PATCH /api/admin/game-requests/:id      -> { email, status?, message? }: approve / decline /
//        move along / reply. Records the reply and notifies the owner (in-app + email).
import { getMongo } from '../mongo.js'
import { requireRole, serializeRequest, applyRequestUpdate, oid, SKILL_THERAPY_TYPE } from '../gameRequests.js'

const adminShape = (d) => serializeRequest(d, {
  ownerName: d.owner_name,
  ownerEmail: d.owner_email,
  therapyType: SKILL_THERAPY_TYPE[d.skill] || 'Cognitive',
})

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireRole(req, res, ['Super Admin'])
    if (!ctx) return
    const { db, user } = ctx

    if (req.method === 'GET') {
      const docs = await db.collection('game_requests').find({ status: { $ne: 'withdrawn' } }).sort({ created_at: -1 }).toArray()
      return res.status(200).json({ requests: docs.map(adminShape) })
    }

    const _id = oid(req.params?.id)
    if (!_id) return res.status(400).json({ error: 'Invalid request id.' })
    const status = req.body?.status ? String(req.body.status) : null
    const updated = await applyRequestUpdate(db, _id, { status, message: req.body?.message, adminName: user.full_name || 'Super Admin' })
    return res.status(200).json({ request: adminShape(updated) })
  } catch (err) {
    console.error('admin/game-requests error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not update the request.' })
  }
}
