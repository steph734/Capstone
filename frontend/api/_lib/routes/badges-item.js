import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Badge } from '../models/badge.js'
import { serializeBadge } from '../serializeBadge.js'

const str = (v) => (v == null ? '' : String(v).trim())

// PATCH /api/badges/:id -> partial update. Used both for full edits (the
// badge builder modal) and for the single-field "show/hide" toggle button
// (just { isActive }) — every field is optional, only what's present in
// the body gets touched.
//
// DELETE /api/badges/:id -> removes a badge, unless patients have already
// earned it (per the schema's own description of `earned_count`: "Blocks
// deletion when above zero") — deleting it out from under patients who
// already hold it would be a data-integrity problem, not just a UI nicety.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePatch(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid badge id.' })
  }

  const {
    name, description, art, badgeType, criteriaType, criteriaGameId,
    criteriaValue, unlockItemCode, isActive,
  } = req.body || {}

  const update = {}
  if (name !== undefined) update.name = str(name)
  if (description !== undefined) update.description = str(description) || null
  if (art !== undefined && art?.shape && art?.color && art?.symbol) {
    update.art = { shape: art.shape, color: art.color, symbol: art.symbol }
  }
  if (badgeType !== undefined) update.badge_type = badgeType
  if (criteriaType !== undefined) update.criteria_type = criteriaType
  if (criteriaGameId !== undefined) {
    update.criteria_game_id = mongoose.isValidObjectId(criteriaGameId) ? new mongoose.Types.ObjectId(criteriaGameId) : null
  }
  if (criteriaValue !== undefined) update.criteria_value = Number.isFinite(criteriaValue) ? criteriaValue : null
  if (unlockItemCode !== undefined) update.unlock_item_code = str(unlockItemCode) || null
  if (isActive !== undefined) update.is_active = !!isActive

  try {
    await getMongo()
    const doc = await Badge.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    if (!doc) {
      return res.status(404).json({ error: 'Badge not found.' })
    }
    return res.status(200).json({ badge: serializeBadge(doc) })
  } catch (err) {
    console.error('badges/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the badge.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid badge id.' })
  }

  try {
    await getMongo()
    const existing = await Badge.findById(id).lean()
    if (!existing) {
      return res.status(404).json({ error: 'Badge not found.' })
    }
    if ((existing.earned_count || 0) > 0) {
      return res.status(409).json({
        error: `Can't delete "${existing.name}" — ${existing.earned_count} patient${existing.earned_count === 1 ? ' has' : 's have'} already earned it.`,
      })
    }
    await Badge.findByIdAndDelete(id)
    return res.status(200).json({ id })
  } catch (err) {
    console.error('badges/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the badge.' })
  }
}
