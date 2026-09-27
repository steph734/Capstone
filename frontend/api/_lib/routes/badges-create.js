import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Badge } from '../models/badge.js'
import { serializeBadge } from '../serializeBadge.js'

const str = (v) => (v == null ? '' : String(v).trim())

function slugify(name) {
  const base = str(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  return base || 'badge'
}

// POST /api/badges/create -> a new badge in the library. `code` is derived
// from the name and de-duplicated (word_wizard, word_wizard_2, ...) rather
// than left to the client, since it's meant as a stable natural key.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    name, description, art, badgeType, criteriaType, criteriaGameId,
    criteriaValue, unlockItemCode, isActive, adminEmail,
  } = req.body || {}

  if (!str(name)) return res.status(400).json({ error: 'Badge name is required.' })
  if (!art?.shape || !art?.color || !art?.symbol) return res.status(400).json({ error: 'Badge art (shape/colour/symbol) is required.' })
  if (!badgeType) return res.status(400).json({ error: 'Missing badge type.' })
  if (!criteriaType) return res.status(400).json({ error: 'Missing criteria type.' })

  try {
    await getMongo()
    const db = await getDb()

    let createdBy = null
    if (str(adminEmail)) {
      const u = await db.collection('users').findOne({ email: str(adminEmail).toLowerCase() })
      if (u) createdBy = u._id
    }

    let code = slugify(name)
    let candidate = code
    let n = 2
    // eslint-disable-next-line no-await-in-loop
    while (await Badge.exists({ code: candidate })) {
      candidate = `${code}_${n}`
      n += 1
    }

    const doc = await Badge.create({
      code: candidate,
      name: str(name),
      description: str(description) || null,
      art: { shape: art.shape, color: art.color, symbol: art.symbol },
      badge_type: badgeType,
      criteria_type: criteriaType,
      criteria_game_id: mongoose.isValidObjectId(criteriaGameId) ? new mongoose.Types.ObjectId(criteriaGameId) : null,
      criteria_value: Number.isFinite(criteriaValue) ? criteriaValue : null,
      unlock_item_code: str(unlockItemCode) || null,
      is_active: !!isActive,
      earned_count: 0,
      sort_order: null,
      created_by: createdBy,
    })

    return res.status(201).json({ badge: serializeBadge(doc) })
  } catch (err) {
    console.error('badges/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the badge.' })
  }
}
