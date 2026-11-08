import { loadPlansAndFeatures, loadSubscriptions } from './plans.js'

const OFF = String(process.env.GAMES_REQUIRE_GOLD || '').trim().toLowerCase() === 'false'
const cache = { at: 0, tier: 'free' }

// The clinic's plan is its Owner's plan: a Gold (or Silver) subscription on any Owner account, either as a beta
// tester of that plan or as an active paid Stripe subscription. Gamified Activities need Gold.
// GAMES_REQUIRE_GOLD=false switches the check off (dev/demo). Cached for 2 minutes.
export async function clinicTier(db) {
  if (OFF) return 'gold'
  if (Date.now() - cache.at < 120000) return cache.tier
  const owners = (await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { email: 1 } }).toArray()).map((u) => String(u.email).toLowerCase())
  const { plans } = await loadPlansAndFeatures(db)
  const beta = (slug) => plans.some((p) => p.slug === slug && (p.beta_testers || []).some((e) => owners.includes(String(e).toLowerCase())))
  let tier = beta('gold') ? 'gold' : beta('silver') ? 'silver' : 'free'
  if (tier !== 'gold') {
    const subs = await loadSubscriptions()
    if (subs) {
      const { paidTierEmails } = await import('./plans.js')
      const paid = paidTierEmails(plans.filter((p) => p.slug === 'gold'), subs)
      if (owners.some((e) => paid.has(e))) tier = 'gold'
      else if (tier === 'free' && owners.some((e) => paidTierEmails(plans.filter((p) => p.slug === 'silver'), subs).has(e))) tier = 'silver'
    }
  }
  cache.at = Date.now(); cache.tier = tier
  return tier
}
export const hasGold = async (db) => (await clinicTier(db)) === 'gold'
