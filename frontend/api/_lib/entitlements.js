// SINGLE SOURCE OF TRUTH for "what plan is this clinic on, and what may its users do".
// Used by every role (Owner, Therapist, Staff, Patient) and every gated feature.
//
//   resolveClinicPlan(db)     -> the clinic's current plan (one subscription, paid by the Owner)
//   getEntitlements(db, user) -> { clinic_id, plan_key, plan_name, tier_rank, features, status, renews_at, is_trial, source }
//   requireFeature(key)       -> Express middleware, 403 FEATURE_NOT_IN_PLAN
//
// Where the data lives: the clinic's subscription is ONE embedded record, `clinic_settings` (_id 'clinic') .subscription:
//   { plan_key, billing_period, status, owner_id, stripe_subscription_id?, current_period_start, current_period_end,
//     price_snapshot (centavos), trial_ends_at?, past_due_since?, checked_at }
// The plan is NEVER stored on user / patient documents and never put in the JWT. TherapyPro has a single clinic: every
// branch, therapist and patient belongs to it, so the clinic id is always 'clinic' (see clinicIdFor).
import { getStripeClient } from './stripeClient.js'
import { loadPlansAndFeatures, loadSubscriptions, paidTierEmails, planName, str } from './plans.js'

export const CLINIC_ID = 'clinic'
const DAY = 24 * 60 * 60 * 1000
const STRIPE_TTL = 30 * 1000 // how stale the cached Stripe status may be before the next request refreshes it
const LEGACY_TTL = 2 * 60 * 1000

// Plan feature keys saved before the catalog was fixed -> the canonical keys used everywhere else.
const CANON = { soap_notes_documentation: 'soap_notes', note_taking_tools: 'note_taking', voice_assisted_speech_to_text: 'voice_to_text', gamified_interactive_exercises: 'gamified_exercises' }
export const canonFeature = (k) => CANON[k] || k

export const graceDays = () => {
  const n = Number(process.env.PLAN_GRACE_DAYS ?? process.env.DEMO_RENEWAL_GRACE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : 3
}

// The clinic a user belongs to. Resolved on the server from the signed-in user, never from anything the client sends.
// Single-clinic deployment: Owner, Therapist, Staff and Patient/Guardian (whatever their branch) all map to 'clinic'.
// If clinics ever become separate, this is the ONE place to resolve user/patient -> branch -> clinic -> owner.
// eslint-disable-next-line no-unused-vars
export async function clinicIdFor(db, user) {
  return CLINIC_ID
}

const bySort = (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
const slugOf = (p) => p.slug || String(planName(p)).toLowerCase()

// ── the stored subscription record ───────────────────────────────────────────
const periodSeconds = (s, k) => s?.items?.data?.[0]?.[k] || s?.[k] || null
const toDate = (sec) => (sec ? new Date(sec * 1000) : null)

// Map a Stripe subscription onto the record's fields.
export function recordFromStripe(s, base = {}) {
  const status = ['active', 'trialing', 'past_due'].includes(s.status) ? s.status : s.status === 'canceled' || s.status === 'unpaid' || s.status === 'incomplete_expired' ? 'canceled' : s.status
  const item = s.items?.data?.[0]
  return {
    ...base,
    stripe_subscription_id: s.id,
    status,
    current_period_start: toDate(periodSeconds(s, 'current_period_start')) || base.current_period_start || null,
    current_period_end: toDate(periodSeconds(s, 'current_period_end')) || base.current_period_end || null,
    ...(item?.price?.unit_amount != null ? { price_snapshot: item.price.unit_amount } : {}), // centavos
    ...(item?.price?.recurring?.interval ? { billing_period: item.price.recurring.interval === 'year' ? 'yearly' : 'monthly' } : {}),
    checked_at: new Date(),
  }
}

async function readRecord(db) {
  const doc = await db.collection('clinic_settings').findOne({ _id: CLINIC_ID }, { projection: { subscription: 1, clinic_name: 1 } })
  return { sub: doc?.subscription || null, clinicName: doc?.clinic_name || 'your clinic' }
}

export async function writeRecord(db, sub) {
  await db.collection('clinic_settings').updateOne({ _id: CLINIC_ID }, { $set: { subscription: sub, updated_at: new Date() } }, { upsert: true })
}

// Refresh the Stripe-backed record when it is stale, so a cancellation, lapse or renewal reaches every user on their
// NEXT request (no re-login). Stripe unreachable -> keep the stored record as it is.
async function refreshFromStripe(db, sub) {
  if (!sub?.stripe_subscription_id || !process.env.STRIPE_SECRET_KEY) return sub
  if (sub.checked_at && Date.now() - new Date(sub.checked_at).getTime() < STRIPE_TTL) return sub
  try {
    const s = await getStripeClient().subscriptions.retrieve(sub.stripe_subscription_id, { expand: ['items.data.price'] })
    const next = recordFromStripe(s, sub)
    if (next.status === 'past_due' && !sub.past_due_since) next.past_due_since = new Date()
    if (next.status !== 'past_due') delete next.past_due_since
    await writeRecord(db, next)
    return next
  } catch (err) {
    console.error('entitlements: could not refresh the Stripe subscription:', err.message)
    return sub
  }
}

// Is this stored record currently granting its plan?
export function recordIsValid(sub, now = Date.now()) {
  if (!sub?.plan_key) return false
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null
  if (sub.status === 'trialing') return end == null || end > now
  if (sub.status === 'active') return end == null || end > now
  if (sub.status === 'past_due') { // grace period after a failed renewal
    const since = sub.past_due_since ? new Date(sub.past_due_since).getTime() : end || now
    return since + graceDays() * DAY > now
  }
  return false
}

// ── fallback for a clinic with NO stored record yet (older payments / beta testers) ─────────────────────────────
let legacyCache = { at: 0, slug: null, why: '' }
async function legacySlug(db, plans) {
  if (legacyCache.slug && Date.now() - legacyCache.at < LEGACY_TTL) return legacyCache
  const owners = (await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { email: 1 } }).toArray()).map((u) => str(u.email).toLowerCase())
  let slug = null
  let why = ''
  const rank = (p) => Number(p.sort_order) || 0
  const betaPlans = plans.filter((p) => (p.beta_testers || []).some((e) => owners.includes(str(e).toLowerCase()))).sort((a, b) => rank(b) - rank(a))
  if (betaPlans[0]) { slug = slugOf(betaPlans[0]); why = `The Owner is a beta tester of the ${slug} plan.` }
  const subs = await loadSubscriptions()
  if (subs) {
    for (const slg of ['gold', 'silver']) {
      if (slug === slg) break
      const group = plans.filter((p) => slugOf(p) === slg)
      if (owners.some((e) => paidTierEmails(group, subs).has(e))) { slug = slg; why = `The Owner has an active ${slg} subscription in Stripe (matched by email).`; break }
    }
  } else if (!slug) why = 'No subscription record yet, and Stripe could not be read.'
  legacyCache = { at: Date.now(), slug, why }
  return legacyCache
}

// ── the resolver ─────────────────────────────────────────────────────────────
// Returns { plan, plans, status, renews_at, is_trial, source, why, clinicName } where `plan` is the full plan document.
export async function resolveClinicPlan(db) {
  const { plans, features } = await loadPlansAndFeatures(db)
  const sorted = [...plans].sort(bySort)
  const free = sorted.find((p) => p.is_default === true || p.slug === 'free') || sorted[0]
  let { sub, clinicName } = await readRecord(db)
  if (sub?.stripe_subscription_id) sub = await refreshFromStripe(db, sub)

  let plan = null; let status = 'free'; let source = 'default'; let renews = null; let isTrial = false; let why = ''
  if (sub) {
    source = 'subscription'
    const valid = recordIsValid(sub)
    // Hidden / archived plans still apply to a clinic that is already subscribed: look through ALL plans, not only visible ones.
    const found = sorted.find((p) => slugOf(p) === String(sub.plan_key).toLowerCase())
    if (valid && found) { plan = found; status = sub.status; renews = sub.current_period_end || null; isTrial = sub.status === 'trialing' && !sub.stripe_subscription_id }
    else why = valid ? `Plan ${sub.plan_key} no longer exists.` : `The ${sub.plan_key} subscription is ${sub.status}.`
  } else {
    const leg = await legacySlug(db, sorted)
    if (leg.slug) { plan = sorted.find((p) => slugOf(p) === leg.slug) || null; if (plan) { source = 'legacy'; status = 'active'; why = leg.why } }
    else why = leg.why
  }
  // A Beta plan the Owner tests keeps applying even when the stored subscription is lower.
  const owners = (await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { email: 1 } }).toArray()).map((u) => str(u.email).toLowerCase())
  const beta = sorted.filter((p) => (p.beta_testers || []).some((e) => owners.includes(str(e).toLowerCase()))).sort((a, b) => bySort(b, a))[0]
  if (beta && (!plan || bySort(beta, plan) > 0)) { plan = beta; status = 'active'; source = 'beta'; why = `The Owner is a beta tester of ${planName(beta)}.` }

  if (!plan) plan = free
  return { plan, plans: sorted, features, status, renews_at: renews, is_trial: isTrial, source, why, clinicName }
}

// Features of the plan AND of every plan below it (sort_order <=): Gold automatically includes Free + Silver.
export function featuresOf(plan, sortedPlans) {
  const rank = Number(plan.sort_order) || 0
  const set = new Set()
  for (const p of sortedPlans) if ((Number(p.sort_order) || 0) <= rank) for (const k of p.feature_keys || []) set.add(canonFeature(k))
  return [...set]
}

export async function getEntitlements(db, user) {
  const clinicId = await clinicIdFor(db, user)
  const r = await resolveClinicPlan(db)
  return {
    clinic_id: clinicId,
    clinic_name: r.clinicName,
    plan_key: slugOf(r.plan).toUpperCase(),
    plan_name: planName(r.plan),
    tier_rank: Number(r.plan.sort_order) || 0,
    features: featuresOf(r.plan, r.plans),
    status: r.status,
    renews_at: r.renews_at,
    is_trial: r.is_trial,
    source: r.source,
    ...(r.why ? { why: r.why } : {}),
  }
}

export const hasFeature = (ent, key) => ent.features.includes(key)

// Lowest plan that includes a feature (for the 403 message).
export async function minimumPlanFor(db, key) {
  const { plans } = await loadPlansAndFeatures(db)
  const sorted = [...plans].sort(bySort)
  const p = sorted.find((x) => featuresOf(x, sorted).includes(key))
  return p ? planName(p) : null
}

// Express middleware for gated routes. Super Admin runs the platform and is not tied to a clinic plan.
export function requireFeature(key) {
  return async (req, res, next) => {
    try {
      const user = req.sessionCtx?.user
      if (!user) return res.status(401).json({ error: 'Please sign in again.', code: 'NO_SESSION' })
      if (user.role === 'Super Admin') return next()
      const db = req.sessionCtx.db
      const ent = await getEntitlements(db, user)
      if (hasFeature(ent, key)) return next()
      const required = await minimumPlanFor(db, key)
      return res.status(403).json({ error: `This feature needs the ${required || 'a higher'} plan. Ask your clinic's Owner to upgrade.`, code: 'FEATURE_NOT_IN_PLAN', feature: key, required_plan: required, plan_key: ent.plan_key })
    } catch (err) {
      console.error('requireFeature error:', err.message)
      return res.status(500).json({ error: 'Could not check the plan.' })
    }
  }
}

// Used by routes that need a yes/no without sending a response.
export async function clinicHasFeature(db, key) {
  const r = await resolveClinicPlan(db)
  return featuresOf(r.plan, r.plans).includes(key)
}

