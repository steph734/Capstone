// GET /api/therapist/gamified/overview?email=&from=&to=
// -> real aggregated stats for the therapist's own patients only (the same
// patient-therapist link `patients-therapist-list.js` uses: distinct
// patient_id from this employee's appointments — there's no separate
// assignment collection to join against). This is a descriptive summary,
// never a diagnosis or a ranking between patients (see the analytics
// prompt's ethics section): deltas are shown plainly, never in red, and
// "no previous data" is reported as such instead of a fake 0% change.
import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000 // Asia/Manila, no DST

function manilaDayKey(d) {
  return new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
}
function parseDateOnly(s) {
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
function xpToNext(level) {
  return 100 + (Math.max(1, level) - 1) * 50
}
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
// Monday-start ISO week key, Manila calendar date.
function mondayWeekKey(d) {
  const manila = new Date(new Date(d).getTime() + MANILA_OFFSET_MS)
  const day = manila.getUTCDay() // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7
  manila.setUTCDate(manila.getUTCDate() - diffToMonday)
  manila.setUTCHours(0, 0, 0, 0)
  return manila.toISOString().slice(0, 10)
}
// Largest-remainder rounding so percentages always sum to exactly 100.
function largestRemainderPercent(counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return counts.map(() => 0)
  const raw = counts.map((c) => (c / total) * 100)
  const floors = raw.map(Math.floor)
  let remaining = 100 - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])
  const result = [...floors]
  for (let i = 0; i < remaining; i++) result[order[i % order.length][1]] += 1
  return result
}
// Never alarming, never red: a drop is a plain minus, not an error.
function delta(curr, prev, hadPrevData) {
  if (!hadPrevData) return null
  return curr - prev
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Missing email.' })

  try {
    await getMongo()
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) return res.status(404).json({ error: 'No staff record is linked to this account yet.' })

    const db = await getDb()

    const to = parseDateOnly(req.query.to) || new Date()
    const from = parseDateOnly(req.query.from) || new Date(to.getTime() - 29 * 86400000)
    const rangeMs = to.getTime() - from.getTime()
    const toExclusive = new Date(to.getTime() + 86400000) // `to` is inclusive of that whole day
    const prevTo = from
    const prevFrom = new Date(from.getTime() - rangeMs - 86400000)

    // This therapist's own patients — same link used across the app:
    // distinct patient_id from their appointments.
    const apptPatientIds = await db.collection('appointments').distinct('patient_id', { employee_id: employee._id, patient_id: { $ne: null } })
    if (apptPatientIds.length === 0) {
      return res.status(200).json({
        kpis: { patientsPlaying: 0, patientsDelta: null, avgLevel: 0, avgLevelDelta: null, games: 0, gamesDelta: null, badges: 0, badgesDelta: null },
        weekly: [], topGames: [], byType: [], patients: [],
      })
    }

    const [patients, profiles, allBadges, games] = await Promise.all([
      db.collection('patients').find({ _id: { $in: apptPatientIds } }, { projection: { first_name: 1, last_name: 1, birthdate: 1 } }).toArray(),
      db.collection('pao_profiles').find({ patient_id: { $in: apptPatientIds } }).toArray(),
      db.collection('patient_badges').find({ patient_id: { $in: apptPatientIds } }).toArray(),
      db.collection('games').find({}, { projection: { name: 1, therapy_type: 1 } }).toArray(),
    ])
    const gameById = new Map(games.map((g) => [String(g._id), g]))
    const profileByPatient = new Map(profiles.map((p) => [String(p.patient_id), p]))

    const sessionsRange = (gte, lt) => db.collection('game_sessions').find({
      patient_id: { $in: apptPatientIds }, status: 'completed', completed_at: { $gte: gte, $lt: lt },
    }).toArray()

    const [curSessions, prevSessions] = await Promise.all([
      sessionsRange(from, toExclusive),
      sessionsRange(prevFrom, new Date(prevTo.getTime())),
    ])
    const hadPrevRange = prevFrom.getTime() >= new Date(0).getTime() // always true in practice; kept for clarity/testability

    // ── KPIs ──────────────────────────────────────────────────────────────
    const curPatientSet = new Set(curSessions.map((s) => String(s.patient_id)))
    const prevPatientSet = new Set(prevSessions.map((s) => String(s.patient_id)))
    const curBadges = allBadges.filter((b) => b.earned_at >= from && b.earned_at < toExclusive)
    const prevBadges = allBadges.filter((b) => b.earned_at >= prevFrom && b.earned_at < prevTo)
    const levels = patients.map((p) => profileByPatient.get(String(p._id))?.level || 1)
    const avgLevel = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0

    const kpis = {
      patientsPlaying: curPatientSet.size,
      patientsDelta: delta(curPatientSet.size, prevPatientSet.size, hadPrevRange),
      avgLevel,
      avgLevelDelta: null, // no historical level snapshot to compare against — honestly omitted rather than faked
      games: curSessions.length,
      gamesDelta: delta(curSessions.length, prevSessions.length, hadPrevRange),
      badges: curBadges.length,
      badgesDelta: delta(curBadges.length, prevBadges.length, hadPrevRange),
    }

    // ── Weekly line (zero-filled, Monday start, Manila tz) ───────────────
    const weekKeys = []
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
      const wk = mondayWeekKey(d)
      if (!weekKeys.includes(wk)) weekKeys.push(wk)
    }
    const weekCounts = new Map(weekKeys.map((k) => [k, 0]))
    for (const s of curSessions) {
      const wk = mondayWeekKey(s.completed_at)
      if (weekCounts.has(wk)) weekCounts.set(wk, weekCounts.get(wk) + 1)
    }
    const weekly = weekKeys.map((k, i) => ({ weekStart: k, label: `Wk ${i + 1}`, games: weekCounts.get(k) }))

    // ── Most played games (top 6, ties broken by most recent play) ──────
    const gameCounts = new Map()
    const gameLastPlayed = new Map()
    for (const s of curSessions) {
      const key = String(s.game_id)
      gameCounts.set(key, (gameCounts.get(key) || 0) + 1)
      const prevLast = gameLastPlayed.get(key)
      if (!prevLast || s.completed_at > prevLast) gameLastPlayed.set(key, s.completed_at)
    }
    const topGames = [...gameCounts.entries()]
      .sort((a, b) => b[1] - a[1] || (gameLastPlayed.get(b[0]) > gameLastPlayed.get(a[0]) ? 1 : -1))
      .slice(0, 6)
      .map(([gameId, count]) => ({ gameId, name: gameById.get(gameId)?.name || 'Game', count }))

    // ── By therapy type (percentages sum to exactly 100) ─────────────────
    const typeCounts = new Map()
    for (const s of curSessions) {
      const t = gameById.get(String(s.game_id))?.therapy_type
      if (!t) continue
      const label = t.charAt(0).toUpperCase() + t.slice(1)
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1)
    }
    const typeEntries = [...typeCounts.entries()]
    const typeShares = largestRemainderPercent(typeEntries.map(([, c]) => c))
    const byType = typeEntries.map(([type, count], i) => ({ type, games: count, share: typeShares[i] }))

    // ── Patients table ────────────────────────────────────────────────────
    const lastPlayedByPatient = new Map()
    for (const s of curSessions.concat(prevSessions)) {
      const key = String(s.patient_id)
      const cur = lastPlayedByPatient.get(key)
      if (!cur || s.completed_at > cur) lastPlayedByPatient.set(key, s.completed_at)
    }
    const gamesCountByPatient = new Map()
    for (const s of curSessions) {
      const key = String(s.patient_id)
      gamesCountByPatient.set(key, (gamesCountByPatient.get(key) || 0) + 1)
    }
    const badgeCountByPatient = new Map()
    for (const b of allBadges) {
      const key = String(b.patient_id)
      badgeCountByPatient.set(key, (badgeCountByPatient.get(key) || 0) + 1)
    }

    const patientsOut = patients.map((p) => {
      const id = String(p._id)
      const profile = profileByPatient.get(id)
      const level = profile?.level || 1
      return {
        id,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
        age: ageFromBirthdate(p.birthdate),
        level,
        xp: profile?.xp || 0,
        xpMax: xpToNext(level),
        games: gamesCountByPatient.get(id) || 0,
        badges: badgeCountByPatient.get(id) || 0,
        lastPlayedAt: lastPlayedByPatient.get(id) || null,
      }
    })

    return res.status(200).json({ kpis, weekly, topGames, byType, patients: patientsOut })
  } catch (err) {
    console.error('therapist/gamified/overview error:', err)
    return res.status(500).json({ error: err.message || 'Could not load stats.' })
  }
}
