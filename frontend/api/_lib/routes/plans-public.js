import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { loadPlansAndFeatures, planName, num, str, slugify, monthsFree, serializePlan } from '../plans.js'

// GET /api/plans  (any signed-in user; used by the Owner Subscription page and checkout)
// Returns the plans a clinic can subscribe to: Live plans, plus Beta plans when the caller is one of that plan's beta
// testers. Hidden and archived plans are not returned. An Owner already on a Hidden plan passes ?include=<their slug>
// so they still see their own plan (it keeps renewing).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res)
    if (!ctx) return
    const email = str(ctx.user.email).toLowerCase()
    const include = slugify(str(req.query.include))
    const { plans, features } = await loadPlansAndFeatures(ctx.db)
    const label = new Map(features.map((f) => [f.key, f.label]))
    const out = []
    for (const p of plans) {
      const s = serializePlan(p, {})
      const visible = s.status === 'live' || (s.status === 'beta' && (p.beta_testers || []).some((e) => str(e).toLowerCase() === email))
      if (!visible && s.slug !== include) continue
      out.push({
        slug: s.slug, name: planName(p), tagline: s.tagline,
        priceMonthly: s.priceMonthly, priceYearly: s.priceYearly, monthsFree: monthsFree(s.priceMonthly, s.priceYearly),
        trialDays: s.trialDays, status: s.status, icon: s.icon, color: s.color, isDefault: s.isDefault, order: s.order,
        features: s.featureKeys.map((k) => label.get(k)).filter(Boolean),
      })
    }
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ plans: out.sort((a, b) => a.order - b.order) })
  } catch (err) {
    console.error('plans list error:', err)
    return res.status(500).json({ error: 'Could not load the plans.' })
  }
}
