// Shared logic for "Assign Games": today's per-patient game plan and the time window that locks the
// patient's Gamified Activities. Everything here works in Asia/Manila days (no DST, UTC+8).
import { ObjectId } from 'mongodb'
import { SessionGamePlan } from './models/sessionGamePlan.js'

const MANILA_OFFSET_MS = 8 * 3600 * 1000
export const DAY_MS = 86400000

// 'YYYY-MM-DD' of the Manila day an instant falls on.
export const manilaDayKey = (d = new Date()) => new Date(new Date(d).getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10)
// The instant Manila midnight of that day begins (stored as plan_date).
export const manilaDayStart = (key) => new Date(`${key}T00:00:00+08:00`)
export const manilaDayEnd = (key) => new Date(manilaDayStart(key).getTime() + DAY_MS)
// 'YYYY-MM-DD' + 'HH:MM' (Manila) -> instant.
export const manilaInstant = (key, hhmm) => new Date(`${key}T${String(hhmm || '00:00').slice(0, 5)}:00+08:00`)

export const oid = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }

// Default length (minutes) of a game when `games.default_minutes` isn't set yet (see migrateGameDefaults.js).
const DEFAULT_MINUTES_BY_TYPE = { choose_picture: 6, step_by_step: 10, sequence: 8, match: 8 }
export const defaultMinutes = (g) => Math.round(Number(g.default_minutes)) || DEFAULT_MINUTES_BY_TYPE[g.game_type] || 6
export const gameDifficulty = (g) => (['easy', 'medium', 'hard'].includes(g.difficulty) ? g.difficulty : 'easy')

export function serializeGame(g) {
  return {
    id: String(g._id), name: g.name, description: g.description || '', therapyType: g.therapy_type || null,
    difficulty: gameDifficulty(g), minutes: defaultMinutes(g), gameType: g.game_type || null,
  }
}

// The therapist's `employees` row for a logged-in user.
export async function employeeFor(db, user) {
  return (await db.collection('employees').findOne({ user_id: user._id }))
    || (user.email ? db.collection('employees').findOne({ email: String(user.email).toLowerCase() }) : null)
}

// The one active patient_assign row between this patient and therapist (source of truth for who they may assign).
// A patient the therapist has a session with is theirs to assign games to: when no assignment row exists yet, one is created
// (active, primary) from that session. A patient whose assignment was ended stays blocked.
const TYPES = ['cognitive', 'speech', 'physical', 'occupational']
export async function activeAssignment(db, patientId, employeeId) {
  const found = await db.collection('patient_assign').findOne({ patient_id: patientId, employee_id: employeeId, status: 'active' })
  if (found) return found
  if (await db.collection('patient_assign').findOne({ patient_id: patientId, employee_id: employeeId })) return null
  const appt = await db.collection('appointments').findOne({ patient_id: patientId, employee_id: employeeId, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] } }, { sort: { session_date: 1 } })
  if (!appt) return null
  const emp = await db.collection('employees').findOne({ _id: employeeId }, { projection: { branch_id: 1 } })
  if (!emp?.branch_id) return null
  const s = String(appt.session_type || '').toLowerCase()
  const now = new Date()
  const doc = {
    patient_id: patientId, employee_id: employeeId, branch_id: emp.branch_id, role: 'primary', status: 'active',
    therapy_types: [TYPES.find((t) => s.includes(t.slice(0, 5))) || 'cognitive'], start_date: appt.session_date || now, assigned_by: null, created_at: now, updated_at: now,
  }
  const r = await db.collection('patient_assign').insertOne(doc)
  return { ...doc, _id: r.insertedId }
}

// Move a plan through scheduled -> active -> ended as the clock passes; returns the fresh document.
export async function refreshPlan(plan) {
  if (!plan) return plan
  const now = Date.now()
  let status = plan.status
  if (status === 'scheduled' && !plan.start_manually && now >= plan.play_start.getTime()) status = 'active'
  if (status === 'active' && now > plan.play_end.getTime()) status = 'ended'
  if (status !== plan.status) {
    plan.status = status
    await SessionGamePlan.updateOne({ _id: plan._id, status: { $ne: status } }, { $set: { status } }, { timestamps: false })
  }
  return plan
}

// Today's (Manila) non-cancelled plan for a patient, kept fresh.
export async function todaysPlan(patientId, key = manilaDayKey()) {
  const plan = await SessionGamePlan.findOne({ patient_id: patientId, plan_date: manilaDayStart(key), status: { $ne: 'cancelled' } })
  return refreshPlan(plan)
}

export function remainingSeconds(plan) {
  if (!plan) return 0
  if (plan.status === 'ended') return 0
  const from = plan.status === 'paused' || plan.status === 'scheduled' ? Math.max(plan.play_start.getTime(), Date.now()) : Date.now()
  return Math.max(0, Math.round((plan.play_end.getTime() - from) / 1000))
}

// Plan + its game documents, in the shape both pages use.
export async function serializePlan(db, plan) {
  if (!plan) return null
  const ids = plan.games.map((g) => g.game_id)
  const docs = ids.length ? await db.collection('games').find({ _id: { $in: ids } }).toArray() : []
  const byId = new Map(docs.map((d) => [String(d._id), d]))
  const sorted = [...plan.games].sort((a, b) => a.order - b.order)
  return {
    id: String(plan._id),
    patientId: String(plan.patient_id),
    appointmentId: plan.appointment_id ? String(plan.appointment_id) : null,
    planDate: manilaDayKey(plan.plan_date),
    status: plan.status,
    playStart: plan.play_start.toISOString(),
    playEnd: plan.play_end.toISOString(),
    startManually: plan.start_manually,
    startedAt: plan.started_at ? plan.started_at.toISOString() : null,
    warnBeforeMinutes: plan.warn_before_minutes,
    allowFinishCurrent: plan.allow_finish_current,
    now: new Date().toISOString(),
    remainingSeconds: remainingSeconds(plan),
    games: sorted.map((g) => {
      const d = byId.get(String(g.game_id))
      return {
        gameId: String(g.game_id), order: g.order, minutes: g.minutes, status: g.status,
        completedAt: g.completed_at ? g.completed_at.toISOString() : null,
        name: d?.name || 'Game', difficulty: d ? gameDifficulty(d) : 'easy', therapyType: d?.therapy_type || null, description: d?.description || '',
      }
    }),
  }
}

// Server-side gate: may this patient start this game right now?
//   { ok: true, plan } or { ok: false, code: 'GAME_LOCKED', reason }
// reason: no_plan | not_assigned | not_started | paused | time_over
export async function checkGameAccess(db, patientId, gameId) {
  const plan = await todaysPlan(patientId)
  if (!plan) return { ok: false, code: 'GAME_LOCKED', reason: 'no_plan' }
  const entry = plan.games.find((g) => String(g.game_id) === String(gameId))
  if (!entry) return { ok: false, code: 'GAME_LOCKED', reason: 'not_assigned' }
  const now = Date.now()
  if (plan.status === 'paused') return { ok: false, code: 'GAME_LOCKED', reason: 'paused' }
  if (plan.status === 'scheduled' || now < plan.play_start.getTime()) return { ok: false, code: 'GAME_LOCKED', reason: 'not_started' }
  if (plan.status === 'active' && now <= plan.play_end.getTime()) return { ok: true, plan }
  // After the window: only a game that was already being played may be picked up again.
  if (plan.allow_finish_current) {
    const open = await db.collection('game_sessions').findOne({
      patient_id: patientId, game_id: oid(gameId), status: 'in_progress', started_at: { $lte: plan.play_end },
    }, { projection: { _id: 1 } })
    if (open) return { ok: true, plan }
  }
  return { ok: false, code: 'GAME_LOCKED', reason: 'time_over' }
}

// Called by the game-session routes so the therapist's live status follows the child's play.
export async function markPlanGame(patientId, gameId, status) {
  try {
    const gid = oid(gameId)
    const filter = {
      patient_id: patientId, plan_date: manilaDayStart(manilaDayKey()), status: { $in: ['active', 'ended', 'paused'] },
      games: { $elemMatch: { game_id: gid, ...(status === 'in_progress' ? { status: { $ne: 'done' } } : {}) } },
    }
    const set = { 'games.$.status': status }
    if (status === 'done') set['games.$.completed_at'] = new Date()
    // timestamps:false keeps updated_at as the moment a pause began.
    await SessionGamePlan.updateOne(filter, { $set: set }, { timestamps: false })
  } catch (err) {
    console.error('markPlanGame failed:', err.message)
  }
}

// Validates a plan body from the therapist. Returns { error } or { value }.
export function validatePlanInput(body, { appointment = null, dayKey = manilaDayKey() } = {}) {
  const games = Array.isArray(body?.games) ? body.games : []
  if (games.length < 1 || games.length > 10) return { error: 'Pick between 1 and 10 games.' }
  const ids = new Set()
  const list = []
  for (const g of games) {
    const id = oid(g?.gameId)
    const minutes = Math.round(Number(g?.minutes))
    if (!id) return { error: 'One of the games is not valid.' }
    if (ids.has(String(id))) return { error: 'A game can only be added once.' }
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) return { error: 'Each game needs 1 to 60 minutes.' }
    ids.add(String(id))
    list.push({ game_id: id, minutes })
  }
  const playStart = new Date(body?.playStart)
  const playEnd = new Date(body?.playEnd)
  if (Number.isNaN(playStart.getTime()) || Number.isNaN(playEnd.getTime())) return { error: 'Choose when play time starts and ends.' }
  if (playEnd <= playStart) return { error: 'Play time must end after it starts.' }
  if (manilaDayKey(playStart) !== dayKey || manilaDayKey(new Date(playEnd.getTime() - 1)) !== dayKey) return { error: 'Play time must be inside today.' }
  const total = list.reduce((s, g) => s + g.minutes, 0)
  const windowMin = Math.round((playEnd - playStart) / 60000)
  if (total > windowMin) return { error: `These games need ${total} min but the play window is only ${windowMin} min.` }
  if (appointment) {
    const aStart = manilaInstant(dayKey, appointment.start_time)
    const aEnd = manilaInstant(dayKey, appointment.end_time)
    if (playStart < aStart || playEnd > aEnd) return { error: 'Play time must stay inside the session time.' }
  }
  return {
    value: {
      games: list.map((g, i) => ({ ...g, order: i + 1, status: 'pending', completed_at: null })),
      playStart, playEnd,
      startManually: Boolean(body?.startManually),
      warnBeforeMinutes: Math.min(30, Math.max(0, Math.round(Number(body?.warnBeforeMinutes ?? 5)))),
      allowFinishCurrent: body?.allowFinishCurrent !== false,
    },
  }
}
