// Shared server helpers for the owner-only Gamified Activities endpoints
// (owner-gamified-overview.js, owner-gamified-patient.js,
// owner-gamified-notify.js). Same descriptive-summary rules as the therapist
// version: plain numbers, never a diagnosis or prediction.
//
// Patient -> therapist -> branch: the app has no assignment collection, so a
// patient's therapist is whoever they most recently had an appointment with
// (same appointments-based link used everywhere else) and their branch is
// that therapist's branch.
import { getDb } from './mongo.js'

export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 86400000

export function manilaDayKey(d) { return new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10) }
export function manilaMidnightUtc(daysAgo) {
  const now = new Date(Date.now() + MANILA_OFFSET_MS)
  now.setUTCHours(0, 0, 0, 0)
  now.setUTCDate(now.getUTCDate() - daysAgo)
  return new Date(now.getTime() - MANILA_OFFSET_MS)
}
export function mondayWeekKey(d) {
  const manila = new Date(new Date(d).getTime() + MANILA_OFFSET_MS)
  manila.setUTCDate(manila.getUTCDate() - ((manila.getUTCDay() + 6) % 7))
  manila.setUTCHours(0, 0, 0, 0)
  return manila.toISOString().slice(0, 10)
}
export function xpToNext(level) { return 100 + (Math.max(1, level) - 1) * 50 }
export function ageFromBirthdate(birthdate) {
  if (!birthdate) return null
  const now = new Date()
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}
export function largestRemainderPercent(counts) {
  const total = counts.reduce((a, b) => a + b, 0)
  if (!total) return counts.map(() => 0)
  const raw = counts.map((c) => (c / total) * 100)
  const floors = raw.map(Math.floor)
  const remaining = 100 - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])
  const result = [...floors]
  for (let i = 0; i < remaining; i++) result[order[i % order.length][1]] += 1
  return result
}
// Weighted by attempts (sum correct / sum attempts), per the analytics rules.
export function weightedAccuracy(sessions) {
  let correct = 0, attempts = 0
  for (const s of sessions) { correct += s.result?.correct || 0; attempts += s.result?.attempts || 0 }
  return attempts > 0 ? (correct / attempts) * 100 : null
}
export const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10)
export function delta(curr, prev) {
  if (curr === null || prev === null || curr === undefined || prev === undefined) return null
  return round1(curr - prev)
}

// Owner check. There is no session/token auth anywhere in this app (see
// api/_lib/stream/identity.js), so like every other route the caller is
// identified by the login email — this verifies that email belongs to an
// active, non-archived user with the Owner role.
export async function requireOwner(req, res) {
  const email = String((req.method === 'GET' ? req.query.email : req.body?.email) || '').trim().toLowerCase()
  if (!email) { res.status(400).json({ error: 'Missing email.' }); return null }
  const db = await getDb()
  const user = await db.collection('users').findOne({ email, role: 'Owner', is_archived: { $ne: true } })
  if (!user) { res.status(403).json({ error: 'Only the clinic owner can view this.' }); return null }
  return { db, user }
}

export function rangeBounds(days) {
  const from = manilaMidnightUtc(days - 1)
  return { from, toExclusive: manilaMidnightUtc(-1), prevFrom: manilaMidnightUtc(days * 2 - 1), prevTo: from }
}

// Every patient with at least one appointment, tagged with their current
// therapist + branch.
export async function loadRoster(db) {
  const [links, employees, branches] = await Promise.all([
    db.collection('appointments').aggregate([
      { $match: { patient_id: { $ne: null }, employee_id: { $ne: null } } },
      { $group: { _id: { p: '$patient_id', e: '$employee_id' }, last: { $max: '$session_date' }, n: { $sum: 1 } } },
    ]).toArray(),
    db.collection('employees').find({}, { projection: { first_name: 1, last_name: 1, email: 1, branch_id: 1 } }).toArray(),
    db.collection('branchs').find({}).toArray(),
  ])
  const branchName = new Map(branches.map((b) => [String(b._id), b.branch_name]))
  const empById = new Map(employees.map((e) => [String(e._id), e]))

  const primary = new Map() // patientId -> link
  for (const l of links) {
    const key = String(l._id.p)
    const cur = primary.get(key)
    const better = !cur || String(l.last || '') > String(cur.last || '') || (String(l.last || '') === String(cur.last || '') && l.n > cur.n)
    if (better) primary.set(key, l)
  }

  const patientIds = [...primary.keys()].map((k) => links.find((l) => String(l._id.p) === k)._id.p)
  const patients = await db.collection('patients').find({ _id: { $in: patientIds } }, { projection: { first_name: 1, last_name: 1, birthdate: 1 } }).toArray()

  const roster = patients.map((p) => {
    const link = primary.get(String(p._id))
    const emp = empById.get(String(link._id.e))
    const bId = emp?.branch_id ? String(emp.branch_id) : ''
    return {
      id: String(p._id),
      _oid: p._id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
      age: ageFromBirthdate(p.birthdate),
      therapistId: emp ? String(emp._id) : '',
      therapistName: emp ? [emp.first_name, emp.last_name].filter(Boolean).join(' ') : 'Unassigned',
      therapistEmail: emp?.email || '',
      branchId: bId,
      branchName: branchName.get(bId) || 'No branch',
    }
  })

  const therapistMap = new Map()
  for (const r of roster) {
    if (r.therapistId && !therapistMap.has(r.therapistId)) {
      therapistMap.set(r.therapistId, { id: r.therapistId, name: r.therapistName, email: r.therapistEmail, branchId: r.branchId, branchName: r.branchName })
    }
  }
  const branchMap = new Map()
  for (const r of roster) if (r.branchId && !branchMap.has(r.branchId)) branchMap.set(r.branchId, { id: r.branchId, name: r.branchName })
  // Every active branch is a valid filter choice, even one with no patients yet.
  for (const b of branches) if (b.status !== 'Inactive' && !branchMap.has(String(b._id))) branchMap.set(String(b._id), { id: String(b._id), name: b.branch_name })

  return {
    roster,
    therapists: [...therapistMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    branches: [...branchMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')

// Everything the owner Overview page shows, for the (optionally) filtered
// set of patients. `days` is 7 | 30 | 90.
export async function buildOverview(db, { branchId = '', therapistId = '', days = 30 }) {
  const { roster: fullRoster, therapists, branches } = await loadRoster(db)
  const roster = fullRoster.filter((r) => (!branchId || r.branchId === branchId) && (!therapistId || r.therapistId === therapistId))
  const { from, toExclusive, prevFrom, prevTo } = rangeBounds(days)
  const ids = roster.map((r) => r._oid)
  const rosterById = new Map(roster.map((r) => [r.id, r]))

  const [profiles, badgeDocs, games, badgeDefs, curSessions, prevSessions, lastAgg] = await Promise.all([
    db.collection('pao_profiles').find({ patient_id: { $in: ids } }).toArray(),
    db.collection('patient_badges').find({ patient_id: { $in: ids } }).toArray(),
    db.collection('games').find({}, { projection: { name: 1, therapy_type: 1 } }).toArray(),
    db.collection('badges').find({ is_active: true, status: { $in: ['active', null] } }).project({ code: 1 }).toArray(),
    db.collection('game_sessions').find({ patient_id: { $in: ids }, status: 'completed', completed_at: { $gte: from, $lt: toExclusive } }).sort({ completed_at: 1 }).toArray(),
    db.collection('game_sessions').find({ patient_id: { $in: ids }, status: 'completed', completed_at: { $gte: prevFrom, $lt: prevTo } }).toArray(),
    db.collection('game_sessions').aggregate([
      { $match: { patient_id: { $in: ids }, status: 'completed' } },
      { $group: { _id: '$patient_id', last: { $max: '$completed_at' } } },
    ]).toArray(),
  ])
  const gameById = new Map(games.map((g) => [String(g._id), g]))
  const profileBy = new Map(profiles.map((p) => [String(p.patient_id), p]))
  const lastAll = new Map(lastAgg.map((l) => [String(l._id), l.last]))

  const group = (sessions) => {
    const m = new Map()
    for (const s of sessions) { const k = String(s.patient_id); if (!m.has(k)) m.set(k, []); m.get(k).push(s) }
    return m
  }
  const curBy = group(curSessions)
  const prevBy = group(prevSessions)
  const badgesBy = new Map()
  for (const b of badgeDocs) badgesBy.set(String(b.patient_id), (badgesBy.get(String(b.patient_id)) || 0) + 1)

  // ── KPIs ────────────────────────────────────────────────────────────────
  const playingNow = new Set(curBy.keys())
  const playingPrev = new Set(prevBy.keys())
  const levels = roster.map((r) => profileBy.get(r.id)?.level || 1)
  const avgLevel = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0
  // No stored level history, so "change" = levels gained during this period,
  // read from each patient's first session in the range (reward.level_before).
  const startLevels = roster.map((r) => {
    const first = (curBy.get(r.id) || []).find((s) => s.reward?.level_before)
    return first ? first.reward.level_before : (profileBy.get(r.id)?.level || 1)
  })
  const avgStartLevel = startLevels.length ? startLevels.reduce((a, b) => a + b, 0) / startLevels.length : 0
  const avgLevelDelta = roster.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length - avgStartLevel) * 10) / 10 : null
  let top = null
  roster.forEach((r) => { const l = profileBy.get(r.id)?.level || 1; if (!top || l > top.level) top = { name: r.name, level: l } })
  const badgesNow = badgeDocs.filter((b) => b.earned_at >= from && b.earned_at < toExclusive)
  const badgesPrev = badgeDocs.filter((b) => b.earned_at >= prevFrom && b.earned_at < prevTo)
  const accNow = weightedAccuracy(curSessions)
  const kpis = {
    patientsPlaying: playingNow.size,
    patientsDelta: playingNow.size - playingPrev.size,
    enrolled: roster.length,
    playingPct: roster.length ? Math.round((playingNow.size / roster.length) * 100) : 0,
    avgLevel, avgLevelDelta, highest: top,
    games: curSessions.length, gamesDelta: curSessions.length - prevSessions.length, avgAccuracy: accNow === null ? null : Math.round(accNow),
    badges: badgesNow.length, badgesDelta: badgesNow.length - badgesPrev.length,
    badgeTypes: new Set(badgesNow.map((b) => b.badge_code)).size,
    badgeTypesTotal: badgeDefs.length,
  }

  // ── Weekly lines: one per branch, or per therapist when one branch is chosen ──
  const byTherapistLines = Boolean(branchId)
  const keyOf = (r) => (byTherapistLines ? r.therapistId : r.branchId)
  const nameOf = (r) => (byTherapistLines ? r.therapistName : r.branchName)
  const weekKeys = []
  for (let d = new Date(from); d < toExclusive; d = new Date(d.getTime() + DAY_MS)) {
    const wk = mondayWeekKey(d); if (!weekKeys.includes(wk)) weekKeys.push(wk)
  }
  const lines = new Map()
  for (const r of roster) {
    const k = keyOf(r) || 'none'
    if (!lines.has(k)) lines.set(k, { key: k, name: nameOf(r) || 'Unassigned', points: weekKeys.map(() => 0) })
  }
  for (const s of curSessions) {
    const r = rosterById.get(String(s.patient_id)); if (!r) continue
    const line = lines.get(keyOf(r) || 'none'); const i = weekKeys.indexOf(mondayWeekKey(s.completed_at))
    if (line && i >= 0) line.points[i] += 1
  }
  const weekly = { weeks: weekKeys.map((k, i) => ({ weekStart: k, label: `Wk ${i + 1}` })), lines: [...lines.values()], by: byTherapistLines ? 'therapist' : 'branch' }

  // ── Branch comparison ──────────────────────────────────────────────────
  const branchAgg = new Map()
  for (const r of roster) {
    const k = r.branchId || 'none'
    if (!branchAgg.has(k)) branchAgg.set(k, { id: k, name: r.branchName, patients: 0, sessions: [] })
    branchAgg.get(k).patients += 1
    branchAgg.get(k).sessions.push(...(curBy.get(r.id) || []))
  }
  const branchComparison = [...branchAgg.values()].map((b) => ({ id: b.id, name: b.name, patients: b.patients, games: b.sessions.length, accuracy: b.sessions.length ? Math.round(weightedAccuracy(b.sessions) ?? 0) : null }))
    .sort((a, b) => b.games - a.games)
  const withGames = branchComparison.filter((b) => b.games > 0)
  const mostActive = withGames[0] ? { id: withGames[0].id, name: withGames[0].name, games: withGames[0].games } : null
  const supportPool = withGames.filter((b) => b.accuracy !== null)
  const needsSupportB = supportPool.length > 1 ? [...supportPool].sort((a, b) => a.accuracy - b.accuracy)[0] : null
  const needsSupport = needsSupportB ? { id: needsSupportB.id, name: needsSupportB.name, accuracy: needsSupportB.accuracy } : null

  // ── By therapy type ─────────────────────────────────────────────────────
  const typeCounts = new Map()
  for (const s of curSessions) {
    const t = gameById.get(String(s.game_id))?.therapy_type; if (!t) continue
    typeCounts.set(cap(t), (typeCounts.get(cap(t)) || 0) + 1)
  }
  const typeEntries = [...typeCounts.entries()]
  const shares = largestRemainderPercent(typeEntries.map(([, c]) => c))
  const byType = typeEntries.map(([type, count], i) => ({ type, games: count, share: shares[i] }))

  // ── Most played games (top 5: count + avg accuracy) ──────────────────────
  const gameAgg = new Map()
  for (const s of curSessions) {
    const k = String(s.game_id); if (!gameAgg.has(k)) gameAgg.set(k, [])
    gameAgg.get(k).push(s)
  }
  const topGames = [...gameAgg.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)
    .map(([gameId, ss]) => ({ gameId, name: gameById.get(gameId)?.name || 'Game', count: ss.length, accuracy: ss.length ? Math.round(weightedAccuracy(ss) ?? 0) : null }))

  // ── Therapist engagement ────────────────────────────────────────────────
  const thAgg = new Map()
  for (const r of roster) {
    const k = r.therapistId || 'none'
    if (!thAgg.has(k)) thAgg.set(k, { id: k, name: r.therapistName, email: r.therapistEmail, branchName: r.branchName, assigned: 0, playing: 0, sessions: [] })
    const t = thAgg.get(k); t.assigned += 1
    const ss = curBy.get(r.id) || []
    if (ss.length) t.playing += 1
    t.sessions.push(...ss)
  }
  const therapistEngagement = [...thAgg.values()].map((t) => ({
    id: t.id, name: t.name, branch: t.branchName, playing: t.playing, assigned: t.assigned, games: t.sessions.length,
    accuracy: t.sessions.length ? Math.round(weightedAccuracy(t.sessions) ?? 0) : null,
  })).sort((a, b) => b.games - a.games)

  // ── Needs attention ─────────────────────────────────────────────────────
  const now = Date.now()
  const needsAttention = []
  for (const r of roster) {
    const last = lastAll.get(r.id)
    const curAcc = weightedAccuracy(curBy.get(r.id) || [])
    const prevAcc = weightedAccuracy(prevBy.get(r.id) || [])
    let reason = null
    if (!last) reason = { type: 'not_started', chip: 'Not started', detail: 'Assigned but never played' }
    else if (now - new Date(last).getTime() >= 7 * DAY_MS) {
      const d = Math.floor((now - new Date(last).getTime()) / DAY_MS)
      reason = { type: 'inactive', chip: 'Inactive', detail: `No games in ${d} days` }
    } else if (curAcc !== null && prevAcc !== null && prevAcc - curAcc >= 15) {
      const drop = Math.round(prevAcc - curAcc)
      reason = { type: 'accuracy_drop', chip: `↓ ${drop} pts`, detail: `Accuracy ${Math.round(prevAcc)}% → ${Math.round(curAcc)}%` }
    }
    if (reason) needsAttention.push({ patientId: r.id, name: r.name, branch: r.branchName, branchId: r.branchId, therapistId: r.therapistId, therapist: r.therapistName, therapistEmail: r.therapistEmail, ...reason })
  }

  // ── Patients table ──────────────────────────────────────────────────────
  const patients = roster.map((r) => {
    const profile = profileBy.get(r.id); const level = profile?.level || 1
    const cur = curBy.get(r.id) || []
    const acc = weightedAccuracy(cur); const prevAcc = weightedAccuracy(prevBy.get(r.id) || [])
    return {
      id: r.id, name: r.name, age: r.age, branch: r.branchName, therapist: r.therapistName,
      level, xp: profile?.xp || 0, xpMax: xpToNext(level), games: cur.length,
      accuracy: acc === null ? null : Math.round(acc),
      accuracyFalling: acc !== null && prevAcc !== null && prevAcc - acc >= 5,
      badges: badgesBy.get(r.id) || 0,
      lastPlayedAt: lastAll.get(r.id) || null,
    }
  })

  // ── Pao's summary (template from the numbers only) ───────────────────────
  const paoSummary = (() => {
    if (!roster.length) return 'No patients match these filters yet.'
    const parts = [`${playingNow.size} of ${roster.length} patients played this period (${kpis.patientsDelta >= 0 ? '+' : ''}${kpis.patientsDelta} vs the previous period).`]
    if (mostActive) parts.push(`${mostActive.name} leads with ${mostActive.games} games${branchComparison.find((b) => b.id === mostActive.id)?.accuracy != null ? ` at ${branchComparison.find((b) => b.id === mostActive.id).accuracy}% accuracy` : ''}.`)
    if (needsSupport) parts.push(`${needsSupport.name}'s accuracy is lowest at ${needsSupport.accuracy}%.`)
    parts.push(needsAttention.length ? `${needsAttention.length} patient${needsAttention.length === 1 ? '' : 's'} could use a check-in.` : 'No patients need a check-in right now.')
    return parts.join(' ')
  })()

  return {
    range: { days, from: from.toISOString(), to: toExclusive.toISOString() },
    options: { branches, therapists },
    kpis, weekly, branchComparison, mostActive, needsSupport, byType, topGames,
    therapistEngagement, needsAttention, patients, paoSummary,
    focusBranch: needsSupport || mostActive || null,
  }
}

// Branch averages for one patient's branch over the same period (used by the
// owner patient page): per-patient averages of games, weighted accuracy,
// active days and hints per game, plus the weekly accuracy line.
export async function branchAverages(db, { branchId, days }) {
  const { roster } = await loadRoster(db)
  const mates = roster.filter((r) => r.branchId === branchId)
  const { from, toExclusive } = rangeBounds(days)
  const ids = mates.map((r) => r._oid)
  const sessions = ids.length
    ? await db.collection('game_sessions').find({ patient_id: { $in: ids }, status: 'completed', completed_at: { $gte: from, $lt: toExclusive } }).toArray()
    : []
  const by = new Map()
  for (const s of sessions) { const k = String(s.patient_id); if (!by.has(k)) by.set(k, []); by.get(k).push(s) }
  const n = mates.length || 1
  const sum = (f) => mates.reduce((a, r) => a + f(by.get(r.id) || []), 0)
  const hintsTotal = sessions.reduce((a, s) => a + (s.result?.hints_used || 0), 0)
  const weekKeys = []
  for (let d = new Date(from); d < toExclusive; d = new Date(d.getTime() + DAY_MS)) {
    const wk = mondayWeekKey(d); if (!weekKeys.includes(wk)) weekKeys.push(wk)
  }
  const weeklyAccuracy = weekKeys.map((wk, i) => {
    const acc = weightedAccuracy(sessions.filter((s) => mondayWeekKey(s.completed_at) === wk))
    return { weekStart: wk, label: `Wk ${i + 1}`, value: acc === null ? null : round1(acc) }
  })
  return {
    patients: mates.length,
    games: round1(sum((ss) => ss.length) / n),
    accuracy: sessions.length ? round1(weightedAccuracy(sessions)) : null,
    activeDays: round1(sum((ss) => new Set(ss.map((s) => manilaDayKey(s.completed_at))).size) / n),
    hintsPerGame: sessions.length ? round1(hintsTotal / sessions.length) : null,
    weeklyAccuracy,
  }
}

