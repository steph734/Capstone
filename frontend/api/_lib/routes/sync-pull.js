// GET /api/sync/pull?since=<ISO time from the previous pull>
// Returns what changed on the server since then, for THIS therapist only.
// `serverTime` is read BEFORE querying and sent back; the device stores it and
// sends it as `since` next time. Using only the server's clock means a wrong
// device clock can never make the device miss a change.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor } from '../noteAccess.js'
import { pullFor } from '../syncRules.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Therapist'], touch: false })
    if (!ctx) return
    const employee = await employeeFor(ctx.db, ctx.user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.' })

    const serverTime = new Date()
    const sinceRaw = req.query?.since ? new Date(String(req.query.since)) : null
    const since = sinceRaw && !Number.isNaN(sinceRaw.getTime()) ? sinceRaw : null

    const docs = await pullFor({ ...ctx, employee }, since)
    return res.status(200).json({ serverTime: serverTime.toISOString(), docs })
  } catch (err) {
    console.error('sync/pull error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not sync.' })
  }
}
