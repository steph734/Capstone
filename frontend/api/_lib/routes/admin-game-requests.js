// GET   /api/admin/game-requests?email=   -> every owner request (Super Admin only)
// PATCH /api/admin/game-requests/:id      -> { email, status?, message? }: approve / decline /
//        move along / reply. Records the reply and notifies the owner (in-app + email).
import { getMongo } from '../mongo.js'
import { serializeRequest, applyRequestUpdate, oid, SKILL_THERAPY_TYPE } from '../gameRequests.js'
import { audit } from '../noteAccess.js'
import { requireSession } from '../session.js'
import { sanitizeDoc, blankDoc } from '../builderDoc.js'
import { createDraftGame } from '../gameCreate.js'

// Request skill -> the builder's skill area.
const SKILL_AREA = { speech: 'speech', cognitive: 'cognitive', sel: 'sel', gross_motor: 'physical', fine_motor: 'occupational' }

const adminShape = (d) => serializeRequest(d, {
  ownerName: d.owner_name,
  ownerEmail: d.owner_email,
  therapyType: SKILL_THERAPY_TYPE[d.skill] || 'Cognitive',
})

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PATCH, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    // Identity comes from the signed session token, never from an email in the request.
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { db, user, ip } = ctx

    if (req.method === 'GET') {
      const docs = await db.collection('game_requests').find({ status: { $ne: 'withdrawn' } }).sort({ created_at: -1 }).toArray()
      return res.status(200).json({ requests: docs.map(adminShape) })
    }

    const _id = oid(req.params?.id)
    if (!_id) return res.status(400).json({ error: 'Invalid request id.' })

    // Approve, create a draft game prefilled from the request, hand back its id.
    if (req.params?.action === 'approve-build' && req.method === 'POST') {
      const r = await db.collection('game_requests').findOne({ _id })
      if (!r) return res.status(404).json({ error: 'Request not found.' })
      if (r.linked_game_id) return res.status(200).json({ gameId: String(r.linked_game_id), existing: true })
      if (r.status === 'pending') {
        await applyRequestUpdate(db, _id, { status: 'approved', adminName: user.full_name || 'Super Admin' })
        await audit(db, { user, action: 'request_approve', ip, meta: { requestId: String(_id), name: r.name } })
      } else if (r.status !== 'approved') {
        return res.status(409).json({ error: 'Only a pending or approved request can be built.' })
      }
      const area = SKILL_AREA[r.skill] || 'cognitive'
      const doc = sanitizeDoc({
        ...blankDoc(),
        meta: { name: r.name, description: r.reason, therapyType: area, difficulty: 'easy', ageMin: r.age_min, ageMax: r.age_max, pointsPerPlay: 100 },
        levels: [{ id: 'lv1', title: 'Level 1', elements: [] }],
      })
      const made = await createDraftGame(db, user, doc, { sourceId: _id, note: 'Created from an owner request' })
      await audit(db, { user, action: 'game_create', ip, meta: { gameId: String(made.id), name: r.name, fromRequest: String(_id) } })
      return res.status(201).json({ gameId: String(made.id) })
    }
    if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })
    const status = req.body?.status ? String(req.body.status) : null
    const updated = await applyRequestUpdate(db, _id, { status, message: req.body?.message, adminName: user.full_name || 'Super Admin' })
    if (status === 'approved' || status === 'declined') await audit(db, { user, action: status === 'approved' ? 'request_approve' : 'request_decline', ip, meta: { requestId: String(_id), name: updated.name, ...(status === 'declined' ? { reason: String(req.body?.message || '').slice(0, 300) } : {}) } })
    return res.status(200).json({ request: adminShape(updated) })
  } catch (err) {
    console.error('admin/game-requests error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not update the request.' })
  }
}
