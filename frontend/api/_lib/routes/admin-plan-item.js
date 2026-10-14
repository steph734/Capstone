import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import {
  loadPlansAndFeatures, loadSubscriptions, loadAccounts, planBreakdown, validatePlanInput, planFields, createStripePrice,
  planName, num, money, str, isEmail,
} from '../plans.js'

// PATCH  /api/admin/plans/:id  { action: 'hide' | 'show' | 'beta_testers', emails? }  or the edit fields.
// DELETE /api/admin/plans/:id  only when the plan has no subscribers.
// Super Admin only; every change is written to audit_logs.
export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid plan id.' })
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const col = ctx.db.collection('subscription')
    const { plans, features } = await loadPlansAndFeatures(ctx.db)
    const plan = plans.find((p) => String(p._id) === req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    const name = planName(plan)

    if (req.method === 'DELETE') {
      const [subs, accounts] = await Promise.all([loadSubscriptions(), loadAccounts(ctx.db)])
      if (!subs) return res.status(400).json({ error: 'Subscriber data is unavailable, so we cannot confirm this plan has no subscribers.' })
      const n = planBreakdown(plans, subs, accounts).stats.get(String(plan._id))?.subscribers || 0
      if (n > 0) return res.status(400).json({ error: `${name} has ${n} subscriber${n === 1 ? '' : 's'}. Move them to another plan first.` })
      await col.deleteOne({ _id: plan._id })
      await auditAdmin(ctx, 'plan_deleted', `Deleted plan "${name}".`, { plan_id: String(plan._id), name })
      return res.json({ ok: true })
    }

    const body = req.body || {}
    const now = new Date()

    if (body.action === 'hide' || body.action === 'show') {
      const status = body.action === 'hide' ? 'hidden' : 'live'
      await col.updateOne({ _id: plan._id }, { $set: { status, is_active: status !== 'hidden', updated_at: now } })
      await auditAdmin(ctx, status === 'hidden' ? 'plan_hidden' : 'plan_shown', `${status === 'hidden' ? 'Hid' : 'Showed'} plan "${name}".`, { plan_id: String(plan._id) })
      return res.json({ ok: true })
    }

    if (body.action === 'beta_testers') {
      const emails = [...new Set((Array.isArray(body.emails) ? body.emails : []).map((e) => str(e).toLowerCase()).filter(Boolean))]
      if (emails.length > 100) return res.status(400).json({ error: 'A plan can have up to 100 beta testers.' })
      const bad = emails.filter((e) => !isEmail(e))
      if (bad.length) return res.status(400).json({ error: `Not valid emails: ${bad.join(', ')}.` })
      const known = new Set((await ctx.db.collection('users').find({ email: { $in: emails } }, { projection: { email: 1 } }).toArray()).map((u) => u.email))
      const unknown = emails.filter((e) => !known.has(e))
      if (unknown.length) return res.status(400).json({ error: `No account found for: ${unknown.join(', ')}.` })
      await col.updateOne({ _id: plan._id }, { $set: { beta_testers: emails, updated_at: now } })
      await auditAdmin(ctx, 'plan_beta_testers', `Set ${emails.length} beta tester${emails.length === 1 ? '' : 's'} on plan "${name}".`, { plan_id: String(plan._id), count: emails.length })
      return res.json({ ok: true })
    }

    // Edit.
    const featureMap = new Map(features.map((f) => [f.key, f]))
    const taken = new Set(plans.filter((p) => p._id !== plan._id).map((p) => planName(p).toLowerCase()))
    const { fields, value } = validatePlanInput(body, { featureKeys: new Set(featureMap.keys()), takenNames: taken, forceStatus: body.saveHidden ? 'hidden' : undefined })
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields })

    const set = planFields(value, value.featureKeys.map((k) => featureMap.get(k).label))
    const oldPrice = num(plan.price) ?? 0
    const oldYearly = num(plan.price_yearly)
    const priceChanged = oldPrice !== value.priceMonthly || (oldYearly ?? null) !== (value.priceYearly ?? null)
    const update = { $set: set }
    let warning = null
    if (priceChanged) {
      // New version for new subscribers and renewals; existing subscriptions keep their Stripe price.
      const sp = oldPrice !== value.priceMonthly ? await createStripePrice({ plan, name: value.name, amount: value.priceMonthly }) : {}
      warning = sp.warning || null
      if (sp.productId) set.stripe_product_id = sp.productId
      set.price_yearly = value.priceYearly == null ? null : money(value.priceYearly)
      update.$push = { price_versions: { price: money(value.priceMonthly), price_yearly: value.priceYearly == null ? null : money(value.priceYearly), stripe_price_id: sp.priceId || null, effective_from: now, by: ctx.user._id } }
    }
    await col.updateOne({ _id: plan._id }, update)
    await auditAdmin(ctx, priceChanged ? 'plan_price_changed' : 'plan_updated',
      priceChanged ? `Changed price of plan "${value.name}" from ₱${oldPrice} to ₱${value.priceMonthly}/month (applies to new subscribers and renewals).` : `Edited plan "${value.name}".`,
      { plan_id: String(plan._id), old_price: oldPrice, new_price: value.priceMonthly, status: value.status })
    return res.json({ ok: true, warning })
  } catch (err) {
    console.error('admin plan item error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : err.code === 121 ? 'The plan did not pass the database validation rules.' : 'Could not complete that request.' })
  }
}
