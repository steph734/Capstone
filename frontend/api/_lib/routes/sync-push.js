// POST /api/sync/push  { entries: [{ collection, op, docId, doc }] }
// Applies changes made offline. Entries are handled in order and one failing
// entry never blocks the others. The answer lists a result per entry, so the
// device only clears an outbox entry once the server says it is done.
//
// Safe to retry: every handler upserts by the client-made _id (see syncRules.js).
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor } from '../noteAccess.js'
import { applyEntry } from '../syncRules.js'

const MAX_BATCH = 50

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    // Same auth as the notes routes. An expired token answers 401 and the device
    // keeps everything locally until the user signs in again.
    const ctx = await requireSession(req, res, { roles: ['Therapist'], touch: false })
    if (!ctx) return
    const employee = await employeeFor(ctx.db, ctx.user)
    if (!employee) return res.status(403).json({ error: 'Your account is not linked to a staff record.' })

    const entries = Array.isArray(req.body?.entries) ? req.body.entries : []
    if (!entries.length) return res.status(400).json({ error: 'Nothing to sync.' })
    if (entries.length > MAX_BATCH) return res.status(413).json({ error: `Send at most ${MAX_BATCH} changes at a time.` })

    const full = { ...ctx, employee }
    const results = []
    for (const entry of entries) {
      const result = await applyEntry(full, entry)
      // `httpStatus` mirrors what a single request would have returned (409 = SOAP conflict).
      const httpStatus = { ok: 200, conflict: 409, rejected: 422, error: 500 }[result.status] || 500
      results.push({ collection: entry?.collection, docId: entry?.docId, httpStatus, ...result })
    }
    return res.status(200).json({ results, serverTime: new Date().toISOString() })
  } catch (err) {
    console.error('sync/push error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Could not sync.' })
  }
}
