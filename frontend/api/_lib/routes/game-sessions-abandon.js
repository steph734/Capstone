// POST /api/sessions/:id/abandon -> the patient left mid-game. Breaks their
// games_in_a_row streak (finishing resets nothing; not finishing does).
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { GameSession } from '../models/gameSession.js'
import { PaoProfile } from '../models/paoProfile.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid session id.' })
  }

  try {
    await getMongo()
    const session = await GameSession.findById(id)
    if (!session) return res.status(404).json({ error: 'Session not found.' })

    // Idempotent — ending an already-finished/abandoned session is a no-op,
    // not an error (e.g. a sendBeacon abandon racing a completed response).
    if (session.status !== 'in_progress') {
      return res.status(200).json({ ok: true, status: session.status })
    }

    session.status = 'abandoned'
    session.completed_at = new Date()
    await session.save()

    await PaoProfile.updateOne({ patient_id: session.patient_id }, { $set: { games_in_a_row: 0 } })

    return res.status(200).json({ ok: true, status: 'abandoned' })
  } catch (err) {
    console.error('game-sessions/abandon error:', err)
    return res.status(500).json({ error: err.message || 'Could not abandon the session.' })
  }
}
