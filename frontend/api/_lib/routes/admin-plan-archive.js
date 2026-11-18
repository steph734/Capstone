import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { loadPlansAndFeatures, loadSubscriptions, loadAccounts, planBreakdown, planName } from '../plans.js'

// POST /api/admin/plans/:id/archive  (Super Admin only)
// Archived plans disappear from every list. Blocked while the plan has active subscribers (hide it instead),
// and the default Free plan can never be archived.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid plan id.' })
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return
    const { plans } = await loadPlansAndFeatures(ctx.db)
    const plan = plans.find((p) => String(p._id) === req.params.id)
    if (!plan) return res.status(404).json({ error: 'Plan not found.' })
    const name = planName(plan)
    if (plan.slug === 'free' || plan.is_default === true) return res.status(409).json({ error: 'The Free plan is the fallback plan and cannot be archived.', code: 'FREE_PLAN_PROTECTED' })

    const [subs, accounts] = await Promise.all([loadSubscriptions(), loadAccounts(ctx.db)])
    if (!subs) return res.status(503).json({ error: 'Subscriber data is unavailable, so we cannot confirm this plan has no subscribers.', code: 'SUBSCRIBERS_UNAVAILABLE' })
    const n = planBreakdown(plans, subs, accounts).stats.get(String(plan._id))?.subscribers || 0
    if (n > 0) return res.status(409).json({ error: `${name} has ${n} active subscriber${n === 1 ? '' : 's'}. Hide it instead.`, code: 'PLAN_HAS_SUBSCRIBERS' })

    const now = new Date()
    const version = Number(plan.version) || 1
    await ctx.db.collection('subscription').updateOne({ _id: plan._id }, { $set: { archived_at: now, is_active: false, status: 'hidden', updated_at: now, version: version + 1, updated_by: ctx.user._id } })
    await auditAdmin(ctx, 'plan_archived', `Archived plan "${name}".`, { plan_id: String(plan._id), name })
    return res.json({ ok: true })
  } catch (err) {
    if (err.code === 121) {
      console.error('admin plan archive: validator rejected the update', JSON.stringify(err.errInfo?.details || {}).slice(0, 1500))
      return res.status(422).json({ error: 'The plan did not pass the database validation rules.', code: 'VALIDATION_FAILED' })
    }
    console.error('admin plan archive error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
