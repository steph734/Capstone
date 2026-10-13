// GET  /api/notifications?email=           -> the caller's latest in-app notifications + unread count
// POST /api/notifications  { email, ids? } -> mark some (or, without ids, all) as read
// Scoped to the caller's own email; no other account's notifications are ever returned.
import { getMongo, getDb } from '../mongo.js'
import { oid } from '../gameRequests.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const email = String((req.method === 'GET' ? req.query.email : req.body?.email) || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })
  try {
    await getMongo()
    const db = await getDb()
    const col = db.collection('notifications')
    if (req.method === 'GET') {
      const [docs, unread] = await Promise.all([
        col.find({ recipient_email: email }).sort({ created_at: -1 }).limit(30).toArray(),
        col.countDocuments({ recipient_email: email, read: false }),
      ])
      return res.status(200).json({
        unread,
        notifications: docs.map((n) => ({ id: String(n._id), type: n.type, title: n.title, body: n.body, link: n.link || null, read: !!n.read, createdAt: n.created_at })),
      })
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(oid).filter(Boolean) : null
    await col.updateMany({ recipient_email: email, read: false, ...(ids ? { _id: { $in: ids } } : {}) }, { $set: { read: true } })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('notifications error:', err)
    return res.status(500).json({ error: err.message || 'Could not load notifications.' })
  }
}
