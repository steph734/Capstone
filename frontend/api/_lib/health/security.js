// System Health: security events, IP blocking, login hooks, risk checks and the score.
import crypto from 'node:crypto'
import { COLS, ensureHealthStore, getSettings, notifyAdmins, maskEmail } from './store.js'
import { sendEmail } from '../brevo.js'

const MIN = 60000
export const clientCountry = (req) => String(req.headers?.['x-vercel-ip-country'] || '').toUpperCase().slice(0, 2) || null
const allowList = () => String(process.env.ALWAYS_ALLOW_IPS || '').split(',').map((s) => s.trim()).filter(Boolean)
export const isAllowedIp = (ip) => allowList().includes(ip)
export const hashEmail = (e) => crypto.createHash('sha256').update(String(e).toLowerCase()).digest('hex').slice(0, 24)

// ── events ──
export async function logEvent(db, e) {
  const doc = { type: e.type, level: e.level, ip: e.ip || null, country: e.country || null, userId: e.userId || null, role: e.role || null, target: e.target || null, message: e.message, details: e.details || {}, status: e.status || 'open', handledBy: e.handledBy || null, createdAt: new Date() }
  for (const k of Object.keys(doc)) if (doc[k] === null || doc[k] === '') delete doc[k] // never store empty values
  const { insertedId } = await db.collection(COLS.events).insertOne(doc)
  return { _id: insertedId, ...doc }
}

// Fires an event-driven alert rule (new country, role changed, downtime change) if it is switched on.
export async function fireRule(db, key, title, body) {
  const rule = await db.collection(COLS.rules).findOne({ key })
  if (rule?.enabled) await notifyAdmins(db, { title, body, channels: rule.channels })
}

// ── blocking ──
export async function isBlocked(db, ip) {
  if (!ip || isAllowedIp(ip)) return false
  const row = await db.collection(COLS.blocked).findOne({ ip }, { projection: { expiresAt: 1 } })
  return !!row && (!row.expiresAt || row.expiresAt > new Date())
}
// Returns true if this call created the block (so the caller notifies once).
export async function blockIp(db, ip, { reason, source = 'auto', minutes = null, by = null }) {
  if (!ip || ip === 'unknown' || isAllowedIp(ip)) return false
  const now = new Date()
  const doc = { ip, reason, source, createdBy: by, createdAt: now, ...(minutes ? { expiresAt: new Date(now.getTime() + minutes * MIN) } : {}) }
  const cur = await db.collection(COLS.blocked).findOne({ ip })
  if (cur && (!cur.expiresAt || cur.expiresAt > now)) {
    if (source === 'manual' && minutes === null && cur.expiresAt) await db.collection(COLS.blocked).replaceOne({ ip }, doc) // upgrade to permanent
    return false
  }
  await db.collection(COLS.blocked).replaceOne({ ip }, doc, { upsert: true })
  return true
}

// ── login hooks (called by the existing auth routes; they never throw into the login) ──
export async function onLoginFailure(db, req, { ip, email, user }) {
  try {
    await ensureHealthStore(db)
    const s = (await getSettings(db)).protection
    const now = new Date()
    await db.collection(COLS.attempts).insertOne({ ip, emailHash: hashEmail(email), success: false, ...(user?.role ? { role: user.role } : {}), ...(clientCountry(req) ? { country: clientCountry(req) } : {}), ...(user?._id ? { userId: user._id } : {}), createdAt: now })
    const cfg = s.blockAfterFailed
    if (!cfg.enabled || user?.role === 'Super Admin') return
    const since = new Date(now.getTime() - cfg.windowMin * MIN)
    const n = await db.collection(COLS.attempts).countDocuments({ ip, success: false, createdAt: { $gte: since } })
    if (n < cfg.attempts) return
    const created = await blockIp(db, ip, { reason: `${n} failed logins in ${cfg.windowMin} minutes`, minutes: s.blockLengthMin })
    if (!created) return
    let locked = false
    if (s.lockAccount.enabled && user?._id) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { is_locked: true, lock_until: new Date(now.getTime() + s.lockAccount.minutes * MIN) } })
      locked = true
    }
    await logEvent(db, { type: 'failed_login_burst', level: 'high', ip, country: clientCountry(req), userId: user?._id, role: user?.role, target: user ? `1 ${String(user.role || 'user').toLowerCase()} account (${maskEmail(user.email)})` : 'unknown account', message: `Repeated failed logins (${n} in ${cfg.windowMin} min)`, status: 'handled', details: { attempts: n, windowMin: cfg.windowMin, blockMinutes: s.blockLengthMin, accountLocked: locked, lockMinutes: locked ? s.lockAccount.minutes : null } })
    await logEvent(db, { type: 'ip_blocked', level: 'medium', ip, message: `IP blocked automatically for ${s.blockLengthMin >= 60 ? `${s.blockLengthMin / 60} hour${s.blockLengthMin === 60 ? '' : 's'}` : `${s.blockLengthMin} minutes`}`, status: 'handled' })
    const rule = await db.collection(COLS.rules).findOne({ key: 'failed_logins' })
    if (rule?.enabled) await notifyAdmins(db, { title: 'Repeated failed logins blocked', body: `IP ${ip} was blocked after ${n} failed logins in ${cfg.windowMin} minutes.`, channels: rule.channels, link: '/admin/system-health#security' })
  } catch (e) { console.error('onLoginFailure:', e.message) }
}

export async function onLoginSuccess(db, req, { ip, email, user }) {
  try {
    await ensureHealthStore(db)
    const country = clientCountry(req)
    const now = new Date()
    await db.collection(COLS.attempts).insertOne({ ip, emailHash: hashEmail(email), success: true, role: user.role, ...(country ? { country } : {}), userId: user._id, createdAt: now })
    if (user.role === 'Super Admin') await logEvent(db, { type: 'admin_login', level: 'info', ip, country, userId: user._id, role: user.role, target: 'Super Admin', message: 'Super Admin signed in' })
    if (!country) return
    const since = new Date(now.getTime() - 90 * 86400000)
    const prior = await db.collection(COLS.attempts).find({ userId: user._id, success: true, country: { $exists: true }, createdAt: { $gte: since, $lt: now } }, { projection: { country: 1 } }).limit(200).toArray()
    // Only "new" when there is history to compare against (a first-ever login is not a new country).
    if (!prior.length || prior.some((p) => p.country === country)) return
    await logEvent(db, { type: 'new_country_login', level: 'medium', ip, country, userId: user._id, role: user.role, target: `${user.role} account (${maskEmail(user.email)})`, message: `Login from a new country (${country})` })
    await fireRule(db, 'new_country', 'Login from a new country', `${user.role} account ${maskEmail(user.email)} signed in from ${country}.`)
    sendEmail({ to: user.email, subject: 'New sign-in location on TherapyPro', html: `<p>We noticed a sign-in to your TherapyPro account from a new country (${country}). If this was you, no action is needed. If not, please reset your password.</p>`, plain: `New sign-in from ${country}. If this was not you, reset your password.` }).catch(() => {})
  } catch (e) { console.error('onLoginSuccess:', e.message) }
}

export async function recordInjection(db, req, ip, where) {
  try { await ensureHealthStore(db); await logEvent(db, { type: 'injection_attempt', level: 'high', ip, country: clientCountry(req), message: `Rejected operator object in ${where}`, status: 'handled', details: { where } }) } catch { /* never break the request */ }
}

// ── risk checks (every 10 minutes) ──
const RISKS = {
  atlas_open: { part: 'network', level: 'high', title: 'MongoDB Atlas allows connections from any IP', detail: 'Network access list contains 0.0.0.0/0', actionKey: 'restrict' },
  two_step_off: { part: 'accounts', level: 'medium', actionKey: 'remind' },
  secret_age: { part: 'accounts', level: 'medium', actionKey: 'rotate' },
  audit_retention: { part: 'monitoring', level: 'low', actionKey: 'retention' },
  no_validation: { part: 'data', level: 'low', actionKey: null },
  storage_high: { part: 'data', level: 'medium', actionKey: null },
  many_sessions: { part: 'accounts', level: 'low', actionKey: null },
}
const PART_WEIGHT = { accounts: 0.3, data: 0.3, network: 0.2, monitoring: 0.2 }
const LOSS = { high: 30, medium: 10, low: 3 }

export async function securityChecks(db, { storageMb = null, storageMaxMb = null, atlasOpen = null } = {}) {
  const found = {}
  const settings = await getSettings(db)
  const owners = await db.collection('users').countDocuments({ role: 'Owner', is_archived: { $ne: true } })
  if (owners && String(process.env.REQUIRE_LOGIN_2FA || '').toLowerCase() !== 'true') found.two_step_off = { title: `${owners} owner account${owners === 1 ? ' has' : 's have'} no two-step verification`, detail: 'Ask owners to turn it on' }
  const rotated = settings.secretRotatedAt ? new Date(settings.secretRotatedAt) : null
  const days = rotated ? Math.floor((Date.now() - rotated.getTime()) / 86400000) : null
  if (!rotated) found.secret_age = { title: 'Signing secret rotation date is not recorded', detail: 'Rotate it, then confirm here. Recommended every 90 days' }
  else if (days > 90) found.secret_age = { title: `Signing secret has not been changed in ${days} days`, detail: 'Recommended every 90 days' }
  const ttl = (await db.collection('auditlogs').indexes().catch(() => [])).find((i) => i.expireAfterSeconds != null)
  if (ttl && ttl.expireAfterSeconds < 365 * 86400) found.audit_retention = { title: `Audit logs are kept for ${Math.round(ttl.expireAfterSeconds / 86400)} days`, detail: 'One year is recommended' }
  const cols = await db.listCollections({ type: 'collection' }, { nameOnly: false }).toArray().catch(() => [])
  const user = cols.filter((c) => !c.name.startsWith('system.') && !c.options?.validator)
  if (user.length) found.no_validation = { title: `${user.length} collection${user.length === 1 ? '' : 's'} without schema validation`, detail: user.slice(0, 4).map((c) => c.name).join(', ') + (user.length > 4 ? '...' : '') }
  if (storageMb != null && storageMaxMb && storageMb / storageMaxMb > 0.8) found.storage_high = { title: 'Database storage is above 80% of the plan limit', detail: `${Math.round(storageMb)} MB of ${storageMaxMb} MB` }
  const heavy = await db.collection('sessions').aggregate([{ $match: { revoked: { $ne: true }, expires_at: { $gt: new Date() } } }, { $group: { _id: '$user_id', n: { $sum: 1 } } }, { $match: { n: { $gt: 10 } } }, { $count: 'c' }]).toArray().catch(() => [])
  if (heavy[0]?.c) found.many_sessions = { title: `${heavy[0].c} account${heavy[0].c === 1 ? ' has' : 's have'} an unusual number of active sessions`, detail: 'More than 10 active sessions' }
  if (atlasOpen) found.atlas_open = {}

  const now = new Date()
  const col = db.collection(COLS.risks)
  for (const [key, f] of Object.entries(found)) {
    const meta = RISKS[key]
    await col.updateOne({ key }, { $set: { title: f.title || meta.title, detail: f.detail || meta.detail || '', level: meta.level, status: 'open', lastCheckedAt: now, actionKey: meta.actionKey, part: meta.part }, $setOnInsert: { key, firstSeenAt: now } }, { upsert: true })
  }
  await col.updateMany({ key: { $nin: Object.keys(found) }, status: 'open' }, { $set: { status: 'fixed', lastCheckedAt: now } })
}

export async function buildScore(db) {
  const open = await db.collection(COLS.risks).find({ status: 'open' }).toArray()
  const parts = Object.keys(PART_WEIGHT).map((k) => ({ key: k, score: Math.max(0, 100 - open.filter((r) => (RISKS[r.key]?.part || r.part) === k).reduce((n, r) => n + LOSS[r.level], 0)) }))
  const total = Math.round(parts.reduce((n, p) => n + p.score * PART_WEIGHT[p.key], 0))
  const high = open.filter((r) => r.level === 'high')
  const without = Math.round(parts.reduce((n, p) => n + (p.score + high.filter((r) => (RISKS[r.key]?.part || r.part) === p.key).length * LOSS.high > 100 ? 100 : p.score + high.filter((r) => (RISKS[r.key]?.part || r.part) === p.key).length * LOSS.high) * PART_WEIGHT[p.key], 0))
  return { total, parts, open, hint: high.length ? `Fix the high risk to reach ${Math.min(100, without)}.` : null, networkChecked: false }
}
