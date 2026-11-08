// Home practice sets (therapist side of the "Assign Games" page, Home practice tab). All routes need role Therapist and only
// touch patients that therapist is actively assigned to. Rules live in ../homeSets.js and ../homeSetConfig.js.
//   GET  /api/therapist/home-sets                    patients with a home set, per-game mastery, summary counts
//   GET  /api/therapist/patients/:id/home-practice-stats?set=<id|current|all>&range=7|30|90   Patient Stats, scoped to a set
//   GET  /api/therapist/patients/:id/home-sets       the sets for the selector
//   GET  /api/therapist/home-sets/games?patientId=   games to pick from, tagged new / played / mastered / recommended
//   POST /api/therapist/home-sets/assign             { patientId, gameIds[], startingLevel, useInTherapy, useAtHome }
//   POST /api/therapist/home-sets/undo               { patientId, setId }  (a few seconds after assigning)
//   POST /api/therapist/home-sets/dismiss            { setId }  ("Keep this set")
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { activeAssignment, employeeFor, oid } from '../gamePlans.js'
import { buildSetStats } from '../homeSetStats.js'
import { ensureDrafts, noteContext, recommendationFor, redraft, saveReview, updateObjectives } from '../homeSetDrafts.js'
import { nextSessionFor } from '../homeSets.js'
import { assignNewSet, availableGames, buildOverview, dismissSetComplete, undoNewSet } from '../homeSets.js'

const method = (req, res, ...allowed) => {
  if (allowed.includes(req.method)) return true
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: 'Method not allowed' })
  return false
}
const fail = (res, err, label) => {
  console.error(`${label}:`, err)
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.', ...(typeof err.code === 'string' ? { code: err.code } : {}) })
}
async function therapistCtx(req, res) {
  await getMongo()
  const ctx = await requireSession(req, res, { roles: ['Therapist'] })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.' }); return null }
  return { ...ctx, employee }
}
const mine = async (ctx, patientId) => Boolean(patientId && await activeAssignment(ctx.db, patientId, ctx.employee._id))

export async function homeSetsOverview(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    let out = await buildOverview(ctx.db, ctx.employee)
    // A finished set gets its two drafts (SOAP note and recommended set) the first time anyone looks; later calls do nothing.
    const todo = out.patients.filter((p) => p.complete && !p.draftReady && !p.draftsError)
    if (todo.length) { for (const p of todo) await ensureDrafts(ctx.db, oid(p.setId)); out = await buildOverview(ctx.db, ctx.employee) }
    return res.status(200).json(out)
  } catch (err) { return fail(res, err, 'home-sets overview') }
}

export async function homeSetsGames(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const patientId = oid(req.query.patientId)
    if (!(await mine(ctx, patientId))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    return res.status(200).json(await availableGames(ctx.db, patientId, ctx.employee))
  } catch (err) { return fail(res, err, 'home-sets games') }
}

export async function homeSetsAssign(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const b = req.body || {}
    const patientId = oid(b.patientId)
    if (!(await mine(ctx, patientId))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const result = await assignNewSet(ctx.db, {
      employee: ctx.employee, patientId, gameIds: b.gameIds, startingLevel: b.startingLevel, useInTherapy: b.useInTherapy !== false, useAtHome: b.useAtHome !== false, objectives: Array.isArray(b.objectives) ? b.objectives : null,
    })
    await audit(ctx.db, { user: ctx.user, role: ctx.user.role, action: 'home_set_assigned', patientId, ip: ctx.ip, meta: { set_id: result.setId, set_number: result.setNumber, games: result.games.length } })
    return res.status(201).json(result)
  } catch (err) { return fail(res, err, 'home-sets assign') }
}

export async function homeSetsUndo(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const patientId = oid(req.body?.patientId)
    if (!(await mine(ctx, patientId))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const out = await undoNewSet(ctx.db, { patientId, setId: req.body?.setId })
    await audit(ctx.db, { user: ctx.user, role: ctx.user.role, action: 'home_set_undone', patientId, ip: ctx.ip, meta: { set_id: String(req.body?.setId) } })
    return res.status(200).json(out)
  } catch (err) { return fail(res, err, 'home-sets undo') }
}

export async function homeSetsDismiss(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const out = await dismissSetComplete(ctx.db, { setId: req.body?.setId, employee: ctx.employee, assigned: (pid, eid) => activeAssignment(ctx.db, pid, eid) })
    return res.status(200).json(out)
  } catch (err) { return fail(res, err, 'home-sets dismiss') }
}

// GET /api/therapist/patients/:id/home-practice-stats  (only the therapist's own patient)
export async function homeSetStats(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const patientId = oid(req.params.id)
    if (!(await mine(ctx, patientId))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const days = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30
    const out = await buildSetStats(ctx.db, { patientId, setParam: String(req.query.set || 'current'), days })
    if (out.selected) {
      const [next, overview] = await Promise.all([nextSessionFor(ctx.db, patientId, ctx.employee._id), buildOverview(ctx.db, ctx.employee)])
      out.nextSession = next ? { date: next.date, start: next.start } : null
      out.homeRow = overview.patients.find((p) => p.patientId === String(patientId)) || null // what the SOAP note and next-set windows open with
      out.config = overview.config
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(out)
  } catch (err) { return fail(res, err, 'home-set stats') }
}

export async function homeSetsOfPatient(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const patientId = oid(req.params.id)
    if (!(await mine(ctx, patientId))) return res.status(403).json({ error: 'This patient is not assigned to you.' })
    const out = await buildSetStats(ctx.db, { patientId, setParam: 'current', days: 30 })
    return res.status(200).json({ sets: out.sets })
  } catch (err) { return fail(res, err, 'home-sets of patient') }
}

const assignedTo = (ctx) => (pid, eid) => activeAssignment(ctx.db, pid, eid)

// GET /api/therapist/home-sets/note-context?noteId=   what the Notes & Progress page shows around the auto-drafted note
export async function homeSetsNoteContext(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    return res.status(200).json(await noteContext(ctx.db, { noteId: req.query.noteId, employee: ctx.employee, assigned: assignedTo(ctx) }))
  } catch (err) { return fail(res, err, 'home-sets note-context') }
}

// POST /api/therapist/home-sets/note-review   { noteId, reviewed: { subjective: true, ... }, edited: ['plan'] }
export async function homeSetsNoteReview(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const b = req.body || {}
    return res.status(200).json(await saveReview(ctx.db, { noteId: b.noteId, reviewed: b.reviewed || {}, edited: Array.isArray(b.edited) ? b.edited : [], employee: ctx.employee, assigned: assignedTo(ctx) }))
  } catch (err) { return fail(res, err, 'home-sets note-review') }
}

// POST /api/therapist/home-sets/note-redraft   { noteId, replaceEdits }
export async function homeSetsNoteRedraft(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    const b = req.body || {}
    const out = await redraft(ctx.db, { noteId: b.noteId, replaceEdits: b.replaceEdits === true, employee: ctx.employee, assigned: assignedTo(ctx), userId: ctx.user._id })
    await audit(ctx.db, { user: ctx.user, role: ctx.user.role, action: 'home_practice_redraft', ip: ctx.ip, meta: { note_id: String(b.noteId), replaceEdits: b.replaceEdits === true } })
    return res.status(200).json(out)
  } catch (err) { return fail(res, err, 'home-sets note-redraft') }
}

// GET|PATCH /api/therapist/home-sets/:id/recommendation   the recommended next set with reasons; PATCH { objectives } re-runs it
export async function homeSetsRecommendation(req, res) {
  if (!method(req, res, 'GET', 'PATCH')) return
  try {
    const ctx = await therapistCtx(req, res)
    if (!ctx) return
    if (req.method === 'PATCH') return res.status(200).json(await updateObjectives(ctx.db, { setId: req.params.id, objectives: req.body?.objectives, employee: ctx.employee, assigned: assignedTo(ctx) }))
    return res.status(200).json(await recommendationFor(ctx.db, { setId: req.params.id, employee: ctx.employee, assigned: assignedTo(ctx) }))
  } catch (err) { return fail(res, err, 'home-sets recommendation') }
}
