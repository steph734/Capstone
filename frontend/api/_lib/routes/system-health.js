// /api/admin/system-health?action=...   Super Admin only. ONE handler (Vercel function limit); see api/_lib/health/*.
// Every response: { ok, data, serverTime } or { ok:false, code, message, serverTime }.
import { getMongo, getDb } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { sendEmail } from '../brevo.js'
import { oid } from '../downtime.js'
import { COLS, ensureHealthStore, getSettings, dropSettingsCache, notifyAdmins, maskEmail, CUSTOM_METRICS } from '../health/store.js'
import { healthTick, maybeTick, mongoMetrics, SERVICES, overallOf, na } from '../health/collect.js'
import { blockIp, buildScore, securityChecks } from '../health/security.js'

const MIN = 60000, HOUR = 3600000, DAY = 86400000
const SVC = Object.fromEntries(SERVICES.map(([k, label, sub]) => [k, { label, sub }]))
const fail = (res, status, code, message) => res.status(status).json({ ok: false, code, message, serverTime: new Date().toISOString() })
const eventId = (e) => `SEC-${String(e._id).slice(-4).toUpperCase()}`
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null }

export default async function handler(req, res) {
  const action = String(req.query?.action || '')
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'], idle: true, touch: false })
    if (!ctx) return // 401 / 403 already sent
    const db = ctx.db
    res.setHeader('Cache-Control', 'no-store')
    await ensureHealthStore(db)
    const ok = (data) => res.status(200).json({ ok: true, data, serverTime: new Date().toISOString() })
    const audit = (a, d, meta) => auditAdmin(ctx, a, d, meta).catch((e) => console.error('health audit failed:', e.message))
    const body = req.body || {}
    const post = req.method === 'POST'
    const need = (m) => { if ((m === 'POST') !== post) { fail(res, 405, 'METHOD', 'Method not allowed'); return false } return true }

    switch (action) {
      case 'tick': { if (!need('POST')) return; await healthTick(db, { force: true }); return ok({ ticked: true }) }
      case 'overview': { if (!need('GET')) return; await maybeTick(db); return ok(await overview(db, req.query)) }
      case 'dashboard': { if (!need('GET')) return; await maybeTick(db); return ok(await dashboard(db)) }
      case 'database': { if (!need('GET')) return; await maybeTick(db); return ok(await database(db, String(req.query.q || '').toLowerCase())) }
      case 'security': { if (!need('GET')) return; await maybeTick(db); return ok(await security(db, Math.max(1, Number(req.query.page) || 1))) }
      case 'event': { if (!need('GET')) return; const d = await eventDetail(db, req.query.id); return d ? ok(d) : fail(res, 404, 'NOT_FOUND', 'That event was not found.') }
      case 'rules': { if (!need('GET')) return; return ok(await rulesPayload(db)) }

      case 'rule-save': {
        if (!need('POST')) return
        const rule = await db.collection(COLS.rules).findOne({ key: String(body.key || '') })
        if (!rule) return fail(res, 404, 'NOT_FOUND', 'Unknown rule.')
        const set = { updatedAt: new Date(), updatedBy: ctx.user._id }
        if (typeof body.enabled === 'boolean') set.enabled = body.enabled
        if (body.channels) { if (typeof body.channels.email === 'boolean') set['channels.email'] = body.channels.email; if (typeof body.channels.inApp === 'boolean') set['channels.inApp'] = body.channels.inApp }
        if (body.threshold != null) { const t = num(body.threshold, 0, 1e6); if (t == null) return fail(res, 422, 'INVALID', 'Threshold must be a number between 0 and 1,000,000.'); set.threshold = t }
        if (body.forMinutes != null) { const f = num(body.forMinutes, 0, 120); if (f == null) return fail(res, 422, 'INVALID', 'Minutes must be between 0 and 120.'); set.forMinutes = f }
        await db.collection(COLS.rules).updateOne({ _id: rule._id }, { $set: set })
        await audit('alert_rule_changed', `Changed alert rule "${rule.label}".`, { key: rule.key, before: { enabled: rule.enabled, channels: rule.channels, threshold: rule.threshold }, after: set })
        return ok(await rulesPayload(db))
      }
      case 'rule-add': {
        if (!need('POST')) return
        const metric = String(body.metric || '')
        const unit = CUSTOM_METRICS[metric]
        const t = num(body.threshold, 0, 1e6), f = num(body.forMinutes ?? 5, 0, 120)
        if (!unit) return fail(res, 422, 'INVALID', 'Choose a metric from the list.')
        if (t == null || f == null) return fail(res, 422, 'INVALID', 'Threshold or minutes are out of range.')
        const op = body.operator === '>=' ? '>=' : '>'
        const key = `custom_${metric}_${Date.now().toString(36)}`
        const area = metric.startsWith('db_') || metric.startsWith('storage') || metric.startsWith('replica') ? 'database' : metric.startsWith('failed') ? 'security' : 'service_health'
        await db.collection(COLS.rules).insertOne({ key, label: `${metric.replace(/_/g, ' ')} ${op === '>=' ? 'at or above' : 'above'} ${t}${unit === '%' || unit === 'ms' || unit === 's' ? ` ${unit}` : ''}`, area, metric, operator: op, threshold: t, forMinutes: f, channels: { email: body.channels?.email !== false, inApp: body.channels?.inApp !== false }, enabled: true, custom: true, updatedAt: new Date(), updatedBy: ctx.user._id })
        await audit('alert_rule_added', `Added alert rule on ${metric}.`, { key, after: { metric, operator: op, threshold: t, forMinutes: f } })
        return ok(await rulesPayload(db))
      }
      case 'protection-save': {
        if (!need('POST')) return
        const p = body.protection || {}
        const a = num(p.blockAfterFailed?.attempts, 3, 20), w = num(p.blockAfterFailed?.windowMin, 1, 10), bl = num(p.blockLengthMin, 5, 1440), rl = num(p.rateLimit?.perMinute, 20, 1000), lk = num(p.lockAccount?.minutes, 5, 60)
        if ([a, w, bl, rl, lk].includes(null)) return fail(res, 422, 'INVALID', 'Attempts 3 to 20, window 1 to 10 min, block 5 min to 24 h, rate limit 20 to 1,000 and lock 5 to 60 min.')
        const next = { blockAfterFailed: { attempts: a, windowMin: w, enabled: p.blockAfterFailed?.enabled !== false }, blockLengthMin: bl, rateLimit: { perMinute: rl, enabled: p.rateLimit?.enabled !== false }, lockAccount: { minutes: lk, enabled: p.lockAccount?.enabled !== false } }
        const before = (await getSettings(db)).protection
        await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $set: { protection: next } })
        dropSettingsCache()
        await audit('protection_changed', 'Changed automatic protection settings.', { before, after: next })
        return ok(await rulesPayload(db))
      }
      case 'delivery-save': {
        if (!need('POST')) return
        const d = body.delivery || {}
        const addr = String(d.email?.address || '').trim()
        if (addr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return fail(res, 422, 'INVALID', 'Enter a valid email address.')
        const next = { email: { enabled: d.email?.enabled !== false, ...(addr ? { address: addr } : {}) }, inApp: { enabled: d.inApp?.enabled !== false }, dailySummary: { enabled: !!d.dailySummary?.enabled, timeLocal: '08:00' } }
        await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $set: { delivery: next } })
        dropSettingsCache()
        await audit('alert_delivery_changed', 'Changed where alerts are sent.', { after: { email: next.email.enabled, inApp: next.inApp.enabled, dailySummary: next.dailySummary.enabled } })
        return ok(await rulesPayload(db))
      }
      case 'block-ip': {
        if (!need('POST')) return
        const ip = String(body.ip || '').trim()
        if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return fail(res, 422, 'INVALID', 'Enter a valid IP address.')
        if (ip === ctx.ip) return fail(res, 422, 'SELF', 'That is your own IP address. You cannot block yourself.')
        const minutes = body.duration === 'permanent' ? null : body.duration === '24h' ? 1440 : 60
        await db.collection(COLS.blocked).deleteOne({ ip })
        await blockIp(db, ip, { reason: 'Blocked by the Super Admin', source: 'manual', minutes, by: ctx.user._id })
        await audit('ip_blocked', `Blocked IP ${ip}${minutes ? ` for ${minutes === 60 ? '1 hour' : '24 hours'}` : ' permanently'}.`, { ip, minutes })
        return ok({ blocked: ip, permanent: minutes === null })
      }
      case 'unblock-ip': {
        if (!need('POST')) return
        const ip = String(body.ip || '').trim()
        await db.collection(COLS.blocked).deleteOne({ ip })
        await db.collection(COLS.events).insertOne({ type: 'ip_unblocked', level: 'info', ip, message: 'IP unblocked by the Super Admin', status: 'handled', createdAt: new Date() })
        await audit('ip_unblocked', `Unblocked IP ${ip}.`, { ip })
        return ok({ unblocked: ip })
      }
      case 'unlock-account': {
        if (!need('POST')) return
        const e = await db.collection(COLS.events).findOne({ _id: oid(body.eventId) })
        if (!e?.userId) return fail(res, 404, 'NOT_FOUND', 'No account is linked to this event.')
        await db.collection('users').updateOne({ _id: e.userId }, { $set: { is_locked: false, lock_until: null, failed_login_attempts: 0 } })
        await audit('account_unlocked', 'Unlocked an account after a security event.', { eventId: String(e._id), userId: String(e.userId) })
        return ok({ unlocked: true })
      }
      case 'event-resolve': {
        if (!need('POST')) return
        const r = await db.collection(COLS.events).updateOne({ _id: oid(body.id) }, { $set: { status: 'resolved', handledBy: ctx.user._id } })
        if (!r.matchedCount) return fail(res, 404, 'NOT_FOUND', 'That event was not found.')
        await audit('security_event_resolved', 'Marked a security event resolved.', { id: String(body.id) })
        return ok({ resolved: true })
      }
      case 'risk-action': {
        if (!need('POST')) return
        const kind = String(body.action || '')
        if (kind === 'remind') {
          const owners = await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true }, email: { $type: 'string' } }, { projection: { email: 1, full_name: 1 } }).toArray()
          const now = new Date()
          if (owners.length) await db.collection('notifications').insertMany(owners.map((o) => ({ recipient_email: o.email.toLowerCase(), type: 'security_reminder', title: 'Turn on two-step verification', body: 'Please turn on two-step verification for your owner account to keep clinic data safe.', link: null, read: false, created_at: now })), { ordered: false })
          await Promise.allSettled(owners.map((o) => sendEmail({ to: o.email, toName: o.full_name, subject: 'Turn on two-step verification', html: '<p>Please turn on two-step verification for your TherapyPro owner account.</p>', plain: 'Please turn on two-step verification for your TherapyPro owner account.' })))
          await audit('risk_reminder_sent', `Reminded ${owners.length} owners about two-step verification.`, { owners: owners.length })
          return ok({ reminded: owners.length })
        }
        if (kind === 'rotate-confirm') {
          await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $set: { secretRotatedAt: new Date() } }); dropSettingsCache()
          await securityChecks(db); await audit('secret_rotation_confirmed', 'Confirmed the signing secret was rotated.', {})
          return ok({ confirmed: true })
        }
        if (kind === 'retention') {
          const days = [30, 90, 180, 365].includes(Number(body.days)) ? Number(body.days) : null
          if (!days || body.confirm !== true) return fail(res, 422, 'INVALID', 'Choose 30, 90, 180 or 365 days and confirm. Logs older than that are deleted.')
          const secs = days * 86400
          const existing = (await db.collection('auditlogs').indexes()).find((i) => i.expireAfterSeconds != null && i.key?.created_at)
          if (existing) await db.command({ collMod: 'auditlogs', index: { keyPattern: { created_at: 1 }, expireAfterSeconds: secs } })
          else await db.collection('auditlogs').createIndex({ created_at: 1 }, { expireAfterSeconds: secs })
          await securityChecks(db); await audit('audit_retention_changed', `Set audit log retention to ${days} days.`, { days })
          return ok({ days })
        }
        return fail(res, 422, 'INVALID', 'Unknown risk action.')
      }
      default: return fail(res, 404, 'UNKNOWN_ACTION', 'Unknown action.')
    }
  } catch (err) {
    if (err?.code === 121) return fail(res, 422, 'VALIDATION', 'Some values were not accepted by the database. Check the fields and try again.')
    console.error('system-health error:', err)
    return fail(res, err.status || 500, 'SERVER', err.status ? err.message : 'Could not load system health.')
  }
}

// ───────────────────────── readers ─────────────────────────
const latest = (db, n = 1) => db.collection(COLS.samples).find().sort({ ts: -1 }).limit(n).toArray()
const toServices = (s) => (s?.services || []).map((x) => ({ key: x.key, ...SVC[x.key], status: x.status, latencyMs: x.latencyMs }))

function bannerOf(services, activeRules) {
  const overall = services.length ? overallOf(services) : 'unknown'
  const bad = services.filter((s) => s.status === 'degraded' || s.status === 'down').map((s) => s.label)
  const reasons = [...bad.map((b) => `${b} is ${services.find((s) => s.label === b).status === 'down' ? 'down' : 'slow'}`), ...activeRules.map((r) => r.label)]
  return { overall, text: overall === 'operational' ? 'All systems operational' : overall === 'degraded' ? 'Degraded performance' : overall === 'down' ? 'Service disruption' : 'Waiting for the first health check', message: reasons.length ? `${reasons.join('; ')}. Users may notice delays.` : null, healthy: services.filter((s) => s.status === 'operational').length, total: services.length }
}

async function seriesOf(db, metric, range) {
  const span = range === '7d' ? 7 * DAY : DAY
  const field = { response: '$api.p95Ms', errors: '$api.errorRate', requests: '$api.requests' }[metric] || '$api.p95Ms'
  const bucket = Math.round(span / 48)
  const from = new Date(Date.now() - span)
  const rows = await db.collection(COLS.samples).aggregate([
    { $match: { ts: { $gte: from } } },
    { $group: { _id: { $floor: { $divide: [{ $subtract: ['$ts', from] }, bucket] } }, v: { $avg: field }, ts: { $max: '$ts' } } },
    { $match: { v: { $ne: null } } }, { $sort: { _id: 1 } },
  ]).toArray()
  const pts = rows.map((r) => ({ t: r.ts.toISOString(), v: Math.round(r.v * 100) / 100 }))
  if (!pts.length) return { points: [], stats: null }
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a)), low = pts.reduce((a, b) => (b.v < a.v ? b : a))
  return { points: pts, stats: { avg: Math.round(pts.reduce((a, p) => a + p.v, 0) / pts.length), peak: peak.v, peakAt: peak.t, low: low.v, lowAt: low.t, now: pts[pts.length - 1].v } }
}

async function uptime(db) {
  const from = new Date(Date.now() - 30 * DAY)
  const [total, down, first] = await Promise.all([db.collection(COLS.samples).countDocuments({ ts: { $gte: from } }), db.collection(COLS.samples).countDocuments({ ts: { $gte: from }, services: { $elemMatch: { status: 'down' } } }), db.collection(COLS.samples).find().sort({ ts: 1 }).limit(1).next()])
  return { pct: total ? +(100 - (down / total) * 100).toFixed(2) : null, spanHours: first ? Math.round((Date.now() - first.ts) / HOUR) : 0 }
}

async function nextDowntime(db) {
  const d = await db.collection('system_downtimes').findOne({ status: { $in: ['scheduled', 'active'] } })
  return d ? { id: String(d._id), title: d.title, startAt: d.startAt.toISOString(), endAt: d.endAt.toISOString(), status: d.status } : null
}

async function failedLogins(db) {
  const since = new Date(Date.now() - DAY)
  const [total, prev, top] = await Promise.all([
    db.collection(COLS.attempts).countDocuments({ success: false, createdAt: { $gte: since } }),
    db.collection(COLS.attempts).countDocuments({ success: false, createdAt: { $gte: new Date(Date.now() - 2 * DAY), $lt: since } }),
    db.collection(COLS.attempts).aggregate([{ $match: { success: false, createdAt: { $gte: since } } }, { $group: { _id: '$ip', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).toArray(),
  ])
  const blocked = await db.collection(COLS.blocked).countDocuments({ $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }] })
  return { total, prev, topIp: top[0]?._id || null, topIpCount: top[0]?.n || 0, blockedIps: blocked }
}

async function overview(db, q) {
  const [[last], up, activeRules, incidents, fl, inc30, next, series] = await Promise.all([
    latest(db), uptime(db), db.collection(COLS.rules).find({ active: true }).toArray(),
    db.collection(COLS.incidents).find().sort({ startedAt: -1 }).limit(5).toArray(), failedLogins(db),
    db.collection(COLS.incidents).countDocuments({ startedAt: { $gte: new Date(Date.now() - 30 * DAY) } }), nextDowntime(db),
    seriesOf(db, String(q.metric || 'response'), String(q.range || '24h')),
  ])
  const services = toServices(last)
  const done = await db.collection('system_downtimes').find({ status: 'completed' }).sort({ actualEndAt: -1 }).limit(3).toArray()
  const history = [...incidents.map((i) => ({ id: String(i._id), title: i.title, startedAt: i.startedAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() || null, status: i.status })),
    ...done.map((d) => ({ id: String(d._id), title: d.title, startedAt: (d.startedAt || d.startAt).toISOString(), resolvedAt: d.actualEndAt.toISOString(), status: 'completed', minutes: Math.round((d.actualEndAt - d.startAt) / MIN) }))].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5)
  return {
    sampleAt: last?.ts?.toISOString() || null, banner: bannerOf(services, activeRules), uptime: up, incidents30: inc30,
    avgMs: last?.api?.avgMs ?? null, p95: last?.api?.p95Ms ?? null, errorRate: last?.api?.errorRate ?? null, requests: last?.api?.requests ?? null,
    signedIn: last?.signedIn || null, failedLogins: fl, services, series: series.points, seriesStats: series.stats, incidents: history, next,
  }
}

async function dashboard(db) {
  const [[last, ...older], up, activeRules, fl, next, sec, series, openToday] = await Promise.all([
    latest(db, 1), uptime(db), db.collection(COLS.rules).find({ active: true }).toArray(), failedLogins(db), nextDowntime(db), buildScore(db), seriesOf(db, 'response', '24h'),
    db.collection(COLS.events).countDocuments({ status: 'open', level: { $in: ['medium', 'high'] }, createdAt: { $gte: new Date(Date.now() - DAY) } }),
  ])
  const services = toServices(last)
  const nodes = (await mongoMetrics(db, null).catch(() => null))?.nodes || []
  const newCountry = await db.collection(COLS.events).countDocuments({ type: 'new_country_login', status: 'open' })
  return {
    banner: bannerOf(services, activeRules), sampleAt: last?.ts?.toISOString() || null, uptime: up, avgMs: last?.api?.avgMs ?? null, signedIn: last?.signedIn?.total ?? null,
    db: last?.db || null, services, series: series.points.map((p) => p.v), next,
    security: { score: sec.total, parts: sec.parts, open: sec.open.length, topRisk: sec.open.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.level] - { high: 0, medium: 1, low: 2 }[b.level]))[0] || null, failed: fl.total, blocked: fl.blockedIps, newCountry },
    nodes, alertsToday: openToday, topRiskLevel: sec.open.some((r) => r.level === 'high') ? 'high' : null,
    attention: [...sec.open.filter((r) => r.level !== 'low').map((r) => ({ key: r.key, title: r.title, detail: r.detail, level: r.level, to: '/admin/system-health#security' })), ...(newCountry ? [{ key: 'new_country', title: `${newCountry} new-country login${newCountry === 1 ? '' : 's'}`, detail: 'Needs review', level: 'medium', to: '/admin/system-health#security' }] : [])],
  }
}

async function database(db, q) {
  const [m, samples] = await Promise.all([mongoMetrics(db, null), latest(db, 2)])
  const last = samples[0]
  const settings = await getSettings(db)
  const infos = await db.listCollections({}, { nameOnly: false }).toArray()
  const user = infos.filter((c) => !c.name.startsWith('system.') && (!q || c.name.toLowerCase().includes(q))).slice(0, 60)
  const rows = []
  for (let i = 0; i < user.length; i += 8) {
    rows.push(...(await Promise.all(user.slice(i, i + 8).map(async (c) => {
      let docs = null, size = null, idx = null, reason = null
      try {
        const [st] = await db.collection(c.name).aggregate([{ $collStats: { storageStats: {}, count: {} } }]).toArray()
        docs = st.count ?? st.storageStats?.count ?? null; size = st.storageStats?.size ?? null; idx = st.storageStats?.nindexes ?? null
      } catch (e) { reason = na(e).reason; docs = await db.collection(c.name).estimatedDocumentCount().catch(() => null); idx = (await db.collection(c.name).indexes().catch(() => [])).length }
      const lvl = c.options?.validator ? (c.options.validationLevel === 'moderate' ? 'moderate' : 'strict') : 'none'
      return { name: c.name, documents: docs, sizeBytes: size, indexes: idx, validation: lvl, notes: reason || (lvl === 'none' ? 'No schema validation' : ''), health: lvl === 'none' ? 'check' : 'healthy' }
    }))))
  }
  const all = infos.filter((c) => !c.name.startsWith('system.'))
  const validated = all.filter((c) => c.options?.validator).length
  const slow = await db.collection(COLS.slow).find().sort({ ms: -1 }).limit(10).toArray()
  const backupsOn = !!(process.env.ATLAS_PUBLIC_KEY && process.env.ATLAS_PRIVATE_KEY && process.env.ATLAS_PROJECT_ID && process.env.ATLAS_CLUSTER_NAME)
  const series = (await db.collection(COLS.samples).aggregate([{ $match: { ts: { $gte: new Date(Date.now() - DAY) }, 'db.opsPerSec': { $ne: null } } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$ts', new Date(Date.now() - DAY)] }, 1800000] } }, v: { $avg: '$db.opsPerSec' }, ts: { $max: '$ts' } } }, { $sort: { _id: 1 } }]).toArray()).map((r) => ({ t: r.ts.toISOString(), v: Math.round(r.v) }))
  return {
    cluster: { setName: m.setName, nodes: m.nodes, status: m.nodes ? (m.nodes.some((n) => n.health === 0) ? 'degraded' : 'healthy') : 'unknown', unavailable: m.unavailable },
    connections: { current: m.connections, max: m.connectionsMax, note: m.unavailable.connections || null },
    opsPerSec: { value: last?.db?.opsPerSec ?? m.opsPerSec, note: m.unavailable.ops || null }, storage: { mb: m.storageMb, maxMb: m.storageMaxMb, note: m.unavailable.storage || (m.storageMaxMb ? null : 'Set ATLAS_STORAGE_LIMIT_MB to see the plan limit') },
    avgQueryMs: m.pingMs, opsSeries: series,
    backups: backupsOn ? { available: false, reason: 'Atlas API keys are set, but reading backups is not enabled in this build' } : { available: false, reason: 'Connect Atlas API keys to see backups' },
    collections: rows, slowQueries: { items: slow, tracking: false, note: 'Slow-query tracking is not recording yet. Atlas profiler data is not available on shared tiers.' },
    protection: [
      { label: `Schema validation on ${validated} of ${all.length} collections`, status: validated === all.length ? 'good' : 'fix' },
      { label: 'Network access list (0.0.0.0/0)', status: 'unchecked', note: 'Needs Atlas API keys' },
      { label: 'Daily backups and restore tested', status: settings.restoreTestedAt ? 'good' : 'unchecked', note: settings.restoreTestedAt ? null : 'Needs Atlas API keys' },
    ],
  }
}

async function security(db, page) {
  const since = new Date(Date.now() - DAY)
  await securityChecks(db).catch(() => {})
  const [score, fl, rateLimited, injections, newCountry, hours, top, events, total] = await Promise.all([
    buildScore(db), failedLogins(db),
    db.collection(COLS.events).countDocuments({ type: 'rate_limited', createdAt: { $gte: since } }), db.collection(COLS.events).countDocuments({ type: 'injection_attempt', createdAt: { $gte: since } }),
    db.collection(COLS.events).countDocuments({ type: 'new_country_login', status: 'open' }),
    db.collection(COLS.attempts).aggregate([{ $match: { success: false, createdAt: { $gte: since } } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', since] }, HOUR] } }, n: { $sum: 1 } } }]).toArray(),
    db.collection(COLS.attempts).aggregate([{ $match: { success: false, createdAt: { $gte: since } } }, { $group: { _id: '$ip', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]).toArray(),
    db.collection(COLS.events).find({ level: { $ne: 'info' } }).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).toArray(), db.collection(COLS.events).countDocuments({ level: { $ne: 'info' } }),
  ])
  const blockedSet = new Set((await db.collection(COLS.blocked).find({ ip: { $in: top.map((t) => t._id) } }).toArray()).filter((b) => !b.expiresAt || b.expiresAt > new Date()).map((b) => b.ip))
  const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: new Date(since.getTime() + i * HOUR).toISOString(), n: hours.find((h) => h._id === i)?.n || 0 }))
  const rank = { high: 0, medium: 1, low: 2 }
  return {
    score: { total: score.total, parts: score.parts, hint: score.hint, networkChecked: false },
    risks: score.open.sort((a, b) => rank[a.level] - rank[b.level]).map((r) => ({ key: r.key, title: r.title, detail: r.detail, level: r.level, actionKey: r.actionKey })),
    counters: { failedLogins: fl.total, failedDelta: fl.total - fl.prev, blockedIps: fl.blockedIps, newCountry, rateLimited, injections },
    failedByHour: byHour, topSources: top.map((t) => ({ ip: t._id, count: t.n, blocked: blockedSet.has(t._id) })),
    events: events.map((e) => ({ id: String(e._id), ref: eventId(e), time: e.createdAt.toISOString(), title: e.message, sub: [e.target, e.ip, e.country].filter(Boolean).join(' . '), level: e.level, status: e.status, type: e.type })),
    page, total,
  }
}

async function eventDetail(db, id) {
  const e = await db.collection(COLS.events).findOne({ _id: oid(id) })
  if (!e) return null
  const tl = []
  const d = e.details || {}
  if (e.type === 'failed_login_burst' && e.ip) {
    const from = new Date(e.createdAt.getTime() - (d.windowMin || 2) * MIN - 30000)
    const att = await db.collection(COLS.attempts).find({ ip: e.ip, success: false, createdAt: { $gte: from, $lte: e.createdAt } }).sort({ createdAt: 1 }).toArray()
    if (att[0]) tl.push({ at: att[0].createdAt.toISOString(), tone: 'amber', title: 'First failed login', sub: `${e.role || 'User'} account, wrong password` })
    tl.push({ at: e.createdAt.toISOString(), tone: 'red', title: `${d.attempts || att.length}th failed attempt in ${d.windowMin || 2} minutes`, sub: `Same IP ${e.ip}, rate limit reached` })
    const b = await db.collection(COLS.blocked).findOne({ ip: e.ip })
    if (b) tl.push({ at: b.createdAt.toISOString(), tone: 'green', title: `IP blocked ${b.expiresAt ? `for ${Math.round((b.expiresAt - b.createdAt) / MIN)} min` : 'permanently'}`, sub: b.source === 'auto' ? 'Done automatically by TherapyPro' : 'Blocked by the Super Admin', leftMin: b.expiresAt ? Math.max(0, Math.ceil((b.expiresAt - Date.now()) / MIN)) : null })
    if (d.accountLocked) tl.push({ at: e.createdAt.toISOString(), tone: 'green', title: `Account locked for ${d.lockMinutes} minutes`, sub: 'The real owner can still reset the password' })
  } else tl.push({ at: e.createdAt.toISOString(), tone: e.level === 'high' ? 'red' : 'amber', title: e.message, sub: [e.target, e.ip].filter(Boolean).join(' . ') })
  const blocked = e.ip ? await db.collection(COLS.blocked).findOne({ ip: e.ip }) : null
  return {
    id: String(e._id), ref: eventId(e), level: e.level, type: e.type, status: e.status, title: e.message, createdAt: e.createdAt.toISOString(), ip: e.ip || null, country: e.country || null, target: e.target || null, hasAccount: !!e.userId,
    handled: e.status === 'handled' || !!blocked, ipBlocked: !!blocked && (!blocked.expiresAt || blocked.expiresAt > new Date()), permanent: !!blocked && !blocked.expiresAt, timeline: tl,
  }
}

async function rulesPayload(db) {
  const [rules, s] = await Promise.all([db.collection(COLS.rules).find().sort({ custom: 1, _id: 1 }).toArray(), getSettings(db)])
  return { rules: rules.map((r) => ({ key: r.key, label: r.label, area: r.area, metric: r.metric, operator: r.operator, threshold: r.threshold, forMinutes: r.forMinutes, channels: r.channels, enabled: r.enabled, active: !!r.active, custom: !!r.custom })), protection: s.protection, delivery: { ...s.delivery, email: { ...s.delivery.email, address: s.delivery.email?.address || '' } }, metrics: CUSTOM_METRICS }
}

export { maskEmail }
