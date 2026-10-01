import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { resolvePatientId } from '../resolvePatient.js'

// GET /api/games/list -> published games, for "which game" pickers (badge
// criteria, wardrobe-item unlock conditions) AND, when `patientEmail` is
// passed, with `locked` computed against that patient's Pao level. Read-only,
// so this talks to the `games` collection with the native driver rather than
// a Mongoose model — its own $jsonSchema validator (built by the games-editor
// side of the app) is a lot larger than anything this endpoint needs to enforce.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const db = await getDb()
    const docs = await db.collection('games')
      .find({ status: 'published' })
      .project({ name: 1, therapy_type: 1, difficulty: 1, points_per_play: 1, unlocks_badge_id: 1, game_type: 1, unlock_level: 1 })
      .sort({ name: 1 })
      .toArray()

    let patientLevel = null
    const patientEmail = String(req.query.patientEmail || '').trim()
    if (patientEmail) {
      const patientId = await resolvePatientId(patientEmail)
      if (patientId) {
        const profile = await PaoProfile.findOne({ patient_id: patientId }).select('level').lean()
        patientLevel = profile?.level ?? 1
      }
    }

    return res.status(200).json({
      games: docs.map((d) => {
        const unlockLevel = Number(d.unlock_level) || 1
        return {
          id: String(d._id),
          name: d.name,
          therapyType: d.therapy_type || null,
          difficulty: d.difficulty || null,
          pointsPerPlay: Number(d.points_per_play) || 100,
          unlocksBadgeId: d.unlocks_badge_id ? String(d.unlocks_badge_id) : null,
          gameType: d.game_type || null,
          unlockLevel,
          locked: patientLevel == null ? null : patientLevel < unlockLevel,
        }
      }),
    })
  } catch (err) {
    console.error('games/list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load games.' })
  }
}
