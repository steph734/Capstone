import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { loadPlansAndFeatures, planName, str, slugify, monthsFree, serializePlan } from '../plans.js'

// The plans a clinic can subscribe to: Live plans, plus Beta plans when the caller is one of that plan's beta testers.
// Hidden and archived plans are not returned, EXCEPT the plan the clinic is already on (`include`), which keeps applying.
export async function listVisiblePlans(db, user, include = '') {
  const email = str(user.email).toLowerCase()
  const keep = slugify(str(include))
  const { plans, features } = await loadPlansAndFeatures(db)
  const label = new Map(features.map((f) => [f.key, f.label]))
  const out = []
  for (const p of plans) {
    const s = serializePlan(p, {})
    const visible = s.status === 'live' || (s.status === 'beta' && (p.beta_testers || []).some((e) => str(e).toLowerCase() === email))
    if (!visible && s.slug !== keep) continue
    out.push({
      slug: s.slug, name: planName(p), tagline: s.tagline,
      priceMonthly: s.priceMonthly, priceYearly: s.priceYearly, monthsFree: monthsFree(s.priceMonthly, s.priceYearly),
      trialDays: s.trialDays, status: s.status, icon: s.icon, color: s.color, isDefault: s.isDefault, order: s.order,
      features: s.featureKeys.map((k) => label.get(k)).filter(Boolean),
    })
  }
  return out.sort((a, b) => a.order - b.order)
}

// GET /api/plans  (any signed-in user)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res)
    if (!ctx) return
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ plans: await listVisiblePlans(ctx.db, ctx.user, req.query.include) })
  } catch (err) {
    console.error('plans list error:', err)
    return res.status(500).json({ error: 'Could not load the plans.' })
  }
}
