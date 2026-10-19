// "Assign Games" API. Therapist routes need role Therapist; the patient routes need role Patient
// (or a Therapist hosting a "Who is playing today?" session, identified by its activity session).
// Registered in api/index.js — one named export per endpoint.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { notify } from '../sessionRecommendations.js'
import { SessionGamePlan } from '../models/sessionGamePlan.js'
import { GamePlayEvent, ensureEventIndexes } from '../models/gamePlayEvent.js'
import { computeLive, soapText } from '../gameLive.js'
import {
  activeAssignment, checkGameAccess, durationOf, employeeFor, planRemaining, manilaDayEnd, manilaDayKey, manilaDayStart,
  manilaInstant, oid, refreshPlan, serializeGame, serializePlan, todaysPlan, validatePlanInput,
} from '../gamePlans.js'

const method = (req, res, ...allowed) => {
  if (allowed.includes(req.method)) return true
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: 'Method not allowed' })
  return false
}
const fail = (res, err, label) => {
  console.error(`${label}:`, err)
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' })
}

// Therapist context: session + employees row. Sends the error response itself and returns null on failure.
async function therapistCtx(req, res) {
  await getMongo()
  const ctx = await requireSession(req, res, { roles: ['Therapist'] })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.' }); return null }
  return { ...ctx, employee }
}

const pretty = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Patient'

// A plan the therapist may touch: theirs, or for a patient they are actively assigned to.
async function ownedPlan(ctx, id) {
  const _id = oid(id)
  if (!_id) return null
  const plan = await SessionGamePlan.findById(_id)
  if (!plan) return null
  if (String(plan.employee_id) !== String(ctx.employee._id) && !(await activeAssignment(ctx.db, plan.patient_id, ctx.employee._id))) return null
  return plan
}

// GET /api/therapist/today
export async function therapistToday(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    const key = manilaDayKey()
    const dayStartUtc = new Date(`${key}T00:00:00Z`)
    const appts = await db.collection('appointments').aggregate([
      { $match: { employee_id: employee._id, $or: [{ session_date: { $gte: dayStartUtc, $lt: new Date(dayStartUtc.getTime() + 86400000) } }, { session_date: { $gte: manilaDayStart(key), $lt: manilaDayEnd(key) } }], is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined', 'Archived', 'No Show', 'No-show', 'Completed'] } } },
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
      { $unwind: '$patient' },
      { $lookup: { from: 'patient_assign', let: { p: '$patient_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$patient_id', '$$p'] }, { $eq: ['$employee_id', employee._id] }, { $eq: ['$status', 'active'] }] } } }, { $limit: 1 }], as: 'assign' } },
      { $unwind: { path: '$assign', preserveNullAndEmptyArrays: true } },
      { $sort: { start_time: 1 } },
    ]).toArray()
    const plans = appts.length ? await SessionGamePlan.find({ patient_id: { $in: appts.map((a) => a.patient_id) }, plan_date: manilaDayStart(key), status: { $ne: 'cancelled' } }) : []
    for (const p of plans) await refreshPlan(p)
    const planBy = new Map(plans.map((p) => [String(p.patient_id), p]))
    return res.status(200).json({
      today: key,
      sessions: appts.map((a) => {
        const plan = planBy.get(String(a.patient_id))
        return {
          id: String(a._id), patientId: String(a.patient_id), patientName: pretty(a.patient), condition: a.patient.primary_condition || a.condition || '',
          start: a.start_time, end: a.end_time, sessionType: a.session_type || a.session_mode || 'Session',
          therapyTypes: a.assign?.therapy_types || [String(a.session_type || 'cognitive').toLowerCase()], assignmentId: a.assign ? String(a.assign._id) : null,
          plan: plan ? { id: String(plan._id), status: plan.status, gamesCount: plan.games.length } : null,
        }
      }),
    })
  } catch (err) { return fail(res, err, 'therapist/today') }
}

// GET /api/therapist/games?patientId=&difficulty=&type=&q=&sort=
export async function therapistGames(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    let types = []
    const patientId = oid(req.query.patientId)
    if (req.query.patientId) {
      const a = patientId && await activeAssignment(db, patientId, employee._id)
      if (!a) return res.status(403).json({ error: 'This patient is not assigned to you.' })
      types = a.therapy_types || []
    }
    const type = String(req.query.type || '').toLowerCase()
    const typeFilter = type && type !== 'all' ? [type] : type === 'all' ? [] : types.map((t) => String(t).toLowerCase())
    const difficulty = String(req.query.difficulty || 'all').toLowerCase()
    const q = String(req.query.q || '').trim().toLowerCase()
    const sort = String(req.query.sort || 'shortest')
    const docs = await db.collection('games').find({ status: 'published' }).toArray()
    let games = docs.map(serializeGame)
    if (typeFilter.length) games = games.filter((g) => g.therapyType && typeFilter.includes(String(g.therapyType).toLowerCase()))
    if (['easy', 'medium', 'hard'].includes(difficulty)) games = games.filter((g) => g.difficulty === difficulty)
    if (q) games = games.filter((g) => `${g.name} ${g.description}`.toLowerCase().includes(q))
    const rank = { easy: 0, medium: 1, hard: 2 }
    const cmp = {
      shortest: (a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name),
      longest: (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      difficulty: (a, b) => rank[a.difficulty] - rank[b.difficulty] || a.name.localeCompare(b.name),
    }[sort] || ((a, b) => a.minutes - b.minutes)
    games.sort(cmp)
    return res.status(200).json({ games, defaultTypes: types })
  } catch (err) { return fail(res, err, 'therapist/games') }
}

// GET /api/game-plans?patientId=&date=  -> that patient's plan for the day (therapist's live status)
// POST /api/game-plans                  -> create or replace today's plan
export async function plansCollection(req, res) {
  if (!method(req, res, 'GET', 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee, user, ip } = ctx

    if (req.method === 'GET') {
      const patientId = oid(req.query.patientId)
      if (!patientId || !(await activeAssignment(db, patientId, employee._id))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
      const plan = await todaysPlan(patientId)
      return res.status(200).json({ plan: await serializePlan(db, plan) })
    }

    const body = req.body || {}
    const patientId = oid(body.patientId)
    const assignment = patientId && await activeAssignment(db, patientId, employee._id)
    if (!assignment) return res.status(403).json({ error: 'This patient is not assigned to you.' })

    const key = manilaDayKey()
    let appointment = null
    if (body.appointmentId) {
      appointment = await db.collection('appointments').findOne({ _id: oid(body.appointmentId), patient_id: patientId, employee_id: employee._id })
      if (!appointment) return res.status(404).json({ error: 'That session was not found.' })
    }
    const checked = validatePlanInput(body, { appointment, dayKey: key })
    if (checked.error) return res.status(400).json({ error: checked.error })
    const v = checked.value

    const docs = await db.collection('games').find({ _id: { $in: v.games.map((g) => g.game_id) } }).toArray()
    if (docs.length !== v.games.length || docs.some((d) => d.status !== 'published')) return res.status(400).json({ error: 'Only published games can be assigned.' })

    // One plan per patient per day: a plan from another therapist with an overlapping window blocks; ours is replaced.
    const existing = await SessionGamePlan.find({ patient_id: patientId, plan_date: manilaDayStart(key), status: { $ne: 'cancelled' } })
    for (const e of existing) {
      if (String(e.employee_id) !== String(employee._id) && e.status !== 'ended' && e.play_start < v.playEnd && e.play_end > v.playStart) {
        return res.status(409).json({ error: 'Another therapist already set play time for this patient at that time.' })
      }
    }
    await SessionGamePlan.updateMany({ _id: { $in: existing.map((e) => e._id) } }, { $set: { status: 'cancelled' } })

    const now = new Date()
    const plan = await SessionGamePlan.create({
      patient_id: patientId, employee_id: employee._id, branch_id: assignment.branch_id || employee.branch_id || null, assignment_id: assignment._id,
      appointment_id: appointment ? appointment._id : null, plan_date: manilaDayStart(key), games: v.games,
      play_start: v.playStart, play_end: v.playEnd, start_manually: v.startManually,
      duration_seconds: Math.round((v.playEnd - v.playStart) / 1000), used_seconds: 0, extended_seconds: 0, pause_count: 0, total_paused_seconds: 0, started_early: false,
      started_at: !v.startManually && v.playStart <= now ? v.playStart : null, run_started_at: !v.startManually && v.playStart <= now ? v.playStart : null,
      warn_before_minutes: v.warnBeforeMinutes, allow_finish_current: v.allowFinishCurrent,
      status: !v.startManually && v.playStart <= now ? 'active' : 'scheduled',
    })
    await audit(db, { user, role: user.role, action: 'game_plan_assigned', patientId, ip, meta: { plan_id: String(plan._id), games: v.games.length } })

    const patient = await db.collection('patients').findOne({ _id: patientId })
    const target = patient?.email || patient?.guardian_email
    await notify(db, { email: target, type: 'game_plan', title: 'Games for today', body: `Your therapist picked ${v.games.length} game${v.games.length === 1 ? '' : 's'} for today.`, link: '/patient/gamified-activities' })
    return res.status(201).json({ plan: await serializePlan(db, plan) })
  } catch (err) { return fail(res, err, 'game-plans create') }
}

// PUT /api/game-plans/:id  (edit games / window)   DELETE /api/game-plans/:id  (cancel)
export async function plansItem(req, res) {
  if (!method(req, res, 'PUT', 'DELETE')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, user, ip } = ctx
    const plan = await ownedPlan(ctx, req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    if (plan.status === 'ended' || plan.status === 'cancelled') return res.status(409).json({ error: 'This plan has ended.' })

    if (req.method === 'DELETE') {
      plan.status = 'cancelled'
      await plan.save()
      await audit(db, { user, role: user.role, action: 'game_plan_cancelled', patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
      return res.status(200).json({ ok: true })
    }

    if (plan.status === 'paused') return res.status(409).json({ error: 'Resume play time before editing the plan.' })
    const appointment = plan.appointment_id ? await db.collection('appointments').findOne({ _id: plan.appointment_id }) : null
    const checked = validatePlanInput(req.body || {}, { appointment, dayKey: manilaDayKey(plan.plan_date) })
    if (checked.error) return res.status(400).json({ error: checked.error })
    const v = checked.value
    const docs = await db.collection('games').find({ _id: { $in: v.games.map((g) => g.game_id) } }).toArray()
    if (docs.length !== v.games.length || docs.some((d) => d.status !== 'published')) return res.status(400).json({ error: 'Only published games can be assigned.' })
    // Keep progress for games that stay in the plan.
    const prior = new Map(plan.games.map((g) => [String(g.game_id), g]))
    plan.games = v.games.map((g) => { const p = prior.get(String(g.game_id)); return p ? { ...g, status: p.status, completed_at: p.completed_at } : g })
    if (plan.status === 'scheduled') { plan.play_start = v.playStart; plan.play_end = v.playEnd; plan.duration_seconds = Math.round((v.playEnd - v.playStart) / 1000); plan.start_manually = v.startManually }
    plan.warn_before_minutes = v.warnBeforeMinutes
    plan.allow_finish_current = v.allowFinishCurrent
    await plan.save()
    await refreshPlan(plan)
    await audit(db, { user, role: user.role, action: 'game_plan_updated', patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
    return res.status(200).json({ plan: await serializePlan(db, plan) })
  } catch (err) { return fail(res, err, 'game-plans item') }
}

// POST /api/game-plans/:id/(start|pause|resume|extend|end|restart|soap-summary)
// Play time is a stopwatch the therapist controls: start any time today, pause and resume freely. Every response carries the
// plan, the server `now` and remainingSeconds, and each control is audit-logged.
export async function plansAction(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, user, ip } = ctx
    const plan = await ownedPlan(ctx, req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    // Every control needs an active patient_assign (created on demand from a booked session; an ended assignment blocks).
    if (!(await activeAssignment(db, plan.patient_id, ctx.employee._id))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    await refreshPlan(plan)
    const action = req.params.action
    const now = new Date()
    const nowMs = now.getTime()
    const settle = () => { if (plan.run_started_at) plan.used_seconds = (plan.used_seconds || 0) + Math.max(0, Math.round((nowMs - plan.run_started_at.getTime()) / 1000)); plan.run_started_at = null }
    const expectedEnd = () => new Date(nowMs + planRemaining(plan, nowMs) * 1000)
    const conflict = (m) => res.status(409).json({ error: m })

    if (action === 'soap-summary') {
      const live = await liveFor(db, plan)
      return res.status(200).json({ text: soapText(live), live })
    }
    if (action === 'start') {
      if (plan.status !== 'scheduled') return conflict('Play time was already started.')
      const appt = plan.appointment_id ? await db.collection('appointments').findOne({ _id: plan.appointment_id }, { projection: { end_time: 1 } }) : null
      const apptEnd = appt ? manilaInstant(manilaDayKey(plan.plan_date), appt.end_time) : null
      plan.started_early = now < plan.play_start || Boolean(apptEnd && now > apptEnd)
      plan.duration_seconds = durationOf(plan)
      plan.started_at = now; plan.run_started_at = now; plan.paused_at = null; plan.status = 'active'
      plan.play_end = expectedEnd()
    } else if (action === 'pause') {
      if (plan.status !== 'active') return conflict('Play time is not running.')
      settle()
      plan.paused_at = now; plan.pause_count = (plan.pause_count || 0) + 1; plan.status = 'paused'
    } else if (action === 'resume') {
      if (plan.status !== 'paused') return conflict('Play time is not paused.')
      plan.total_paused_seconds = (plan.total_paused_seconds || 0) + Math.max(0, Math.round((nowMs - (plan.paused_at || now).getTime()) / 1000))
      plan.paused_at = null; plan.run_started_at = now; plan.status = 'active'
      plan.play_end = expectedEnd()
    } else if (action === 'extend') {
      if (!['active', 'paused', 'scheduled'].includes(plan.status)) return conflict('Play time has already ended.')
      const minutes = Math.round(Number(req.body?.minutes))
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) return res.status(400).json({ error: 'Add between 1 and 30 minutes.' })
      if ((plan.extended_seconds || 0) + minutes * 60 > 1800) return conflict('You can add at most 30 minutes in total.')
      plan.extended_seconds = (plan.extended_seconds || 0) + minutes * 60
      if (plan.status === 'active') plan.play_end = expectedEnd()
    } else if (action === 'end') {
      if (plan.status === 'ended' || plan.status === 'cancelled') return conflict('This plan has already ended.')
      if (plan.status === 'paused') plan.total_paused_seconds = (plan.total_paused_seconds || 0) + Math.max(0, Math.round((nowMs - (plan.paused_at || now).getTime()) / 1000))
      settle(); plan.paused_at = null; plan.status = 'ended'; plan.play_end = now
    } else if (action === 'restart') {
      if (plan.status !== 'ended') return conflict('Only a finished play time can be restarted.')
      Object.assign(plan, { status: 'scheduled', used_seconds: 0, extended_seconds: 0, run_started_at: null, paused_at: null, pause_count: 0, total_paused_seconds: 0, started_early: false, started_at: null, start_manually: true })
      plan.games = plan.games.map((g) => ({ ...(g.toObject ? g.toObject() : g), status: 'pending', completed_at: null }))
    } else {
      return res.status(404).json({ error: 'Unknown action.' })
    }
    await plan.save()
    await audit(db, { user, role: user.role, action: `game_plan_${action}`, patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id), started_early: plan.started_early || undefined } })
    return res.status(200).json({ plan: await serializePlan(db, plan), now: new Date().toISOString(), remainingSeconds: planRemaining(plan) })
  } catch (err) { return fail(res, err, 'game-plans action') }
}

// Who is asking on the patient side: a Patient (their own account) or a Therapist hosting a play session.
async function playerCtx(req, res) {
  await getMongo()
  const ctx = await requireSession(req, res, { roles: ['Patient', 'Therapist'] })
  if (!ctx) return null
  const { db, user } = ctx
  if (user.role === 'Patient') {
    const patient = await db.collection('patients').findOne({ email: String(user.email).toLowerCase() })
    if (!patient) { res.status(404).json({ error: 'No patient record is linked to this account yet.' }); return null }
    return { ...ctx, patient }
  }
  const employee = await employeeFor(db, user)
  const act = employee && oid(req.query.activitySessionId) && await db.collection('activity_sessions').findOne({ _id: oid(req.query.activitySessionId), therapist_id: employee._id, status: 'active' })
  if (!act || !act.patient_id) { res.status(400).json({ error: 'Pick who is playing first.' }); return null }
  const patient = await db.collection('patients').findOne({ _id: act.patient_id })
  if (!patient) { res.status(404).json({ error: 'Patient not found.' }); return null }
  return { ...ctx, patient }
}

// GET /api/patient/game-plan/today
export async function patientToday(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await playerCtx(req, res)
    if (!ctx) return
    const plan = await todaysPlan(ctx.patient._id)
    return res.status(200).json({ plan: await serializePlan(ctx.db, plan), playerName: ctx.patient.nickname || ctx.patient.first_name || 'friend' })
  } catch (err) { return fail(res, err, 'patient/game-plan/today') }
}

// GET /api/patient/game-access?name=  (or gameId=) -> 200 { ok } or 403 { code: 'GAME_LOCKED', reason }
export async function patientGameAccess(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await playerCtx(req, res)
    if (!ctx) return
    const { db, patient } = ctx
    const game = oid(req.query.gameId)
      ? await db.collection('games').findOne({ _id: oid(req.query.gameId) })
      : await db.collection('games').findOne({ name: String(req.query.name || '') })
    if (!game) return res.status(200).json({ ok: true, untracked: true }) // not a database game: nothing to lock
    const r = await checkGameAccess(db, patient._id, game._id)
    if (!r.ok) return res.status(403).json({ error: 'This game is locked right now.', code: r.code, reason: r.reason })
    return res.status(200).json({ ok: true })
  } catch (err) { return fail(res, err, 'patient/game-access') }
}

// ---- live monitor -------------------------------------------------------------------------------------------

async function liveFor(db, plan) {
  const ids = plan.games.map((g) => g.game_id)
  const docs = ids.length ? await db.collection('games').find({ _id: { $in: ids } }).toArray() : []
  const names = new Map(docs.map((d) => [String(d._id), { name: d.name, difficulty: ['easy', 'medium', 'hard'].includes(d.difficulty) ? d.difficulty : 'easy' }]))
  const patient = await db.collection('patients').findOne({ _id: plan.patient_id }, { projection: { first_name: 1, last_name: 1, nickname: 1 } })
  await refreshPlan(plan)
  const live = await computeLive(plan, patient, names)
  return { ...live, patient: { id: String(plan.patient_id), name: pretty(patient) } }
}

// GET /api/therapist/game-plans/live?date=today -> one entry per plan today for this therapist's assigned patients
export async function therapistLive(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    const key = manilaDayKey()
    const plans = await SessionGamePlan.find({ employee_id: employee._id, plan_date: manilaDayStart(key), status: { $ne: 'cancelled' } })
    const assigned = plans.length ? new Set((await db.collection('patient_assign').find({ employee_id: employee._id, status: 'active', patient_id: { $in: plans.map((p) => p.patient_id) } }).project({ patient_id: 1 }).toArray()).map((a) => String(a.patient_id))) : new Set()
    const out = []
    for (const p of plans) if (assigned.has(String(p.patient_id))) out.push(await liveFor(db, p))
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ today: key, now: new Date().toISOString(), plans: out })
  } catch (err) { return fail(res, err, 'therapist/game-plans/live') }
}

// POST /api/game-plans/:id/events  (the patient's device; only for that patient's own plan)
const TYPES = ['game_started', 'heartbeat', 'round_retry', 'hint_used', 'game_finished', 'game_exited']
const int = (v, max = 100000) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.round(Number(v)))) : null)
export async function planEvents(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await playerCtx(req, res)
    if (!ctx) return
    const { db, patient } = ctx
    const planId = oid(req.params.id)
    const plan = planId && await SessionGamePlan.findOne({ _id: planId, patient_id: patient._id })
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    const b = req.body || {}
    if (!TYPES.includes(b.type)) return res.status(400).json({ error: 'Unknown event.' })
    const gameId = oid(b.gameId)
    if (!gameId || !plan.games.some((g) => String(g.game_id) === String(gameId))) return res.status(400).json({ error: 'That game is not in the plan.' })
    await ensureEventIndexes()
    if (plan.status === 'paused' && b.type === 'heartbeat') return res.status(200).json({ ok: true, ignored: true }) // nothing counts while paused
    if (b.type === 'heartbeat') {
      const recent = await GamePlayEvent.countDocuments({ plan_id: plan._id, type: 'heartbeat', at: { $gte: new Date(Date.now() - 60000) } })
      if (recent >= 6) return res.status(429).json({ error: 'Too many updates.' })
    }
    const acc = b.accuracy == null || b.accuracy === '' ? null : Math.min(100, Math.max(0, Number(b.accuracy)))
    const last = new Date(b.lastInputAt)
    await GamePlayEvent.create({
      plan_id: plan._id, patient_id: patient._id, game_id: gameId, game_session_id: oid(b.gameSessionId), type: b.type,
      round: int(b.round, 1000), total_rounds: int(b.totalRounds, 1000), score: int(b.score), accuracy: Number.isFinite(acc) ? acc : null, hints: int(b.hints, 1000),
      last_input_at: Number.isNaN(last.getTime()) ? null : last, at: new Date(),
    })
    const set = {}
    if (b.type === 'game_started') set['games.$[g].status'] = 'in_progress'
    if (b.type === 'game_finished') { set['games.$[g].status'] = 'done'; set['games.$[g].completed_at'] = new Date() }
    if (Object.keys(set).length) {
      const filter = b.type === 'game_started' ? { _id: plan._id } : { _id: plan._id }
      await SessionGamePlan.updateOne(filter, { $set: set }, { arrayFilters: [{ 'g.game_id': gameId, ...(b.type === 'game_started' ? { 'g.status': { $ne: 'done' } } : {}) }], timestamps: false })
    } else if (b.type === 'game_exited') {
      await SessionGamePlan.updateOne({ _id: plan._id }, { $set: { 'games.$[g].status': 'pending' } }, { arrayFilters: [{ 'g.game_id': gameId, 'g.status': 'in_progress' }], timestamps: false })
    }
    return res.status(200).json({ ok: true })
  } catch (err) { return fail(res, err, 'game-plans events') }
}
