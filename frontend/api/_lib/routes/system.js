// /api/system?action=...   (ONE handler for the whole System Downtime feature; see _lib/downtime.js)
//
//   GET   status           PUBLIC. What every browser polls. Cacheable for 15 s (add &fresh=1 to skip the cache).
//   GET   cron             Vercel cron (every minute), Bearer CRON_SECRET: sends due reminders, flips scheduled -> active.
//   POST  busy             a signed-in user with an upload/payment/game in progress asks for the 5-minute grace.
//   --- Super Admin only (403 for anyone else) ---
//   GET   current          the scheduled/active downtime with everything the admin page needs
//   GET   history          past downtimes (planned vs actual length, on time / ran over)
//   GET   online-count     signed-in users by role + account counts for "Who is notified"
//   POST  schedule         create
//   PATCH edit&id=         change a scheduled downtime
//   POST  start-now&id=    begin now (5-minute countdown first)
//   POST  cancel&id=       { notifyUsers }
//   POST  extend&id=       { minutes: 30 | 60 } moves endAt only
//   POST  end&id=          "Bring system back online" { checklist }
//   PATCH checklist&id=    { checklist }
import crypto from 'node:crypto'
import { getMongo, getDb } from '../mongo.js'
import { requireSession, IDLE_LIMIT_MS } from '../session.js'
import { audit } from '../noteAccess.js'
import { healthTick } from '../health/collect.js'
import { fireRule } from '../health/security.js'
import { computePlan, validateSchedule, MAX_LENGTH_MS, GRACE_MS, MIN } from '../downtimePlan.js'
import {
  COL, ensureIndexes, getCurrent, invalidate, buildStatus, adminOut, oid, isDown,
  claimAndDispatch, dispatchNotice, runDue, audienceCounts, onlineCounts, recipients,
} from '../downtime.js'

const CHECK_KEYS = ['deployed', 'adminChecked', 'therapistChecked', 'patientChecked', 'notesChecked']
const bad = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra })
const diff = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]))

async function record(ctx, action, description, meta) {
  try {
    await audit(ctx.db, { user: ctx.user, action, ip: ctx.ip, meta, mirror: false })
    await ctx.db.collection('auditlogs').insertOne({ user_id: ctx.user._id, action, ip_address: ctx.ip || 'unknown', description, created_at: new Date() })
  } catch (e) { console.error('system downtime audit failed:', e.message) }
}

function secretOk(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(String(req.headers.authorization || ''))
  const want = Buffer.from(`Bearer ${secret}`)
  return given.length === want.length && crypto.timingSafeEqual(given, want)
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '')
  try {
    await getMongo()
    const db = await getDb()
    await ensureIndexes(db)

    // ── public ──
    if (action === 'status') {
      if (req.method !== 'GET') return bad(res, 405, 'Method not allowed')
      const fresh = req.query.fresh === '1'
      res.setHeader('Cache-Control', fresh ? 'no-store' : 'public, max-age=0, s-maxage=15, stale-while-revalidate=5')
      return res.status(200).json(await buildStatus(db, { fresh }))
    }
    if (action === 'cron') {
      if (!process.env.CRON_SECRET) return bad(res, 500, 'CRON_SECRET is not configured on the server.')
      if (!secretOk(req)) return bad(res, 401, 'Unauthorized.')
      const out = await runDue(db)
      await healthTick(db).catch((e) => console.error('healthTick failed:', e.message)) // same cron: health sample + alert rules
      return res.status(200).json({ ok: true, ...out })
    }

    // ── everything below needs a session ──
    const adminOnly = !['busy'].includes(action)
    const ctx = await requireSession(req, res, { idle: false, touch: false, roles: adminOnly ? ['Super Admin'] : undefined })
    if (!ctx) return
    res.setHeader('Cache-Control', 'no-store')

    if (action === 'busy') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      const dt = await getCurrent(db)
      const now = Date.now()
      // Only inside the final countdown (or the grace itself): later than that the person has already been signed out.
      if (!dt || ctx.user.role === 'Super Admin' || now < dt.startAt.getTime() - 6 * MIN || now > dt.startAt.getTime() + GRACE_MS) return res.status(200).json({ ok: true, graceUntil: null })
      const until = new Date(dt.startAt.getTime() + GRACE_MS)
      await db.collection('sessions').updateOne({ _id: ctx.session._id }, { $set: { downtime_grace_until: until } })
      return res.status(200).json({ ok: true, graceUntil: until.toISOString() })
    }

    if (action === 'current') {
      if (req.method !== 'GET') return bad(res, 405, 'Method not allowed')
      const dt = await getCurrent(db, { fresh: true })
      return res.status(200).json({ serverTime: new Date().toISOString(), downtime: dt ? adminOut(dt) : null })
    }
    if (action === 'history') {
      if (req.method !== 'GET') return bad(res, 405, 'Method not allowed')
      const rows = await db.collection(COL).find({ status: { $in: ['completed', 'cancelled'] } }).sort({ startAt: -1 }).limit(20).toArray()
      return res.status(200).json({ history: rows.map(historyRow) })
    }
    if (action === 'online-count') {
      if (req.method !== 'GET') return bad(res, 405, 'Method not allowed')
      const [online, accounts] = await Promise.all([onlineCounts(db, IDLE_LIMIT_MS), audienceCounts(db)])
      return res.status(200).json({ online, accounts })
    }

    // ── writes ──
    const now = new Date()
    const col = db.collection(COL)

    if (action === 'schedule') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      const { fields, value } = validateSchedule(req.body || {}, { now })
      if (Object.keys(fields).length) return bad(res, 422, Object.values(fields)[0], { fields })
      if (await col.findOne({ status: { $in: ['scheduled', 'active'] } }, { projection: { _id: 1 } })) return bad(res, 409, 'There is already a downtime scheduled or in progress. Cancel or finish it first.')
      const doc = {
        ...value, status: 'scheduled', plan: computePlan({ startAt: value.startAt, now, reminders: value.reminders }),
        checklist: Object.fromEntries(CHECK_KEYS.map((k) => [k, false])), notifyOnCancel: false,
        createdBy: ctx.user._id, createdAt: now, updatedAt: now, startedAt: null, startedEarly: false, sessionsEnded: 0, actualEndAt: null, endedBy: null, cancelledAt: null, cancelledBy: null,
      }
      const { insertedId } = await col.insertOne(doc)
      invalidate()
      const saved = await col.findOne({ _id: insertedId })
      await claimAndDispatch(db, saved, 'now') // the first notice goes out immediately
      await record(ctx, 'downtime_scheduled', `Scheduled system downtime "${value.title}" for ${value.startAt.toISOString()}.`, { id: String(insertedId), after: diff(value, ['title', 'startAt', 'endAt', 'audience', 'reminders']) })
      return res.status(201).json({ downtime: adminOut(await col.findOne({ _id: insertedId })) })
    }

    // The rest act on an existing downtime.
    const id = oid(req.query.id)
    const dt = id ? await col.findOne({ _id: id }) : null
    if (!dt) return bad(res, 404, 'That downtime was not found.')

    if (action === 'edit') {
      if (req.method !== 'PATCH' && req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      if (dt.status !== 'scheduled') return bad(res, 409, 'Only a scheduled downtime can be edited.')
      const input = { title: dt.title, message: dt.message, releaseNotes: dt.releaseNotes, startAt: dt.startAt, endAt: dt.endAt, audience: dt.audience, reminders: dt.reminders, ...(req.body || {}) }
      const { fields, value } = validateSchedule(input, { now, keepStartAt: dt.startAt })
      if (Object.keys(fields).length) return bad(res, 422, Object.values(fields)[0], { fields })
      const plan = computePlan({ startAt: value.startAt, now, reminders: value.reminders, existing: dt.plan })
      const keys = ['title', 'message', 'releaseNotes', 'startAt', 'endAt', 'audience', 'reminders']
      await col.updateOne({ _id: dt._id, status: 'scheduled' }, { $set: { ...value, plan, updatedAt: now } })
      invalidate()
      await record(ctx, 'downtime_edited', `Edited system downtime "${value.title}".`, { id: String(dt._id), before: diff(dt, keys), after: diff(value, keys) })
      return res.status(200).json({ downtime: adminOut(await col.findOne({ _id: dt._id })) })
    }

    if (action === 'start-now') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      if (dt.status !== 'scheduled') return bad(res, 409, 'Only a scheduled downtime can be started early.')
      const startAt = new Date(now.getTime() + GRACE_MS) // everyone still gets the 5-minute countdown
      const length = Math.min(dt.endAt.getTime() - dt.startAt.getTime(), MAX_LENGTH_MS)
      const plan = (dt.plan || []).map((p) => (p.status !== 'pending' ? p : p.key === 'countdown' ? { ...p, sendAt: now, status: 'sent', sentAt: now } : { ...p, status: 'skipped', skipReason: 'Started early' }))
      await col.updateOne({ _id: dt._id, status: 'scheduled' }, { $set: { status: 'active', startedEarly: true, startedAt: now, startAt, endAt: new Date(startAt.getTime() + length), plan, updatedAt: now } })
      invalidate()
      const after = await col.findOne({ _id: dt._id })
      await dispatchNotice(db, { ...after, message: 'TherapyPro is starting its update in 5 minutes. Save your work now.' }, 'm15').catch(() => {})
      await fireRule(db, 'downtime_change', 'Scheduled downtime is starting', `"${dt.title}" is starting in 5 minutes.`).catch(() => {})
      await record(ctx, 'downtime_started_early', `Started system downtime "${dt.title}" early.`, { id: String(dt._id), before: diff(dt, ['startAt', 'endAt']), after: diff(after, ['startAt', 'endAt']) })
      return res.status(200).json({ downtime: adminOut(after) })
    }

    if (action === 'cancel') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      if (!(dt.status === 'scheduled' || (dt.status === 'active' && !isDown(dt, now)))) return bad(res, 409, dt.status === 'active' ? 'The downtime has already started. Bring the system back online instead.' : 'This downtime is already finished.')
      const notify = req.body?.notifyUsers === true
      const plan = (dt.plan || []).map((p) => (p.status === 'pending' ? { ...p, status: 'skipped', skipReason: 'Cancelled' } : p))
      await col.updateOne({ _id: dt._id }, { $set: { status: 'cancelled', cancelledAt: now, cancelledBy: ctx.user._id, notifyOnCancel: notify, plan, updatedAt: now } })
      invalidate()
      if (notify) {
        const people = await recipients(db, dt.audience)
        if (people.length) await db.collection('notifications').insertMany(people.map((u) => ({ recipient_email: String(u.email).toLowerCase(), type: 'system_downtime', title: 'Update cancelled', body: 'The scheduled TherapyPro update will not happen. Nothing changes for you.', link: null, read: false, created_at: now })), { ordered: false }).catch(() => {})
      }
      await record(ctx, 'downtime_cancelled', `Cancelled system downtime "${dt.title}"${notify ? ' and told users' : ''}.`, { id: String(dt._id), before: { status: dt.status }, after: { status: 'cancelled', notifyOnCancel: notify } })
      return res.status(200).json({ downtime: adminOut(await col.findOne({ _id: dt._id })) })
    }

    if (action === 'extend') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      const minutes = Number(req.body?.minutes)
      if (minutes !== 30 && minutes !== 60) return bad(res, 422, 'Extend by 30 or 60 minutes.', { fields: { minutes: 'Extend by 30 or 60 minutes.' } })
      if (dt.status !== 'active' && dt.status !== 'scheduled') return bad(res, 409, 'This downtime is already finished.')
      const endAt = new Date(dt.endAt.getTime() + minutes * MIN)
      if (endAt.getTime() - dt.startAt.getTime() > MAX_LENGTH_MS) return bad(res, 422, 'Downtime can be at most 24 hours long.', { fields: { endAt: 'Downtime can be at most 24 hours long.' } })
      await col.updateOne({ _id: dt._id }, { $set: { endAt, updatedAt: now } })
      invalidate()
      await record(ctx, 'downtime_extended', `Extended system downtime "${dt.title}" by ${minutes} minutes.`, { id: String(dt._id), before: { endAt: dt.endAt }, after: { endAt } })
      return res.status(200).json({ downtime: adminOut(await col.findOne({ _id: dt._id })) })
    }

    if (action === 'checklist') {
      if (req.method !== 'PATCH' && req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      if (dt.status !== 'active') return bad(res, 409, 'The checklist is only used while the downtime is active.')
      const set = {}
      for (const k of CHECK_KEYS) if (typeof req.body?.checklist?.[k] === 'boolean') set[`checklist.${k}`] = req.body.checklist[k]
      await col.updateOne({ _id: dt._id }, { $set: { ...set, updatedAt: now } })
      return res.status(200).json({ downtime: adminOut(await col.findOne({ _id: dt._id })) })
    }

    if (action === 'end') {
      if (req.method !== 'POST') return bad(res, 405, 'Method not allowed')
      if (dt.status !== 'active') return bad(res, 409, 'There is no downtime in progress.')
      if (!isDown(dt, now)) return bad(res, 409, 'The downtime has not started yet. Cancel it instead.')
      const checklist = { ...(dt.checklist || {}) }
      for (const k of CHECK_KEYS) if (typeof req.body?.checklist?.[k] === 'boolean') checklist[k] = req.body.checklist[k]
      if (!checklist.deployed || !checklist.adminChecked) return bad(res, 422, 'Tick "Update deployed" and "Super Admin login checked" first.', { fields: { checklist: 'Tick the first two checks first.' } })
      await col.updateOne({ _id: dt._id, status: 'active' }, { $set: { status: 'completed', checklist, actualEndAt: now, endedBy: ctx.user._id, updatedAt: now } })
      invalidate()
      const done = await col.findOne({ _id: dt._id })
      await fireRule(db, 'downtime_change', 'Scheduled downtime ended', `"${dt.title}" is finished and the system is back online.`).catch(() => {})
      await record(ctx, 'downtime_ended', `Brought the system back online after "${dt.title}".`, { id: String(dt._id), before: { status: 'active', endAt: dt.endAt }, after: { status: 'completed', actualEndAt: now } })
      return res.status(200).json({ downtime: adminOut(done) })
    }

    return bad(res, 404, 'Unknown action.')
  } catch (err) {
    if (err?.code === 121) return res.status(422).json({ error: 'The downtime could not be saved because some fields are invalid.', fields: invalidFields(err) })
    console.error('system error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}

function invalidFields(err) {
  const rules = err?.errInfo?.details?.schemaRulesNotSatisfied || []
  const names = rules.flatMap((r) => (r.propertiesNotSatisfied || []).map((p) => p.propertyName)).filter(Boolean)
  return Object.fromEntries(names.map((n) => [n, 'This value is not accepted.']))
}

function historyRow(d) {
  const planned = d.endAt.getTime() - d.startAt.getTime()
  const base = { id: String(d._id), title: d.title, startAt: d.startAt.toISOString(), plannedMs: planned }
  if (d.status === 'cancelled') return { ...base, status: 'cancelled', actualMs: null, result: 'cancelled', overMs: 0 }
  const actual = d.actualEndAt ? Math.max(0, d.actualEndAt.getTime() - d.startAt.getTime()) : null
  const over = d.actualEndAt && d.actualEndAt.getTime() > d.endAt.getTime() ? d.actualEndAt.getTime() - d.endAt.getTime() : 0
  return { ...base, status: d.status, actualMs: actual, result: over > 0 ? 'ran_over' : 'on_time', overMs: over }
}

