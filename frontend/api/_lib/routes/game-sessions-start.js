// POST /api/games/:gameId/sessions -> starts a play session for a game.
// body: { patientEmail, employeeEmail?, activitySessionId?, language? }
//
// Only one in_progress session per patient is ever live: starting a new one
// abandons whichever was still open (and resets that patient's
// games_in_a_row streak to 0 — leaving a game unfinished breaks the streak).
import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Game } from '../models/game.js'
import { GameSession } from '../models/gameSession.js'
import { PaoProfile } from '../models/paoProfile.js'
import { Employee } from '../models/employee.js'
import { ActivitySession } from '../models/activitySession.js'
import { resolvePatientId } from '../resolvePatient.js'
import { serializePaoProfile } from '../serializePaoProfile.js'

async function getOrCreateProfile(patientId) {
  let profile = await PaoProfile.findOne({ patient_id: patientId })
  if (!profile) {
    profile = await PaoProfile.create({ patient_id: patientId })
  }
  return profile
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { gameId } = req.params
  if (!mongoose.isValidObjectId(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId.' })
  }

  const body = req.body || {}
  const patientEmail = String(body.patientEmail || '').trim()
  const employeeEmail = String(body.employeeEmail || '').trim().toLowerCase()
  const language = ['en', 'tl', 'ceb'].includes(body.language) ? body.language : 'en'
  const activitySessionId = mongoose.isValidObjectId(body.activitySessionId) ? body.activitySessionId : null

  try {
    await getMongo()

    // When this play is part of a "Who is playing today?" activity session,
    // that session's own patient_id is the only thing trusted for identity —
    // a patientEmail from the client is never enough on its own, and practice
    // mode (patient_id: null) must never be able to start a tracked game.
    let activitySession = null
    if (activitySessionId) {
      activitySession = await ActivitySession.findById(activitySessionId)
      if (!activitySession || activitySession.status !== 'active') {
        return res.status(400).json({ error: 'That session has ended.' })
      }
      if (activitySession.mode === 'practice') {
        return res.status(403).json({ error: "Practice mode doesn't save progress — nothing to start." })
      }
    }

    const patientId = activitySession ? activitySession.patient_id : await resolvePatientId(patientEmail)
    if (!patientId) {
      return res.status(404).json({ error: 'No patient record is linked to this account yet.' })
    }

    const game = await Game.findById(gameId).lean()
    if (!game) return res.status(404).json({ error: 'Game not found.' })

    const profile = await getOrCreateProfile(patientId)

    const requiredLevel = Number(game.unlock_level) || 1
    if (profile.level < requiredLevel) {
      return res.status(403).json({ error: `This game unlocks at level ${requiredLevel}.`, requiredLevel })
    }

    // Any session this patient left open counts as abandoned the moment a
    // new one starts — including the streak reset that goes with it.
    const stale = await GameSession.find({ patient_id: patientId, status: 'in_progress' })
    if (stale.length) {
      await GameSession.updateMany(
        { _id: { $in: stale.map((s) => s._id) } },
        { $set: { status: 'abandoned', completed_at: new Date() } }
      )
      if (profile.games_in_a_row !== 0) {
        profile.games_in_a_row = 0
        await profile.save()
      }
    }

    let employeeId = activitySession?.therapist_id || null
    if (!employeeId && employeeEmail) {
      const employee = await Employee.findOne({ email: employeeEmail }).lean()
      employeeId = employee?._id || null
    }
    const effectiveLanguage = activitySession?.language || language

    const session = await GameSession.create({
      patient_id: patientId,
      game_id: game._id,
      employee_id: employeeId,
      activity_session_id: activitySessionId,
      language: effectiveLanguage,
      status: 'in_progress',
      started_at: new Date(),
    })

    if (activitySession) {
      activitySession.games_started += 1
      activitySession.last_active_at = new Date()
      await activitySession.save()
    }

    return res.status(201).json({ sessionId: String(session._id), profile: serializePaoProfile(profile) })
  } catch (err) {
    console.error('game-sessions/start error:', err)
    return res.status(500).json({ error: err.message || 'Could not start the game session.' })
  }
}
