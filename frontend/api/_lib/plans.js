// Subscription plans for the Super Admin. Plans live in the `subscription`
// collection (validated by its $jsonSchema: Decimal128 price, int32 counts,
// string[] features), with a few extra fields the validator allows
// (status, limits, icon, color, feature_keys, price_versions, beta_testers).
// Features are shared in `plan_features`. Subscribers live in Stripe;
// accounts and payments live in MongoDB.
import { Decimal128, Int32, ObjectId } from 'mongodb'
import { getStripeClient } from './stripeClient.js'
import { PRICE_IDS } from './createSubscription.js'

const DAY = 24 * 60 * 60 * 1000
export const ICONS = ['sprout', 'medal', 'crown', 'gem', 'rocket', 'shield', 'heart']
export const COLORS = ['#1fa37a', '#3b82c4', '#e0a526', '#7c5ce0', '#e0508f', '#5b6b66']
export const STATUSES = ['live', 'beta', 'hidden']
const DEFAULT_LOOK = {
  free: { icon: 'sprout', color: COLORS[0] },
  silver: { icon: 'medal', color: COLORS[1] },
  gold: { icon: 'crown', color: COLORS[2] },
}
const ACCOUNT_ROLES = ['Owner', 'Therapist', 'Patient']

export const str = (v) => (v == null ? '' : String(v).trim())
export const num = (d) => (d == null ? null : Number(d.toString()))
export const slugify = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
const money = (n) => Decimal128.fromString(Number(n).toFixed(2))
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(v))

export function planName(doc) {
  if (doc.name) return doc.name
  const raw = str(doc.tier_name).replace(/^therapypro:\s*/i, '')
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'Plan'
}

// ── Features ───────────────────────────────────────────────────────────────
// First access seeds `plan_features` from the labels the existing plans
// already list (so nothing is invented), then backfills `feature_keys`.
export async function loadPlansAndFeatures(db) {
  const featCol = db.collection('plan_features')
  const planCol = db.collection('subscription')
  let plans = await planCol.find({}).sort({ sort_order: 1, created_at: 1 }).toArray()

  if (!(await featCol.estimatedDocumentCount())) {
    await featCol.createIndex({ key: 1 }, { unique: true }).catch(() => {})
    const seen = new Map()
    plans.forEach((p, i) => {
      for (const label of p.features || []) {
        const key = slugify(label)
        if (key && !seen.has(key)) seen.set(key, { key, label, min_tier: i === 0 ? 'all' : p.slug || slugify(planName(p)), order: seen.size, is_custom: false, created_at: new Date() })
      }
    })
    if (seen.size) await featCol.insertMany([...seen.values()], { ordered: false }).catch(() => {})
  }
  let features = await featCol.find({}).sort({ order: 1, created_at: 1 }).toArray()

  const known = new Set(features.map((f) => f.key))
  for (const p of plans) {
    if (Array.isArray(p.feature_keys)) continue
    const keys = []
    for (const label of p.features || []) {
      const key = slugify(label)
      if (!key) continue
      if (!known.has(key)) {
        await featCol.insertOne({ key, label, min_tier: null, order: features.length, is_custom: true, created_at: new Date() }).catch(() => {})
        known.add(key)
        features = await featCol.find({}).sort({ order: 1, created_at: 1 }).toArray()
      }
      keys.push(key)
    }
    p.feature_keys = keys
    await planCol.updateOne({ _id: p._id }, { $set: { feature_keys: keys } })
  }
  plans = plans.filter(Boolean)
  return { plans, features }
}

export const serializeFeature = (f) => ({ id: String(f._id), key: f.key, label: f.label, minTier: f.min_tier || null, custom: Boolean(f.is_custom) })

// ── Validation ─────────────────────────────────────────────────────────────
function parseLimit(v, label, fields, key) {
  if (v === null || v === undefined || v === '' || v === 'unlimited') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 100000) { fields[key] = `${label} must be a whole number from 1 to 100000, or unlimited.`; return null }
  return n
}

export function validatePlanInput(body, { featureKeys, takenNames, forceStatus }) {
  const fields = {}
  const name = str(body.name)
  if (!name) fields.name = 'Plan name is required.'
  else if (name.length > 30) fields.name = 'Keep the name to 30 characters.'
  else if (takenNames.has(name.toLowerCase())) fields.name = 'A plan with this name already exists.'

  const tagline = str(body.tagline)
  if (tagline.length > 60) fields.tagline = 'Keep the tagline to 60 characters.'

  const price = body.priceMonthly === '' || body.priceMonthly == null ? NaN : Number(body.priceMonthly)
  if (Number.isNaN(price)) fields.priceMonthly = 'Monthly price is required.'
  else if (price < 0 || price > 1000000) fields.priceMonthly = 'Enter a price of ₱0 or more.'

  let yearly = null
  if (body.priceYearly !== '' && body.priceYearly != null) {
    yearly = Number(body.priceYearly)
    if (Number.isNaN(yearly) || yearly < 0 || yearly > 12000000) { fields.priceYearly = 'Enter a yearly price of ₱0 or more.'; yearly = null }
  }

  const trial = body.trialDays === '' || body.trialDays == null ? 0 : Number(body.trialDays)
  if (!Number.isInteger(trial) || trial < 0 || trial > 60) fields.trialDays = 'Free trial must be 0 to 60 days.'

  const status = forceStatus || str(body.status) || 'live'
  if (!STATUSES.includes(status)) fields.status = 'Choose Live, Beta or Hidden.'

  const lim = body.limits || {}
  const limits = {
    branches: parseLimit(lim.branches, 'Branches', fields, 'limits.branches'),
    therapists: parseLimit(lim.therapists, 'Therapists', fields, 'limits.therapists'),
    patients: parseLimit(lim.patients, 'Patients', fields, 'limits.patients'),
  }

  const icon = str(body.icon) || 'rocket'
  if (!ICONS.includes(icon)) fields.icon = 'Choose an icon from the list.'
  const color = str(body.color) || COLORS[0]
  if (!COLORS.includes(color)) fields.color = 'Choose a color from the list.'

  const keys = Array.isArray(body.featureKeys) ? [...new Set(body.featureKeys.map(str))] : []
  if (keys.some((k) => !featureKeys.has(k))) fields.featureKeys = 'One of the selected features no longer exists.'

  return {
    fields,
    value: { name, tagline, priceMonthly: price, priceYearly: yearly, trialDays: trial, status, limits, icon, color, featureKeys: keys },
  }
}

const limitDoc = (l) => ({
  branches: l.branches == null ? null : new Int32(l.branches),
  therapists: l.therapists == null ? null : new Int32(l.therapists),
  patients: l.patients == null ? null : new Int32(l.patients),
})

// Fields shared by create and edit, shaped for the collection's validator.
export function planFields(v, featureLabels) {
  return {
    name: v.name,
    tier_name: `THERAPYPRO: ${v.name.toUpperCase()}`,
    description: v.tagline,
    price: money(v.priceMonthly),
    trial_period_days: new Int32(v.trialDays),
    features: featureLabels,
    feature_keys: v.featureKeys,
    is_active: v.status !== 'hidden',
    status: v.status,
    limits: limitDoc(v.limits),
    icon: v.icon,
    color: v.color,
    updated_at: new Date(),
  }
}

export async function uniqueSlug(db, name) {
  const base = slugify(name) || 'plan'
  let slug = base
  for (let n = 2; await db.collection('subscription').findOne({ slug }, { projection: { _id: 1 } }); n += 1) slug = `${base}_${n}`
  return slug
}

// A new Stripe Price per price change: existing subscriptions keep the Price
// they were created with, so a change only reaches new subscribers (and
// renewals of subscriptions moved onto the new Price).
export async function createStripePrice({ plan, name, amount }) {
  if (!process.env.STRIPE_SECRET_KEY || !(amount > 0)) return {}
  try {
    const stripe = getStripeClient()
    let productId = plan?.stripe_product_id
    if (!productId) productId = (await stripe.products.create({ name: `TherapyPro ${name}`, metadata: { slug: plan?.slug || '' } })).id
    const price = await stripe.prices.create({ product: productId, currency: 'php', unit_amount: Math.round(amount * 100), recurring: { interval: 'month' } })
    return { productId, priceId: price.id }
  } catch (err) {
    console.error('stripe price create failed:', err.message)
    return { warning: `The plan was saved, but its Stripe price could not be created (${err.message}). New subscribers keep paying the previous price until it is.` }
  }
}

// ── Subscribers / revenue (Stripe + accounts) ──────────────────────────────
export async function loadSubscriptions() {
  try {
    const stripe = getStripeClient()
    const subs = []
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] })) {
      if (s.status !== 'incomplete' && s.status !== 'incomplete_expired') subs.push(s)
      if (subs.length >= 3000) break
    }
    return subs
  } catch (err) {
    console.error('plans: stripe subscriptions unavailable:', err.message)
    return null
  }
}

export async function loadAccounts(db) {
  const rows = await db.collection('users')
    .find({ role: { $in: ACCOUNT_ROLES }, is_archived: { $ne: true } }, { projection: { full_name: 1, email: 1, role: 1, created_at: 1 } }).toArray()
  return rows.map((u) => ({ name: u.full_name, email: str(u.email).toLowerCase(), role: u.role, createdAt: u.created_at ? new Date(u.created_at) : new Date(0) }))
}
export const accountsAt = (accounts, t) => accounts.filter((a) => a.createdAt.getTime() <= t).length

export const isLive = (s) => !s.ended_at && ['active', 'trialing', 'past_due'].includes(s.status)
export const activeAt = (subs, t) => subs.filter((s) => s.created * 1000 <= t && !(s.ended_at && s.ended_at * 1000 <= t))

export function monthlyAmount(sub) {
  let total = 0
  for (const item of sub.items?.data || []) {
    const p = item.price
    if (!p?.unit_amount) continue
    const per = p.recurring?.interval === 'year' ? 12 : p.recurring?.interval === 'week' ? 0.23 : 1
    total += (p.unit_amount / 100) * (item.quantity || 1) / per
  }
  return total
}
const periodEnd = (s) => (s.cancel_at || s.current_period_end || s.items?.data?.[0]?.current_period_end || 0) * 1000
const customerOf = (s) => (s.customer && typeof s.customer === 'object' ? s.customer : null)

function priceMap(plans) {
  const m = new Map()
  for (const p of plans) {
    for (const v of p.price_versions || []) if (v.stripe_price_id) m.set(v.stripe_price_id, p)
    for (const id of Object.values(PRICE_IDS[p.slug] || {})) if (!m.has(id)) m.set(id, p)
  }
  return m
}
const planOfSub = (map, sub) => map.get(sub.items?.data?.[0]?.price?.id) || null

// Per-plan subscribers + monthly revenue, plus the headline stats.
export function planBreakdown(plans, subs, accounts) {
  const map = priceMap(plans)
  const now = Date.now()
  const live = subs ? subs.filter(isLive) : null
  const stats = new Map(plans.map((p) => [String(p._id), { subscribers: subs ? 0 : null, mrr: subs ? 0 : null }]))
  let paidEmails = new Set()
  if (live) {
    for (const s of live) {
      const p = planOfSub(map, s)
      if (p) { const st = stats.get(String(p._id)); st.subscribers += 1; st.mrr += monthlyAmount(s) }
      const e = str(customerOf(s)?.email).toLowerCase()
      if (e) paidEmails.add(e)
    }
    const free = plans.find((p) => num(p.price) === 0)
    if (free) stats.get(String(free._id)).subscribers = accounts.filter((a) => !paidEmails.has(a.email)).length
  }
  const mrrAt = (t) => activeAt(subs, t).reduce((n, s) => n + monthlyAmount(s), 0)
  return {
    stats,
    live,
    map,
    mrr: subs ? Math.round(live.reduce((n, s) => n + monthlyAmount(s), 0)) : null,
    mrrChange: subs ? Math.round(live.reduce((n, s) => n + monthlyAmount(s), 0) - mrrAt(now - 30 * DAY)) : null,
    subscribers: accounts.length,
    subscribersPrev: accountsAt(accounts, now - 30 * DAY),
    subscribersChangePct: (() => { const prev = accountsAt(accounts, now - 30 * DAY); return prev > 0 ? Math.round(((accounts.length - prev) / prev) * 1000) / 10 : null })(),
  }
}

export function serializePlan(doc, { st, popularId }) {
  const slug = doc.slug || slugify(planName(doc))
  const look = DEFAULT_LOOK[slug] || { icon: 'rocket', color: COLORS[0] }
  const status = doc.status || (doc.is_active === false ? 'hidden' : 'live')
  const lim = doc.limits || {}
  return {
    id: String(doc._id),
    slug,
    name: planName(doc),
    tagline: doc.description || '',
    priceMonthly: num(doc.price) ?? 0,
    priceYearly: num(doc.price_yearly),
    trialDays: Number(doc.trial_period_days) || 0,
    status,
    limits: { branches: lim.branches ?? null, therapists: lim.therapists ?? null, patients: lim.patients ?? null },
    icon: doc.icon || look.icon,
    color: doc.color || look.color,
    featureKeys: doc.feature_keys || [],
    order: Number(doc.sort_order) || 0,
    betaTesters: doc.beta_testers || [],
    subscribers: st?.subscribers ?? null,
    revenue: st?.mrr == null ? null : Math.round(st.mrr),
    mostPopular: popularId === String(doc._id),
  }
}

// ── Recent changes (Stripe events) ─────────────────────────────────────────
export async function loadChanges(plans, live, map) {
  const out = []
  const now = Date.now()
  if (live) {
    const due = live.filter((s) => !s.cancel_at_period_end && periodEnd(s) > now && periodEnd(s) <= now + 7 * DAY)
    const failed = live.filter((s) => s.status === 'past_due').length
    if (due.length || failed) {
      out.push({
        kind: 'warning', title: `${due.length} subscription${due.length === 1 ? '' : 's'} renew in 7 days`,
        detail: failed ? `${failed} ${failed === 1 ? 'has a' : 'have a'} failed payment` : 'No payment problems', amount: null, at: null, action: 'subscribers',
      })
    }
  }
  try {
    const stripe = getStripeClient()
    const evts = await stripe.events.list({
      limit: 100,
      types: ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed'],
    })
    const planByPrice = (id) => map.get(id)
    const rows = []
    for (const e of evts.data) {
      const o = e.data.object
      const at = new Date(e.created * 1000)
      if (e.type === 'customer.subscription.created') {
        rows.push({ kind: 'new', customer: o.customer, plan: planOfSub(map, o), amount: monthlyAmount(o), at, title: (p) => `New ${p || 'paid'} subscriber` })
      } else if (e.type === 'customer.subscription.updated') {
        const prev = e.data.previous_attributes?.items?.data?.[0]?.price
        if (!prev) continue
        const prevAmount = (prev.unit_amount || 0) / 100
        const nowAmount = monthlyAmount(o)
        if (nowAmount === prevAmount) continue
        rows.push({ kind: nowAmount > prevAmount ? 'upgrade' : 'downgrade', customer: o.customer, plan: planOfSub(map, o), from: planByPrice(prev.id), amount: nowAmount - prevAmount, at })
      } else if (e.type === 'customer.subscription.deleted') {
        const d = o.cancellation_details || {}
        const reason = d.comment || d.feedback || d.reason
        rows.push({ kind: 'cancel', customer: o.customer, plan: planOfSub(map, o), amount: -monthlyAmount(o), reason: reason && reason !== 'cancellation_requested' ? String(reason).replace(/_/g, ' ') : '', at })
      } else if (e.type === 'invoice.payment_failed') {
        rows.push({ kind: 'warning', customer: o.customer, plan: null, amount: null, at, failed: true })
      }
      if (rows.length >= 5) break
    }
    const need = [...new Set(rows.map((r) => (typeof r.customer === 'string' ? r.customer : r.customer?.id)).filter(Boolean))]
    const names = new Map()
    await Promise.all(need.slice(0, 8).map(async (id) => {
      try {
        const c = await stripe.customers.retrieve(id)
        if (!c.deleted) names.set(id, c.name || c.email || 'A subscriber')
      } catch { /* customer gone */ }
    }))
    const day = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    for (const r of rows) {
      const who = names.get(typeof r.customer === 'string' ? r.customer : r.customer?.id) || 'A subscriber'
      const pn = r.plan ? planName(r.plan) : ''
      if (r.kind === 'new') out.push({ kind: 'new', title: `New ${pn || 'paid'} subscriber`, detail: `${who} · ${day(r.at)}`, amount: r.amount, at: r.at })
      else if (r.kind === 'upgrade') out.push({ kind: 'upgrade', title: `${who} upgraded${pn ? ` to ${pn}` : ''}`, detail: `${r.from ? `From ${planName(r.from)} · ` : ''}${day(r.at)}`, amount: r.amount, at: r.at })
      else if (r.kind === 'downgrade') out.push({ kind: 'downgrade', title: `${who} downgraded${pn ? ` to ${pn}` : ''}`, detail: `${r.from ? `From ${planName(r.from)} · ` : ''}${day(r.at)}`, amount: r.amount, at: r.at })
      else if (r.kind === 'cancel') out.push({ kind: 'cancel', title: `${who} cancelled`, detail: `${pn ? `${pn} · ` : ''}${r.reason ? `reason: "${r.reason}" · ` : ''}${day(r.at)}`, amount: r.amount, at: r.at })
      else out.push({ kind: 'warning', title: 'Payment failed', detail: `${who} · ${day(r.at)}`, amount: null, at: r.at })
    }
  } catch (err) {
    console.error('plans: stripe events unavailable:', err.message)
  }
  return out.slice(0, 5)
}

// ── Subscriber list (drawer + CSV) ─────────────────────────────────────────
export function buildSubscriberList(plans, subs, accounts, planSlug) {
  const map = priceMap(plans)
  const free = plans.find((p) => num(p.price) === 0)
  const rows = []
  const paidEmails = new Set()
  for (const s of (subs || []).filter(isLive)) {
    const c = customerOf(s)
    const p = planOfSub(map, s)
    const email = str(c?.email).toLowerCase()
    if (email) paidEmails.add(email)
    rows.push({
      name: c?.name || c?.email || 'Subscriber', email: c?.email || '', plan: p ? planName(p) : 'Other', slug: p?.slug || '',
      status: s.cancel_at_period_end ? 'cancelling' : s.status, since: new Date(s.created * 1000), renews: periodEnd(s) ? new Date(periodEnd(s)) : null, monthly: Math.round(monthlyAmount(s) * 100) / 100,
    })
  }
  if (subs && free) {
    for (const a of accounts) {
      if (!paidEmails.has(a.email)) rows.push({ name: a.name, email: a.email, plan: planName(free), slug: free.slug, status: 'free', since: a.createdAt, renews: null, monthly: 0 })
    }
  }
  const filtered = planSlug ? rows.filter((r) => r.slug === planSlug) : rows
  return filtered.sort((a, b) => b.since - a.since)
}

export function csvCell(v) {
  let s = v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export { ObjectId, isEmail, money }

// Emails with an active paid Silver or Gold subscription (used by the voice-log plan check).
export function paidTierEmails(plans, subs) {
  const map = priceMap(plans)
  const out = new Set()
  for (const s of (subs || []).filter(isLive)) {
    const p = planOfSub(map, s)
    const email = str(customerOf(s)?.email).toLowerCase()
    if (p && email && ['silver', 'gold'].includes(p.slug)) out.add(email)
  }
  return out
}
