import { useCallback, useEffect, useState } from 'react'
import { authFetch, getSessionToken } from '../utils/session'

// The plans every user sees come from the database (Super Admin > Subscription saves to the `subscription` collection).
// GET /api/plans returns Live plans (Beta only for its testers); Hidden plans are not returned for anyone.
// `include` is the slug of the plan the user is already on, so their own plan still shows even if it was hidden later.
const CARD_COLOR = { free: 'blue', silver: 'silver', gold: 'gold' }

// A plan from GET /api/plans -> the tier shape the Owner / Therapist / Patient subscription pages use.
export function tierFromPlan(p) {
  const base = String(p.name || '').replace(/ plan$/i, '').toUpperCase()
  return {
    id: p.slug,
    name: `THERAPYPRO: ${base}`,
    price: p.priceMonthly === 0 ? 'FREE' : `₱${p.priceMonthly}`,
    period: p.priceMonthly === 0 ? '/ forever' : '/month',
    color: CARD_COLOR[p.slug] || 'silver',
    monthlyPrice: p.priceMonthly,
    yearlyPrice: p.priceYearly ?? 0,
    trialDays: p.trialDays,
    features: p.features,
    current: false,
  }
}

// Returns the tiers, or null until loaded / if the request fails (callers keep their built-in tiers meanwhile).
// Refetches when the tab regains focus so a Super Admin change shows up without a manual reload.
export default function usePlanTiers(include = '') {
  const [tiers, setTiers] = useState(null)
  const load = useCallback(() => {
    if (!getSessionToken()) return Promise.resolve()
    return authFetch('/api/plans', { query: { include: include || '' } })
      .then((d) => { if (Array.isArray(d.plans)) setTiers(d.plans.map(tierFromPlan)) })
      .catch(() => { /* keep whatever we already have */ })
  }, [include])

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  return tiers
}
