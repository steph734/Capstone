import { useCallback, useEffect, useState } from 'react'
import { authFetch, getSessionToken } from '../utils/session'
import { onPlanChanged } from './useEntitlements'

// Plans for the Subscription pages (Owner, Therapist, Patient) and the clinic's current plan, from GET /api/me/subscription.
// Live plans are listed (Beta only for its testers, Hidden for nobody), plus the clinic's own plan even if it was hidden later.
const CARD_COLOR = { free: 'blue', silver: 'silver', gold: 'gold' }

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
    rank: p.order,
    features: p.features,
    current: false,
  }
}

// { tiers, current, clinicName, loading }: while `loading` is true and there are no tiers yet, pages show a placeholder, never
// their built-in prices (those can differ from the database). The last loaded plans are cached for the next visit.
// `current` is the clinic's
// entitlements (plan_key such as 'GOLD'). Refetches on focus and after any payment/downgrade (invalidateEntitlements).
const CACHE_KEY = 'tp_plan_tiers_v1'
const readCache = () => { try { const t = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return Array.isArray(t) && t.length ? t : null } catch { return null } }
const writeCache = (t) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(t)) } catch { /* private mode */ } }

export default function usePlanTiers() {
  const [data, setData] = useState(() => ({ tiers: readCache(), current: null, clinicName: '', loading: Boolean(getSessionToken()) }))
  const load = useCallback(() => {
    if (!getSessionToken()) return Promise.resolve()
    return authFetch('/api/me/subscription')
      .then((d) => {
        const tiers = Array.isArray(d.plans) ? d.plans.map(tierFromPlan) : null
        if (tiers) writeCache(tiers)
        setData({ tiers, current: d.current || null, clinicName: d.clinic_name || '', loading: false })
      })
      .catch(() => setData((old) => ({ ...old, loading: false }))) // keep what we have
  }, [])
  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    const off = onPlanChanged(load)
    return () => { window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', onVisible); off() }
  }, [load])
  return data
}
