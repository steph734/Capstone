// Covering-therapist sharing: a therapist who cannot attend lets a colleague write, sign and monitor one
// patient's session note. Stored in `note_cover_shares` (NOT `note_shares`, which is the guardian sharing).
//
// note_cover_shares document:
//   patient_id, appointment_id, session_date ('YYYY-MM-DD', Manila), session_start/end ('HH:MM'), session_type
//   owner_id / cover_id (employees._id), owner_user_id / cover_user_id (users._id)
//   access 'view' | 'write_sign', include_past_notes, include_goals, include_game_progress, message
//   ends_kind 'signed' | 'today' | 'custom', ends_at (always set: end of the session day, or the chosen date)
//   status pending | accepted | declined | revoked | completed | expired
//   note_id (set when the covering therapist saves the first draft)
//   created_at, opened_at, writing_at, signed_at, completed_at, declined_at, revoked_at, accepted_at
//
// Every check here runs on the server. A covering therapist reaches a note only through an ACTIVE share.
import { ObjectId } from 'mongodb'

const OFFSET = 8 * 3600 * 1000
const DAY = 86400000
export const COLL = 'note_cover_shares'
export const oid = (v) => { try { return v && ObjectId.isValid(String(v)) ? new ObjectId(String(v)) : null } catch { return null } }
export const dayKey = (d = new Date()) => new Date(new Date(d).getTime() + OFFSET).toISOString().slice(0, 10)
export const endOfDay = (key) => new Date(new Date(`${key}T00:00:00+08:00`).getTime() + DAY - 1000)
const instant = (key, hhmm) => new Date(`${key}T${String(hhmm || '00:00').slice(0, 5)}:00+08:00`)
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
export const fullName = (e) => [e?.first_name, e?.last_name].filter(Boolean).join(' ') || 'Therapist'

export const DECLINE_REASONS = { busy_at_that_time: 'Has another session at that time', not_my_area: 'Not their area of therapy', too_many_patients: 'Too many patients today', other: 'Other reason' }

export const ACTION_WORDS = {
  accepted: 'accepted the request', handed_back: 'handed the note back',
  shared: 'shared the note', opened: 'opened the note', viewed_past_notes: 'viewed past signed notes', viewed_game_progress: 'viewed game progress',
  viewed_goals: 'viewed goals and diagnosis', edited: 'saved a draft', signed: 'signed the note', declined: 'declined the handoff',
  revoked: 'stopped sharing', changed: 'changed the access', expired: 'access expired',
}

// Marks shares past their end time as expired (called on every read, so no scheduled job is needed).
export async function expireShares(db, extra = {}) {
  await db.collection(COLL).updateMany(
    { status: { $in: ['pending', 'accepted'] }, ends_at: { $lt: new Date() }, ...extra },
    { $set: { status: 'expired' } }
  )
  // A request nobody answered by the time the session starts expires, and the owner is told so they can pick someone else.
  const stale = await db.collection(COLL).find({ status: 'pending', session_start: { $ne: null }, ...extra }).toArray()
  for (const sh of stale) {
    if (instant(sh.session_date, sh.session_start) > new Date()) continue
    const r = await db.collection(COLL).updateOne({ _id: sh._id, status: 'pending' }, { $set: { status: 'expired' } })
    if (!r.modifiedCount) continue
    await logShare(db, sh, null, 'expired', { reason: 'not answered before the session' })
    const [owner, cover] = await Promise.all([db.collection('employees').findOne({ _id: sh.owner_id }), db.collection('employees').findOne({ _id: sh.cover_id })])
    const { notify } = await import('./sessionRecommendations.js')
    await notify(db, { email: owner?.email, type: 'note_share', title: 'Request expired', body: `${fullName(cover)} did not answer before the session started. Pick another therapist.`, link: `/therapist/notes-progress?patient=${sh.patient_id}` })
  }
}
export const isAccepted = (s) => Boolean(s) && s.status === 'accepted' && (!s.ends_at || s.ends_at > new Date())
export const isActive = (s) => Boolean(s) && ['pending', 'accepted'].includes(s.status) && (!s.ends_at || s.ends_at > new Date())

export async function logShare(db, share, user, action, meta = null) {
  await db.collection('note_cover_log').insertOne({
    share_id: share._id, note_id: share.note_id || null, patient_id: share.patient_id, actor_id: user?._id || null, action, meta, created_at: new Date(),
  })
}

// The covering therapist's active share for this patient (optionally pinned to one share id).
export async function activeCoverShare(db, employeeId, patientId, shareId = null) {
  await expireShares(db, { cover_id: employeeId })
  // Only an ACCEPTED share opens the note. A pending or declined one gives no access to anything but the request summary.
  const q = { cover_id: employeeId, patient_id: patientId, status: 'accepted' }
  if (shareId) q._id = shareId
  const s = await db.collection(COLL).findOne(q, { sort: { created_at: -1 } })
  return isAccepted(s) ? s : null
}

// Colleagues a therapist may hand a session to, with availability at the session time.
export async function availableColleagues(db, me, { date, time }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : dayKey()
  const at = toMin(time || '10:00')
  const colleagues = await db.collection('employees').find({ branch_id: me.branch_id, status: 'active', _id: { $ne: me._id } }).toArray()
  const ids = colleagues.map((c) => c._id)
  const dayStart = new Date(`${day}T00:00:00+08:00`)
  const [leaves, appts, scans] = await Promise.all([
    db.collection('leave_request').find({ employee: { $in: ids }, status: 'approved', is_archived: { $ne: true }, start_date: { $lt: new Date(dayStart.getTime() + DAY) }, end_date: { $gte: dayStart } }).project({ employee: 1, leave_type: 1 }).toArray(),
    db.collection('appointments').find({ employee_id: { $in: ids }, is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] }, session_date: { $gte: new Date(dayStart.getTime() - 8 * 3600000), $lt: new Date(dayStart.getTime() + DAY) } }).project({ employee_id: 1, start_time: 1, end_time: 1 }).toArray(),
    db.collection('attendance').find({ employee: { $in: ids }, attendance_date: day, is_archived: { $ne: true } }).sort({ scanned_at: 1 }).project({ employee: 1, type: 1 }).toArray(),
  ])
  const leaveBy = new Map(leaves.map((l) => [String(l.employee), l]))
  const lastScan = new Map()
  for (const s of scans) lastScan.set(String(s.employee), s.type)
  const sessions = new Map()
  const busy = new Set()
  for (const a of appts) {
    const k = String(a.employee_id)
    sessions.set(k, (sessions.get(k) || 0) + 1)
    if (toMin(a.start_time) <= at && at < toMin(a.end_time)) busy.add(k)
  }
  const users = await db.collection('users').find({ _id: { $in: colleagues.map((c) => c.user_id).filter(Boolean) } }).project({ is_archived: 1, status: 1, is_locked: 1 }).toArray()
  const userBy = new Map(users.map((u) => [String(u._id), u]))
  return colleagues
    .map((c) => {
      const k = String(c._id)
      const u = userBy.get(String(c.user_id))
      const leave = leaveBy.get(k)
      const inactive = !u || u.is_archived
      const unavailable = Boolean(leave) || inactive
      return {
        id: k, name: fullName(c), specialty: c.specialty || c.position || 'Therapist', initials: [c.first_name, c.last_name].filter(Boolean).map((x) => x[0].toUpperCase()).join('') || '?',
        online: lastScan.get(k) === 'time_in', sessionsToday: sessions.get(k) || 0,
        availability: unavailable ? 'unavailable' : busy.has(k) ? 'busy' : 'free',
        reason: leave ? `On ${String(leave.leave_type || 'leave').toLowerCase()} today` : inactive ? 'Account inactive' : null,
      }
    })
    .sort((a, b) => (a.availability === 'unavailable') - (b.availability === 'unavailable') || a.name.localeCompare(b.name))
}

// Resolves an `ends` choice from the share modal to a stored end time.
export function endsFor(kind, customDate, sessionDay) {
  if (kind === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(customDate))) return { error: 'Choose the date when access ends.' }
    const e = endOfDay(customDate)
    if (e < new Date()) return { error: 'The end date has already passed.' }
    if (e.getTime() - Date.now() > 30 * DAY) return { error: 'Access can last 30 days at most.' }
    return { value: e }
  }
  return { value: endOfDay(sessionDay) }
}

// What a share looks like to the browser.
export function serializeShare(s, { owner, cover, patient, note } = {}) {
  const steps = { shared: s.created_at, accepted: s.accepted_at || null, writing: s.writing_at || null, signed: s.signed_at || null }
  return {
    id: String(s._id), patientId: String(s.patient_id), patientName: patient ? [patient.first_name, patient.last_name].filter(Boolean).join(' ') : null,
    diagnosis: patient?.primary_condition || patient?.condition || null,
    appointmentId: s.appointment_id ? String(s.appointment_id) : null, sessionDate: s.session_date, sessionStart: s.session_start, sessionEnd: s.session_end, sessionType: s.session_type || null,
    owner: owner ? { id: String(owner._id), name: fullName(owner) } : { id: String(s.owner_id) },
    cover: cover ? { id: String(cover._id), name: fullName(cover) } : { id: String(s.cover_id) },
    access: s.access, includePastNotes: s.include_past_notes, includeGoals: s.include_goals, includeGameProgress: s.include_game_progress,
    message: s.message || '', acceptedAt: s.accepted_at ? s.accepted_at.toISOString() : null, declinedAt: s.declined_at ? s.declined_at.toISOString() : null,
    declineReason: s.decline_reason || null, declineReasonText: DECLINE_REASONS[s.decline_reason] || null, declineMessage: s.decline_message || '', endsKind: s.ends_kind, endsAt: s.ends_at ? s.ends_at.toISOString() : null, status: s.status, noteId: s.note_id ? String(s.note_id) : null,
    noteStatus: note ? (note.voided ? 'void' : note.status) : 'not_started',
    steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v ? new Date(v).toISOString() : null])),
  }
}

export { instant }

// Called after a covering therapist signs: records the step, closes the share when it ends on signing, tells the owner.
export async function finishCoverSign(db, share, { user, employee, noteId }) {
  const now = new Date()
  const set = { signed_at: now, note_id: noteId }
  if (share.ends_kind === 'signed') { set.status = 'completed'; set.completed_at = now }
  await db.collection(COLL).updateOne({ _id: share._id }, { $set: set })
  await logShare(db, { ...share, note_id: noteId }, user, 'signed')
  const owner = await db.collection('employees').findOne({ _id: share.owner_id })
  const { notify } = await import('./sessionRecommendations.js')
  await notify(db, { email: owner?.email, type: 'note_share', title: 'Note signed', body: `${fullName(employee)} signed the SOAP note you shared. It is back in your list.`, link: `/therapist/notes-progress?patient=${share.patient_id}` })
}
// First draft saved by the covering therapist: the "Writing" step, and the note is linked to the share.
export async function markCoverWriting(db, share, { user, noteId }) {
  if (share.writing_at && String(share.note_id) === String(noteId)) return
  await db.collection(COLL).updateOne({ _id: share._id }, { $set: { writing_at: share.writing_at || new Date(), note_id: noteId, status: 'accepted' } })
  await logShare(db, { ...share, note_id: noteId }, user, 'edited')
}
