// System Health: request timing rollups, the once-a-minute healthTick(), MongoDB metrics and alert-rule evaluation.
// Nothing here invents numbers: anything that cannot be measured is null / { available: false } and the UI says so.
import { COLS, ensureHealthStore, getSettings, notifyAdmins } from './store.js'
import { securityChecks } from './security.js'
import { getDb } from '../mongo.js'
import { onlineCounts } from '../downtime.js'
import { IDLE_LIMIT_MS } from '../session.js'
import { sendEmail } from '../brevo.js'

const MIN = 60000
const BOUNDS = [50, 100, 200, 400, 800, 1500, 3000, Infinity] // latency histogram (ms); p95 is the upper bound of the bucket that holds it

// ── 1. request timing: one cheap in-memory counter per minute, flushed to `api_rollups` at most every 15 s ──
let buf = new Map()
let lastFlush = Date.now()
export function timing(req, res, next) {
  const t0 = Date.now()
  res.on('finish', () => {
    if (!req.path.startsWith('/api/') || req.path.startsWith('/api/admin/system-health')) return
    const min = Math.floor(Date.now() / MIN) * MIN
    const b = buf.get(min) || { n: 0, sum: 0, err: 0, h: BOUNDS.map(() => 0) }
    const ms = Date.now() - t0
    b.n++; b.sum += ms; if (res.statusCode >= 500) b.err++
    b.h[BOUNDS.findIndex((x) => ms <= x)]++
    buf.set(min, b)
    if (Date.now() - lastFlush > 15000) flush().catch(() => {})
  })
  next()
}
async function flush() {
  lastFlush = Date.now()
  const take = buf; buf = new Map()
  if (!take.size) return
  const col = (await getDb()).collection(COLS.rollups)
  await Promise.all([...take].map(([min, b]) => col.updateOne({ _id: min }, { $inc: { n: b.n, sum: b.sum, err: b.err, ...Object.fromEntries(b.h.map((v, i) => [`h${i}`, v])) }, $setOnInsert: { expiresAt: new Date(min + 3 * 86400000) } }, { upsert: true }))).catch((e) => console.error('rollup flush failed:', e.message))
}
async function apiStats(db, fromMs, toMs) {
  const rows = await db.collection(COLS.rollups).find({ _id: { $gte: fromMs, $lt: toMs } }).toArray()
  const n = rows.reduce((a, r) => a + (r.n || 0), 0)
  if (!n) return { requests: 0, avgMs: null, p95Ms: null, errorRate: null }
  const h = BOUNDS.map((_, i) => rows.reduce((a, r) => a + (r[`h${i}`] || 0), 0))
  let acc = 0, p95 = BOUNDS[BOUNDS.length - 2]
  for (let i = 0; i < h.length; i++) { acc += h[i]; if (acc >= n * 0.95) { p95 = Number.isFinite(BOUNDS[i]) ? BOUNDS[i] : BOUNDS[BOUNDS.length - 2]; break } }
  return { requests: n, avgMs: Math.round(rows.reduce((a, r) => a + (r.sum || 0), 0) / n), p95Ms: p95, errorRate: +((rows.reduce((a, r) => a + (r.err || 0), 0) / n) * 100).toFixed(2) }
}

// ── 2. MongoDB metrics (each one optional) ──
const na = (e) => ({ available: false, reason: /not (supported|authorized)|unauthorized|requires|command .* not found|Unsupported/i.test(e?.message || '') ? 'Not available on this plan' : (e?.message || 'Unavailable').slice(0, 80) })
export async function mongoMetrics(db, prev) {
  const out = { connections: null, connectionsMax: null, opsPerSec: null, opTotal: null, storageMb: null, storageMaxMb: Number(process.env.ATLAS_STORAGE_LIMIT_MB) || null, nodes: null, replicaLagSec: null, primary: null, setName: null, unavailable: {} }
  const t0 = Date.now()
  await db.command({ ping: 1 })
  out.pingMs = Date.now() - t0
  try {
    const s = await db.admin().serverStatus()
    out.connections = s.connections.current; out.connectionsMax = s.connections.current + s.connections.available
    out.opTotal = Object.values(s.opcounters || {}).reduce((a, b) => a + Number(b), 0)
    if (prev?.opTotal != null && prev.ts && out.opTotal >= prev.opTotal) out.opsPerSec = Math.round((out.opTotal - prev.opTotal) / Math.max(1, (Date.now() - prev.ts) / 1000))
  } catch (e) { out.unavailable.connections = na(e).reason; out.unavailable.ops = na(e).reason }
  try { const st = await db.stats(); out.storageMb = +((st.dataSize + st.indexSize) / 1048576).toFixed(1) } catch (e) { out.unavailable.storage = na(e).reason }
  try {
    const h = await db.admin().command({ hello: 1 })
    out.primary = h.primary || h.me || null; out.setName = h.setName || null
    out.nodes = [...(h.hosts || [])].map((host) => ({ host, role: host === h.primary ? 'PRIMARY' : 'SECONDARY', lagSec: null }))
  } catch (e) { out.unavailable.nodes = na(e).reason }
  try {
    const rs = await db.admin().command({ replSetGetStatus: 1 })
    const p = rs.members.find((m) => m.stateStr === 'PRIMARY')
    let max = 0
    for (const m of rs.members) {
      const lag = p && m.optimeDate && p.optimeDate ? Math.max(0, Math.round((p.optimeDate - m.optimeDate) / 1000)) : null
      const n = out.nodes?.find((x) => x.host === m.name); if (n) { n.lagSec = lag; n.role = m.stateStr; n.health = m.health }
      if (lag != null) max = Math.max(max, lag)
    }
    out.replicaLagSec = max
  } catch (e) { out.unavailable.replicaLag = na(e).reason }
  return out
}

// ── 3. services ──
async function ping(url, { method = 'GET', headers, okBelow = 500 } = {}) {
  const t = Date.now()
  try { const r = await fetch(url, { method, headers, signal: AbortSignal.timeout(3000) }); return { ok: r.status < okBelow, ms: Date.now() - t } } catch { return { ok: false, ms: Date.now() - t } }
}
export const SERVICES = [['web', 'Web app', 'Vercel'], ['api', 'API', 'Serverless'], ['mongodb', 'MongoDB Atlas', 'therapypro cluster'], ['email', 'Email delivery', 'Invoices, notices'], ['payments', 'Payments', 'Card, GCash, Maya'], ['voice_ai', 'Pao voice and AI', 'Speech and AI']]
const statusOf = (r, prevFail, errRate) => {
  if (!r) return { status: 'unknown', latencyMs: null, fail: false }
  if (!r.ok) return { status: prevFail ? 'down' : 'degraded', latencyMs: r.ms, fail: true } // "down" only after two failed checks in a row
  return { status: r.ms >= 1000 || (errRate != null && errRate > 1) ? 'degraded' : 'operational', latencyMs: r.ms, fail: false }
}
export const overallOf = (services) => (services.some((s) => s.status === 'down') ? 'down' : services.some((s) => s.status === 'degraded') ? 'degraded' : 'operational')

// ── 4. the tick ──
export async function healthTick(db, { force = false } = {}) {
  await ensureHealthStore(db)
  const now = new Date()
  const claim = await db.collection(COLS.settings).findOneAndUpdate(
    force ? { _id: 'default' } : { _id: 'default', $or: [{ lastTickAt: { $lt: new Date(now.getTime() - 55000) } }, { lastTickAt: { $exists: false } }] },
    { $set: { lastTickAt: now } }, { returnDocument: 'before' })
  if (!claim) return null // someone else ticked within the last minute
  await flush()
  const last = await db.collection(COLS.samples).find().sort({ ts: -1 }).limit(1).next()
  const minute = Math.floor(now.getTime() / MIN) * MIN
  const api = await apiStats(db, minute - 5 * MIN, minute) // 5-minute window smooths one-off spikes
  const dbm = await mongoMetrics(db, last ? { opTotal: last.db?.opTotal, ts: last.ts.getTime() } : null).catch((e) => ({ failed: true, err: e.message }))
  const site = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  const brevoKey = String(process.env.BREVO_API_KEY || '').trim()
  const [web, email, pay] = await Promise.all([
    site ? ping(site, { method: 'HEAD' }) : null,
    brevoKey ? ping('https://api.brevo.com/v3/account', { headers: { 'api-key': brevoKey }, okBelow: 400 }) : null,
    ping('https://api.stripe.com/v1/charges', { okBelow: 500 }), // 401 without a key is a healthy answer: the service is reachable
  ])
  const prevFail = Object.fromEntries((last?.services || []).map((s) => [s.key, s.fail]))
  const services = [
    { key: 'web', ...statusOf(web, prevFail.web) },
    { key: 'api', ...(api.p95Ms == null ? { status: 'unknown', latencyMs: null, fail: false } : { status: api.p95Ms >= 1000 || api.errorRate > 1 ? 'degraded' : 'operational', latencyMs: api.avgMs, fail: false }) },
    { key: 'mongodb', ...statusOf(dbm.failed ? { ok: false, ms: 3000 } : { ok: true, ms: dbm.pingMs }, prevFail.mongodb) },
    { key: 'email', ...statusOf(email, prevFail.email) },
    { key: 'payments', ...statusOf(pay, prevFail.payments) },
    { key: 'voice_ai', status: 'unknown', latencyMs: null, fail: false }, // no cheap, safe check exists: reported honestly as unknown
  ]
  const online = await onlineCounts(db, IDLE_LIMIT_MS).catch(() => ({ owners: 0, therapists: 0, patients: 0, superAdmins: 0 }))
  await db.collection(COLS.samples).insertOne({
    ts: now, api, services,
    db: dbm.failed ? { error: true } : { connections: dbm.connections, connectionsMax: dbm.connectionsMax, opsPerSec: dbm.opsPerSec, opTotal: dbm.opTotal, storageMb: dbm.storageMb, storageMaxMb: dbm.storageMaxMb, avgQueryMs: dbm.pingMs, replicaLagSec: dbm.replicaLagSec, primary: dbm.primary },
    signedIn: { owners: online.owners, therapists: online.therapists, patients: online.patients, total: online.owners + online.therapists + online.patients + online.superAdmins },
  })
  await evaluateRules(db, now)
  const s = await getSettings(db)
  if (!s.lastRiskCheckAt || now - new Date(s.lastRiskCheckAt) > 10 * MIN) {
    await securityChecks(db, { storageMb: dbm.storageMb, storageMaxMb: dbm.storageMaxMb }).catch((e) => console.error('securityChecks failed:', e.message))
    await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $set: { lastRiskCheckAt: now } })
  }
  await dailySummary(db, s, now).catch((e) => console.error('daily summary failed:', e.message))
  return { ok: true }
}
// Throttled version used when a Super Admin loads a health page (Vercel Hobby only runs crons daily).
export const maybeTick = (db) => healthTick(db).catch((e) => { console.error('healthTick failed:', e.message); return null })

// ── 5. alert rules: fire once when the condition has held for `forMinutes`, once more when it recovers ──
const METRIC = {
  error_rate: (s) => s.api?.errorRate, api_p95: (s) => s.api?.p95Ms,
  db_connections_pct: (s) => (s.db?.connections != null && s.db?.connectionsMax ? (s.db.connections / s.db.connectionsMax) * 100 : null),
  storage_pct: (s) => (s.db?.storageMb != null && s.db?.storageMaxMb ? (s.db.storageMb / s.db.storageMaxMb) * 100 : null),
  replica_lag: (s) => s.db?.replicaLagSec,
}
const cmp = (v, op, t) => (op === '>=' ? v >= t : v > t)
async function evaluateRules(db, now) {
  const rules = await db.collection(COLS.rules).find({ enabled: true, metric: { $in: [...Object.keys(METRIC), 'failed_logins_2m'] } }).toArray()
  for (const r of rules) {
    let holds = false
    if (r.metric === 'failed_logins_2m') holds = (await db.collection(COLS.attempts).countDocuments({ success: false, createdAt: { $gte: new Date(now - 2 * MIN) } })) >= r.threshold
    else {
      const rows = await db.collection(COLS.samples).find({ ts: { $gte: new Date(now - Math.max(1, r.forMinutes) * MIN - 30000) } }).sort({ ts: -1 }).toArray()
      const vals = rows.map(METRIC[r.metric]).filter((v) => v != null)
      const spanOk = rows.length && now - rows[rows.length - 1].ts >= (r.forMinutes - 1) * MIN // enough history to say "for N minutes"
      holds = vals.length > 0 && vals.length === rows.length && spanOk && vals.every((v) => cmp(v, r.operator, r.threshold))
    }
    if (holds && !r.active) {
      await db.collection(COLS.rules).updateOne({ _id: r._id }, { $set: { active: true, activeSince: now, notifiedAt: now } })
      await notifyAdmins(db, { title: `Alert: ${r.label}`, body: 'This condition has been met. Open System Health for details.', channels: r.channels })
      await db.collection(COLS.incidents).insertOne({ title: r.label, area: r.area, status: 'investigating', startedAt: now, ruleKey: r.key })
    } else if (!holds && r.active) {
      await db.collection(COLS.rules).updateOne({ _id: r._id }, { $set: { active: false }, $unset: { activeSince: '' } })
      await notifyAdmins(db, { title: `Recovered: ${r.label}`, body: 'The condition has cleared.', channels: r.channels })
      await db.collection(COLS.incidents).updateMany({ ruleKey: r.key, status: 'investigating' }, { $set: { status: 'resolved', resolvedAt: now } })
    }
  }
}

async function dailySummary(db, s, now) {
  const d = s.delivery?.dailySummary
  if (!d?.enabled) return
  const manila = new Date(now.getTime() + 8 * 3600000)
  const today = manila.toISOString().slice(0, 10)
  if (s.lastSummaryDate === today || manila.toISOString().slice(11, 16) < (d.timeLocal || '08:00')) return
  const since = new Date(now - 86400000)
  const [high, blocked, samples] = await Promise.all([db.collection(COLS.events).countDocuments({ level: 'high', createdAt: { $gte: since } }), db.collection(COLS.blocked).countDocuments({ createdAt: { $gte: since } }), db.collection(COLS.samples).countDocuments({ ts: { $gte: since } })])
  const to = s.delivery.email?.address
  await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $set: { lastSummaryDate: today } })
  if (to) await sendEmail({ to, subject: 'TherapyPro health summary (last 24 hours)', html: `<p>High-level security events: ${high}<br>IPs blocked: ${blocked}<br>Health samples recorded: ${samples}</p>`, plain: `High events: ${high}. Blocked IPs: ${blocked}. Samples: ${samples}.` })
}

export { na }
