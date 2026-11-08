// Home practice "sets": the group of games a patient practices at home, one set after another.
//
// A set is a row in `home_sets` (new collection, no schema validator) that wraps the existing `home_practice_plans` row:
//   home_sets            set_number, status (active | completed), started_at, completed_at, starting_level, use_in_therapy, use_at_home,
//                        game_ids, plan_id, next_session, keep_set_at ("Keep this set"), undo (snapshot for the Undo button)
//   home_practice_plans  unchanged: it is still what the patient app reads to unlock games at home.
// Progress is DERIVED from the existing `game_sessions` rows (no copy to keep in sync), so the therapist page and the patient side
// always agree and nothing needs to be recomputed when a play is saved. Each home game can be played HOME_PLAYS_PER_GAME times per set
// (the patient side locks it after that): 1-2 plays = practicing, all plays used = finished, and finished with every play at
// MASTERED_ACCURACY percent = mastered. The set is complete when every game is finished. Before the next set can be assigned the therapist
// writes a SOAP note about the home practice (soap_note_id on the set). See homeSetConfig.js.
import { ObjectId } from 'mongodb'
import { HomePracticePlan } from './models/homePracticePlan.js'
import { playPercent } from './homePractice.js'
import { manilaDayKey, serializeGame } from './gamePlans.js'
import { notify } from './sessionRecommendations.js'
import { summarise } from './homePracticeStats.js'
import { HOME_PLAYS_PER_GAME, MASTERED_ACCURACY, MASTERED_PLAYS_REQUIRED, MAX_SET_GAMES, MIN_SET_GAMES, STARTING_LEVELS, UNDO_GRACE_MS, UNDO_WINDOW_MS } from './homeSetConfig.js'

const DAY = 86400000
const toId = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }
const httpError = (status, message) => Object.assign(new Error(message), { status })
const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Patient'

export const statusOf = (plays, mastered) => (mastered >= MASTERED_PLAYS_REQUIRED ? 'mastered' : plays >= HOME_PLAYS_PER_GAME ? 'finished' : plays > 0 ? 'practicing' : 'not_started')
export const gameIsDone = (status) => status === 'mastered' || status === 'finished'
export const setIsComplete = (games) => games.length > 0 && games.every((g) => gameIsDone(g.status))
// Home sets count plays made at home; a therapy-only set counts every play.
const contextOf = (set) => (set.use_at_home === false ? null : 'home')

// Per game: completed plays, plays at the mastery accuracy, status, and the day the game became mastered.
export async function masteryForGames(db, patientId, gameIds, since, until = null, context = null) {
  const out = new Map(gameIds.map((id) => [String(id), { plays: 0, masteredPlays: 0, masteredAt: null, status: 'not_started' }]))
  if (!gameIds.length) return out
  const when = { $gte: since, ...(until ? { $lte: until } : {}) }
  const rows = await db.collection('game_sessions').find(
    { patient_id: patientId, game_id: { $in: gameIds }, status: 'completed', completed_at: when, ...(context ? { context } : {}) },
    { projection: { game_id: 1, completed_at: 1, result: 1 } },
  ).sort({ completed_at: 1 }).toArray()
  for (const r of rows) {
    const o = out.get(String(r.game_id))
    if (!o) continue
    o.plays += 1
    const pct = playPercent(r.result)
    if (pct != null && pct >= MASTERED_ACCURACY) {
      o.masteredPlays += 1
      if (o.masteredPlays === MASTERED_PLAYS_REQUIRED) o.masteredAt = r.completed_at
    }
    if (o.plays === HOME_PLAYS_PER_GAME) o.finishedAt = r.completed_at
  }
  for (const o of out.values()) if (!o.masteredAt && o.finishedAt) o.masteredAt = o.finishedAt
  for (const o of out.values()) o.status = statusOf(o.plays, o.masteredPlays)
  return out
}

// The patient's next scheduled session with this therapist (after today), or null.
export async function nextSessionFor(db, patientId, employeeId) {
  const key = manilaDayKey()
  const a = await db.collection('appointments').findOne({
    patient_id: patientId, employee_id: employeeId, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined', 'Archived', 'No Show', 'No-show', 'Completed'] },
    session_date: { $gt: new Date(`${key}T00:00:00Z`) },
  }, { sort: { session_date: 1, start_time: 1 }, projection: { session_date: 1, start_time: 1 } })
  return a ? { appointment_id: a._id, date: new Date(a.session_date).toISOString().slice(0, 10), start: a.start_time || null } : null
}

// The patient's active set. A set is created lazily for a patient who already has an active home plan (set 1), and follows the
// plan if the therapist replaced it with "Send games home" (counting then restarts, like any new plan).
export async function syncActiveSet(db, patientId) {
  const sets = db.collection('home_sets')
  const plan = await HomePracticePlan.findOne({ patient_id: patientId, status: 'active' }).sort({ created_at: -1 }).lean()
  const live = plan && plan.ends_at.getTime() > Date.now() ? plan : null
  let set = await sets.findOne({ patient_id: patientId, status: 'active' })
  if (!live) return set
  const gameIds = [...live.games].sort((a, b) => a.order - b.order).map((g) => g.game_id)
  if (!set) {
    const doc = {
      patient_id: patientId, set_number: (await sets.countDocuments({ patient_id: patientId })) + 1, status: 'active', plan_id: live._id,
      started_at: live.created_at, completed_at: null, starting_level: 'warmup', use_in_therapy: true, use_at_home: true, game_ids: gameIds,
      next_session: null, keep_set_at: null, soap_note_id: null, soap_at: null, undo: null, created_at: new Date(),
    }
    const r = await sets.insertOne(doc)
    set = { ...doc, _id: r.insertedId }
  } else if (String(set.plan_id || '') !== String(live._id)) {
    await sets.updateOne({ _id: set._id }, { $set: { plan_id: live._id, game_ids: gameIds, started_at: live.created_at, use_at_home: true, keep_set_at: null, soap_note_id: null, soap_at: null, undo: null } })
    set = await sets.findOne({ _id: set._id })
  }
  return set
}

// Everything the Home practice tab needs, for the patients assigned to this therapist.
export async function buildOverview(db, employee) {
  const assigns = await db.collection('patient_assign').find({ employee_id: employee._id, status: 'active' }, { projection: { patient_id: 1 } }).toArray()
  const mine = new Map(assigns.map((a) => [String(a.patient_id), a.patient_id]))
  const ids = [...mine.values()]
  const [plans, activeSets] = ids.length ? await Promise.all([
    HomePracticePlan.find({ patient_id: { $in: ids }, status: 'active', ends_at: { $gt: new Date() } }).select('patient_id').lean(),
    db.collection('home_sets').find({ patient_id: { $in: ids }, status: 'active' }, { projection: { patient_id: 1 } }).toArray(),
  ]) : [[], []]
  const withHome = new Map([...plans, ...activeSets].map((x) => [String(x.patient_id), x.patient_id]))

  const sets = (await Promise.all([...withHome.values()].map(async (pid) => [pid, await syncActiveSet(db, pid)]))).filter(([, s]) => s)
  const gameIds = [...new Set(sets.flatMap(([, s]) => s.game_ids.map(String)))].map(toId)
  const [patients, games, history] = await Promise.all([
    sets.length ? db.collection('patients').find({ _id: { $in: sets.map(([p]) => p) } }, { projection: { first_name: 1, last_name: 1, nickname: 1 } }).toArray() : [],
    gameIds.length ? db.collection('games').find({ _id: { $in: gameIds } }, { projection: { name: 1, description: 1 } }).toArray() : [],
    sets.length ? db.collection('home_sets').find({ patient_id: { $in: sets.map(([p]) => p) }, status: 'completed' }).sort({ completed_at: -1 }).toArray() : [],
  ])
  const patientBy = new Map(patients.map((p) => [String(p._id), p]))
  const gameBy = new Map(games.map((g) => [String(g._id), g]))
  const histGameIds = [...new Set(history.flatMap((h) => h.game_ids.map(String)))].filter((id) => !gameBy.has(id)).map(toId)
  if (histGameIds.length) (await db.collection('games').find({ _id: { $in: histGameIds } }, { projection: { name: 1 } }).toArray()).forEach((g) => gameBy.set(String(g._id), g))

  const rows = await Promise.all(sets.map(async ([pid, set]) => {
    const m = await masteryForGames(db, pid, set.game_ids, set.started_at, null, contextOf(set))
    const list = set.game_ids.map((id) => { const o = m.get(String(id)); return { gameId: String(id), name: gameBy.get(String(id))?.name || 'Game', ...o, plays: Math.min(o.plays, HOME_PLAYS_PER_GAME), required: HOME_PLAYS_PER_GAME } })
    const complete = setIsComplete(list)
    const p = patientBy.get(String(pid))
    const name = fullName(p)
    return {
      patientId: String(pid), name, firstName: p?.nickname || p?.first_name || name,
      setId: String(set._id), setNumber: set.set_number, startedAt: set.started_at, assignedAt: set.created_at,
      useAtHome: set.use_at_home !== false, useInTherapy: Boolean(set.use_in_therapy), startingLevel: set.starting_level || 'warmup',
      nextSession: set.next_session ? { date: set.next_session.date, start: set.next_session.start } : null,
      games: list, playedCount: list.filter((g) => g.plays > 0).length, masteredCount: list.filter((g) => g.status === 'mastered').length, finishedCount: list.filter((g) => gameIsDone(g.status)).length,
      complete, dismissed: Boolean(set.keep_set_at), needsNew: complete && !set.keep_set_at, soapDone: Boolean(set.soap_note_id), needsSoap: complete && !set.soap_note_id,
      history: history.filter((h) => String(h.patient_id) === String(pid)).map((h) => ({
        setId: String(h._id), setNumber: h.set_number, startedAt: h.started_at, completedAt: h.completed_at, games: h.game_ids.map((id) => gameBy.get(String(id))?.name || 'Game'),
      })),
    }
  }))
  rows.sort((a, b) => Number(b.needsNew) - Number(a.needsNew) || a.name.localeCompare(b.name))
  return {
    config: { playsPerGame: HOME_PLAYS_PER_GAME, masteredPlaysRequired: MASTERED_PLAYS_REQUIRED, masteredAccuracy: MASTERED_ACCURACY, minGames: MIN_SET_GAMES, maxGames: MAX_SET_GAMES, undoWindowMs: UNDO_WINDOW_MS },
    patients: rows,
    summary: {
      patients: rows.length, needNew: rows.filter((r) => r.needsNew).length,
      finished: rows.reduce((a, r) => a + r.finishedCount, 0), notFinished: rows.filter((r) => !r.complete).length,
    },
  }
}

// The games the therapist may pick for the next set, each tagged new / played / mastered (and one "recommended").
export async function availableGames(db, patientId, employee) {
  const [docs, played, sets, patient, next] = await Promise.all([
    db.collection('games').find({ status: 'published' }).toArray(),
    db.collection('game_sessions').distinct('game_id', { patient_id: patientId, status: 'completed' }),
    db.collection('home_sets').find({ patient_id: patientId }).toArray(),
    db.collection('patients').findOne({ _id: patientId }, { projection: { first_name: 1, last_name: 1, nickname: 1 } }),
    nextSessionFor(db, patientId, employee._id),
  ])
  const playedSet = new Set(played.map(String))
  const masteredAt = new Map()
  for (const s of sets) {
    const m = await masteryForGames(db, patientId, s.game_ids, s.started_at, s.completed_at, contextOf(s))
    for (const [id, o] of m) if (o.status === 'mastered' && (!masteredAt.has(id) || o.masteredAt > masteredAt.get(id))) masteredAt.set(id, o.masteredAt)
  }
  const ordered = [...docs].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || String(a.name).localeCompare(String(b.name)))
  const games = ordered.map((d) => {
    const id = String(d._id)
    return { ...serializeGame(d), status: masteredAt.has(id) ? 'mastered' : playedSet.has(id) ? 'played' : 'new', masteredAt: masteredAt.get(id) || null, recommended: false }
  })
  const first = games.find((g) => g.status === 'new')
  if (first) first.recommended = true
  const active = sets.find((s) => s.status === 'active')
  const plan = active?.plan_id ? await HomePracticePlan.findById(active.plan_id).lean() : null
  return {
    games, patient: { id: String(patientId), name: fullName(patient), firstName: patient?.nickname || patient?.first_name || 'the patient' },
    setNumber: (active?.set_number || sets.length) + 1, activeGameIds: active ? active.game_ids.map(String) : [],
    nextSession: next ? { date: next.date, start: next.start } : null,
    home: plan ? { goal: plan.goal_per_game_per_week, days: plan.days, dailyStart: plan.daily_start, dailyEnd: plan.daily_end } : { goal: 3, days: [1, 2, 3, 4, 5], dailyStart: '16:00', dailyEnd: '19:00' },
  }
}

// "Assign new set": completes the current set and starts the next. Steps run in order and are undone if one fails
// (MongoDB multi-document transactions are not used because the plan is written through Mongoose and the rest through the driver).
export async function assignNewSet(db, { employee, patientId, gameIds, startingLevel, useInTherapy, useAtHome }) {
  const ids = (Array.isArray(gameIds) ? gameIds : []).map(toId)
  if (ids.some((i) => !i) || new Set(ids.map(String)).size !== ids.length) throw httpError(400, 'Pick different, valid games.')
  if (ids.length < MIN_SET_GAMES || ids.length > MAX_SET_GAMES) throw httpError(400, `Pick ${MIN_SET_GAMES} to ${MAX_SET_GAMES} games.`)
  if (!STARTING_LEVELS.includes(startingLevel)) throw httpError(400, 'Choose a starting level.')
  if (!useInTherapy && !useAtHome) throw httpError(400, 'Use the games in the next therapy session, at home, or both.')
  const docs = await db.collection('games').find({ _id: { $in: ids } }).toArray()
  if (docs.length !== ids.length || docs.some((d) => d.status !== 'published')) throw httpError(400, 'Only published games can be assigned.')

  const sets = db.collection('home_sets')
  const current = await syncActiveSet(db, patientId)
  if (!current) throw httpError(409, 'This patient has no active home practice set. Set up home practice first.')
  const m = await masteryForGames(db, patientId, current.game_ids, current.started_at, null, contextOf(current))
  if (!setIsComplete(current.game_ids.map((id) => m.get(String(id))))) throw httpError(409, 'The current set is not complete yet: every game needs all its plays first.')
  // The therapist documents the home practice before moving on.
  const note = current.soap_note_id && await db.collection('therapy_notes').findOne({ _id: current.soap_note_id, patient_id: patientId, voided: { $ne: true } }, { projection: { _id: 1 } })
  if (!note) throw httpError(409, 'Write the SOAP note for this home practice set first, then choose the next set.')

  const now = new Date()
  const oldPlan = current.plan_id ? await HomePracticePlan.findById(current.plan_id) : null
  const next = useInTherapy ? await nextSessionFor(db, patientId, employee._id) : null
  const patient = await db.collection('patients').findOne({ _id: patientId })
  const names = ids.map((id) => docs.find((d) => String(d._id) === String(id)).name)

  let newPlan = null
  let newSetId = null
  await sets.updateOne({ _id: current._id }, { $set: { status: 'completed', completed_at: now, keep_set_at: null } })
  try {
    if (oldPlan && oldPlan.status === 'active') await HomePracticePlan.updateOne({ _id: oldPlan._id }, { $set: { status: 'cancelled' } })
    if (useAtHome) {
      const keepEnd = oldPlan && oldPlan.ends_at.getTime() > now.getTime() + 7 * DAY ? oldPlan.ends_at : new Date(now.getTime() + 28 * DAY)
      newPlan = await HomePracticePlan.create({
        patient_id: patientId, therapist_id: employee._id, branch_id: oldPlan?.branch_id || employee.branch_id || null,
        session_plan_id: null, appointment_id: next?.appointment_id || oldPlan?.appointment_id || null,
        starts_at: now, ends_at: keepEnd, days: oldPlan?.days || [1, 2, 3, 4, 5], daily_start: oldPlan?.daily_start || '16:00', daily_end: oldPlan?.daily_end || '19:00',
        daily_limit_minutes: oldPlan?.daily_limit_minutes || 15, goal_per_game_per_week: oldPlan?.goal_per_game_per_week || 3,
        notify_caregiver: oldPlan?.notify_caregiver !== false, save_to_progress: oldPlan?.save_to_progress !== false, auto_level_up: false,
        games: ids.map((id, i) => ({ game_id: id, order: i + 1, source: 'session' })), status: 'active',
      })
    }
    const doc = {
      patient_id: patientId, set_number: current.set_number + 1, status: 'active', plan_id: newPlan ? newPlan._id : null,
      started_at: now, completed_at: null, starting_level: startingLevel, use_in_therapy: Boolean(useInTherapy), use_at_home: Boolean(useAtHome),
      game_ids: ids, next_session: next, keep_set_at: null, created_by: employee._id, created_at: now,
      undo: { previous_set_id: current._id, previous_plan_id: oldPlan ? oldPlan._id : null, new_plan_id: newPlan ? newPlan._id : null, until: new Date(now.getTime() + UNDO_WINDOW_MS + UNDO_GRACE_MS) },
    }
    newSetId = (await sets.insertOne(doc)).insertedId
  } catch (err) {
    if (newPlan) await HomePracticePlan.deleteOne({ _id: newPlan._id })
    if (oldPlan) await HomePracticePlan.updateOne({ _id: oldPlan._id }, { $set: { status: oldPlan.status } })
    await sets.updateOne({ _id: current._id }, { $set: { status: 'active', completed_at: null } })
    throw err
  }

  // The family hears about it (patient account and guardian account when they differ).
  const first = patient?.nickname || patient?.first_name || 'your child'
  const emails = [...new Set([patient?.email, patient?.guardian_email].filter(Boolean).map((e) => String(e).toLowerCase()))]
  for (const email of emails) {
    await notify(db, { email, type: 'home_set', title: 'New games are ready', body: `New games are ready for ${first}: ${names.join(', ')}.`, link: '/patient/gamified-activities', requestId: String(newSetId) })
  }
  return {
    setId: String(newSetId), setNumber: current.set_number + 1, patientName: fullName(patient), firstName: first, games: names,
    therapyDate: next?.date || null, therapyStart: next?.start || null, useInTherapy: Boolean(useInTherapy), useAtHome: Boolean(useAtHome),
    goal: newPlan ? newPlan.goal_per_game_per_week : null, undoMs: UNDO_WINDOW_MS,
  }
}

// "Undo" shortly after assigning: puts the previous set and plan back and removes the new ones.
export async function undoNewSet(db, { patientId, setId }) {
  const sets = db.collection('home_sets')
  const sid = toId(setId)
  const cur = sid && await sets.findOne({ _id: sid, patient_id: patientId, status: 'active' })
  if (!cur?.undo) throw httpError(404, 'There is nothing to undo.')
  if (Date.now() > new Date(cur.undo.until).getTime()) throw httpError(409, 'The undo time has passed.')
  const played = await db.collection('game_sessions').countDocuments({ patient_id: patientId, game_id: { $in: cur.game_ids }, completed_at: { $gte: cur.started_at } })
  if (played > 0) throw httpError(409, 'The patient has already played a game from the new set.')
  if (cur.undo.new_plan_id) await HomePracticePlan.deleteOne({ _id: cur.undo.new_plan_id })
  if (cur.undo.previous_plan_id) await HomePracticePlan.updateOne({ _id: cur.undo.previous_plan_id }, { $set: { status: 'active' } })
  await sets.updateOne({ _id: cur.undo.previous_set_id }, { $set: { status: 'active', completed_at: null } })
  await sets.deleteOne({ _id: cur._id })
  await db.collection('notifications').deleteMany({ type: 'home_set', request_id: String(cur._id) })
  return { ok: true }
}

// "Keep this set": hides the celebration banner for this set only.
export async function dismissSetComplete(db, { setId, employee, assigned }) {
  const sid = toId(setId)
  const set = sid && await db.collection('home_sets').findOne({ _id: sid, status: 'active' })
  if (!set || !(await assigned(set.patient_id, employee._id))) throw httpError(404, 'Set not found.')
  await db.collection('home_sets').updateOne({ _id: set._id }, { $set: { keep_set_at: new Date() } })
  return { ok: true }
}

// Games queued for a therapy session by an assigned set (shown pre-selected on the session day).
export async function queuedGamesByAppointment(db, appointmentIds) {
  if (!appointmentIds.length) return new Map()
  const sets = await db.collection('home_sets').find({ status: 'active', use_in_therapy: true, 'next_session.appointment_id': { $in: appointmentIds } }).toArray()
  const ids = [...new Set(sets.flatMap((s) => s.game_ids.map(String)))].map(toId)
  const docs = ids.length ? await db.collection('games').find({ _id: { $in: ids }, status: 'published' }).toArray() : []
  const by = new Map(docs.map((d) => [String(d._id), serializeGame(d)]))
  return new Map(sets.map((s) => [String(s.next_session.appointment_id), s.game_ids.map((id) => by.get(String(id))).filter(Boolean)]))
}

// A finished set the therapist owns (patient assigned to them). Throws 404 otherwise.
async function ownedActiveSet(db, { setId, employee, assigned }) {
  const sid = toId(setId)
  const set = sid && await db.collection('home_sets').findOne({ _id: sid, status: 'active' })
  if (!set || !(await assigned(set.patient_id, employee._id))) throw httpError(404, 'Set not found.')
  return set
}

// Text for the Objective section of the home practice SOAP note: what was played and how it went, from the recorded plays only.
export async function homeSetSummary(db, { setId, employee, assigned }) {
  const set = await ownedActiveSet(db, { setId, employee, assigned })
  const ctx = contextOf(set)
  const [games, plays] = await Promise.all([
    db.collection('games').find({ _id: { $in: set.game_ids } }, { projection: { name: 1 } }).toArray(),
    db.collection('game_sessions').find({ patient_id: set.patient_id, game_id: { $in: set.game_ids }, status: 'completed', completed_at: { $gte: set.started_at }, ...(ctx ? { context: ctx } : {}) }).sort({ completed_at: 1 }).toArray(),
  ])
  const nameBy = new Map(games.map((g) => [String(g._id), g.name]))
  const day = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
  const lines = set.game_ids.map((id) => {
    const mine = plays.filter((p) => String(p.game_id) === String(id))
    const s = summarise(mine)
    const used = Math.min(s.plays, HOME_PLAYS_PER_GAME)
    return `- ${nameBy.get(String(id)) || 'Game'}: ${used} of ${HOME_PLAYS_PER_GAME} plays at home${s.accuracy != null ? `, accuracy ${s.accuracy}%` : ''}, ${s.mistakes} mistake${s.mistakes === 1 ? '' : 's'}, ${s.hints} hint${s.hints === 1 ? '' : 's'}`
  })
  const all = summarise(plays)
  const text = [`Home practice, set ${set.set_number} (${day(set.started_at)} to ${day(plays.length ? plays[plays.length - 1].completed_at : new Date())}).`, ...lines,
    `Overall: ${all.plays} play${all.plays === 1 ? '' : 's'}${all.accuracy != null ? `, accuracy ${all.accuracy}%` : ''}, ${all.minutes} min played, ${all.xp} XP earned.`].join(String.fromCharCode(10))
  return { text, setNumber: set.set_number, patientId: String(set.patient_id) }
}

// Remembers which SOAP note documents this set. The note must be the therapist's own, for this patient, and not voided.
export async function linkSoapNote(db, { setId, noteId, employee, assigned }) {
  const set = await ownedActiveSet(db, { setId, employee, assigned })
  const nid = toId(noteId)
  const note = nid && await db.collection('therapy_notes').findOne({ _id: nid, patient_id: set.patient_id, employee_id: employee._id, voided: { $ne: true } }, { projection: { _id: 1 } })
  if (!note) throw httpError(400, 'That SOAP note was not found for this patient.')
  await db.collection('home_sets').updateOne({ _id: set._id }, { $set: { soap_note_id: note._id, soap_at: new Date() } })
  return { ok: true }
}
