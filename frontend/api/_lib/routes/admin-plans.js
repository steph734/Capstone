import { Int32 } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import {
  loadPlansAndFeatures, serializeFeature, loadSubscriptions, loadAccounts, planBreakdown, serializePlan, loadChanges,
  validatePlanInput, planFields, uniqueSlug, createStripePrice, planName, num, money,
} from '../plans.js'

// Everything the Super Admin Subscription page shows (one call).
export async function buildPlansPayload(db) {
  const { plans, features } = await loadPlansAndFeatures(db)
  const [subs, accounts] = await Promise.all([loadSubscriptions(), loadAccounts(db)])
  const bd = planBreakdown(plans, subs, accounts)
  let popularId = null
  let best = 0
  for (const p of plans) {
    const n = bd.stats.get(String(p._id))?.subscribers || 0
    if (n > best) { best = n; popularId = String(p._id) }
  }
  const list = plans.map((p) => serializePlan(p, { st: bd.stats.get(String(p._id)), popularId }))
  const total = list.reduce((n, p) => n + (p.subscribers || 0), 0)
  const beta = list.filter((p) => p.status === 'beta')
  return {
    stripeAvailable: Boolean(subs),
    stats: {
      subscribers: { value: bd.subscribers, previous: bd.subscribersPrev, changePct: bd.subscribersChangePct },
      mrr: { value: bd.mrr, change: bd.mrrChange },
      plans: { total: list.length, popular: list.find((p) => p.mostPopular)?.name || null },
      beta: { count: beta.reduce((n, p) => n + p.betaTesters.length, 0), plan: beta.length === 1 ? beta[0].name : beta.length ? `${beta.length} plans` : null },
    },
    plans: list.map((p) => ({ ...p, share: total ? Math.round(((p.subscribers || 0) / total) * 100) : 0 })),
    features: features.map(serializeFeature),
    changes: await loadChanges(plans, bd.live, bd.map),
  }
}

// GET  /api/admin/plans -> plans, stats, shared features, recent changes.
// POST /api/admin/plans -> create a plan ({ ...fields } or { duplicateOf }). Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store')
      return res.json(await buildPlansPayload(ctx.db))
    }

    const { plans, features } = await loadPlansAndFeatures(ctx.db)
    const featureMap = new Map(features.map((f) => [f.key, f]))
    const taken = new Set(plans.map((p) => planName(p).toLowerCase()))
    let body = req.body || {}
    if (body.duplicateOf) {
      const src = plans.find((p) => String(p._id) === String(body.duplicateOf))
      if (!src) return res.status(404).json({ error: 'Plan not found.' })
      let name = `${planName(src)} copy`.slice(0, 30)
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${planName(src).slice(0, 24)} copy ${n}`
      body = {
        name, tagline: src.description || '', priceMonthly: num(src.price), priceYearly: num(src.price_yearly), trialDays: src.trial_period_days,
        status: 'hidden', limits: src.limits || {}, icon: src.icon, color: src.color, featureKeys: src.feature_keys || [],
      }
    }
    const { fields, value } = validatePlanInput(body, { featureKeys: new Set(featureMap.keys()), takenNames: taken, forceStatus: body.saveHidden ? 'hidden' : undefined })
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields })

    const now = new Date()
    const slug = await uniqueSlug(ctx.db, value.name)
    const order = plans.reduce((m, p) => Math.max(m, Number(p.sort_order) || 0), 0) + 1
    const sp = await createStripePrice({ plan: { slug }, name: value.name, amount: value.priceMonthly })
    const doc = {
      ...planFields(value, value.featureKeys.map((k) => featureMap.get(k).label)),
      slug, billing_cycle: 'monthly', currency: 'PHP', is_popular: false, sort_order: new Int32(order), created_at: now, beta_testers: [],
      price_versions: [{ price: money(value.priceMonthly), price_yearly: value.priceYearly == null ? null : money(value.priceYearly), stripe_price_id: sp.priceId || null, effective_from: now, by: ctx.user._id }],
      ...(sp.productId ? { stripe_product_id: sp.productId } : {}),
      ...(value.priceYearly == null ? {} : { price_yearly: money(value.priceYearly) }),
    }
    const { insertedId } = await ctx.db.collection('subscription').insertOne(doc)
    await auditAdmin(ctx, body.duplicateOf ? 'plan_duplicated' : 'plan_created', `${body.duplicateOf ? 'Duplicated' : 'Created'} plan "${value.name}" at ₱${value.priceMonthly}/month (${value.status}).`, { plan_id: String(insertedId), name: value.name, price_monthly: value.priceMonthly, status: value.status })
    return res.status(201).json({ id: String(insertedId), warning: sp.warning || null })
  } catch (err) {
    console.error('admin plans error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : err.code === 121 ? 'The plan did not pass the database validation rules.' : 'Could not complete that request.' })
  }
}
