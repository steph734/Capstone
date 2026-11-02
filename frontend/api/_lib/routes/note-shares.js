// Covering-therapist sharing API (collection `note_cover_shares`; the guardian share lives in `note_shares`).
//   GET  /api/therapists/available?date=&time=        active colleagues + availability at that time (owner)
//   POST /api/note-shares                             create a share (owner)
//   PATCH /api/note-shares/:id                        change therapist / access / stop sharing (owner)
//   POST /api/note-shares/:id/accept | /decline       (covering therapist)
//   GET  /api/note-shares/shared-with-me              the covering therapist's list
//   GET  /api/note-shares/by-me                       the owner's list with progress, plus "absent today"
//   GET  /api/note-shares/:id/log                     access log (owner, or the covering therapist while active)
//   GET  /api/note-shares/:id/context?part=past|goals|games   extra info the owner allowed (covering therapist)
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit, employeeFor, isAssigned, decryptSoap } from '../noteAccess.js'
import { notify } from '../sessionRecommendations.js'
import { ACTION_WORDS, COLL, activeCoverShare, availableColleagues, dayKey, endsFor, expireShares, fullName, isActive, logShare, oid, serializeShare } from '../coverShares.js'

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
const apptDay = (d) => { const x = new Date(d); return x.getUTCHours() === 0 && x.getUTCMinutes() === 0 ? x.toISOString().slice(0, 10) : dayKey(x) }

async function ctxFor(req, res) {
  await getMongo()
  const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.' }); return null }
  return { ...ctx, employee }
}
const loadShare = async (db, id) => {
  const _id = oid(id)
  if (!_id) return null
  await expireShares(db)
  return db.collection(COLL).findOne({ _id })
}
const people = async (db, shares) => {
  const empIds = [...new Set(shares.flatMap((s) => [String(s.owner_id), String(s.cover_id)]))].map(oid)
  const patIds = [...new Set(shares.map((s) => String(s.patient_id)))].map(oid)
  const noteIds = shares.map((s) => s.note_id).filter(Boolean)
  const [emps, pats, notes] = await Promise.all([
    empIds.length ? db.collection('employees').find({ _id: { $in: empIds } }).toArray() : [],
    patIds.length ? db.collection('patients').find({ _id: { $in: patIds } }).toArray() : [],
    noteIds.length ? db.collection('therapy_notes').find({ _id: { $in: noteIds } }, { projection: { status: 1, voided: 1 } }).toArray() : [],
  ])
  return { emp: new Map(emps.map((e) => [String(e._id), e])), pat: new Map(pats.map((p) => [String(p._id), p])), note: new Map(notes.map((n) => [String(n._id), n])) }
}
const shape = (s, p) => serializeShare(s, { owner: p.emp.get(String(s.owner_id)), cover: p.emp.get(String(s.cover_id)), patient: p.pat.get(String(s.patient_id)), note: s.note_id ? p.note.get(String(s.note_id)) : null })

// GET /api/therapists/available
export async function therapistsAvailable(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const list = await availableColleagues(ctx.db, ctx.employee, { date: req.query.date, time: req.query.time })
    return res.status(200).json({ therapists: list })
  } catch (err) { return fail(res, err, 'therapists/available') }
}

// POST /api/note-shares
export async function sharesCollection(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, user, ip, employee } = ctx
    const b = req.body || {}
    const patientId = oid(b.patientId)
    if (!patientId || !(await isAssigned(db, employee._id, patientId))) {
      await audit(db, { user, action: 'denied', patientId, ip, meta: { attempted: 'cover-share' } })
      return res.status(403).json({ error: 'Only the patient\'s own therapist can share this note.' })
    }
    // Which session? The given appointment (must be mine), otherwise my appointment with this patient today.
    const today = dayKey()
    let appt = oid(b.appointmentId) ? await db.collection('appointments').findOne({ _id: oid(b.appointmentId), patient_id: patientId, employee_id: employee._id }) : null
    if (!appt) {
      const rows = await db.collection('appointments').find({ patient_id: patientId, employee_id: employee._id, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] } }).sort({ session_date: -1 }).limit(20).toArray()
      appt = rows.find((a) => apptDay(a.session_date) >= today) || null
    }
    if (!appt) return res.status(400).json({ error: 'There is no session for this patient to hand over.' })
    const sessionDay = apptDay(appt.session_date)

    const coverId = oid(b.coverId)
    const list = await availableColleagues(db, employee, { date: sessionDay, time: appt.start_time })
    const target = list.find((t) => t.id === String(coverId))
    if (!coverId || String(coverId) === String(employee._id)) return res.status(400).json({ error: 'Pick a colleague to share with. You cannot share with yourself.' })
    if (!target) return res.status(400).json({ error: 'That therapist is not in your clinic or is not active.' })
    if (target.availability === 'unavailable') return res.status(400).json({ error: `${target.name} is unavailable (${target.reason || 'not working'}).` })

    // The note: an existing unsigned draft of mine can be handed over; a signed note can only be viewed.
    let note = null
    if (oid(b.noteId)) {
      note = await db.collection('therapy_notes').findOne({ _id: oid(b.noteId), patient_id: patientId, employee_id: employee._id, addendum_to: null })
      if (!note || note.voided) return res.status(404).json({ error: 'That note was not found.' })
    }
    const access = note?.status === 'signed' ? 'view' : b.access === 'view' ? 'view' : 'write_sign'
    const ends = endsFor(b.endsKind, b.customDate, sessionDay)
    if (ends.error) return res.status(400).json({ error: ends.error })

    await expireShares(db)
    const clash = await db.collection(COLL).findOne({ patient_id: patientId, session_date: sessionDay, access: 'write_sign', status: { $in: ['pending', 'accepted'] } })
    if (access === 'write_sign' && clash) return res.status(409).json({ error: 'This note is already shared with another therapist. Use "Change therapist" or "Stop sharing" first.' })

    const coverEmp = await db.collection('employees').findOne({ _id: coverId })
    const now = new Date()
    const doc = {
      patient_id: patientId, appointment_id: appt._id, session_date: sessionDay, session_start: appt.start_time, session_end: appt.end_time, session_type: appt.session_type || appt.session_mode || null,
      owner_id: employee._id, owner_user_id: user._id, cover_id: coverId, cover_user_id: coverEmp.user_id || null,
      access, include_past_notes: b.includePastNotes !== false, include_goals: b.includeGoals !== false, include_game_progress: b.includeGameProgress !== false,
      message: String(b.message || '').trim().slice(0, 600), ends_kind: ['signed', 'today', 'custom'].includes(b.endsKind) ? b.endsKind : 'signed', ends_at: ends.value,
      status: 'pending', note_id: note ? note._id : null, created_at: now,
      opened_at: null, writing_at: null, signed_at: null, accepted_at: null, completed_at: null, declined_at: null, revoked_at: null,
    }
    const { insertedId } = await db.collection(COLL).insertOne(doc)
    const share = { ...doc, _id: insertedId }
    await logShare(db, share, user, 'shared', { to: fullName(coverEmp), access })
    await audit(db, { user, action: 'cover_share', patientId, noteId: note?._id || null, ip, meta: { share_id: String(insertedId), to: String(coverId), access } })
    const patient = await db.collection('patients').findOne({ _id: patientId })
    await notify(db, {
      email: coverEmp.email, type: 'note_share', title: 'SOAP note shared with you',
      body: `${fullName(employee)} is absent today and shared ${[patient?.first_name, patient?.last_name].filter(Boolean).join(' ')}'s SOAP note with you.`,
      link: `/therapist/notes-progress?patient=${patientId}`,
    })
    const p = await people(db, [share])
    return res.status(201).json({ share: shape(share, p) })
  } catch (err) { return fail(res, err, 'note-shares create') }
}

// PATCH /api/note-shares/:id  { status: 'revoked' } | { coverId, ... } | { access, includePastNotes, ... }
export async function sharesItem(req, res) {
  if (!method(req, res, 'PATCH')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, user, ip, employee } = ctx
    const share = await loadShare(db, req.params.id)
    if (!share || String(share.owner_id) !== String(employee._id)) {
      if (share) await audit(db, { user, action: 'denied', patientId: share.patient_id, ip, meta: { attempted: 'cover-share edit' } })
      return res.status(share ? 403 : 404).json({ error: share ? 'Only the therapist who shared this note can change it.' : 'Share not found.' })
    }
    if (!isActive(share)) return res.status(409).json({ error: 'This share has already ended.' })
    const b = req.body || {}
    const now = new Date()

    if (b.status === 'revoked') {
      await db.collection(COLL).updateOne({ _id: share._id }, { $set: { status: 'revoked', revoked_at: now } })
      await logShare(db, share, user, 'revoked')
      await audit(db, { user, action: 'cover_revoke', patientId: share.patient_id, noteId: share.note_id, ip, meta: { share_id: String(share._id) } })
      const cover = await db.collection('employees').findOne({ _id: share.cover_id })
      await notify(db, { email: cover?.email, type: 'note_share', title: 'Sharing stopped', body: `${fullName(employee)} stopped sharing a SOAP note with you.`, link: '/therapist/notes-progress' })
      return res.status(200).json({ share: null })
    }

    // Change therapist: revoke this share and create a new one with the same settings.
    if (b.coverId && String(oid(b.coverId)) !== String(share.cover_id)) {
      if (share.writing_at && share.note_id) return res.status(409).json({ error: 'The covering therapist already started writing. Stop sharing first if you need to take it back.' })
      const list = await availableColleagues(db, employee, { date: share.session_date, time: share.session_start })
      const target = list.find((t) => t.id === String(oid(b.coverId)))
      if (!target || target.availability === 'unavailable') return res.status(400).json({ error: 'That therapist is not available.' })
      const coverEmp = await db.collection('employees').findOne({ _id: oid(b.coverId) })
      await db.collection(COLL).updateOne({ _id: share._id }, { $set: { status: 'revoked', revoked_at: now } })
      await logShare(db, share, user, 'revoked', { reason: 'changed therapist' })
      const { _id, ...rest } = share
      const doc = { ...rest, cover_id: coverEmp._id, cover_user_id: coverEmp.user_id || null, status: 'pending', created_at: now, opened_at: null, writing_at: null, accepted_at: null, declined_at: null, revoked_at: null }
      const r = await db.collection(COLL).insertOne(doc)
      const next = { ...doc, _id: r.insertedId }
      await logShare(db, next, user, 'shared', { to: fullName(coverEmp), access: next.access })
      await audit(db, { user, action: 'cover_share', patientId: next.patient_id, noteId: next.note_id, ip, meta: { share_id: String(r.insertedId), to: String(coverEmp._id), changed: true } })
      const patient = await db.collection('patients').findOne({ _id: next.patient_id })
      await notify(db, { email: coverEmp.email, type: 'note_share', title: 'SOAP note shared with you', body: `${fullName(employee)} is absent today and shared ${[patient?.first_name, patient?.last_name].filter(Boolean).join(' ')}'s SOAP note with you.`, link: `/therapist/notes-progress?patient=${next.patient_id}` })
      const old = await db.collection('employees').findOne({ _id: share.cover_id })
      await notify(db, { email: old?.email, type: 'note_share', title: 'Sharing stopped', body: `${fullName(employee)} handed that note to someone else.`, link: '/therapist/notes-progress' })
      return res.status(200).json({ share: shape(next, await people(db, [next])) })
    }

    // Same therapist: update access and options.
    const set = {}
    if (b.access === 'view' || b.access === 'write_sign') { if (share.writing_at && b.access === 'view') return res.status(409).json({ error: 'The covering therapist already started writing.' }); set.access = b.access }
    for (const [k, col] of [['includePastNotes', 'include_past_notes'], ['includeGoals', 'include_goals'], ['includeGameProgress', 'include_game_progress']]) if (typeof b[k] === 'boolean') set[col] = b[k]
    if (typeof b.message === 'string') set.message = b.message.trim().slice(0, 600)
    if (b.endsKind) { const e = endsFor(b.endsKind, b.customDate, share.session_date); if (e.error) return res.status(400).json({ error: e.error }); set.ends_kind = b.endsKind; set.ends_at = e.value }
    if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to change.' })
    await db.collection(COLL).updateOne({ _id: share._id }, { $set: set })
    await logShare(db, share, user, 'changed', set)
    return res.status(200).json({ share: shape({ ...share, ...set }, await people(db, [share])) })
  } catch (err) { return fail(res, err, 'note-shares item') }
}

// POST /api/note-shares/:id/accept | /decline
export async function sharesRespond(req, res) {
  if (!method(req, res, 'POST')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, user, ip, employee } = ctx
    const share = await loadShare(db, req.params.id)
    if (!share || String(share.cover_id) !== String(employee._id)) {
      if (share) await audit(db, { user, action: 'denied', patientId: share.patient_id, ip, meta: { attempted: 'cover-share respond' } })
      return res.status(share ? 403 : 404).json({ error: share ? 'This share is not addressed to you.' : 'Share not found.' })
    }
    if (!isActive(share)) return res.status(403).json({ error: 'This share is no longer active.' })
    const action = req.params.action
    const now = new Date()
    if (action === 'accept') {
      const first = !share.opened_at
      await db.collection(COLL).updateOne({ _id: share._id }, { $set: { status: 'accepted', accepted_at: share.accepted_at || now, opened_at: share.opened_at || now } })
      if (first) {
        await logShare(db, share, user, 'opened')
        await audit(db, { user, action: 'cover_open', patientId: share.patient_id, noteId: share.note_id, ip, meta: { share_id: String(share._id) } })
        const owner = await db.collection('employees').findOne({ _id: share.owner_id })
        await notify(db, { email: owner?.email, type: 'note_share', title: 'Note opened', body: `${fullName(employee)} opened the note you shared.`, link: `/therapist/notes-progress?patient=${share.patient_id}` })
      }
      return res.status(200).json({ ok: true })
    }
    if (action === 'decline') {
      if (share.writing_at) return res.status(409).json({ error: 'You already started this note. Ask the owner to take it back.' })
      await db.collection(COLL).updateOne({ _id: share._id }, { $set: { status: 'declined', declined_at: now } })
      await logShare(db, share, user, 'declined')
      await audit(db, { user, action: 'cover_decline', patientId: share.patient_id, noteId: share.note_id, ip, meta: { share_id: String(share._id) } })
      const owner = await db.collection('employees').findOne({ _id: share.owner_id })
      await notify(db, { email: owner?.email, type: 'note_share', title: 'Handoff declined', body: `${fullName(employee)} declined the note you shared. You can pick another therapist.`, link: `/therapist/notes-progress?patient=${share.patient_id}` })
      return res.status(200).json({ ok: true })
    }
    return res.status(404).json({ error: 'Unknown action.' })
  } catch (err) { return fail(res, err, 'note-shares respond') }
}

// GET /api/note-shares/shared-with-me
export async function sharedWithMe(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    await expireShares(db, { cover_id: employee._id })
    const since = new Date(Date.now() - 7 * 86400000)
    const rows = await db.collection(COLL).find({ cover_id: employee._id, $or: [{ status: { $in: ['pending', 'accepted'] } }, { status: 'completed', completed_at: { $gte: since } }] }).sort({ created_at: -1 }).toArray()
    const p = await people(db, rows)
    return res.status(200).json({
      shares: rows.map((s) => shape(s, p)),
      pendingCount: rows.filter((s) => s.status === 'pending' || (s.status === 'accepted' && !s.signed_at)).length,
    })
  } catch (err) { return fail(res, err, 'note-shares shared-with-me') }
}

// GET /api/note-shares/by-me
export async function sharesByMe(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    await expireShares(db, { owner_id: employee._id })
    const since = new Date(Date.now() - 30 * 86400000)
    const rows = await db.collection(COLL).find({ owner_id: employee._id, created_at: { $gte: since } }).sort({ created_at: -1 }).toArray()
    const p = await people(db, rows)
    const today = dayKey()
    const dayStart = new Date(`${today}T00:00:00+08:00`)
    const leave = await db.collection('leave_request').findOne({ employee: employee._id, status: 'approved', is_archived: { $ne: true }, start_date: { $lt: new Date(dayStart.getTime() + 86400000) }, end_date: { $gte: dayStart } })
    let needCover = 0
    if (leave) {
      const appts = await db.collection('appointments').find({ employee_id: employee._id, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined', 'Completed'] }, session_date: { $gte: new Date(dayStart.getTime() - 8 * 3600000), $lt: new Date(dayStart.getTime() + 86400000) } }).project({ patient_id: 1 }).toArray()
      const covered = new Set(rows.filter((s) => s.session_date === today && ['pending', 'accepted', 'completed'].includes(s.status)).map((s) => String(s.patient_id)))
      needCover = new Set(appts.map((a) => String(a.patient_id)).filter((id) => !covered.has(id))).size
    }
    return res.status(200).json({ shares: rows.map((s) => shape(s, p)), absentToday: Boolean(leave), needCover })
  } catch (err) { return fail(res, err, 'note-shares by-me') }
}

// GET /api/note-shares/:id/log
export async function sharesLog(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, employee } = ctx
    const share = await loadShare(db, req.params.id)
    const mine = share && (String(share.owner_id) === String(employee._id) || (String(share.cover_id) === String(employee._id) && isActive(share)))
    if (!mine) return res.status(share ? 403 : 404).json({ error: share ? 'You cannot see this log.' : 'Share not found.' })
    const rows = await db.collection('note_cover_log').find({ share_id: share._id }).sort({ created_at: 1 }).toArray()
    const actors = await db.collection('users').find({ _id: { $in: [...new Set(rows.map((r) => String(r.actor_id)))].map(oid).filter(Boolean) } }, { projection: { full_name: 1 } }).toArray()
    const by = new Map(actors.map((a) => [String(a._id), a.full_name]))
    return res.status(200).json({ log: rows.map((r) => ({ action: r.action, actor: by.get(String(r.actor_id)) || 'Someone', text: ACTION_WORDS[r.action] || r.action, detail: r.meta?.count ? `${r.meta.count} note${r.meta.count === 1 ? '' : 's'}` : null, at: r.created_at.toISOString() })) })
  } catch (err) { return fail(res, err, 'note-shares log') }
}

// GET /api/note-shares/:id/context?part=past|goals|games  (the covering therapist, only what the owner allowed)
export async function sharesContext(req, res) {
  if (!method(req, res, 'GET')) return
  try {
    const ctx = await ctxFor(req, res)
    if (!ctx) return
    const { db, user, ip, employee } = ctx
    const share = await loadShare(db, req.params.id)
    if (!share || String(share.cover_id) !== String(employee._id) || !isActive(share)) {
      if (share) await audit(db, { user, action: 'denied', patientId: share.patient_id, ip, meta: { attempted: 'cover-share context' } })
      return res.status(403).json({ error: 'You do not have access to this.' })
    }
    const part = String(req.query.part || '')
    const patientId = share.patient_id
    if (part === 'past') {
      if (!share.include_past_notes) return res.status(403).json({ error: 'The owner did not share past notes.' })
      const rows = await db.collection('therapy_notes').find({ patient_id: patientId, status: 'signed', voided: { $ne: true }, addendum_to: null, is_archived: { $ne: true } }).sort({ session_date: -1 }).limit(10).toArray()
      await logShare(db, share, user, 'viewed_past_notes', { count: rows.length })
      await audit(db, { user, action: 'cover_view_past', patientId, ip, meta: { share_id: String(share._id), count: rows.length } })
      return res.status(200).json({ notes: rows.map((n) => ({ id: String(n._id), date: n.session_date, by: n.signed_by_name || n.employee_name, ...decryptSoap(n) })) })
    }
    if (part === 'goals') {
      if (!share.include_goals) return res.status(403).json({ error: 'The owner did not share goals and diagnosis.' })
      const patient = await db.collection('patients').findOne({ _id: patientId })
      const last = await db.collection('therapy_notes').findOne({ patient_id: patientId, status: 'signed', voided: { $ne: true }, addendum_to: null }, { sort: { session_date: -1 } })
      await logShare(db, share, user, 'viewed_goals')
      return res.status(200).json({ diagnosis: patient?.primary_condition || patient?.condition || null, lastPlan: last ? decryptSoap(last).plan : null, lastPlanDate: last?.session_date || null })
    }
    if (part === 'games') {
      if (!share.include_game_progress) return res.status(403).json({ error: 'The owner did not share game progress.' })
      const rows = await db.collection('game_sessions').find({ patient_id: patientId, status: 'completed' }).sort({ completed_at: -1 }).limit(10).toArray()
      const games = rows.length ? await db.collection('games').find({ _id: { $in: rows.map((r) => r.game_id) } }, { projection: { name: 1 } }).toArray() : []
      const name = new Map(games.map((g) => [String(g._id), g.name]))
      await logShare(db, share, user, 'viewed_game_progress', { count: rows.length })
      return res.status(200).json({ plays: rows.map((r) => ({ game: name.get(String(r.game_id)) || 'Game', at: r.completed_at, accuracy: r.result?.attempts ? Math.round((Math.min(r.result.correct, r.result.attempts) / r.result.attempts) * 100) : null, hints: r.result?.hints_used || 0, atHome: r.context === 'home' })) })
    }
    return res.status(400).json({ error: 'Unknown part.' })
  } catch (err) { return fail(res, err, 'note-shares context') }
}
