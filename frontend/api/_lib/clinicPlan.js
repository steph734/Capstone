import { resolveClinicPlan, featuresOf } from './entitlements.js'

// Kept for older callers (game gating, /api/clinic/plan). The clinic's plan now comes from ONE place, entitlements.js:
// the clinic's stored subscription, resolved on every request. `tier` is the coarse 'free' | 'silver' | 'gold' view:
// anything that includes the gamified feature counts as 'gold', anything that includes voice-to-text as 'silver'
// (so Radiant, or a plan added later, is covered automatically).
const OFF = String(process.env.GAMES_REQUIRE_GOLD || '').trim().toLowerCase() === 'false'

export async function clinicTierInfo(db) {
  if (OFF) return { tier: 'gold', why: 'The Gold check is switched off on this server (GAMES_REQUIRE_GOLD=false).' }
  const r = await resolveClinicPlan(db)
  const features = featuresOf(r.plan, r.plans)
  const tier = features.includes('gamified_exercises') ? 'gold' : features.includes('voice_to_text') ? 'silver' : 'free'
  return { tier, why: r.why || (r.source === 'default' ? 'The clinic has no active paid subscription.' : '') }
}
export const clinicTier = async (db) => (await clinicTierInfo(db)).tier
export const hasGold = async (db) => (await clinicTier(db)) === 'gold'
