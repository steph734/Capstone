import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { PaoItem } from '../models/paoItem.js'
import { serializePaoItem, dbCategoryFromUi } from '../serializePaoItem.js'

const str = (v) => (v == null ? '' : String(v).trim())

// PATCH /api/pao-items/:id -> partial update (rename, redesign, retire).
// DELETE /api/pao-items/:id -> removes a piece from the wardrobe.
export default async function handler(req, res) {
  if (req.method === 'PATCH') return handlePatch(req, res)
  if (req.method === 'DELETE') return handleDelete(req, res)
  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handlePatch(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid item id.' })

  const { name, category, description, emoji, theme, design, isActive } = req.body || {}

  const update = {}
  if (name !== undefined) update.name = str(name)
  if (category !== undefined) {
    const dbCategory = dbCategoryFromUi(category)
    if (!dbCategory) return res.status(400).json({ error: 'Category must be one of Hats, Clothes, Pants, Shoes.' })
    update.category = dbCategory
  }
  if (description !== undefined) update.description = str(description) || null
  if (emoji !== undefined) update.emoji = str(emoji) || null
  if (theme !== undefined) update.theme_code = str(theme) || null
  if (design !== undefined) {
    update.design = design ? {
      style: design.style,
      main_color: design.main,
      trim_color: design.trim,
      pattern: design.pattern,
      pattern_color: design.patternColor,
      decal: str(design.decal) || null,
    } : null
  }
  if (isActive !== undefined) update.is_active = !!isActive

  try {
    await getMongo()
    const doc = await PaoItem.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
    if (!doc) return res.status(404).json({ error: 'Item not found.' })
    return res.status(200).json({ item: serializePaoItem(doc) })
  } catch (err) {
    console.error('pao-items/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the item.' })
  }
}

async function handleDelete(req, res) {
  const id = req.params?.id
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid item id.' })

  try {
    await getMongo()
    const existing = await PaoItem.findById(id).lean()
    if (!existing) return res.status(404).json({ error: 'Item not found.' })
    await PaoItem.findByIdAndDelete(id)
    return res.status(200).json({ id })
  } catch (err) {
    console.error('pao-items/delete error:', err)
    return res.status(500).json({ error: err.message || 'Could not delete the item.' })
  }
}
