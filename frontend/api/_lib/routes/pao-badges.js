// GET /api/pao/badges?patientEmail= -> every active badge, with earned
// true/false and earnedAt — the badge shelf. Unlike /api/game-progress/unlocks
// (which recomputes "currently satisfies criteria" fresh every call), this
// reads the durable patient_badges record, so a badge a patient already has
// stays earned even if, say, the admin later changes its criteria.
import { getMongo } from '../mongo.js'
import { Badge } from '../models/badge.js'
import { PatientBadge } from '../models/patientBadge.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { serializeBadge } from '../serializeBadge.js'
import { getDb } from '../mongo.js'
import { criteriaProgress } from '../evaluateUnlock.js'
import { buildUnlockContext } from '../unlockContext.js'
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
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patientId = resolved.patientId

    const badges = await Badge.find({ is_active: true, status: { $in: ['active', null] } }).sort({ sort_order: 1, name: 1 }).lean()
    const earned = patientId
      ? await PatientBadge.find({ patient_id: patientId }).lean()
      : []
    const earnedByCode = new Map(earned.map((e) => [e.badge_code, e]))

    // Extra detail for the Badge Case: how to earn, progress, outfit reward.
    const db = await getDb()
    const [ctx, games, clothes, hair] = await Promise.all([
      patientId ? buildUnlockContext(patientId).catch(() => null) : null,
      db.collection('games').find({}, { projection: { name: 1 } }).toArray(),
      db.collection('clothes').find({}, { projection: { code: 1, name: 1 } }).toArray(),
      db.collection('pao_hair').find({}, { projection: { code: 1, name: 1 } }).toArray(),
    ])
    const gameName = new Map(games.map((g) => [String(g._id), g.name]))
    const outfitName = new Map([...clothes, ...hair].map((d) => [d.code, d.name]))
    const isPlaceholder = (n) => !n || !String(n).trim() || /^untitled/i.test(String(n).trim())

    return res.status(200).json({
      badges: badges.map((b) => {
        const e = earnedByCode.get(b.code)
        const crit = b.criteria ? { type: b.criteria.type, gameId: b.criteria.game_id, value: b.criteria.value } : null
        const pr = !e && ctx && crit ? criteriaProgress(crit, ctx) : null
        return {
          ...serializeBadge(b),
          earned: !!e, earnedAt: e?.earned_at || null, seen: e ? !!e.seen : true,
          howToEarn: crit ? describeUnlock(crit.type, { gameId: crit.gameId, value: crit.value }, gameName) : null,
          progress: pr ? pr.have : null,
          target: pr ? pr.need : null,
          relatedGameId: crit?.gameId ? String(crit.gameId) : null,
          relatedGameName: crit?.gameId ? gameName.get(String(crit.gameId)) || null : null,
          rewardOutfit: b.unlock_item_code ? (outfitName.get(b.unlock_item_code) || b.unlock_item_code) : null,
          isSecret: isPlaceholder(b.name),
        }
      }),
    })
  } catch (err) {
    console.error('pao/badges error:', err)
    return res.status(500).json({ error: err.message || 'Could not load badges.' })
  }
}
