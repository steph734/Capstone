// GET /api/therapist/gamified/patients/:patientId?email=&range=7|30|90
// -> the full per-patient Gamified Stats dashboard. A descriptive summary of
// recorded sessions only — no prediction, no diagnosis. The therapist must
// be the one actually assigned to this patient (same appointments-based
// link used everywhere else), or this returns 403.
//
// Known gap: the game_sessions schema has no per-response timing data
// (only a whole-session duration), so there is no honest "response time"
// series to report — that half of the reference design is left out rather
// than invented.
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
const STAT_KEYS = ['intelligence', 'focus', 'resistance', 'creativity', 'speed', 'memory']
const STAT_LABEL = { intelligence: 'Intelligence', focus: 'Focus', resistance: 'Resistance', creativity: 'Creativity', speed: 'Speed', memory: 'Memory' }

function manilaDayKey(d) { return new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10) }
function manilaMidnightUtc(daysAgo) {
  const now = new Date(Date.now() + MANILA_OFFSET_MS)
  now.setUTCHours(0, 0, 0, 0)
  now.setUTCDate(now.getUTCDate() - daysAgo)
  return new Date(now.getTime() - MANILA_OFFSET_MS)
}
function mondayWeekKey(d) {
  const manila = new Date(new Date(d).getTime() + MANILA_OFFSET_MS)
  const day = manila.getUTCDay()
  manila.setUTCDate(manila.getUTCDate() - ((day + 6) % 7))
  manila.setUTCHours(0, 0, 0, 0)
  return manila.toISOString().slice(0, 10)
}
function xpToNext(level) { return 100 + (Math.max(1, level) - 1) * 50 }
function ageFromBirthdate(birthdate) {
  if (!birthdate) return null
  const now = new Date()
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}
function largestRemainderPercent(counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return counts.map(() => 0)
  const floors = counts.map((c) => Math.floor((c / total) * 100))
  let remaining = 100 - floors.reduce((a, b) => a + b, 0)
  const order = counts.map((c, i) => [((c / total) * 100) - Math.floor((c / total) * 100), i]).sort((a, b) => b[0] - a[0])
  const result = [...floors]
  for (let i = 0; i < remaining; i++) result[order[i % order.length][1]] += 1
  return result
}
// Weighted by attempts (sum correct / sum attempts), per the analytics rules.
function weightedAccuracy(sessions) {
  let correct = 0, attempts = 0
  for (const s of sessions) { correct += s.result?.correct || 0; attempts += s.result?.attempts || 0 }
  return attempts > 0 ? (correct / attempts) * 100 : null
}
function sessionAccuracy(s) {
  const c = s.result?.correct || 0, a = s.result?.attempts || 0
  return a > 0 ? (c / a) * 100 : null
}
function delta(curr, prev, hadPrev) {
  if (!hadPrev || curr === null || prev === null) return null
  return Math.round((curr - prev) * 10) / 10
}
function activeDays(sessions) { return new Set(sessions.map((s) => manilaDayKey(s.completed_at))).size }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const patientId = String(req.params?.patientId || '')
  if (!mongoose.isValidObjectId(patientId)) return res.status(400).json({ error: 'Invalid patient id.' })
  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })
  const days = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const db = await getDb()
    const pid = new mongoose.Types.ObjectId(patientId)

    // Access check: this therapist must actually be assigned to this patient.
    const linked = await db.collection('appointments').findOne({ employee_id: employee._id, patient_id: pid })
    if (!linked) return res.status(403).json({ error: "You don't have access to this patient." })

    const from = manilaMidnightUtc(days - 1)
    const toExclusive = new Date(manilaMidnightUtc(-1).getTime())
    const prevFrom = manilaMidnightUtc(days * 2 - 1)
    const prevTo = from

    const [patient, profile, allBadges, earnedBadges, games, curSessions, prevSessions, recentLookback] = await Promise.all([
      db.collection('patients').findOne({ _id: pid }, { projection: { first_name: 1, last_name: 1, birthdate: 1 } }),
      db.collection('pao_profiles').findOne({ patient_id: pid }),
      db.collection('badges').find({ is_active: true, status: 'active' }).sort({ sort_order: 1, name: 1 }).toArray(),
      db.collection('patient_badges').find({ patient_id: pid }).toArray(),
      db.collection('games').find({}, { projection: { name: 1, therapy_type: 1 } }).toArray(),
      db.collection('game_sessions').find({ patient_id: pid, status: 'completed', completed_at: { $gte: from, $lt: toExclusive } }).sort({ completed_at: 1 }).toArray(),
      db.collection('game_sessions').find({ patient_id: pid, status: 'completed', completed_at: { $gte: prevFrom, $lt: prevTo } }).toArray(),
      db.collection('game_sessions').find({ patient_id: pid, status: 'completed' }).sort({ completed_at: -1 }).limit(200).toArray(),
    ])
    if (!patient) return res.status(404).json({ error: 'Patient not found.' })

    const gameById = new Map(games.map((g) => [String(g._id), g]))
    const name = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Unknown'
    const age = ageFromBirthdate(patient.birthdate)
    const level = profile?.level || 1
    const xp = profile?.xp || 0
    const xpMax = xpToNext(level)
    const lastPlayedAt = recentLookback[0]?.completed_at || null
    const favoriteGame = (() => {
      const counts = new Map()
      for (const s of recentLookback) counts.set(String(s.game_id), (counts.get(String(s.game_id)) || 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      return top ? gameById.get(top[0])?.name || null : null
    })()

    // ── KPIs ──────────────────────────────────────────────────────────────
    const curAccuracy = weightedAccuracy(curSessions)
    const prevAccuracy = weightedAccuracy(prevSessions)
    const curActive = activeDays(curSessions)
    const prevActive = activeDays(prevSessions)
    const playedDayKeys = new Set(recentLookback.filter((s) => s.completed_at >= manilaMidnightUtc(89)).map((s) => manilaDayKey(s.completed_at)))
    let currentStreak = 0
    for (let i = 0; i < 90; i++) {
      const key = manilaDayKey(manilaMidnightUtc(i))
      if (playedDayKeys.has(key)) currentStreak += 1
      else if (i === 0) continue
      else break
    }

    const kpis = {
      games: { value: curSessions.length, previous: prevSessions.length, change: delta(curSessions.length, prevSessions.length, true) },
      accuracy: { value: curAccuracy, previous: prevAccuracy, change: delta(curAccuracy, prevAccuracy, curAccuracy !== null && prevAccuracy !== null) },
      activeDays: { value: curActive, daysInRange: days, previous: prevActive, change: delta(curActive, prevActive, true) },
      currentStreak: { value: currentStreak },
    }

    // ── Accuracy over time (per-session points, newest-last) ────────────
    const series = curSessions.filter((s) => sessionAccuracy(s) !== null).map((s) => ({
      date: manilaDayKey(s.completed_at), value: Math.round(sessionAccuracy(s) * 10) / 10,
    }))
    const trend = series.length >= 5 ? (() => {
      const ys = series.map((p) => p.value)
      const n = ys.length
      const xs = ys.map((_, i) => i)
      const meanX = xs.reduce((a, b) => a + b, 0) / n
      const meanY = ys.reduce((a, b) => a + b, 0) / n
      const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0)
      const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0)
      const slope = den ? num / den : 0
      if (Math.abs(slope) < 0.5) return 'steady'
      return slope > 0 ? 'improving' : 'needs more practice'
    })() : 'not_enough_data'

    // ── Weekly (zero-filled) + top games + share by type ─────────────────
    const weekKeys = []
    for (let d = new Date(from); d < toExclusive; d = new Date(d.getTime() + 86400000)) {
      const wk = mondayWeekKey(d)
      if (!weekKeys.includes(wk)) weekKeys.push(wk)
    }
    const weekCounts = new Map(weekKeys.map((k) => [k, 0]))
    for (const s of curSessions) { const wk = mondayWeekKey(s.completed_at); if (weekCounts.has(wk)) weekCounts.set(wk, weekCounts.get(wk) + 1) }
    const weekly = weekKeys.map((k, i) => ({ weekStart: k, label: `Wk ${i + 1}`, completed: weekCounts.get(k) }))

    const gameCounts = new Map()
    for (const s of curSessions) gameCounts.set(String(s.game_id), (gameCounts.get(String(s.game_id)) || 0) + 1)
    const topGames = [...gameCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([gameId, count]) => ({ gameId, name: gameById.get(gameId)?.name || 'Game', count }))

    const typeCounts = new Map()
    const typeMinutes = new Map()
    for (const s of curSessions) {
      const t = gameById.get(String(s.game_id))?.therapy_type
      if (!t) continue
      const label = t.charAt(0).toUpperCase() + t.slice(1)
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1)
      typeMinutes.set(label, (typeMinutes.get(label) || 0) + Math.min(3600, s.result?.duration_seconds || 0) / 60)
    }
    const typeEntries = [...typeCounts.entries()]
    const typeShares = largestRemainderPercent(typeEntries.map(([, c]) => c))
    const shareByType = typeEntries.map(([type, count], i) => ({ type, games: count, minutes: Math.round(typeMinutes.get(type) || 0), share: typeShares[i] }))
    const totalMinutes = Math.round([...typeMinutes.values()].reduce((a, b) => a + b, 0))

    // ── Session analytics per therapy type (accuracy series + last 3) ────
    const analytics = {}
    for (const type of ['cognitive', 'occupational', 'physical', 'speech']) {
      const typeSessions = curSessions.filter((s) => (gameById.get(String(s.game_id))?.therapy_type || '').toLowerCase() === type)
      analytics[type] = {
        accuracy: typeSessions.filter((s) => sessionAccuracy(s) !== null).map((s) => ({ date: manilaDayKey(s.completed_at), value: Math.round(sessionAccuracy(s) * 10) / 10 })),
        sessions: typeSessions.slice(-3).reverse().map((s) => ({
          date: manilaDayKey(s.completed_at),
          name: gameById.get(String(s.game_id))?.name || 'Game',
          accuracy: sessionAccuracy(s) !== null ? Math.round(sessionAccuracy(s)) : null,
          minutes: Math.round((s.result?.duration_seconds || 0) / 60),
        })),
      }
    }

    // ── Character stats: live value + gain from sessions this month ─────
    const monthStart = manilaMidnightUtc(29)
    const gainThisMonth = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
    for (const s of recentLookback) {
      if (s.completed_at < monthStart) break // sorted desc, stop once we pass the window
      const gains = s.reward?.stat_gains || {}
      for (const k of STAT_KEYS) gainThisMonth[k] += Number(gains[k]) || 0
    }
    const characterStats = STAT_KEYS.map((k) => ({ key: k, label: STAT_LABEL[k], value: profile?.stats?.[k] ?? 5, change: gainThisMonth[k] || null }))

    // ── Badges ────────────────────────────────────────────────────────────
    const earnedCodes = new Set(earnedBadges.map((b) => b.badge_code))
    const badgesOut = allBadges.map((b) => ({ code: b.code, name: b.name, shape: b.art?.shape || 'circle', colour: b.art?.color || 'gold', symbol: b.art?.symbol || 'star', earned: earnedCodes.has(b.code) }))
    const newThisRange = earnedBadges.filter((b) => b.earned_at >= from && b.earned_at < toExclusive).length
    const nextBadge = badgesOut.find((b) => !b.earned) || null

    // ── Recent sessions (paginate client-side; cap 100) ───────────────────
    const recentSessions = recentLookback.slice(0, 100).map((s) => ({
      date: manilaDayKey(s.completed_at),
      game: gameById.get(String(s.game_id))?.name || 'Game',
      accuracy: sessionAccuracy(s) !== null ? Math.round(sessionAccuracy(s)) : null,
      hints: s.result?.hints_used || 0,
      minutes: Math.round((s.result?.duration_seconds || 0) / 60),
    }))

    return res.status(200).json({
      profile: { id: patientId, name, age, level, xp, xpMax, lastPlayedAt, favoriteGame },
      kpis,
      series, trend,
      weekly, topGames, shareByType, totalMinutes,
      analytics,
      characterStats,
      badges: badgesOut, nextBadge, newThisRange,
      recentSessions,
      meta: {
        range: { days, from: from.toISOString(), to: toExclusive.toISOString(), tz: 'Asia/Manila' },
        definitions: {
          games: 'Number of completed games in the selected date range.',
          accuracy: 'Correct answers divided by attempts, summed across every completed game in the range (not a simple average of percentages).',
          activeDays: 'Number of distinct days with at least one completed game, out of the days in this range.',
          currentStreak: 'Consecutive days ending today (or yesterday, if nothing has been played yet today) with at least one completed game.',
        },
      },
    })
  } catch (err) {
    console.error('therapist/gamified/patients/:id error:', err)
    return res.status(500).json({ error: err.message || 'Could not load this patient’s stats.' })
  }
}
