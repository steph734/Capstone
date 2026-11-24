// System downtime: collection access, lazy state changes, the server-side gate and the notice dispatcher.
// Collection `system_downtimes` (see downtimePlan.js for the rules, routes/system.js for the endpoints).
//
// Time model (all UTC in the database, shown in Asia/Manila by the clients):
//   scheduled  -> startAt in the future
//   active     -> set the moment startAt passes (done lazily here; the cron is a safety net).
//                 "Start now" makes it active at once with startAt = now + 5 minutes so people still get the countdown.
//   The system is DOWN only while status is "active" AND now >= startAt. It never reopens by itself at endAt;
//   only "Bring system back online" (status completed) does.
import { ObjectId } from 'mongodb'
import { sendEmail } from './brevo.js'
import { GRACE_MS, RECENT_MS, PLAN_LABELS, rolesFor, roleInAudience } from './downtimePlan.js'

export const COL = 'system_downtimes'
const EMAIL_KEYS = new Set(['now', 'week', 'h24'])
const NOTIFY_KEYS = new Set(['now', 'week', 'h24', 'h1', 'm15'])

let indexed = false
export async function ensureIndexes(db) {
  if (indexed) return
  const col = db.collection(COL)
  await col.createIndex({ status: 1, startAt: 1 })
  await col.createIndex({ createdAt: -1 })
  indexed = true // only after both succeeded: a failed attempt is retried by the next request
}

export const oid = (v) => { try { return new ObjectId(String(v)) } catch { return null } }

// ── current downtime + lazy transition ───────────────────────────────────────
let memo = { at: 0, doc: undefined }
export const invalidate = () => { memo = { at: 0, doc: undefined } }
let lastSweep = 0

export const isDown = (dt, now = new Date()) => !!dt && dt.status === 'active' && dt.startAt.getTime() <= now.getTime()

// The one scheduled-or-active downtime (or null). Flips scheduled -> active once startAt has passed and ends the
// sessions of affected roles. Cached for 3 s per container so the gate adds no real load.
export async function getCurrent(db, { fresh = false } = {}) {
  const now = new Date()
  if (!fresh && memo.doc !== undefined && now.getTime() - memo.at < 3000) return memo.doc
  await ensureIndexes(db)
  const col = db.collection(COL)
  let dt = await col.findOne({ status: { $in: ['scheduled', 'active'] } })
  if (dt && dt.status === 'scheduled' && dt.startAt.getTime() <= now.getTime()) {
    const flipped = await col.findOneAndUpdate({ _id: dt._id, status: 'scheduled' }, { $set: { status: 'active', startedAt: dt.startedAt || now, updatedAt: now } }, { returnDocument: 'after' })
    dt = flipped || (await col.findOne({ _id: dt._id }))
  }
  if (dt && isDown(dt, now) && now.getTime() - lastSweep > 15000) {
    lastSweep = now.getTime()
    await sweepSessions(db, dt, now).catch((e) => console.error('downtime sweep failed:', e.message))
    dt = (await col.findOne({ _id: dt._id })) || dt
  }
  memo = { at: now.getTime(), doc: dt || null }
  return dt || null
}

// Ends the sessions of the affected roles. Sessions that asked for the 5-minute grace (an upload, payment or game in
// progress) are left alone until it runs out; they are caught by a later sweep.
async function sweepSessions(db, dt, now) {
  const roles = rolesFor(dt.audience)
  if (!roles.length) return
  const r = await db.collection('sessions').updateMany(
    { role: { $in: roles }, revoked: { $ne: true }, expires_at: { $gt: now }, $or: [{ downtime_grace_until: { $exists: false } }, { downtime_grace_until: { $lte: now } }] },
    { $set: { revoked: true, revoked_at: now, revoked_reason: 'downtime' } },
  )
  if (r.modifiedCount) await db.collection(COL).updateOne({ _id: dt._id }, { $inc: { sessionsEnded: r.modifiedCount } })
}

// The gate used by apiGuard and the login routes. Returns the downtime that blocks this caller, or null.
export async function blockingFor(db, role, session = null) {
  const dt = await getCurrent(db)
  if (!isDown(dt)) return null
  if (!role || role === 'Super Admin' || !roleInAudience(role, dt.audience)) return null
  if (session?.downtime_grace_until && session.downtime_grace_until.getTime() > Date.now()) return null
  return dt
}
export const downtimeBody = (dt) => ({ error: 'TherapyPro is down for scheduled maintenance. Please try again later.', code: 'SYSTEM_DOWNTIME', endAt: dt.endAt })

// ── serializing ──────────────────────────────────────────────────────────────
const iso = (d) => (d ? new Date(d).toISOString() : null)
export const planOut = (plan = []) => plan.map((p) => ({ key: p.key, label: PLAN_LABELS[p.key], sendAt: iso(p.sendAt), status: p.status, sentAt: iso(p.sentAt), skipReason: p.skipReason || null }))

export function publicOut(dt) {
  return {
    id: String(dt._id), title: dt.title, message: dt.message, startAt: iso(dt.startAt), endAt: iso(dt.endAt),
    releaseNotes: dt.releaseNotes || [], audience: dt.audience, bannerNow: dt.reminders?.bannerNow !== false,
    status: dt.status, startedEarly: !!dt.startedEarly,
  }
}
export function adminOut(dt) {
  return {
    ...publicOut(dt), reminders: dt.reminders, plan: planOut(dt.plan), checklist: dt.checklist || {}, notifyOnCancel: !!dt.notifyOnCancel,
    createdAt: iso(dt.createdAt), updatedAt: iso(dt.updatedAt), startedAt: iso(dt.startedAt), sessionsEnded: dt.sessionsEnded || 0,
    actualEndAt: iso(dt.actualEndAt), cancelledAt: iso(dt.cancelledAt),
  }
}

// What GET status returns. Public: nothing here is specific to a person.
export async function buildStatus(db, { fresh = false } = {}) {
  const now = new Date()
  const dt = await getCurrent(db, { fresh })
  const col = db.collection(COL)
  const since = new Date(now.getTime() - RECENT_MS)
  const [ended, cancelled] = await Promise.all([
    dt ? null : col.findOne({ status: 'completed', actualEndAt: { $gt: since } }, { sort: { actualEndAt: -1 } }),
    dt ? null : col.findOne({ status: 'cancelled', notifyOnCancel: true, cancelledAt: { $gt: since } }, { sort: { cancelledAt: -1 } }),
  ])
  const plan = dt ? planOut(dt.plan) : []
  const next = plan.filter((p) => p.status === 'pending' && p.key !== 'now' && new Date(p.sendAt) > now).sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt))[0] || null
  return {
    state: dt ? dt.status : 'none', serverTime: now.toISOString(),
    downtime: dt ? publicOut(dt) : null, plan, nextReminder: next ? { key: next.key, sendAt: next.sendAt } : null,
    recentlyEnded: ended ? { id: String(ended._id), title: ended.title, endedAt: iso(ended.actualEndAt), releaseNotes: ended.releaseNotes || [], audience: ended.audience } : null,
    cancelled: cancelled ? { id: String(cancelled._id), title: cancelled.title, startAt: iso(cancelled.startAt), audience: cancelled.audience } : null,
  }
}

// ── who gets told ────────────────────────────────────────────────────────────
export async function recipients(db, audience) {
  const roles = rolesFor(audience)
  if (!roles.length) return []
  return db.collection('users').find({ role: { $in: roles }, is_archived: { $ne: true }, email: { $type: 'string' } }, { projection: { email: 1, full_name: 1, role: 1 } }).toArray()
}

export async function audienceCounts(db) {
  const rows = await db.collection('users').aggregate([{ $match: { is_archived: { $ne: true } } }, { $group: { _id: '$role', n: { $sum: 1 } } }]).toArray()
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]))
  return { owners: by.Owner || 0, therapists: by.Therapist || 0, patients: (by.Patient || 0) + (by.Guardian || 0) }
}

export async function onlineCounts(db, idleLimitMs) {
  const now = new Date()
  const rows = await db.collection('sessions').aggregate([
    { $match: { revoked: { $ne: true }, expires_at: { $gt: now }, last_seen: { $gt: new Date(now.getTime() - idleLimitMs) } } },
    { $group: { _id: '$role', n: { $sum: 1 } } },
  ]).toArray()
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n]))
  return { owners: by.Owner || 0, therapists: by.Therapist || 0, patients: (by.Patient || 0) + (by.Guardian || 0), superAdmins: by['Super Admin'] || 0 }
}

// ── notices ──────────────────────────────────────────────────────────────────
const MANILA = { timeZone: 'Asia/Manila' }
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { ...MANILA, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { ...MANILA, hour: 'numeric', minute: '2-digit', hour12: true })
export const whenText = (dt) => `${fmtDate(dt.startAt)}, ${fmtTime(dt.startAt)} - ${fmtTime(dt.endAt)} (Philippine Time)`

const HEADLINE = {
  now: (dt) => `Scheduled update: ${fmtDate(dt.startAt)}`,
  week: () => 'TherapyPro update planned next week',
  h24: () => 'TherapyPro update is tomorrow',
  h1: () => 'TherapyPro goes down in 1 hour',
  m15: () => 'TherapyPro goes down in 15 minutes',
}

// Writes the in-app notification (and, for the first three notices, the email) for one plan item.
// Failures are logged and never thrown: a mail outage must not block the schedule.
export async function dispatchNotice(db, dt, key) {
  if (!NOTIFY_KEYS.has(key)) return { notified: 0, emailed: 0 }
  const people = await recipients(db, dt.audience)
  if (!people.length) return { notified: 0, emailed: 0 }
  const title = HEADLINE[key](dt)
  const body = `${dt.message} ${whenText(dt)}.`
  const now = new Date()
  await db.collection('notifications').insertMany(people.map((u) => ({ recipient_email: String(u.email).toLowerCase(), type: 'system_downtime', title, body, link: null, read: false, created_at: now })), { ordered: false }).catch((e) => console.error('downtime notifications failed:', e.message))
  let emailed = 0
  if (EMAIL_KEYS.has(key)) {
    const html = `<p>${esc(dt.message)}</p><p><strong>When:</strong> ${esc(whenText(dt))}</p><p>Please save your work before then. You will be signed out automatically, and your data is safe.</p>`
    for (let i = 0; i < people.length; i += 10) {
      const results = await Promise.allSettled(people.slice(i, i + 10).map((u) => sendEmail({ to: u.email, toName: u.full_name, subject: title, html, plain: `${dt.message}\nWhen: ${whenText(dt)}` })))
      emailed += results.filter((r) => r.status === 'fulfilled').length
    }
  }
  return { notified: people.length, emailed }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Marks a plan item sent (exactly once, even if the cron and a request race) and then sends it.
export async function claimAndDispatch(db, dt, key) {
  const now = new Date()
  const r = await db.collection(COL).updateOne({ _id: dt._id, plan: { $elemMatch: { key, status: 'pending' } } }, { $set: { 'plan.$.status': 'sent', 'plan.$.sentAt': now } })
  if (!r.matchedCount) return false
  await dispatchNotice(db, dt, key).catch((e) => console.error(`downtime notice ${key} failed:`, e.message))
  return true
}

// The cron body: send what is due, skip what is long overdue (never sent late), keep the state fresh.
export async function runDue(db) {
  const now = new Date()
  const dt = await getCurrent(db, { fresh: true })
  const out = { sent: [], skipped: [] }
  if (!dt || dt.status !== 'scheduled') return out
  for (const p of dt.plan || []) {
    if (p.status !== 'pending' || p.sendAt.getTime() > now.getTime()) continue
    if (now.getTime() - p.sendAt.getTime() > 10 * 60 * 1000 && p.key !== 'now') {
      await db.collection(COL).updateOne({ _id: dt._id, plan: { $elemMatch: { key: p.key, status: 'pending' } } }, { $set: { 'plan.$.status': 'skipped', 'plan.$.skipReason': 'Missed (not sent late)' } })
      out.skipped.push(p.key)
    } else if (await claimAndDispatch(db, dt, p.key)) out.sent.push(p.key)
  }
  return out
}

export { GRACE_MS }
