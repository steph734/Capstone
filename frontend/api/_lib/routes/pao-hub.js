// GET /api/pao/hub?patientEmail=|activitySessionId= -> everything the
// Gamified Activities hub shows that is not already on the Pao profile:
// streak, this week's games by day, earned badges, and the next outfit to
// unlock. All computed here from existing collections (game_sessions,
// patient_badges, badges, clothes, pao_hair); nothing is invented client-side.
// Days are Asia/Manila (UTC+8, no DST); stored dates stay UTC.
import { getMongo, getDb } from '../mongo.js'
import { PaoProfile } from '../models/paoProfile.js'
import { PatientBadge } from '../models/patientBadge.js'
import { PatientUnlock } from '../models/patientUnlock.js'
import { Badge } from '../models/badge.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'
import { serializePaoProfile } from '../serializePaoProfile.js'
import { criteriaProgress } from '../evaluateUnlock.js'
import { buildUnlockContext } from '../unlockContext.js'
import { describeUnlock } from '../describeUnlock.js'

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Manila calendar day number (days since epoch) for a UTC date.
const manilaDay = (d) => Math.floor((new Date(d).getTime() + MANILA_OFFSET_MS) / DAY_MS)
const manilaWeekday = (dayNum) => new Date(dayNum * DAY_MS).getUTCDay() // 0 = Sunday

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

    const today = manilaDay(new Date())
    const since = new Date((today - 60) * DAY_MS - MANILA_OFFSET_MS)

    const [profile, sessions, earnedRows, badges, clothes, hair, unlocks, games, ctx] = await Promise.all([
      PaoProfile.findOne({ patient_id: patientId }).lean(),
      db.collection('game_sessions').find(
        { patient_id: patientId, status: 'completed', completed_at: { $gte: since } },
        { projection: { completed_at: 1 } },
      ).toArray(),
      PatientBadge.find({ patient_id: patientId }).sort({ earned_at: -1 }).lean(),
      Badge.find({ is_active: true, status: { $in: ['active', null] } }).lean(),
      db.collection('clothes').find({ is_active: true }).toArray(),
      db.collection('pao_hair').find({ is_active: true }).toArray(),
      PatientUnlock.find({ patient_id: patientId }).lean(),
      db.collection('games').find({}, { projection: { name: 1 } }).toArray(),
      buildUnlockContext(patientId).catch(() => null),
    ])

    // ── streak + this week ──
    const perDay = new Map()
    for (const s of sessions) {
      const k = manilaDay(s.completed_at)
      perDay.set(k, (perDay.get(k) || 0) + 1)
    }
    const playedToday = (perDay.get(today) || 0) > 0
    let streakDays = 0
    for (let d = playedToday ? today : today - 1; perDay.get(d); d -= 1) streakDays += 1

    const weekStart = today - manilaWeekday(today) // Sunday
    const week = Array.from({ length: 7 }, (_, i) => {
      const dayNum = weekStart + i
      return { weekday: WEEKDAYS[i], games: perDay.get(dayNum) || 0, isToday: dayNum === today, isFuture: dayNum > today }
    })
    const gamesThisWeek = week.reduce((n, d) => n + d.games, 0)
    const best = week.reduce((b, d) => (d.games > b.games ? d : b), { weekday: null, games: 0 })

    // ── badges (one source of truth: patient_badges) ──
    const badgeByCode = new Map(badges.map((b) => [b.code, b]))
    const earnedBadges = earnedRows
      .filter((e) => badgeByCode.has(e.badge_code))
      .slice(0, 4)
      .map((e) => {
        const b = badgeByCode.get(e.badge_code)
        return { code: b.code, name: b.name, earnedAt: e.earned_at, shape: b.art?.shape || 'circle', colour: b.art?.color || 'gold', symbol: b.art?.symbol || 'star' }
      })
    const earnedCount = earnedRows.filter((e) => badgeByCode.has(e.badge_code)).length

    // ── next outfit to unlock: highest progress ratio ──
    const gameName = new Map(games.map((g) => [String(g._id), g.name]))
    const unlockedSet = new Set(unlocks.map((u) => `${u.item_type}:${u.item_code}`))
    const badgeName = new Map(badges.map((b) => [b.code, b.name]))
    let nextOutfit = null
    if (ctx) {
      const candidates = [
        ...clothes.map((d) => ({ d, type: 'item' })),
        ...hair.map((d) => ({ d, type: 'hair' })),
      ]
      for (const { d, type } of candidates) {
        if (!d.unlock || d.unlock.type === 'free' || unlockedSet.has(`${type}:${d.code}`)) continue
        const pr = criteriaProgress({ type: d.unlock.type, gameId: d.unlock.game_id, value: d.unlock.value, badgeCode: d.unlock.badge_code }, ctx)
        if (!pr || pr.need <= 0) continue
        const ratio = pr.have / pr.need
        if (!nextOutfit || ratio > nextOutfit.ratio) {
          nextOutfit = {
            ratio,
            code: d.code, name: d.name, category: type === 'hair' ? 'hair' : d.category,
            requirement: describeUnlock(d.unlock.type, { gameId: d.unlock.game_id, value: d.unlock.value, badgeCode: d.unlock.badge_code }, gameName, badgeName),
            have: pr.have, need: pr.need,
            gameId: d.unlock.game_id ? String(d.unlock.game_id) : null,
            gameName: d.unlock.game_id ? gameName.get(String(d.unlock.game_id)) || null : null,
          }
        }
      }
    }
    if (nextOutfit) delete nextOutfit.ratio

    return res.status(200).json({
      profile: profile ? serializePaoProfile(profile) : null,
      streakDays,
      playedToday,
      week,
      gamesThisWeek,
      bestDay: best.games > 0 ? { weekday: best.weekday, games: best.games } : null,
      earnedBadges,
      earnedCount,
      totalBadges: badges.length,
      nextOutfit,
    })
  } catch (err) {
    console.error('pao/hub error:', err)
    return res.status(500).json({ error: err.message || 'Could not load the hub.' })
  }
}
