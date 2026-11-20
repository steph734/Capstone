import useEntitlements, { tierOf } from './useEntitlements'

// Compatibility wrapper for the older callers (sidebar, dashboard, gamified page). The plan is read from the server's
// entitlements; nothing is cached in sessionStorage any more. `gamified` is true when the plan includes gamified exercises.
// `tier` is the coarse 'free' | 'silver' | 'gold' view; null while unknown.
export default function useClinicPlan(enabled = true) {
  const { ent } = useEntitlements({ enabled })
  if (!ent) return { tier: null, gamified: null, why: '' }
  return { tier: tierOf(ent) || 'free', gamified: ent.features.includes('gamified_exercises'), why: ent.why || '', entitlements: ent }
}
