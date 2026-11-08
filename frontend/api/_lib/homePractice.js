// Home practice: games a therapist keeps unlocked after a session. Every rule is enforced here, on the server.
// All days and times are Asia/Manila (the clinic's timezone; there is no per-patient timezone in this app).
import { ObjectId } from 'mongodb'
import { HomePracticePlan } from './models/homePracticePlan.js'
import { HOME_PLAYS_PER_GAME } from './homeSetConfig.js'

const OFFSET = 8 * 3600 * 1000
const DAY = 86400000
const asDate = (d) => new Date(d)
export const dayKey = (d = new Date()) => new Date(asDate(d).getTime() + OFFSET).toISOString().slice(0, 10)
export const dayStart = (key) => new Date(`${key}T00:00:00+08:00`)
export const weekday = (d = new Date()) => new Date(asDate(d).getTime() + OFFSET).getUTCDay() // 0 = Sunday
const minuteOfDay = (d) => { const x = new Date(asDate(d).getTime() + OFFSET); return x.getUTCHours() * 60 + x.getUTCMinutes() }
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const oid = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }
// Monday 00:00 (Manila) of the week a moment falls in.
export const weekStart = (d = new Date()) => dayStart(dayKey(new Date(asDate(d).getTime() - ((weekday(d) + 6) % 7) * DAY)))

// A play's score as a whole percent: correct of attempts, else stars out of 3, else null.
export function playPercent(result) {
  if (!result) return null
  const a = Number(result.attempts)
  const c = Number(result.correct)
  if (Number.isFinite(a) && a > 0 && Number.isFinite(c)) return Math.round(Math.min(c, a) / a * 100)
  const s = Number(result.stars)
  if (Number.isFinite(s) && s > 0) return Math.round(Math.min(s, 3) / 3 * 100)
  return null
}
export const resultChip = (pct) => (pct == null ? null : pct >= 100 ? 'mastered' : pct >= 60 ? 'almost' : 'needs_practice')

// Validates the home settings a therapist sends. Returns { error } or { value }.
export function normalizeHomeSettings(b = {}) {
  const startsAt = new Date(b.startsAt)
  const endsAt = new Date(b.endsAt)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: 'Choose when home practice opens and when it ends.' }
  if (endsAt <= startsAt) return { error: 'Home practice must end after it opens.' }
  if (endsAt.getTime() - Date.now() > 90 * DAY) return { error: 'Home practice can stay open for 90 days at most.' }
  const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
  if (!days.length) return { error: 'Pick at least one practice day.' }
  const dailyStart = String(b.dailyStart || '16:00').slice(0, 5)
  const dailyEnd = String(b.dailyEnd || '19:00').slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(dailyStart) || !/^\d{2}:\d{2}$/.test(dailyEnd) || toMin(dailyEnd) <= toMin(dailyStart)) return { error: 'Home play hours must end after they start.' }
  const limit = Math.round(Number(b.dailyLimitMinutes ?? 15))
  if (!Number.isFinite(limit) || limit < 5 || limit > 120) return { error: 'The daily limit must be between 5 and 120 minutes.' }
  if (limit > toMin(dailyEnd) - toMin(dailyStart)) return { error: 'The daily limit is longer than the home play hours.' }
  const goal = Math.round(Number(b.goalPerGamePerWeek ?? 3))
  if (!Number.isFinite(goal) || goal < 1 || goal > 7) return { error: 'The weekly goal must be 1 to 7 plays per game.' }
  return {
    value: {
      starts_at: startsAt, ends_at: endsAt, days, daily_start: dailyStart, daily_end: dailyEnd, daily_limit_minutes: limit,
      goal_per_game_per_week: goal, notify_caregiver: b.notifyCaregiver !== false, save_to_progress: b.saveToProgress !== false, auto_level_up: Boolean(b.autoLevelUp),
    },
  }
}

// The patient's active plan; one that passed its end date is marked expired.
export async function activeHomePlan(patientId) {
  const plan = await HomePracticePlan.findOne({ patient_id: patientId, status: 'active' }).sort({ created_at: -1 })
  if (plan && plan.ends_at.getTime() < Date.now()) {
    await HomePracticePlan.updateOne({ _id: plan._id }, { $set: { status: 'expired' } })
    return null
  }
  return plan
}

// Seconds of home play used today under a plan (finished plays + the part of a running one, capped).
export async function homeSecondsToday(db, patientId, planId, now = new Date()) {
  const key = dayKey(now)
  const rows = await db.collection('game_sessions').find({
    patient_id: patientId, context: 'home', home_plan_id: planId, started_at: { $gte: dayStart(key), $lt: new Date(dayStart(key).getTime() + DAY) },
  }).project({ status: 1, started_at: 1, completed_at: 1, 'result.duration_seconds': 1 }).toArray()
  let total = 0
  for (const r of rows) {
    if (r.status === 'in_progress') total += Math.min(15 * 60, Math.max(0, (now - r.started_at) / 1000))
    else total += Number.isFinite(r.result?.duration_seconds) ? r.result.duration_seconds : Math.max(0, ((r.completed_at || now) - r.started_at) / 1000)
  }
  return Math.round(total)
}

// Is home practice open right now? reason: home_not_started | expired | home_day | home_hours | home_limit
export function homeWindow(plan, usedSeconds, now = new Date()) {
  const limit = plan.daily_limit_minutes * 60
  const base = { limitSeconds: limit, usedSeconds }
  if (plan.status !== 'active') return { ...base, open: false, reason: 'expired', secondsLeft: 0 }
  if (now < plan.starts_at) return { ...base, open: false, reason: 'home_not_started', secondsLeft: 0 }
  if (now > plan.ends_at) return { ...base, open: false, reason: 'expired', secondsLeft: 0 }
  if (!plan.days.includes(weekday(now))) return { ...base, open: false, reason: 'home_day', secondsLeft: 0 }
  const m = minuteOfDay(now)
  if (m < toMin(plan.daily_start) || m >= toMin(plan.daily_end)) return { ...base, open: false, reason: 'home_hours', secondsLeft: 0 }
  if (usedSeconds >= limit) return { ...base, open: false, reason: 'home_limit', secondsLeft: 0 }
  return { ...base, open: true, reason: null, secondsLeft: Math.max(0, Math.min(limit - usedSeconds, (toMin(plan.daily_end) - m) * 60)) }
}

// Server gate for one game at home. { ok, inPlan, reason, plan }
// Unique index so two requests can never both save the same home play number (a 4th play is impossible). Created once per server instance.
let homePlayIndex = null
export function ensureHomePlayIndex(db) {
  if (!homePlayIndex) {
    homePlayIndex = db.collection('game_sessions')
      .createIndex({ home_plan_id: 1, game_id: 1, home_play_number: 1 }, { unique: true, partialFilterExpression: { home_play_number: { $type: 'number' } }, name: 'home_play_number_unique' })
      .catch((err) => { console.error('home play index failed:', err.message); homePlayIndex = null })
  }
  return homePlayIndex
}

export async function checkHomeAccess(db, patientId, gameId) {
  const plan = await activeHomePlan(patientId)
  if (!plan) return { ok: false, inPlan: false, reason: 'no_plan' }
  if (!plan.games.some((g) => String(g.game_id) === String(gameId))) return { ok: false, inPlan: false, reason: 'not_assigned' }
  // Each home game can be played HOME_PLAYS_PER_GAME times per set; after that it is finished and locked.
  const playsDone = await db.collection('game_sessions').countDocuments({ patient_id: patientId, game_id: oid(gameId), context: 'home', home_plan_id: plan._id, status: 'completed' })
  if (playsDone >= HOME_PLAYS_PER_GAME) return { ok: false, inPlan: true, reason: 'game_finished', plan }
  const w = homeWindow(plan, await homeSecondsToday(db, patientId, plan._id))
  return w.open ? { ok: true, inPlan: true, plan } : { ok: false, inPlan: true, reason: w.reason, plan }
}

// After a good home play with auto level-up on: add the same game at the next difficulty, when one exists
// (a published game whose name starts with this game's name and is one step harder). Quietly does nothing otherwise.
export async function maybeLevelUp(db, planId, gameId) {
  try {
    const plan = await HomePracticePlan.findById(planId)
    if (!plan || !plan.auto_level_up || plan.status !== 'active') return null
    const game = await db.collection('games').findOne({ _id: gameId })
    const order = ['easy', 'medium', 'hard']
    const at = order.indexOf(game?.difficulty)
    if (!game || at < 0 || at >= 2) return null
    const stem = String(game.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const next = await db.collection('games').findOne({ status: 'published', difficulty: order[at + 1], name: { $regex: `^${stem}`, $options: 'i' }, _id: { $ne: game._id } })
    if (!next || plan.games.some((g) => String(g.game_id) === String(next._id))) return null
    plan.games.push({ game_id: next._id, order: plan.games.length + 1, source: 'level_up' })
    await plan.save()
    return next
  } catch (err) {
    console.error('maybeLevelUp failed:', err.message)
    return null
  }
}

// Home plays for one patient this week, per game and weekday (Mon..Sun index 0..6), plus best home/session scores.
export async function weekProgress(db, patientId, plan, now = new Date()) {
  const ids = plan.games.map((g) => g.game_id)
  const from = weekStart(now)
  const plays = await db.collection('game_sessions').find({
    patient_id: patientId, game_id: { $in: ids }, status: 'completed', completed_at: { $ne: null },
  }).project({ game_id: 1, context: 1, home_plan_id: 1, completed_at: 1, result: 1 }).sort({ completed_at: 1 }).toArray()
  const out = new Map(ids.map((id) => [String(id), { homePlays: 0, playsThisWeek: 0, byDay: [0, 0, 0, 0, 0, 0, 0], bestHome: null, sessionScore: null, lastHomeAt: null }]))
  for (const p of plays) {
    const o = out.get(String(p.game_id))
    if (!o) continue
    const pct = playPercent(p.result)
    if (p.context === 'home') {
      if (String(p.home_plan_id) === String(plan._id)) o.homePlays += 1 // all plays under this plan (the per-game limit)
      if (String(p.home_plan_id) === String(plan._id) && p.completed_at >= from) {
        o.playsThisWeek += 1
        o.byDay[(weekday(p.completed_at) + 6) % 7] += 1
      }
      if (pct != null && (o.bestHome == null || pct > o.bestHome)) o.bestHome = pct
      o.lastHomeAt = p.completed_at
    } else if (pct != null) {
      o.sessionScore = pct // latest session score wins (rows are in time order)
    }
  }
  return out
}
