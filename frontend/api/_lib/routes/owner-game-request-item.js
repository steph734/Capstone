// PATCH /api/owner/game-requests/:id  { email, action: 'withdraw' }  -> withdraw a pending request
// PATCH /api/owner/game-requests/:id  { email, ...fields }           -> edit a pending request
// GET   /api/owner/game-requests/:id/file?email=                      -> download the attachment
// Only the request's owner, and only while it is still pending.
import { getMongo } from '../mongo.js'
import { requireRole, validateRequestInput, serializeRequest, oid } from '../gameRequests.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'GET') {
    res.setHeader('Allow', 'PATCH, GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const _id = oid(req.params?.id)
  if (!_id) return res.status(400).json({ error: 'Invalid request id.' })
  try {
    await getMongo()
    const ctx = await requireRole(req, res, req.method === 'GET' ? ['Owner', 'Super Admin'] : ['Owner'])
    if (!ctx) return
    const { db, user } = ctx
    const request = await db.collection('game_requests').findOne({ _id })
    if (!request || (user.role === 'Owner' && String(request.owner_user_id) !== String(user._id))) {
      return res.status(404).json({ error: 'Request not found.' })
    }

    if (req.method === 'GET') {
      const file = await db.collection('game_request_files').findOne({ request_id: _id })
      if (!file) return res.status(404).json({ error: 'No attachment on this request.' })
      res.setHeader('Content-Type', file.type)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.status(200).send(Buffer.from(file.data.buffer))
    }

    if (request.status !== 'pending') return res.status(409).json({ error: 'Only a pending request can be changed.' })

    if (req.body?.action === 'withdraw') {
      await db.collection('game_requests').updateOne({ _id }, { $set: { status: 'withdrawn', updated_at: new Date() } })
      return res.status(200).json({ ok: true })
    }

    const { errors, value } = validateRequestInput(req.body || {})
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors })
    await db.collection('game_requests').updateOne({ _id }, { $set: { ...value, updated_at: new Date() } })
    return res.status(200).json({ request: serializeRequest(await db.collection('game_requests').findOne({ _id })) })
  } catch (err) {
    console.error('owner/game-requests/:id error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not update the request.' })
  }
}
