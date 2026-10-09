// GET /api/patient/progress?patientEmail=&activitySessionId=&range=week|month
// -> everything the patient's "My Progress" page needs, aggregated here so
// the browser never computes stats itself. Real data only: game_sessions,
// patient_badges, pao_profiles, activity_sessions. Patients only ever see
// their own data — identity comes from resolveRequestPatient, the same
// trust rule every other Pao route uses, never a client-supplied id.
import { getMongo, getDb } from '../mongo.js'
import { resolveRequestPatient } from '../resolveRequestPatient.js'

const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const STAT_LABEL = { intelligence: 'Thinking', focus: 'Focus', resistance: 'Listening & speaking', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Manila is UTC+8, no DST

function manilaDayKey(d) {
  return new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}
function manilaMidnightUtc(daysAgo) {
  const now = new Date(Date.now() + MANILA_OFFSET_MS)
  now.setUTCHours(0, 0, 0, 0)
  now.setUTCDate(now.getUTCDate() - daysAgo)
  return new Date(now.getTime() - MANILA_OFFSET_MS)
}
function xpToNext(level) {
  return 100 + (Math.max(1, level) - 1) * 50
}
function starsFor(correct, attempts) {
  if (!attempts) return 1
  const acc = correct / attempts
  if (acc >= 0.95) return 3
  if (acc >= 0.85) return 2
  return 1
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientEmail = String(req.query.patientEmail || '').trim()
  const activitySessionId = String(req.query.activitySessionId || '').trim() || null
  const range = req.query.range === 'month' ? 'month' : 'week'

  try {
    await getMongo()
    const resolved = await resolveRequestPatient({ activitySessionId, patientEmail })
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message })
    const patientId = resolved.patientId
    const db = await getDb()

    const days = range === 'month' ? 30 : 7
    const rangeStart = manilaMidnightUtc(days - 1)
    const prevStart = manilaMidnightUtc(days * 2 - 1)
    const weekChartStart = manilaMidnightUtc(6) // "My week" is always the last 7 days, regardless of range

    const [patient, profile, earnedBadges, allBadges, completedInRange, completedPrev, completedForWeek, completedRecentLookback, sessionsInRange, games] = await Promise.all([
      db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, last_name: 1 } }),
      db.collection('pao_profiles').findOne({ patient_id: patientId }),
      db.collection('patient_badges').find({ patient_id: patientId }).toArray(),
      db.collection('badges').find({ is_active: true, status: 'active' }).sort({ sort_order: 1, name: 1 }).toArray(),
      db.collection('game_sessions').find({ patient_id: patientId, status: 'completed', completed_at: { $gte: rangeStart } }).toArray(),
      db.collection('game_sessions').find({ patient_id: patientId, status: 'completed', completed_at: { $gte: prevStart, $lt: rangeStart } }).toArray(),
      db.collection('game_sessions').find({ patient_id: patientId, status: 'completed', completed_at: { $gte: weekChartStart } }).toArray(),
      db.collection('game_sessions').find({ patient_id: patientId, status: 'completed', completed_at: { $gte: manilaMidnightUtc(89) } }).sort({ completed_at: -1 }).toArray(),
      db.collection('activity_sessions').find({ patient_id: patientId, started_at: { $gte: rangeStart } }).toArray(),
      db.collection('games').find({}, { projection: { name: 1, therapy_type: 1 } }).toArray(),
    ])

    const gameById = new Map(games.map((g) => [String(g._id), g]))
    const name = [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || 'Friend'

    // ── Level / XP / badges ──────────────────────────────────────────────
    const level = profile?.level || 1
    const xp = profile?.xp || 0
    const xpMax = xpToNext(level)
    const earnedCodes = new Set(earnedBadges.map((b) => b.badge_code))

    // ── KPIs (this range vs the one before it) ───────────────────────────
    const minutes = Math.round(completedInRange.reduce((sum, s) => sum + (s.result?.duration_seconds || 0), 0) / 60)
    const kpis = { sessions: sessionsInRange.length, minutes, games: completedInRange.length }
    const moreThanBefore = completedInRange.length - completedPrev.length

    // ── Therapy types practiced in range ─────────────────────────────────
    const typeSet = new Set()
    for (const s of completedInRange) {
      const t = gameById.get(String(s.game_id))?.therapy_type
      if (t) typeSet.add(t.charAt(0).toUpperCase() + t.slice(1))
    }

    // ── Skills: live stat value + what was gained from sessions finished
    //    this month (the only historical signal we actually store). ──────
    const monthStart = manilaMidnightUtc(29)
    const gainThisMonth = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
    for (const s of completedForWeek.concat(completedPrev, completedInRange)) {
      if (new Date(s.completed_at) < monthStart) continue
      const gains = s.reward?.stat_gains || {}
      for (const k of STAT_KEYS) gainThisMonth[k] += Number(gains[k]) || 0
    }
    const skills = STAT_KEYS.map((k) => ({
      key: k, label: STAT_LABEL[k], value: (profile?.stats?.[k]) ?? 5, deltaMonth: gainThisMonth[k],
    }))

    // ── Badges grid ───────────────────────────────────────────────────────
    const badges = allBadges.map((b) => ({
      code: b.code, name: b.name, shape: b.art?.shape || 'circle', colour: b.art?.color || 'gold', symbol: b.art?.symbol || 'star',
      earned: earnedCodes.has(b.code),
    }))
    const nextBadge = badges.find((b) => !b.earned)
      ? { name: badges.find((b) => !b.earned).name } : null

    // ── Recent games (last 4) ────────────────────────────────────────────
    const recent = completedRecentLookback.slice(0, 4).map((s) => {
      const g = gameById.get(String(s.game_id))
      const stars = s.result?.stars ?? starsFor(s.result?.correct ?? 0, s.result?.attempts ?? 0)
      return {
        gameId: String(s.game_id),
        name: g?.name || 'Game',
        therapyType: g?.therapy_type || null,
        playedAt: s.completed_at,
        stars: Math.max(1, Math.min(3, stars)),
      }
    })

    // ── "My week": games finished per day, last 7 days, Sun..Sat ─────────
    const weekBuckets = new Map()
    for (let i = 6; i >= 0; i--) {
      const d = manilaMidnightUtc(i)
      weekBuckets.set(manilaDayKey(d), { day: DAY_LETTER[new Date(d.getTime() + MANILA_OFFSET_MS).getUTCDay()], games: 0 })
    }
    for (const s of completedForWeek) {
      const key = manilaDayKey(s.completed_at)
      if (weekBuckets.has(key)) weekBuckets.get(key).games += 1
    }
    const week = [...weekBuckets.values()]

    // ── Streak: consecutive days with at least one completed game ───────
    const playedDayKeys = new Set(completedRecentLookback.map((s) => manilaDayKey(s.completed_at)))
    const todayKey = manilaDayKey(new Date())
    let current = 0
    for (let i = 0; i < 90; i++) {
      const key = manilaDayKey(manilaMidnightUtc(i))
      if (playedDayKeys.has(key)) current += 1
      else if (i === 0) continue // today not played yet still counts yesterday's streak
      else break
    }
    let best = 0, run = 0
    for (let i = 89; i >= 0; i--) {
      const key = manilaDayKey(manilaMidnightUtc(i))
      if (playedDayKeys.has(key)) { run += 1; best = Math.max(best, run) } else run = 0
    }
    const days7 = Array.from({ length: 7 }, (_, i) => playedDayKeys.has(manilaDayKey(manilaMidnightUtc(6 - i))))

    // ── Pao's message + a suggestion ──────────────────────────────────────
    const playedGameIds = new Set(completedRecentLookback.map((s) => String(s.game_id)))
    const notYetPlayed = games.find((g) => !playedGameIds.has(String(g._id)))
    const suggestedGameId = notYetPlayed ? String(notYetPlayed._id) : null
    const paoMessage = completedInRange.length > 0
      ? `Great job this ${range}, ${name}! You played ${completedInRange.length} game${completedInRange.length === 1 ? '' : 's'}.${notYetPlayed ? ` Let's try ${notYetPlayed.name} next!` : ''}`
      : `Let's play a game together, ${name}!`

    return res.status(200).json({
      name,
      level, xp, xpMax,
      badgeCount: earnedCodes.size,
      headline: 'Getting better at everyday skills practice!',
      streak: { current, best, days: days7 },
      kpis,
      moreThanBefore,
      types: [...typeSet],
      skills,
      badges,
      nextBadge,
      recent,
      week,
      paoMessage,
      suggestedGameId,
    })
  } catch (err) {
    console.error('patient/progress error:', err)
    return res.status(500).json({ error: err.message || 'Could not load progress.' })
  }
}
