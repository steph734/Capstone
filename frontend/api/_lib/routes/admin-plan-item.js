import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import {
  loadPlansAndFeatures, loadSubscriptions, loadAccounts, planBreakdown, validatePlanInput, planFields, createStripePrice,
  planName, num, money, str, isEmail, serializePlan, diffPlan,
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
    const isFree = plan.slug === 'free' || plan.is_default === true // the fallback plan: always ₱0, never hidden, archived or deleted
    const version = Number(plan.version) || 1 // plans saved before versioning count as version 1
    const sameVersion = (v) => (v === 1 ? { $or: [{ version: 1 }, { version: { $exists: false } }] } : { version: v })

    if (req.method === 'DELETE') {
      if (isFree) return res.status(409).json({ error: 'The Free plan is the fallback plan and cannot be deleted.', code: 'FREE_PLAN_PROTECTED' })
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
      if (status === 'hidden' && isFree) return res.status(409).json({ error: 'The Free plan cannot be hidden.', code: 'FREE_PLAN_PROTECTED' })
      await col.updateOne({ _id: plan._id }, { $set: { status, is_active: status !== 'hidden', updated_at: now, version: version + 1, updated_by: ctx.user._id } })
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

    // Edit. The admin sends the form plus expected_version; the SERVER computes the diff against the stored plan.
    const expected = Number(body.expected_version)
    if (!Number.isInteger(expected) || expected < 1) return res.status(422).json({ error: 'expected_version is required.', code: 'VERSION_REQUIRED' })
    if (expected !== version) return res.status(409).json({ error: 'This plan was changed by someone else. Reload to see the latest.', code: 'STALE_PLAN', version })
    const featureMap = new Map(features.map((f) => [f.key, f]))
    const taken = new Set(plans.filter((p) => p._id !== plan._id).map((p) => planName(p).toLowerCase()))
    if (isFree && body.saveHidden) return res.status(409).json({ error: 'The Free plan cannot be hidden.', code: 'FREE_PLAN_PROTECTED' })
    const { fields, value } = validatePlanInput(body, { featureKeys: new Set(featureMap.keys()), takenNames: taken, forceStatus: body.saveHidden ? 'hidden' : undefined })
    if (isFree && value.priceMonthly !== 0) fields.priceMonthly = 'The Free plan must stay at ₱0.'
    if (isFree && value.status === 'hidden') fields.status = 'The Free plan cannot be hidden.'
    if (Object.keys(fields).length) return res.status(422).json({ error: 'Please fix the highlighted fields.', code: 'VALIDATION_ERROR', fields })

    const changes = diffPlan(plan, value, (k) => featureMap.get(k)?.label || k)
    if (!changes.length) return res.status(422).json({ error: 'No changes to save.', code: 'NO_CHANGES' })

    const set = planFields(value, value.featureKeys.map((k) => featureMap.get(k).label))
    set.version = version + 1
    set.updated_by = ctx.user._id
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
    // The version in the filter makes the check atomic: a concurrent save between the read above and here loses.
    const r = await col.updateOne({ _id: plan._id, ...sameVersion(version) }, update)
    if (!r.matchedCount) return res.status(409).json({ error: 'This plan was changed by someone else. Reload to see the latest.', code: 'STALE_PLAN' })
    const summary = changes.map((c) => c.label).join(', ')
    await auditAdmin(ctx, priceChanged ? 'plan_price_changed' : 'plan_updated',
      priceChanged
        ? `Changed price of plan "${value.name}" from ₱${oldPrice} to ₱${value.priceMonthly}/month (applies to new subscribers and renewals). Changed: ${summary}.`
        : `Edited plan "${value.name}". Changed: ${summary}.`,
      { plan_id: String(plan._id), old_price: oldPrice, new_price: value.priceMonthly, status: value.status, version: version + 1, changes })
    const fresh = await col.findOne({ _id: plan._id })
    return res.json({ ok: true, warning, version: version + 1, changes, plan: serializePlan(fresh, {}) })
  } catch (err) {
    if (err.code === 121) {
      console.error('admin plan item: validator rejected the plan', JSON.stringify(err.errInfo?.details || {}).slice(0, 1500))
      return res.status(422).json({ error: 'The plan did not pass the database validation rules.', code: 'VALIDATION_FAILED' })
    }
    console.error('admin plan item error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
