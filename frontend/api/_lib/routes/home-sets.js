// Home practice sets (therapist side of the "Assign Games" page, Home practice tab). All routes need role Therapist and only
// touch patients that therapist is actively assigned to. Rules live in ../homeSets.js and ../homeSetConfig.js.
//   GET  /api/therapist/home-sets                    patients with a home set, per-game mastery, summary counts
//   GET  /api/therapist/home-sets/games?patientId=   games to pick from, tagged new / played / mastered / recommended
//   POST /api/therapist/home-sets/assign             { patientId, gameIds[], startingLevel, useInTherapy, useAtHome }
//   POST /api/therapist/home-sets/undo               { patientId, setId }  (a few seconds after assigning)
//   POST /api/therapist/home-sets/dismiss            { setId }  ("Keep this set")
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { activeAssignment, employeeFor, oid } from '../gamePlans.js'
import { assignNewSet, availableGames, buildOverview, dismissSetComplete, undoNewSet } from '../homeSets.js'

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
    return res.status(200).json(await buildOverview(ctx.db, ctx.employee))
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
      employee: ctx.employee, patientId, gameIds: b.gameIds, startingLevel: b.startingLevel, useInTherapy: b.useInTherapy !== false, useAtHome: b.useAtHome !== false,
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
