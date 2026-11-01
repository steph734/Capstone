// Home practice API. Therapist routes need role Therapist (and an active patient_assign row for the patient);
// the patient route needs role Patient and only ever reads that patient's own plan.
//   POST  /api/home-practice-plans              create (replaces the patient's active plan)
//   PATCH /api/home-practice-plans/:id          edit settings / games, or { status: 'cancelled' }
//   GET   /api/patients/:id/home-practice       plan + this week's progress (+ the session's played games)
//   GET   /api/home-practice/me                 what the signed-in patient may play right now
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { notify } from '../sessionRecommendations.js'
import { sendEmail } from '../brevo.js'
import { HomePracticePlan } from '../models/homePracticePlan.js'
import { activeAssignment, employeeFor, gameDifficulty, manilaDayKey, oid, serializeGame } from '../gamePlans.js'
import {
  activeHomePlan, dayKey, dayStart, homeSecondsToday, homeWindow, normalizeHomeSettings, playPercent, resultChip, weekProgress, weekStart,
} from '../homePractice.js'

const DAY = 86400000
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
const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Patient'

async function therapistCtx(req, res) {
  await getMongo()
  const ctx = await requireSession(req, res, { roles: ['Therapist'] })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.' }); return null }
  return { ...ctx, employee }
}

// The plan's games with their details and this week's progress.
async function viewPlan(db, plan) {
  const ids = plan.games.map((g) => g.game_id)
  const docs = ids.length ? await db.collection('games').find({ _id: { $in: ids } }).toArray() : []
  const byId = new Map(docs.map((d) => [String(d._id), d]))
  const progress = await weekProgress(db, plan.patient_id, plan)
  const therapist = await db.collection('employees').findOne({ _id: plan.therapist_id }, { projection: { first_name: 1, last_name: 1 } })
  return {
    id: String(plan._id), patientId: String(plan.patient_id), status: plan.status,
    sessionPlanId: plan.session_plan_id ? String(plan.session_plan_id) : null, appointmentId: plan.appointment_id ? String(plan.appointment_id) : null,
    startsAt: plan.starts_at.toISOString(), endsAt: plan.ends_at.toISOString(), days: plan.days,
    dailyStart: plan.daily_start, dailyEnd: plan.daily_end, dailyLimitMinutes: plan.daily_limit_minutes, goalPerGamePerWeek: plan.goal_per_game_per_week,
    notifyCaregiver: plan.notify_caregiver, saveToProgress: plan.save_to_progress, autoLevelUp: plan.auto_level_up,
    therapistName: therapist ? fullName(therapist) : 'Your therapist',
    weekStart: weekStart().toISOString(),
    games: [...plan.games].sort((a, b) => a.order - b.order).map((g) => {
      const d = byId.get(String(g.game_id))
      const p = progress.get(String(g.game_id)) || {}
      return {
        ...(d ? serializeGame(d) : { id: String(g.game_id), name: 'Game', difficulty: 'easy', minutes: 5 }),
        source: g.source, order: g.order,
        playsThisWeek: p.playsThisWeek || 0, playsByDay: p.byDay || [0, 0, 0, 0, 0, 0, 0], bestHome: p.bestHome ?? null, sessionScore: p.sessionScore ?? null,
        lastHomeAt: p.lastHomeAt ? p.lastHomeAt.toISOString() : null,
        needsPractice: p.sessionScore != null && p.sessionScore < 60,
      }
    }),
  }
}

// What was played in the therapy session on a day: per game, minutes played and the score.
async function playedInSession(db, patientId, key) {
  const from = dayStart(key)
  const rows = await db.collection('game_sessions').find({
    patient_id: patientId, context: { $ne: 'home' }, status: 'completed', completed_at: { $gte: from, $lt: new Date(from.getTime() + DAY) },
  }).sort({ completed_at: 1 }).toArray()
  const per = new Map()
  for (const r of rows) {
    const k = String(r.game_id)
    const o = per.get(k) || { gameId: k, seconds: 0 }
    o.seconds += Number.isFinite(r.result?.duration_seconds) ? r.result.duration_seconds : 0
    o.correct = r.result?.correct ?? null
    o.attempts = r.result?.attempts ?? null
    o.percent = playPercent(r.result)
    per.set(k, o)
  }
  const ids = [...per.keys()].map(oid).filter(Boolean)
  const docs = ids.length ? await db.collection('games').find({ _id: { $in: ids } }).toArray() : []
  const byId = new Map(docs.map((d) => [String(d._id), d]))
  const list = [...per.values()].map((o) => {
    const d = byId.get(o.gameId)
    return { ...o, minutes: Math.max(1, Math.round(o.seconds / 60)), chip: resultChip(o.percent), name: d?.name || 'Game', difficulty: d ? gameDifficulty(d) : 'easy', therapyType: d?.therapy_type || null }
  })
  const worst = list.filter((g) => g.percent != null).sort((a, b) => a.percent - b.percent)[0]
  return list.map((g) => ({ ...g, suggested: Boolean(worst) && worst.percent < 100 && g.gameId === worst.gameId }))
}

async function notifyHome(db, patient, plan, therapistName, count) {
  const to = patient?.email || patient?.guardian_email
  if (!to) return
  const first = patient.nickname || patient.first_name || 'your child'
  await notify(db, { email: to, type: 'home_practice', title: 'Home practice is ready', body: `${therapistName} kept ${count} game${count === 1 ? '' : 's'} open at home for ${first}.`, link: '/patient/gamified-activities' })
  try {
    const when = `${plan.days.length === 7 ? 'every day' : 'on practice days'}, ${plan.daily_start}–${plan.daily_end}, up to ${plan.daily_limit_minutes} minutes a day`
    const html = `<p>Hi!</p><p><b>${therapistName}</b> kept <b>${count}</b> game${count === 1 ? '' : 's'} open at home for ${first}.</p><p>${first} can play ${when} until ${plan.ends_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}.</p><p>Open TherapyPro and tap Gamified Activities to play.</p>`
    await Promise.race([sendEmail({ to, toName: first, subject: 'Home practice is ready on TherapyPro', html, plain: `${therapistName} kept ${count} game(s) open at home for ${first}. Open TherapyPro > Gamified Activities to play.` }), new Promise((r) => setTimeout(r, 5000))])
  } catch (err) { console.error('home practice email failed:', err.message) }
}

// POST /api/home-practice-plans
export async function homePlansCollection(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee, user, ip } = ctx
    const b = req.body || {}
    const patientId = oid(b.patientId)
    const assignment = patientId && await activeAssignment(db, patientId, employee._id)
    if (!assignment) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const checked = normalizeHomeSettings(b)
    if (checked.error) return res.status(400).json({ error: checked.error })
    const list = (Array.isArray(b.games) ? b.games : []).map((g) => ({ id: oid(g?.gameId), source: g?.source === 'home_only' ? 'home_only' : 'session' }))
    if (list.length < 1 || list.length > 10 || list.some((g) => !g.id) || new Set(list.map((g) => String(g.id))).size !== list.length) return res.status(400).json({ error: 'Pick 1 to 10 different games to send home.' })
    const docs = await db.collection('games').find({ _id: { $in: list.map((g) => g.id) } }).toArray()
    if (docs.length !== list.length || docs.some((d) => d.status !== 'published')) return res.status(400).json({ error: 'Only published games can be sent home.' })

    // A new plan replaces the patient's active one (their weekly counts restart with the new plan).
    await HomePracticePlan.updateMany({ patient_id: patientId, status: 'active' }, { $set: { status: 'cancelled' } })
    const plan = await HomePracticePlan.create({
      patient_id: patientId, therapist_id: employee._id, branch_id: assignment.branch_id || employee.branch_id || null,
      session_plan_id: oid(b.sessionPlanId), appointment_id: oid(b.appointmentId), ...checked.value,
      games: list.map((g, i) => ({ game_id: g.id, order: i + 1, source: g.source })), status: 'active',
    })
    await audit(db, { user, role: user.role, action: 'home_practice_assigned', patientId, ip, meta: { plan_id: String(plan._id), games: list.length } })
    if (plan.notify_caregiver) {
      const patient = await db.collection('patients').findOne({ _id: patientId })
      await notifyHome(db, patient, plan, `${employee.first_name || 'Your therapist'} ${employee.last_name || ''}`.trim(), list.length)
    }
    return res.status(201).json({ plan: await viewPlan(db, plan) })
  } catch (err) { return fail(res, err, 'home-practice create') }
}

// PATCH /api/home-practice-plans/:id
export async function homePlansItem(req, res) {
  if (!method(req, res, 'PATCH')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee, user, ip } = ctx
    const plan = oid(req.params.id) && await HomePracticePlan.findById(oid(req.params.id))
    if (!plan || !(String(plan.therapist_id) === String(employee._id) || await activeAssignment(db, plan.patient_id, employee._id))) return res.status(404).json({ error: 'Plan not found.' })
    const b = req.body || {}
    if (b.status === 'cancelled') {
      plan.status = 'cancelled'
      await plan.save()
      await audit(db, { user, role: user.role, action: 'home_practice_cancelled', patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
      return res.status(200).json({ plan: null })
    }
    if (plan.status !== 'active') return res.status(409).json({ error: 'This plan is no longer active.' })
    const merged = {
      startsAt: b.startsAt ?? plan.starts_at, endsAt: b.endsAt ?? plan.ends_at, days: b.days ?? plan.days, dailyStart: b.dailyStart ?? plan.daily_start, dailyEnd: b.dailyEnd ?? plan.daily_end,
      dailyLimitMinutes: b.dailyLimitMinutes ?? plan.daily_limit_minutes, goalPerGamePerWeek: b.goalPerGamePerWeek ?? plan.goal_per_game_per_week,
      notifyCaregiver: b.notifyCaregiver ?? plan.notify_caregiver, saveToProgress: b.saveToProgress ?? plan.save_to_progress, autoLevelUp: b.autoLevelUp ?? plan.auto_level_up,
    }
    const checked = normalizeHomeSettings(merged)
    if (checked.error) return res.status(400).json({ error: checked.error })
    Object.assign(plan, checked.value)
    if (Array.isArray(b.games)) {
      const list = b.games.map((g) => ({ id: oid(g?.gameId), source: g?.source === 'home_only' ? 'home_only' : 'session' }))
      if (list.length < 1 || list.length > 10 || list.some((g) => !g.id) || new Set(list.map((g) => String(g.id))).size !== list.length) return res.status(400).json({ error: 'Pick 1 to 10 different games to send home.' })
      const docs = await db.collection('games').find({ _id: { $in: list.map((g) => g.id) } }).toArray()
      if (docs.length !== list.length || docs.some((d) => d.status !== 'published')) return res.status(400).json({ error: 'Only published games can be sent home.' })
      plan.games = list.map((g, i) => ({ game_id: g.id, order: i + 1, source: g.source }))
    }
    await plan.save()
    await audit(db, { user, role: user.role, action: 'home_practice_updated', patientId: plan.patient_id, ip, meta: { plan_id: String(plan._id) } })
    return res.status(200).json({ plan: await viewPlan(db, plan) })
  } catch (err) { return fail(res, err, 'home-practice update') }
}

// GET /api/patients/:id/home-practice?appointmentId=&date=YYYY-MM-DD
export async function patientHomePractice(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    // `/api/patients/session/home-practice?appointmentId=` finds the patient from the session itself.
    let patientId = oid(req.params.id)
    let appt = null
    if (!patientId && req.params.id === 'session' && oid(req.query.appointmentId)) {
      appt = await db.collection('appointments').findOne({ _id: oid(req.query.appointmentId), employee_id: employee._id })
      patientId = appt?.patient_id || null
    }
    if (!patientId || !(await activeAssignment(db, patientId, employee._id))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const patient = await db.collection('patients').findOne({ _id: patientId })
    const plan = await HomePracticePlan.findOne({ patient_id: patientId, status: 'active' }).sort({ created_at: -1 })
    let session = null
    if (!appt && oid(req.query.appointmentId)) appt = await db.collection('appointments').findOne({ _id: oid(req.query.appointmentId), patient_id: patientId, employee_id: employee._id })
    const key = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : appt ? new Date(appt.session_date).toISOString().slice(0, 10) : manilaDayKey()
    if (appt) session = { id: String(appt._id), date: key, start: appt.start_time, end: appt.end_time, type: appt.session_type || appt.session_mode || 'Session' }
    const nextAppt = await db.collection('appointments').findOne({
      patient_id: patientId, employee_id: employee._id, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] },
      session_date: { $gt: new Date(`${key}T00:00:00Z`) },
    }, { sort: { session_date: 1, start_time: 1 }, projection: { session_date: 1, start_time: 1 } })
    return res.status(200).json({
      patient: { id: String(patientId), name: fullName(patient), firstName: patient?.nickname || patient?.first_name || '' },
      session, nextSession: nextAppt ? { date: new Date(nextAppt.session_date).toISOString().slice(0, 10), start: nextAppt.start_time } : null,
      plan: plan && plan.ends_at > new Date() ? await viewPlan(db, plan) : null,
      sessionGames: await playedInSession(db, patientId, key),
    })
  } catch (err) { return fail(res, err, 'patients/home-practice') }
}

// GET /api/home-practice/me   (Patient)
export async function homePracticeMe(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Patient'] })
    if (!ctx) return
    const { db, user } = ctx
    const patient = await db.collection('patients').findOne({ email: String(user.email).toLowerCase() })
    if (!patient) return res.status(404).json({ error: 'No patient record is linked to this account yet.' })
    res.setHeader('Cache-Control', 'no-store')
    const now = new Date()
    const plan = await activeHomePlan(patient._id)

    // Games played in recent therapy sessions that are NOT at home (shown locked, with a reason).
    const recent = await db.collection('session_game_plans').find({ patient_id: patient._id, status: { $ne: 'cancelled' } }).sort({ plan_date: -1 }).limit(10).project({ games: 1 }).toArray()
    const sessionIds = [...new Set(recent.flatMap((p) => p.games.map((g) => String(g.game_id))))]
    const homeIds = new Set((plan?.games || []).map((g) => String(g.game_id)))
    const onlyIds = sessionIds.filter((id) => !homeIds.has(id))
    const allIds = [...new Set([...sessionIds, ...homeIds])].map(oid).filter(Boolean)
    const plays = allIds.length ? await db.collection('game_sessions').find({
      patient_id: patient._id, game_id: { $in: allIds }, status: 'completed', completed_at: { $gte: new Date(now.getTime() - 60 * DAY) },
    }).sort({ completed_at: 1 }).project({ game_id: 1, context: 1, completed_at: 1, result: 1 }).toArray() : []
    const names = allIds.length ? new Map((await db.collection('games').find({ _id: { $in: allIds } }).toArray()).map((d) => [String(d._id), d])) : new Map()

    const history = []
    const lastSession = new Map()
    for (const id of [...allIds.map(String)]) {
      const pts = plays.filter((p) => String(p.game_id) === id).map((p) => ({ at: p.completed_at.toISOString(), percent: playPercent(p.result), context: p.context === 'home' ? 'home' : 'session' })).filter((p) => p.percent != null)
      pts.filter((p) => p.context === 'session').forEach((p) => lastSession.set(id, p.percent))
      if (pts.length) history.push({ gameId: id, name: names.get(id)?.name || 'Game', points: pts })
    }
    const nextAppt = await db.collection('appointments').findOne({
      patient_id: patient._id, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] }, session_date: { $gte: dayStart(dayKey(now)) },
    }, { sort: { session_date: 1, start_time: 1 }, projection: { session_date: 1, start_time: 1 } })
    const sessionOnly = onlyIds.map((id) => ({
      gameId: id, name: names.get(id)?.name || 'Game', difficulty: names.get(id) ? gameDifficulty(names.get(id)) : 'easy', therapyType: names.get(id)?.therapy_type || null,
      reason: lastSession.get(id) === 100 ? 'Mastered – opens again in your next session' : 'Opens again in your next session',
    }))
    const base = { now: now.toISOString(), firstName: patient.nickname || patient.first_name || 'friend', nextSession: nextAppt ? new Date(nextAppt.session_date).toISOString().slice(0, 10) : null, sessionOnly, history }
    if (!plan) return res.status(200).json({ ...base, plan: null })

    const used = await homeSecondsToday(db, patient._id, plan._id, now)
    const w = homeWindow(plan, used, now)
    const view = await viewPlan(db, plan)
    const goalTotal = view.games.length * plan.goal_per_game_per_week
    const doneTotal = view.games.reduce((s, g) => s + Math.min(g.playsThisWeek, plan.goal_per_game_per_week), 0)
    return res.status(200).json({
      ...base,
      plan: view,
      window: { open: w.open, reason: w.reason, usedSeconds: used, limitSeconds: w.limitSeconds, secondsLeft: w.secondsLeft },
      week: { played: doneTotal, goal: goalTotal },
    })
  } catch (err) { return fail(res, err, 'home-practice/me') }
}
