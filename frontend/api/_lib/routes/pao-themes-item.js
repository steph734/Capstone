import { getMongo } from '../mongo.js'
import { PaoTheme } from '../models/paoTheme.js'
import { serializePaoTheme } from '../serializePaoTheme.js'

// PATCH /api/pao-themes/:code -> merge newly-created piece codes into this
// theme's set_items, e.g. { setItems: { hats: 'witch_hat' } } after the
// admin's "Add theme set" click creates that piece. Merges rather than
// replaces, since pieces the schema can't represent (see badges.js note)
// are added one slot at a time as they succeed.
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const code = req.params?.code
  const { setItems } = req.body || {}
  if (!code) return res.status(400).json({ error: 'Missing theme code.' })
  if (!setItems || typeof setItems !== 'object') return res.status(400).json({ error: 'Missing setItems.' })

  try {
    await getMongo()
    const existing = await PaoTheme.findOne({ code }).lean()
    if (!existing) return res.status(404).json({ error: 'Theme not found.' })

    const merged = { ...(existing.set_items || {}), ...setItems }
    const doc = await PaoTheme.findOneAndUpdate({ code }, { $set: { set_items: merged } }, { new: true, runValidators: true })
    return res.status(200).json({ theme: serializePaoTheme(doc) })
  } catch (err) {
    console.error('pao-themes/update error:', err)
    return res.status(500).json({ error: err.message || 'Could not update the theme.' })
  }
}
