// POST /api/auth/reauth { password }  (Bearer token) -> re-enter the password
// to unlock a session that went idle. Wrong passwords count toward the lock.
// POST /api/auth/logout               (Bearer token) -> revoke this session.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { checkPasswordReentry } from '../passwordCheck.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { idle: false })
    if (!ctx) return
    const { db, user, session } = ctx
    if (String(req.url).includes('logout')) {
      await db.collection('sessions').updateOne({ _id: session._id }, { $set: { revoked: true, revoked_at: new Date() } })
      return res.status(200).json({ ok: true })
    }
    const check = await checkPasswordReentry(db, user, req.body?.password)
    if (!check.ok) return res.status(check.locked ? 423 : 401).json({ error: check.error, locked: !!check.locked })
    await db.collection('sessions').updateOne({ _id: session._id }, { $set: { last_seen: new Date(), reauth_at: new Date() } })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('auth/reauth error:', err)
    return res.status(500).json({ error: 'Could not check your password.' })
  }
}
