// The clinic's plan for ANY signed-in user, plus the Owner's actions that change it.
//   GET  /api/me/entitlements              the caller's clinic plan + the feature list (always fresh)
//   GET  /api/me/subscription              { current, clinic_name, plans } for the Owner and Patient Subscription pages
//   POST /api/owner/subscription/confirm   Owner: record the Stripe subscription they just paid for as the clinic's plan
//   POST /api/owner/subscription/trial     Owner: start the free trial of a plan (once)
//   POST /api/owner/subscription/cancel    Owner: downgrade the clinic to Free
// The clinic id and plan are resolved on the server (see entitlements.js); nothing the client sends picks them.
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { getStripeClient } from '../stripeClient.js'
import { loadPlansAndFeatures, planName, num } from '../plans.js'
import { getEntitlements, recordFromStripe, writeRecord, CLINIC_ID } from '../entitlements.js'
import { listVisiblePlans } from './plans-public.js'

const DAY = 24 * 60 * 60 * 1000
const fail = (res, status, code, error) => res.status(status).json({ error, code })

function route(label, method, roles, fn) {
  return async (req, res) => {
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json({ error: 'Method not allowed' }) }
    try {
      await getMongo()
      const ctx = await requireSession(req, res, { idle: false })
      if (!ctx) return
      if (roles && !roles.includes(ctx.user.role)) return fail(res, 403, 'FORBIDDEN_ROLE', 'Only the clinic Owner can change the plan.')
      res.setHeader('Cache-Control', 'no-store')
      return await fn(ctx, req, res)
    } catch (err) {
      console.error(`${label}:`, err.message)
      return res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' })
    }
  }
}

export const entitlementsRoute = route('me entitlements', 'GET', null, async (ctx, req, res) => res.json(await getEntitlements(ctx.db, ctx.user)))

export const subscriptionRoute = route('me subscription', 'GET', null, async (ctx, req, res) => {
  const current = await getEntitlements(ctx.db, ctx.user)
  // The clinic's own plan is always listed, even if the Super Admin has since hidden it.
  const plans = await listVisiblePlans(ctx.db, ctx.user, current.plan_key.toLowerCase())
  return res.json({ current, clinic_name: current.clinic_name, plans })
})

// Called right after the card payment succeeds. The server re-reads the subscription from Stripe (never trusts the browser)
// and only accepts the one this Owner created during checkout.
export const confirmRoute = route('owner subscription confirm', 'POST', ['Owner'], async (ctx, req, res) => {
  const id = String(req.body?.subscription_id || '')
  if (!/^sub_\w+$/.test(id)) return fail(res, 422, 'INVALID_SUBSCRIPTION', 'Missing subscription reference.')
  const doc = await ctx.db.collection('clinic_settings').findOne({ _id: CLINIC_ID }, { projection: { pending_subscription: 1 } })
  const pending = doc?.pending_subscription
  if (!pending || pending.stripe_subscription_id !== id || String(pending.owner_id) !== String(ctx.user._id)) return fail(res, 403, 'FORBIDDEN_SUBSCRIPTION', 'That subscription was not started from your account.')
  const s = await getStripeClient().subscriptions.retrieve(id, { expand: ['items.data.price'] })
  if (!['active', 'trialing'].includes(s.status)) return fail(res, 409, 'PAYMENT_NOT_COMPLETE', 'The payment has not completed yet. Try again in a moment.')
  const record = recordFromStripe(s, { plan_key: pending.plan_key, owner_id: ctx.user._id, billing_period: pending.billing_period })
  await writeRecord(ctx.db, record)
  await ctx.db.collection('clinic_settings').updateOne({ _id: CLINIC_ID }, { $unset: { pending_subscription: '' } })
  await auditAdmin(ctx, 'clinic_plan_activated', `The clinic subscribed to the ${String(pending.plan_key).toUpperCase()} plan.`, { plan_key: pending.plan_key, subscription_id: id }).catch(() => {})
  return res.json({ ok: true, current: await getEntitlements(ctx.db, ctx.user) })
})

// One free trial per clinic; the plan's own trial_period_days decides the length.
export const trialRoute = route('owner subscription trial', 'POST', ['Owner'], async (ctx, req, res) => {
  const slug = String(req.body?.plan || '').toLowerCase()
  const { plans } = await loadPlansAndFeatures(ctx.db)
  const plan = plans.find((p) => (p.slug || '') === slug && p.slug !== 'free')
  const days = Number(plan?.trial_period_days) || 0
  if (!plan || (plan.status || 'live') === 'hidden' || days < 1) return fail(res, 422, 'NO_TRIAL', 'That plan has no free trial.')
  const doc = await ctx.db.collection('clinic_settings').findOne({ _id: CLINIC_ID }, { projection: { trial_used: 1 } })
  if (doc?.trial_used) return fail(res, 409, 'TRIAL_USED', 'The free trial was already used.')
  const now = new Date()
  await writeRecord(ctx.db, { plan_key: slug.toUpperCase(), billing_period: 'monthly', status: 'trialing', owner_id: ctx.user._id, current_period_start: now, current_period_end: new Date(now.getTime() + days * DAY), price_snapshot: 0, checked_at: now })
  await ctx.db.collection('clinic_settings').updateOne({ _id: CLINIC_ID }, { $set: { trial_used: true } })
  await auditAdmin(ctx, 'clinic_plan_trial', `Started a ${days}-day free trial of the ${planName(plan)} plan.`, { plan_key: slug, days }).catch(() => {})
  return res.json({ ok: true, current: await getEntitlements(ctx.db, ctx.user) })
})

// Downgrade to Free now: cancels the Stripe subscription (when there is one) and records the lapse. Every user drops to
// Free on their next request.
export const cancelRoute = route('owner subscription cancel', 'POST', ['Owner'], async (ctx, req, res) => {
  const doc = await ctx.db.collection('clinic_settings').findOne({ _id: CLINIC_ID }, { projection: { subscription: 1 } })
  const sub = doc?.subscription
  if (sub?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try { await getStripeClient().subscriptions.cancel(sub.stripe_subscription_id) } catch (err) { console.error('stripe cancel failed:', err.message) }
  }
  const now = new Date()
  await writeRecord(ctx.db, { ...(sub || {}), plan_key: sub?.plan_key || 'FREE', status: 'canceled', canceled_at: now, checked_at: now })
  await auditAdmin(ctx, 'clinic_plan_downgraded', 'Downgraded the clinic to the Free plan.', { from: sub?.plan_key || null }).catch(() => {})
  return res.json({ ok: true, current: await getEntitlements(ctx.db, ctx.user) })
})

export { num }
