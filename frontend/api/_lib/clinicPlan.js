import { loadPlansAndFeatures, loadSubscriptions, monthlyAmount, paidTierEmails } from './plans.js'

const OFF = String(process.env.GAMES_REQUIRE_GOLD || '').trim().toLowerCase() === 'false'
const cache = { at: 0, ttl: 0, info: null }

// The clinic's plan is its Owner's plan: a Gold (or Silver) subscription on any Owner account, either as a beta
// tester of that plan or as an active paid Stripe subscription whose customer email is the Owner's account email.
// Gamified Activities need Gold. GAMES_REQUIRE_GOLD=false switches the check off (dev/demo). Cached for 2 minutes
// (15 seconds when Stripe could not be read, so a hiccup does not hide the games for long).
// `why` says in words where the answer came from, so a "Gold but the games are hidden" report can be explained from /api/clinic/plan.
export async function clinicTierInfo(db) {
  if (OFF) return { tier: 'gold', why: 'The Gold check is switched off on this server (GAMES_REQUIRE_GOLD=false).' }
  if (cache.info && Date.now() - cache.at < cache.ttl) return cache.info
  const owners = (await db.collection('users').find({ role: 'Owner', is_archived: { $ne: true } }, { projection: { email: 1 } }).toArray()).map((u) => String(u.email).toLowerCase())
  const { plans } = await loadPlansAndFeatures(db)
  const beta = (slug) => plans.some((p) => p.slug === slug && (p.beta_testers || []).some((e) => owners.includes(String(e).toLowerCase())))
  let tier = beta('gold') ? 'gold' : beta('silver') ? 'silver' : 'free'
  let why = tier === 'free' ? '' : `The Owner is a beta tester of the ${tier} plan.`
  let ttl = 120000
  if (tier !== 'gold') {
    const subs = await loadSubscriptions()
    if (!subs) {
      ttl = 15000
      why = why || 'The server could not read Stripe subscriptions (check STRIPE_SECRET_KEY on the server), so no paid plan was found.'
    } else {
      if (owners.some((e) => paidTierEmails(plans.filter((p) => p.slug === 'gold'), subs).has(e))) { tier = 'gold'; why = 'The Owner has an active Gold subscription in Stripe.' }
      else if (tier === 'free' && owners.some((e) => paidTierEmails(plans.filter((p) => p.slug === 'silver'), subs).has(e))) { tier = 'silver'; why = 'The Owner has an active Silver subscription in Stripe.' }
      // A live subscription of the Owner whose Stripe price id we don't know (a re-created price, another Stripe account) still counts when it
      // bills exactly the monthly price of the Gold (or Silver) plan on the Subscription page.
      if (tier === 'free') {
        const price = (slug) => { const v = plans.find((p) => p.slug === slug)?.price; return Number(String(v?.$numberDecimal ?? v ?? 0)) }
        const ownerLiveSubs = subs.filter((x) => ['active', 'trialing', 'past_due'].includes(x.status) && !x.ended_at && owners.includes(String(x.customer?.email || '').toLowerCase()))
        const bills = (slug) => price(slug) > 0 && ownerLiveSubs.some((x) => Math.round(monthlyAmount(x)) === Math.round(price(slug)))
        if (bills('gold')) { tier = 'gold'; why = 'The Owner has a live Stripe subscription billing the Gold price.' }
        else if (bills('silver')) { tier = 'silver'; why = 'The Owner has a live Stripe subscription billing the Silver price.' }
      }
      if (tier === 'free') {
        const live = subs.filter((s) => ['active', 'trialing', 'past_due'].includes(s.status) && !s.ended_at)
        const ownerLive = live.filter((s) => owners.includes(String(s.customer?.email || '').toLowerCase()))
        why = ownerLive.length
          ? `A live Stripe subscription exists for the Owner's email, but its price is not one of the Gold or Silver prices on the Subscription page (price ${ownerLive[0].items?.data?.[0]?.price?.id || 'unknown'}).`
          : `No live Stripe subscription has the Owner account's email as its customer (${live.length} live subscription${live.length === 1 ? '' : 's'} checked). The email used at payment must match the Owner's account email, or add the Owner as a Gold beta tester.`
      }
    }
  }
  const info = { tier, why }
  cache.at = Date.now(); cache.ttl = ttl; cache.info = info
  return info
}
export const clinicTier = async (db) => (await clinicTierInfo(db)).tier
export const hasGold = async (db) => (await clinicTier(db)) === 'gold'
