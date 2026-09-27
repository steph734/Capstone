const express = require('express');
const Game = require('../models/Game');

const router = express.Router();

const THERAPY_TYPES = ['cognitive', 'speech', 'physical', 'occupational'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const GAME_TYPES = ['picture_match', 'sort_place', 'choose_picture', 'step_by_step', 'say_it', 'move_with_me'];
const STATUSES = ['draft', 'published', 'archived'];

function toGameJSON(doc) {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description || '',
    therapyType: doc.therapy_type,
    difficulty: doc.difficulty || null,
    ageRange: doc.age_range || null,
    pointsPerPlay: doc.points_per_play ?? 0,
    unlocksBadgeId: doc.unlocks_badge_id || null,
    therapistNote: doc.therapist_note || '',
    gameType: doc.game_type,
    typeSettings: doc.type_settings || null,
    levels: doc.levels || [],
    support: doc.support || null,
    status: doc.status,
    testPlayed: !!doc.test_played,
    createdBy: doc.created_by,
    updatedBy: doc.updated_by || null,
    publishedAt: doc.published_at || null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

// GET /api/games?status=published -> the game catalog, newest first. Powers
// both the Super Admin's GamesLibraryPage (no filter, sees every status) and
// the patient/therapist game hub (status=published only).
router.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim().toLowerCase();
  const filter = {};
  if (status) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    filter.status = status;
  }

  try {
    const games = await Game.find(filter).sort({ created_at: -1 }).lean();
    return res.json({ games: games.map(toGameJSON) });
  } catch (err) {
    console.error('list games error:', err);
    return res.status(500).json({ error: 'Could not load the games library.' });
  }
});

// POST /api/games -> a Super Admin creates a new game (starts as 'draft'
// unless status is explicitly given).
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const therapyType = String(req.body?.therapyType || '').trim().toLowerCase();
  const gameType = String(req.body?.gameType || '').trim().toLowerCase();
  const createdBy = req.body?.createdBy;

  if (!name) return res.status(400).json({ error: 'Missing game name.' });
  if (!THERAPY_TYPES.includes(therapyType)) return res.status(400).json({ error: 'Invalid therapy type.' });
  if (!GAME_TYPES.includes(gameType)) return res.status(400).json({ error: 'Invalid game type.' });
  if (!createdBy) return res.status(400).json({ error: 'Missing createdBy.' });

  const status = STATUSES.includes(String(req.body?.status).toLowerCase()) ? req.body.status.toLowerCase() : 'draft';
  const difficulty = DIFFICULTIES.includes(String(req.body?.difficulty).toLowerCase())
    ? req.body.difficulty.toLowerCase()
    : undefined;

  try {
    const doc = await Game.create({
      name,
      description: req.body?.description || undefined,
      therapy_type: therapyType,
      difficulty,
      points_per_play: typeof req.body?.pointsPerPlay === 'number' ? req.body.pointsPerPlay : undefined,
      therapist_note: req.body?.therapistNote || undefined,
      game_type: gameType,
      status,
      created_by: createdBy,
      published_at: status === 'published' ? new Date() : null,
    });

    return res.status(201).json(toGameJSON(doc));
  } catch (err) {
    console.error('create game error:', err);
    return res.status(500).json({ error: 'Could not save this game.' });
  }
});

// PATCH /api/games/:id -> a Super Admin edits a game, or changes its
// status (e.g. publishing a draft, archiving a published game).
router.patch('/:id', async (req, res) => {
  const updates = {};

  if (req.body?.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body?.description !== undefined) updates.description = req.body.description;
  if (req.body?.therapyType !== undefined) {
    const therapyType = String(req.body.therapyType).trim().toLowerCase();
    if (!THERAPY_TYPES.includes(therapyType)) return res.status(400).json({ error: 'Invalid therapy type.' });
    updates.therapy_type = therapyType;
  }
  if (req.body?.difficulty !== undefined) {
    const difficulty = String(req.body.difficulty).trim().toLowerCase();
    if (!DIFFICULTIES.includes(difficulty)) return res.status(400).json({ error: 'Invalid difficulty.' });
    updates.difficulty = difficulty;
  }
  if (req.body?.gameType !== undefined) {
    const gameType = String(req.body.gameType).trim().toLowerCase();
    if (!GAME_TYPES.includes(gameType)) return res.status(400).json({ error: 'Invalid game type.' });
    updates.game_type = gameType;
  }
  if (req.body?.pointsPerPlay !== undefined) updates.points_per_play = req.body.pointsPerPlay;
  if (req.body?.therapistNote !== undefined) updates.therapist_note = req.body.therapistNote;
  if (req.body?.updatedBy !== undefined) updates.updated_by = req.body.updatedBy;
  if (req.body?.status !== undefined) {
    const status = String(req.body.status).trim().toLowerCase();
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    updates.status = status;
    if (status === 'published') updates.published_at = new Date();
  }

  try {
    const doc = await Game.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Game not found.' });
    return res.json(toGameJSON(doc));
  } catch (err) {
    console.error('update game error:', err);
    return res.status(500).json({ error: 'Could not update this game.' });
  }
});

// DELETE /api/games/:id -> permanently removes a game from the catalog.
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Game.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Game not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('delete game error:', err);
    return res.status(500).json({ error: 'Could not delete this game.' });
  }
});

module.exports = router;
