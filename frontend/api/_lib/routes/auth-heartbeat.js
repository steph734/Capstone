// POST /api/auth/heartbeat  (Bearer token) -> "the user is still here". Used by "Stay logged in" and by the periodic
// activity ping. It goes through requireSession, so a session that is already past the idle limit gets 401 SESSION_IDLE.
import { getMongo } from '../mongo.js'
import { requireSession, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '../session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const now = new Date()
    await ctx.db.collection('sessions').updateOne({ _id: ctx.session._id }, { $set: { last_seen: now } }) // always written: this IS the activity
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ ok: true, idle_expires_at: new Date(now.getTime() + IDLE_TIMEOUT_MS + IDLE_WARNING_MS).toISOString() })
  } catch (err) {
    console.error('auth/heartbeat error:', err)
    return res.status(500).json({ error: 'Could not refresh your session.' })
  }
}
