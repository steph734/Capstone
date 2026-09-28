import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { PaoHair } from '../models/paoHair.js'
import { serializePaoHair } from '../serializePaoHair.js'
import { unlockToDb } from '../serializeUnlock.js'

const str = (v) => (v == null ? '' : String(v).trim())

function slugify(name) {
  const base = str(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
  return base || 'hair'
}

// POST /api/pao-hair/create -> a new hairstyle for Pao.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, description, emoji, theme, unlock, design, adminEmail } = req.body || {}

  if (!str(name)) return res.status(400).json({ error: 'Hairstyle name is required.' })
  if (!design?.style || !design?.main || !design?.trim || !design?.pattern) {
    return res.status(400).json({ error: 'Missing style or colours.' })
  }

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
    while (await PaoHair.exists({ code: candidate })) {
      candidate = `${code}_${n}`
      n += 1
    }

    const doc = await PaoHair.create({
      code: candidate,
      name: str(name),
      description: str(description) || null,
      emoji: str(emoji) || null,
      theme_code: str(theme) || null,
      unlock: unlockToDb(unlock, { mongoose }) ?? null,
      style: design.style,
      hair_color: design.main,
      tie_color: design.trim,
      pattern: design.pattern,
      pattern_color: design.pattern !== 'solid' ? (design.patternColor || null) : null,
      clip: str(design.decal) || null,
      is_active: true,
      sort_order: null,
      created_by: createdBy,
    })

    return res.status(201).json({ item: serializePaoHair(doc) })
  } catch (err) {
    console.error('pao-hair/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the hairstyle.' })
  }
}
