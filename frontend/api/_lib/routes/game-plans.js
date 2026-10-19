// "Assign Games" API. Therapist routes need role Therapist; the patient routes need role Patient
// (or a Therapist hosting a "Who is playing today?" session, identified by its activity session).
// Registered in api/index.js — one named export per endpoint.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { notify } from '../sessionRecommendations.js'
import { SessionGamePlan } from '../models/sessionGamePlan.js'
import {
  activeAssignment, checkGameAccess, employeeFor, manilaDayEnd, manilaDayKey, manilaDayStart,
  oid, refreshPlan, serializeGame, serializePlan, todaysPlan, validatePlanInput,
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
      { $match: { employee_id: employee._id, session_date: { $gte: dayStartUtc, $lt: new Date(dayStartUtc.getTime() + 86400000) }, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined', 'Archived', 'No-show'] } } },
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
      { $unwind: '$patient' },
      { $lookup: { from: 'patient_assign', let: { p: '$patient_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$patient_id', '$$p'] }, { $eq: ['$employee_id', employee._id] }, { $eq: ['$status', 'active'] }] } } }, { $limit: 1 }], as: 'assign' } },
      { $unwind: '$assign' },
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
          therapyTypes: a.assign.therapy_types || [], assignmentId: String(a.assign._id),
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
      started_at: !v.startManually && v.playStart <= now ? now : null,
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
    plan.play_start = v.playStart
    plan.play_end = v.playEnd
    plan.start_manually = v.startManually
    plan.warn_before_minutes = v.warnBeforeMinutes
    plan.allow_finish_current = v.allowFinishCurrent
    await plan.save()
    await refreshPlan(plan)
    await audit(db, { user, role: user.role, action: 'game_plan_updated', patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
    return res.status(200).json({ plan: await serializePlan(db, plan) })
  } catch (err) { return fail(res, err, 'game-plans item') }
}

// POST /api/game-plans/:id/(start|pause|resume|end)
export async function plansAction(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, user, ip } = ctx
    const plan = await ownedPlan(ctx, req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    await refreshPlan(plan)
    const action = req.params.action
    const now = new Date()
    if (action === 'start') {
      if (plan.status !== 'scheduled') return res.status(409).json({ error: 'Play time was already started.' })
      const length = plan.play_end - plan.play_start
      const end = new Date(Math.min(now.getTime() + length, manilaDayEnd(manilaDayKey(plan.plan_date)).getTime() - 1))
      plan.started_at = now; plan.play_start = now; plan.play_end = end; plan.status = 'active'
    } else if (action === 'pause') {
      if (plan.status !== 'active') return res.status(409).json({ error: 'Play time is not running.' })
      plan.status = 'paused' // updated_at (set by the save) marks when the pause began
    } else if (action === 'resume') {
      if (plan.status !== 'paused') return res.status(409).json({ error: 'Play time is not paused.' })
      plan.play_end = new Date(plan.play_end.getTime() + Math.max(0, now - plan.updated_at))
      plan.status = 'active'
    } else if (action === 'end') {
      if (plan.status === 'ended' || plan.status === 'cancelled') return res.status(409).json({ error: 'This plan has already ended.' })
      if (plan.play_end > now) plan.play_end = now
      plan.status = 'ended'
    } else {
      return res.status(404).json({ error: 'Unknown action.' })
    }
    await plan.save()
    await audit(db, { user, role: user.role, action: `game_plan_${action}`, patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
    return res.status(200).json({ plan: await serializePlan(db, plan) })
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
