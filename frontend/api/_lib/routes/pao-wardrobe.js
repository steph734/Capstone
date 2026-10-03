// GET /api/pao/wardrobe?patientEmail= -> items grouped by category + hair,
// each with unlocked/equipped/isNew/howToUnlock. Also lazily unlocks any
// `unlock.type: 'free'` item this patient doesn't have a patient_unlocks
// record for yet — covers both a brand-new profile and a free item an admin
// added after the patient's profile already existed.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { Badge } from '../models/badge.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { serializePaoItem } from '../serializePaoItem.js'
import { serializePaoHair } from '../serializePaoHair.js'
import { describeUnlock } from '../describeUnlock.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientEmail = String(req.query.patientEmail || '').trim()

  const activitySessionId = String(req.query.activitySessionId || '').trim() || null
  if (!patientEmail && !activitySessionId) return res.status(400).json({ error: 'Missing patientEmail.' })

  try {
    await getMongo()
    const db = await getDb()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patientId = resolved.patientId

    let profile = await PaoProfile.findOne({ patient_id: patientId })
    if (!profile) profile = await PaoProfile.create({ patient_id: patientId })

    const [clothesDocs, hairDocs, games, badges, unlocks] = await Promise.all([
      db.collection('clothes').find({ is_active: true }).toArray(),
      db.collection('pao_hair').find({ is_active: true }).toArray(),
      db.collection('games').find({}, { projection: { name: 1 } }).toArray(),
      Badge.find().select('code name').lean(),
      PatientUnlock.find({ patient_id: patientId }).lean(),
    ])

    // Backfill: any free item not yet recorded as unlocked for this patient.
    const unlockedSet = new Set(unlocks.map((u) => `${u.item_type}:${u.item_code}`))
    const toBackfill = []
    for (const d of clothesDocs) {
      if (d.unlock?.type === 'free' && !unlockedSet.has(`item:${d.code}`)) toBackfill.push({ item_type: 'item', item_code: d.code })
    }
    for (const d of hairDocs) {
      if (d.unlock?.type === 'free' && !unlockedSet.has(`hair:${d.code}`)) toBackfill.push({ item_type: 'hair', item_code: d.code })
    }
    if (toBackfill.length) {
      await PatientUnlock.insertMany(
        toBackfill.map((u) => ({ patient_id: patientId, item_type: u.item_type, item_code: u.item_code, source: { type: 'free' } })),
        { ordered: false }
      ).catch(() => {}) // a concurrent request may have just inserted the same ones — duplicate key is fine to ignore
      for (const u of toBackfill) unlockedSet.add(`${u.item_type}:${u.item_code}`)
    }

    const unlockedMeta = new Map(unlocks.map((u) => [`${u.item_type}:${u.item_code}`, u]))
    const gameNameById = new Map(games.map((g) => [String(g._id), g.name]))
    const badgeNameByCode = new Map(badges.map((b) => [b.code, b.name]))
    const equipped = profile.equipped || {}

    const describe = (unlock) => unlock ? describeUnlock(unlock.type, { gameId: unlock.game_id, value: unlock.value, badgeCode: unlock.badge_code }, gameNameById, badgeNameByCode) : null

    const mapItem = (doc, itemType, serialize, slot) => {
      const key = `${itemType}:${doc.code}`
      const isUnlocked = unlockedSet.has(key)
      const meta = unlockedMeta.get(key)
      return {
        ...serialize(doc),
        unlocked: isUnlocked,
        equipped: equipped[slot] === doc.code,
        isNew: isUnlocked ? !(meta?.seen ?? true) : false,
        howToUnlock: isUnlocked ? null : describe(doc.unlock),
      }
    }

    const byCategory = { Hats: [], Clothes: [], Pants: [], Shoes: [] }
    for (const d of clothesDocs) {
      const slot = { hats: 'hats', clothes: 'clothes', pants: 'pants', shoes: 'shoes' }[d.category]
      if (!slot) continue
      const key = d.category === 'hats' ? 'Hats' : d.category === 'clothes' ? 'Clothes' : d.category === 'pants' ? 'Pants' : 'Shoes'
      byCategory[key].push(mapItem(d, 'item', serializePaoItem, slot))
    }
    const hair = hairDocs.map((d) => mapItem(d, 'hair', serializePaoHair, 'hair'))

    return res.status(200).json({ hair, items: byCategory })
  } catch (err) {
    console.error('pao/wardrobe error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the wardrobe.' })
  }
}
