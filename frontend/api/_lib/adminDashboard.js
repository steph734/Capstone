// Everything the Super Admin dashboard shows, computed from real data in one
// pass: branches / appointments / users / game_sessions / audit trails in
// MongoDB, subscribers from Stripe (the only place subscriptions live),
// subscription revenue from the `payments` collection.
import { getStripeClient } from './stripeClient.js'
import { PRICE_IDS } from './createSubscription.js'
import { getStreamServerClient } from './stream/serverClient.js'
import { loadBranchStats, normalizeStatus } from './adminBranches.js'

const DAY = 24 * 60 * 60 * 1000
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000 // Philippines (UTC+8); no DST
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "YYYY-MM-DD" of an instant, as seen in the Philippines.
const manilaDay = (d) => new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10)
const dayStart = (ymd) => new Date(`${ymd}T00:00:00+08:00`)
const dayEnd = (ymd) => new Date(`${ymd}T23:59:59.999+08:00`)

export function parseRange(q) {
  const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(dayStart(v).getTime())
  const toDay = ok(q.to) ? q.to : manilaDay(new Date())
  const fromDay = ok(q.from) ? q.from : manilaDay(new Date(dayStart(toDay).getTime() - 29 * DAY))
  if (fromDay > toDay) return { error: 'The start date must be on or before the end date.' }
  const start = dayStart(fromDay)
  const end = dayEnd(toDay)
  const days = Math.round((end - start) / DAY)
  if (days > 366) return { error: 'Choose a range of one year or less.' }
  return { fromDay, toDay, start, end, days, prevStart: new Date(start.getTime() - days * DAY), prevEnd: new Date(start.getTime() - 1) }
}

const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null)

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
])

// ── Stripe subscribers ─────────────────────────────────────────────────────
const PLAN_BY_PRICE = Object.fromEntries(
  Object.entries(PRICE_IDS).flatMap(([slug, periods]) => Object.values(periods).map((id) => [id, slug]))
)
const planOf = (sub) => {
  const price = sub.items?.data?.[0]?.price
  return PLAN_BY_PRICE[price?.id] || (price?.nickname ? String(price.nickname).toLowerCase() : 'other')
}
const planLabel = (slug) => (slug === 'other' ? 'Other' : slug.charAt(0).toUpperCase() + slug.slice(1))

async function loadSubscriptions() {
  try {
    const stripe = getStripeClient()
    const subs = []
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      if (s.status !== 'incomplete' && s.status !== 'incomplete_expired') subs.push(s)
      if (subs.length >= 3000) break
    }
    return subs
  } catch (err) {
    console.error('dashboard: stripe subscriptions unavailable:', err.message)
    return null
  }
}

const activeAt = (subs, t) => subs.filter((s) => s.created * 1000 <= t && !(s.ended_at && s.ended_at * 1000 <= t)).length
const periodEnd = (s) => (s.cancel_at || s.current_period_end || s.items?.data?.[0]?.current_period_end || 0) * 1000

// ── Chart buckets ──────────────────────────────────────────────────────────
function buildBuckets(kind, start, end) {
  const out = []
  if (kind === 'monthly') {
    const s = new Date(start.getTime() + TZ_OFFSET_MS)
    let y = s.getUTCFullYear()
    let m = s.getUTCMonth()
    for (;;) {
      const from = new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS)
      if (from > end) break
      const to = new Date(Date.UTC(y, m + 1, 1) - TZ_OFFSET_MS - 1)
      out.push({ label: MONTHS[m], from, to: to < end ? to : end })
      m += 1
      if (m > 11) { m = 0; y += 1 }
    }
    return out
  }
  // Weeks start on Monday.
  const s = new Date(start.getTime() + TZ_OFFSET_MS)
  const monday = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - ((s.getUTCDay() + 6) % 7)) - TZ_OFFSET_MS
  for (let from = monday; from <= end.getTime(); from += 7 * DAY) {
    const d = new Date(from + TZ_OFFSET_MS)
    out.push({ label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, from: new Date(from), to: new Date(Math.min(from + 7 * DAY - 1, end.getTime())) })
  }
  return out
}

function buildSeries(kind, range, subs, payments) {
  // Trend context: never show fewer than 6 months / 8 weeks, whatever the range.
  const minStart = new Date(range.end.getTime() - (kind === 'monthly' ? 180 : 56) * DAY)
  const start = range.start < minStart ? range.start : minStart
  return buildBuckets(kind, start, range.end).map((b) => ({
    label: b.label,
    subscribers: subs ? activeAt(subs, b.to.getTime()) : null,
    revenue: Math.round(payments.filter((p) => p.at >= b.from && p.at <= b.to).reduce((n, p) => n + p.amount, 0) * 100) / 100,
  }))
}

// ── Audit-trail presentation ───────────────────────────────────────────────
const NOTE_VERBS = { view: 'viewed a SOAP note', sign: 'signed a SOAP note', create: 'created a SOAP note', edit: 'edited a SOAP note', addendum: 'added an addendum to a SOAP note', share: 'shared a SOAP note', unshare: 'stopped sharing a SOAP note', void: 'voided a SOAP note', archive: 'archived a SOAP note', accept: 'accepted a shared SOAP note', withdraw: 'withdrew a SOAP note', denied: 'was denied access to a SOAP note' }
function activityKind(action) {
  if (/lock|failed/.test(action)) return 'security'
  if (action.startsWith('branch_')) return 'branch'
  if (action in NOTE_VERBS) return 'note'
  if (/subscription|plan|payment/.test(action)) return 'billing'
  if (/game/.test(action)) return 'game'
  return 'other'
}

async function loadRecentActivity(db, range) {
  const q = { created_at: { $gte: range.start, $lte: range.end } }
  const [legacy, trail] = await Promise.all([
    db.collection('auditlogs').find(q).sort({ created_at: -1 }).limit(5).toArray(),
    // Branch actions are mirrored into `auditlogs`, so skip them here.
    db.collection('audit_logs').find({ ...q, action: { $not: /^branch_/ } }).sort({ created_at: -1 }).limit(5).toArray(),
  ])
  const ids = [...new Set([...legacy, ...trail].map((r) => r.user_id).filter(Boolean).map(String))]
  const { ObjectId } = await import('mongodb')
  const users = ids.length
    ? await db.collection('users').find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }, { projection: { full_name: 1, role: 1 } }).toArray()
    : []
  const who = new Map(users.map((u) => [String(u._id), u]))
  const rows = [
    ...legacy.map((r) => ({ id: String(r._id), action: r.action, text: r.description, user: who.get(String(r.user_id)), at: r.created_at })),
    ...trail.map((r) => {
      const u = who.get(String(r.user_id))
      return { id: String(r._id), action: r.action, text: `${u?.full_name || 'A user'} ${NOTE_VERBS[r.action] || r.action}`, user: u, at: r.created_at }
    }),
  ]
  return rows.sort((a, b) => b.at - a.at).slice(0, 5).map((r) => ({
    id: r.id, kind: activityKind(r.action), text: r.text, role: r.user?.role || 'System', at: r.at,
  }))
}

// ── System health ──────────────────────────────────────────────────────────
async function timed(fn, { slowMs = 2000, timeoutMs = 5000, label }) {
  const t0 = Date.now()
  try {
    const detail = await withTimeout(fn(), timeoutMs, label)
    const ms = Date.now() - t0
    return { status: ms > slowMs ? 'degraded' : 'online', ms, detail: typeof detail === 'string' ? detail : '' }
  } catch (err) {
    return { status: err.degraded ? 'degraded' : 'offline', ms: Date.now() - t0, detail: err.message }
  }
}

async function checkHealth(db) {
  const [database, stream, email] = await Promise.all([
    timed(() => db.command({ ping: 1 }), { label: 'Database', slowMs: 3000 }),
    timed(async () => { await getStreamServerClient().getAppSettings() }, { label: 'Stream' }),
    timed(async () => {
      const key = String(process.env.BREVO_API_KEY || '').trim().replace(/^["']|["']$/g, '')
      if (!key) throw new Error('Email provider is not configured.')
      const res = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': key, accept: 'application/json' } })
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`Email provider returned ${res.status}.`), { degraded: true })
      if (!res.ok) throw new Error(`Email provider rejected the API key (${res.status}).`)
    }, { label: 'Email provider' }),
  ])
  const lastBackup = process.env.LAST_BACKUP_AT ? new Date(process.env.LAST_BACKUP_AT) : null
  return {
    checkedAt: new Date(),
    services: [
      { key: 'api', label: 'API server', status: 'online', ms: 0, detail: '' },
      { key: 'db', label: 'Database', ...database },
      { key: 'stream', label: 'Video & chat (Stream)', ...stream },
      { key: 'email', label: 'Email delivery', ...email },
    ],
    lastBackup: lastBackup && !Number.isNaN(lastBackup.getTime()) ? lastBackup : null,
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
export async function buildDashboard(db, range) {
  const now = new Date()
  const todayStart = dayStart(manilaDay(now))
  const [branchRows, subs, payRows, lockedAccounts, repeatedFailed, pendingRequests, gameDocs, draftGames, topRaw, recent, health, branchStats] = await Promise.all([
    db.collection('branchs').find({}).toArray(),
    loadSubscriptions(),
    db.collection('payments').find(
      { payment_for: 'subscription', status: 'completed', payment_date: { $gte: new Date(range.end.getTime() - 400 * DAY), $lte: range.end } },
      { projection: { amount: 1, payment_date: 1 } }
    ).toArray(),
    db.collection('users').countDocuments({ is_locked: true, lock_until: { $gt: now } }),
    db.collection('users').countDocuments({ is_locked: { $ne: true }, failed_login_attempts: { $gte: 3 }, last_login_attempt: { $gte: todayStart } }),
    db.collection('game_requests').find({ status: 'pending' }, { projection: { created_at: 1 } }).sort({ created_at: 1 }).toArray(),
    db.collection('games').find({ status: { $ne: 'archived' } }, { projection: { updated_at: 1, created_at: 1 } }).toArray(),
    db.collection('games').countDocuments({ status: 'draft' }),
    db.collection('game_sessions').aggregate([
      { $match: { status: 'completed', completed_at: { $gte: range.start, $lte: range.end } } },
      { $group: { _id: '$game_id', plays: { $sum: 1 }, correct: { $sum: { $ifNull: ['$result.correct', 0] } }, attempts: { $sum: { $ifNull: ['$result.attempts', 0] } } } },
      { $sort: { plays: -1 } },
      { $limit: 4 },
    ]).toArray(),
    loadRecentActivity(db, range),
    checkHealth(db),
    loadBranchStats(db, { from: range.fromDay, to: range.toDay }),
  ])

  const payments = payRows.map((p) => ({ amount: Number(p.amount) || 0, at: new Date(p.payment_date) }))
  const revenueIn = (a, b) => payments.filter((p) => p.at >= a && p.at <= b).reduce((n, p) => n + p.amount, 0)
  const revenue = revenueIn(range.start, range.end)
  const prevRevenue = revenueIn(range.prevStart, range.prevEnd)

  // Branches (same definitions as the Branches page: archived ones are left out).
  const live = branchRows.filter((b) => normalizeStatus(b.status) !== 'Archived')
  const byStatus = (s) => live.filter((b) => normalizeStatus(b.status) === s)
  const performance = [...byStatus('Active'), ...byStatus('Under review')].map((b) => {
    const st = branchStats.get(String(b._id))
    const therapists = st?.therapists || 0
    return {
      id: String(b._id), name: b.branch_name, status: normalizeStatus(b.status), therapists,
      sessions: st?.sessions || 0, capacity: b.therapist_capacity ?? null,
      capacityPct: b.therapist_capacity ? Math.min(100, Math.round((therapists / b.therapist_capacity) * 100)) : null,
    }
  }).sort((a, b) => b.therapists - a.therapists || a.name.localeCompare(b.name)).slice(0, 8)

  // Subscribers + plans (null when Stripe can't be reached; the UI says so).
  const activeNow = subs ? activeAt(subs, Math.min(range.end.getTime(), now.getTime())) : null
  const activePrev = subs ? activeAt(subs, range.prevEnd.getTime()) : null
  const activeSubs = subs ? subs.filter((s) => !s.ended_at) : []
  const planCounts = {}
  for (const s of activeSubs) planCounts[planOf(s)] = (planCounts[planOf(s)] || 0) + 1
  const planTotal = Object.values(planCounts).reduce((n, c) => n + c, 0)
  const plans = Object.entries(planCounts).sort((a, b) => b[1] - a[1]).map(([slug, count]) => ({
    key: slug, label: planLabel(slug), count, pct: planTotal ? Math.round((count / planTotal) * 100) : 0,
  }))
  const expiring = subs
    ? activeSubs.filter((s) => s.cancel_at_period_end && periodEnd(s) > now.getTime() && periodEnd(s) <= now.getTime() + 7 * DAY).length
    : 0

  // Games.
  const updatedInRange = gameDocs.filter((g) => {
    const t = new Date(g.updated_at || g.created_at || 0)
    return t >= range.start && t <= range.end
  }).length
  const topIds = topRaw.map((t) => t._id)
  const topGames = topIds.length ? await db.collection('games').find({ _id: { $in: topIds } }, { projection: { name: 1, status: 1 } }).toArray() : []
  const gameById = new Map(topGames.map((g) => [String(g._id), g]))
  const topPlays = topRaw[0]?.plays || 0
  const top = topRaw.map((t) => ({
    id: String(t._id),
    name: gameById.get(String(t._id))?.name || 'Deleted game',
    status: gameById.get(String(t._id))?.status || 'archived',
    plays: t.plays,
    playsPct: topPlays ? Math.round((t.plays / topPlays) * 100) : 0,
    accuracy: t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : null,
  }))

  const alerts = lockedAccounts + repeatedFailed
  const oldest = pendingRequests[0]?.created_at
  const attention = [
    { key: 'branches', count: byStatus('Under review').length, title: (n) => `${n} branch application${n === 1 ? '' : 's'}`, detail: byStatus('Under review').slice(0, 2).map((b) => b.branch_name).join(', '), action: 'Review', to: '/admin/branches?status=review' },
    { key: 'requests', count: pendingRequests.length, title: (n) => `${n} game request${n === 1 ? '' : 's'}`, detail: oldest ? `Oldest waiting ${Math.max(0, Math.floor((now - new Date(oldest)) / DAY))} days` : '', action: 'Open', to: '/admin/games-library/games' },
    { key: 'locked', count: lockedAccounts, title: (n) => `${n} locked account${n === 1 ? '' : 's'}`, detail: 'Locked after repeated failed sign-ins', action: 'View', to: '/admin/audit-logs?filter=security' },
    { key: 'expiring', count: expiring, title: (n) => `${n} subscription${n === 1 ? '' : 's'} expiring`, detail: 'Within the next 7 days', action: 'View', to: '/admin/subscription' },
    { key: 'drafts', count: draftGames, title: (n) => `${n} draft game${n === 1 ? '' : 's'}`, detail: 'Not yet published', action: 'Open', to: '/admin/games-library/games' },
  ].filter((a) => a.count > 0).map((a) => ({ key: a.key, count: a.count, title: a.title(a.count), detail: a.detail, action: a.action, to: a.to }))

  return {
    range: { from: range.fromDay, to: range.toDay, days: range.days },
    generatedAt: now,
    subscribersAvailable: Boolean(subs),
    stats: {
      branches: { total: live.length, active: byStatus('Active').length, review: byStatus('Under review').length },
      subscribers: { value: activeNow, changePct: subs ? pctChange(activeNow, activePrev) : null },
      revenue: { value: Math.round(revenue * 100) / 100, changePct: pctChange(revenue, prevRevenue) },
      games: { total: gameDocs.length, updated: updatedInRange },
      security: { alerts, locked: lockedAccounts, repeatedFailed },
    },
    series: { weekly: buildSeries('weekly', range, subs, payments), monthly: buildSeries('monthly', range, subs, payments) },
    attention,
    branches: performance,
    plans: { total: planTotal, items: plans },
    health,
    recent,
    topGames: top,
  }
}
