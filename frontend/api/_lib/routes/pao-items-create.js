import { getMongo, getDb } from '../mongo.js'
import { PaoItem } from '../models/paoItem.js'
import { serializePaoItem, dbCategoryFromUi } from '../serializePaoItem.js'

const str = (v) => (v == null ? '' : String(v).trim())

function slugify(name) {
  const base = str(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50)
  return base || 'item'
}

// POST /api/pao-items/create -> a new hat/clothes/pants/shoes piece for
// Pao's wardrobe, designed by the admin. `code` is derived from the name
// and de-duplicated, same pattern as badges/create.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, category, description, emoji, design, adminEmail } = req.body || {}

  if (!str(name)) return res.status(400).json({ error: 'Item name is required.' })
  const dbCategory = dbCategoryFromUi(category)
  if (!dbCategory) return res.status(400).json({ error: 'Category must be one of Hats, Clothes, Pants, Shoes.' })
  if (!design?.style || !design?.main || !design?.trim || !design?.pattern || !design?.patternColor) {
    return res.status(400).json({ error: 'Missing style, colours or pattern.' })
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
    while (await PaoItem.exists({ code: candidate })) {
      candidate = `${code}_${n}`
      n += 1
    }

    const doc = await PaoItem.create({
      code: candidate,
      name: str(name),
      category: dbCategory,
      description: str(description) || null,
      emoji: str(emoji) || null,
      is_builtin: false,
      design: {
        style: design.style,
        main_color: design.main,
        trim_color: design.trim,
        pattern: design.pattern,
        pattern_color: design.patternColor,
        decal: str(design.decal) || null,
      },
      is_active: true,
      sort_order: null,
      created_by: createdBy,
    })

    return res.status(201).json({ item: serializePaoItem(doc) })
  } catch (err) {
    console.error('pao-items/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the item.' })
  }
}
