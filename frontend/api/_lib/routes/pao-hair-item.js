import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { PaoHair } from '../models/paoHair.js'
import { serializePaoHair } from '../serializePaoHair.js'
import { unlockToDb } from '../serializeUnlock.js'

const str = (v) => (v == null ? '' : String(v).trim())

// PATCH /api/pao-hair/:id -> partial update.
// DELETE /api/pao-hair/:id -> removes a hairstyle.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePatch(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid hairstyle id.' })

  const { name, description, emoji, theme, unlock, design, isActive } = req.body || {}

  const update = {}
  if (name !== undefined) update.name = str(name)
  if (description !== undefined) update.description = str(description) || null
  if (emoji !== undefined) update.emoji = str(emoji) || null
  if (theme !== undefined) update.theme_code = str(theme) || null
  if (unlock !== undefined) {
    const mapped = unlockToDb(unlock, { mongoose })
    if (mapped !== undefined) update.unlock = mapped
  }
  if (design !== undefined && design) {
    update.style = design.style
    update.hair_color = design.main
    update.tie_color = design.trim
    update.pattern = design.pattern
    update.pattern_color = design.pattern !== 'solid' ? (design.patternColor || null) : null
    update.clip = str(design.decal) || null
  }
  if (isActive !== undefined) update.is_active = !!isActive

  try {
    await getMongo()
    const doc = await PaoHair.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    if (!doc) return res.status(404).json({ error: 'Hairstyle not found.' })
    return res.status(200).json({ item: serializePaoHair(doc) })
  } catch (err) {
    console.error('pao-hair/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the hairstyle.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid hairstyle id.' })

  try {
    await getMongo()
    const existing = await PaoHair.findById(id).lean()
    if (!existing) return res.status(404).json({ error: 'Hairstyle not found.' })
    await PaoHair.findByIdAndDelete(id)
    return res.status(200).json({ id })
  } catch (err) {
    console.error('pao-hair/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the hairstyle.' })
  }
}
