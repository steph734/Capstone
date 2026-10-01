// POST /api/activities/session/:id/end -> body { reason }
// Used for an explicit "close activities" action and for
// navigator.sendBeacon on page unload (reason: 'closed'), plus logout.
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { ActivitySession } from '../models/activitySession.js'

const VALID_REASONS = ['changed_player', 'closed', 'timeout', 'logout']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid session id.' })
  }

  // sendBeacon posts a Blob body with no Content-Type express.json() will
  // parse, so a missing/unparsed body here just falls back to 'closed'.
  const reason = VALID_REASONS.includes(req.body?.reason) ? req.body.reason : 'closed'

  try {
    await getMongo()
    const session = await ActivitySession.findById(id)
    if (!session) return res.status(200).json({ ok: true }) // already gone — fine

    if (session.status === 'active') {
      session.status = 'ended'
      session.ended_at = new Date()
      session.end_reason = reason
      await session.save()
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('activities/session end error:', err)
    return res.status(500).json({ error: err.message || 'Could not end the session.' })
  }
}
