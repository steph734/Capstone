// System Health: collections, validators, indexes, seed rules and settings. Everything is idempotent and runs once per warm container.
import { sendEmail } from '../brevo.js'

export const COLS = {
  samples: 'system_health_samples', events: 'security_events', blocked: 'blocked_ips', attempts: 'login_attempts',
  rules: 'alert_rules', settings: 'alert_settings', incidents: 'health_incidents', risks: 'security_risks', slow: 'slow_queries', rollups: 'api_rollups',
}
const DAY = 86400000

export const DEFAULT_SETTINGS = {
  protection: { blockAfterFailed: { attempts: 5, windowMin: 2, enabled: true }, blockLengthMin: 60, rateLimit: { perMinute: 100, enabled: true }, lockAccount: { minutes: 15, enabled: true } },
  delivery: { email: { enabled: true, address: '' }, inApp: { enabled: true }, dailySummary: { enabled: false, timeLocal: '08:00' } },
}

// key, label, area, metric, operator, threshold, forMinutes, email, inApp, enabled
const RULES = [
  ['error_rate', 'Error rate above 2% for 5 minutes', 'service_health', 'error_rate', '>', 2, 5, true, true, true],
  ['api_p95', 'API response (p95) above 1,500 ms', 'service_health', 'api_p95', '>', 1500, 5, true, true, true],
  ['db_connections', 'MongoDB connections above 80%', 'database', 'db_connections_pct', '>', 80, 5, true, true, true],
  ['db_storage', 'Storage above 80% of the plan limit', 'database', 'storage_pct', '>', 80, 5, true, false, true],
  ['replica_lag', 'Replica lag above 10 seconds', 'database', 'replica_lag', '>', 10, 5, true, true, true],
  ['backup_failed', 'Backup failed or missed', 'database', 'backup_failed', '>', 0, 0, true, true, true],
  ['failed_logins', '5 or more failed logins in 2 minutes', 'security', 'failed_logins_2m', '>=', 5, 0, false, true, true],
  ['new_country', 'Login from a new country', 'security', 'event', '>', 0, 0, true, true, true],
  ['role_changed', 'Role or permission changed', 'security', 'event', '>', 0, 0, true, false, true],
  ['downtime_change', 'Scheduled downtime starts or ends', 'system', 'event', '>', 0, 0, false, true, false],
]
export const CUSTOM_METRICS = { error_rate: '%', api_p95: 'ms', db_connections_pct: '%', storage_pct: '%', replica_lag: 's', failed_logins_2m: 'logins' }

const obj = (properties, required) => ({ $jsonSchema: { bsonType: 'object', required, properties } })
const VALIDATORS = {
  [COLS.events]: obj({ type: { bsonType: 'string' }, level: { enum: ['info', 'low', 'medium', 'high'] }, status: { enum: ['open', 'handled', 'resolved'] }, createdAt: { bsonType: 'date' } }, ['type', 'level', 'status', 'createdAt']),
  [COLS.blocked]: obj({ ip: { bsonType: 'string' }, source: { enum: ['auto', 'manual'] }, createdAt: { bsonType: 'date' } }, ['ip', 'source', 'createdAt']),
  [COLS.rules]: obj({ key: { bsonType: 'string' }, area: { enum: ['service_health', 'database', 'security', 'system'] }, enabled: { bsonType: 'bool' } }, ['key', 'label', 'area', 'enabled']),
  [COLS.samples]: obj({ ts: { bsonType: 'date' } }, ['ts']),
  [COLS.incidents]: obj({ status: { enum: ['investigating', 'resolved', 'completed'] }, startedAt: { bsonType: 'date' } }, ['title', 'status', 'startedAt']),
  [COLS.risks]: obj({ key: { bsonType: 'string' }, level: { enum: ['high', 'medium', 'low'] }, status: { enum: ['open', 'fixed', 'dismissed'] } }, ['key', 'level', 'status']),
}

let ready = null
export function ensureHealthStore(db) {
  if (!ready) ready = setup(db).catch((e) => { ready = null; throw e })
  return ready
}

async function setup(db) {
  for (const [name, validator] of Object.entries(VALIDATORS)) {
    try { await db.createCollection(name, { validator, validationLevel: 'moderate' }) } catch (e) { if (e.code !== 48) console.error(`health: createCollection ${name}:`, e.message) }
  }
  const ix = (c, key, opts) => db.collection(c).createIndex(key, opts).catch((e) => console.error(`health: index ${c}:`, e.message))
  await Promise.all([
    ix(COLS.samples, { ts: -1 }), ix(COLS.samples, { ts: 1 }, { expireAfterSeconds: 35 * 86400, name: 'ts_ttl' }),
    ix(COLS.events, { createdAt: -1 }), ix(COLS.events, { level: 1, status: 1 }), ix(COLS.events, { ip: 1, createdAt: -1 }),
    ix(COLS.blocked, { ip: 1 }, { unique: true }), ix(COLS.blocked, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ix(COLS.attempts, { ip: 1, createdAt: -1 }), ix(COLS.attempts, { createdAt: 1 }, { expireAfterSeconds: 7 * 86400, name: 'createdAt_ttl' }), ix(COLS.attempts, { userId: 1, success: 1, createdAt: -1 }),
    ix(COLS.rules, { key: 1 }, { unique: true }), ix(COLS.incidents, { startedAt: -1 }), ix(COLS.risks, { key: 1 }, { unique: true }),
    ix(COLS.slow, { lastSeenAt: 1 }, { expireAfterSeconds: 7 * 86400 }), ix(COLS.rollups, { expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])
  const now = new Date()
  for (const [key, label, area, metric, operator, threshold, forMinutes, email, inApp, enabled] of RULES) {
    await db.collection(COLS.rules).updateOne({ key }, { $setOnInsert: { key, label, area, metric, operator, threshold, forMinutes, channels: { email, inApp }, enabled, custom: false, updatedAt: now, updatedBy: null } }, { upsert: true })
  }
  await db.collection(COLS.settings).updateOne({ _id: 'default' }, { $setOnInsert: { ...DEFAULT_SETTINGS, createdAt: now } }, { upsert: true })
}

let cache = { at: 0, doc: null }
export async function getSettings(db) {
  if (cache.doc && Date.now() - cache.at < 60000) return cache.doc
  const doc = (await db.collection(COLS.settings).findOne({ _id: 'default' })) || { _id: 'default', ...DEFAULT_SETTINGS }
  cache = { at: Date.now(), doc: { ...doc, protection: { ...DEFAULT_SETTINGS.protection, ...doc.protection }, delivery: { ...DEFAULT_SETTINGS.delivery, ...doc.delivery } } }
  return cache.doc
}
export const dropSettingsCache = () => { cache = { at: 0, doc: null } }

export const maskEmail = (e) => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 1)}***@${d}` : '' }

// ── notifications: reuse the app's `notifications` collection (the bell) and the Brevo mail helper ──
export async function notifyAdmins(db, { title, body, channels, type = 'system_health', link = '/admin/system-health' }) {
  const s = await getSettings(db)
  const admins = await db.collection('users').find({ role: 'Super Admin', is_archived: { $ne: true }, email: { $type: 'string' } }, { projection: { email: 1, full_name: 1 } }).toArray()
  if (channels?.inApp && s.delivery.inApp?.enabled !== false && admins.length) {
    await db.collection('notifications').insertMany(admins.map((a) => ({ recipient_email: a.email.toLowerCase(), type, title, body, link, read: false, created_at: new Date() })), { ordered: false }).catch((e) => console.error('health notify failed:', e.message))
  }
  if (channels?.email && s.delivery.email?.enabled !== false) {
    const to = s.delivery.email?.address || admins[0]?.email
    if (to) await sendEmail({ to, subject: title, html: `<p>${esc(title)}</p><p>${esc(body)}</p>`, plain: `${title}\n${body}` }).catch((e) => console.error('health email failed:', e.message))
  }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export { DAY }
