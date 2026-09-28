import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { GameCompletion } from '../models/gameCompletion.js'
import { resolvePatientId } from '../resolvePatient.js'

// POST /api/game-progress/complete -> record that a patient finished a game,
// upserting one running document per (patient, game). This is the signal
// wardrobe `unlock` fields and badge criteria (complete_specific_game,
// complete_any_game, perfect_score) are evaluated against.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { patientEmail, gameId, gameName, score, maxScore } = req.body || {}
  if (!mongoose.isValidObjectId(gameId)) return res.status(400).json({ error: 'Invalid gameId.' })

  try {
    await getMongo()
    const patientId = await resolvePatientId(patientEmail)
    if (!patientId) return res.status(404).json({ error: 'No patient record is linked to this account yet.' })

    const s = Number.isFinite(score) ? score : null
    const m = Number.isFinite(maxScore) ? maxScore : null
    const perfect = s != null && m != null && m > 0 && s >= m

    const existing = await GameCompletion.findOne({ patient_id: patientId, game_id: gameId })
    const now = new Date()

    if (!existing) {
      await GameCompletion.create({
        patient_id: patientId,
        game_id: gameId,
        game_name: gameName || null,
        times_completed: 1,
        best_score: s,
        best_max_score: m,
        perfect_score_achieved: perfect,
        first_completed_at: now,
        last_completed_at: now,
      })
    } else {
      existing.times_completed += 1
      existing.last_completed_at = now
      if (gameName) existing.game_name = gameName
      if (s != null && (existing.best_score == null || s > existing.best_score)) {
        existing.best_score = s
        existing.best_max_score = m
      }
      if (perfect) existing.perfect_score_achieved = true
      await existing.save()
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('game-progress/complete error:', err)
    return res.status(500).json({ error: err.message || 'Could not record game completion.' })
  }
}
