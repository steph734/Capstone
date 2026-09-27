const express = require('express');
const GameSession = require('../models/GameSession');

const router = express.Router();

// POST /api/game-sessions -> records one completed gamified-activity session
// (fired from ProgressContext.recordGameSession on the frontend whenever a
// patient finishes a game). Best-effort from the caller's point of view —
// the frontend keeps its own local progress regardless of whether this
// succeeds.
router.post('/', async (req, res) => {
  const patientId = String(req.body?.patientId || '').trim().toLowerCase();
  const domain = String(req.body?.domain || '').trim();
  if (!patientId) {
    return res.status(400).json({ error: 'Missing patientId.' });
  }
  if (!domain) {
    return res.status(400).json({ error: 'Missing domain.' });
  }

  try {
    const doc = await GameSession.create({
      patient_id: patientId,
      patient_name: req.body?.patientName || null,
      game_id: req.body?.gameId || null,
      game_name: req.body?.gameName || null,
      domain,
      difficulty: req.body?.difficulty || null,
      accuracy: typeof req.body?.accuracy === 'number' ? req.body.accuracy : null,
      duration_minutes: typeof req.body?.durationMinutes === 'number' ? req.body.durationMinutes : 0,
      xp_earned: typeof req.body?.xpEarned === 'number' ? req.body.xpEarned : 0,
      completed_at: req.body?.completedAt ? new Date(req.body.completedAt) : new Date(),
    });

    return res.status(201).json({ id: doc._id });
  } catch (err) {
    console.error('record game session error:', err);
    return res.status(500).json({ error: 'Could not record this game session.' });
  }
});

// GET /api/game-sessions?patientId=... -> a patient's game-session history,
// most recent first, for a therapist/owner "played games" view.
router.get('/', async (req, res) => {
  const patientId = String(req.query.patientId || '').trim().toLowerCase();
  if (!patientId) {
    return res.status(400).json({ error: 'Missing patientId.' });
  }

  try {
    const sessions = await GameSession.find({ patient_id: patientId })
      .sort({ completed_at: -1 })
      .limit(200)
      .lean();

    return res.json({
      sessions: sessions.map((s) => ({
        id: s._id,
        gameId: s.game_id,
        gameName: s.game_name,
        domain: s.domain,
        difficulty: s.difficulty,
        accuracy: s.accuracy,
        durationMinutes: s.duration_minutes,
        xpEarned: s.xp_earned,
        completedAt: s.completed_at,
      })),
    });
  } catch (err) {
    console.error('list game sessions error:', err);
    return res.status(500).json({ error: 'Could not load game sessions.' });
  }
});

module.exports = router;
