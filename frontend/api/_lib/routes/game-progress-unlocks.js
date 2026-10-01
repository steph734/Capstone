import { getMongo, getDb } from '../mongo.js'
import { resolvePatientId } from '../resolvePatient.js'
import { evaluateCriteria } from '../evaluateUnlock.js'
import { buildUnlockContext } from '../unlockContext.js'

// GET /api/game-progress/unlocks?patientEmail= -> which badge codes and
// wardrobe item codes this patient has actually earned, computed fresh from
// their recorded game completions against the badges/clothes/pao_hair
// criteria the admin configured. Never 500s on "nothing yet" — an unknown
// or brand-new patient just gets empty arrays.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientEmail = String(req.query.patientEmail || '').trim().toLowerCase()
  if (!patientEmail) return res.status(400).json({ error: 'Missing patientEmail.' })

  try {
    await getMongo()
    const db = await getDb()
    const patientId = await resolvePatientId(patientEmail)
    if (!patientId) return res.status(200).json({ unlockedItemCodes: [], earnedBadgeCodes: [] })

    const ctx = await buildUnlockContext(patientId)

    const badges = await db.collection('badges').find({ is_active: true }).toArray()
    const earnedBadgeCodes = []
    const itemCodesFromBadges = []
    for (const b of badges) {
      const met = evaluateCriteria({ type: b.criteria?.type, gameId: b.criteria?.game_id, value: b.criteria?.value }, ctx)
      if (met) {
        earnedBadgeCodes.push(b.code)
        ctx.earnedBadgeCodes.add(b.code)
        if (b.unlock_item_code) itemCodesFromBadges.push(b.unlock_item_code)
      }
    }

    const [clothes, hair] = await Promise.all([
      db.collection('clothes').find({ unlock: { $ne: null } }).toArray(),
      db.collection('pao_hair').find({ unlock: { $ne: null } }).toArray(),
    ])

    const unlockedItemCodes = new Set(itemCodesFromBadges)
    for (const item of [...clothes, ...hair]) {
      const u = item.unlock
      if (!u) continue
      const met = evaluateCriteria({ type: u.type, gameId: u.game_id, value: u.value, badgeCode: u.badge_code }, ctx)
      if (met && item.code) unlockedItemCodes.add(item.code)
    }

    return res.status(200).json({
      unlockedItemCodes: [...unlockedItemCodes],
      earnedBadgeCodes,
    })
  } catch (err) {
    console.error('game-progress/unlocks error:', err)
    return res.status(500).json({ error: err.message || 'Could not compute unlocks.' })
  }
}
