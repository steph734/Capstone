import { useEffect, useState } from 'react'
import { authFetch } from '../utils/session'

// The clinic's plan (its Owner's subscription). Remembered for the session so menus don't flicker.
// `gamified` is true on the Gold plan; null while unknown.
const KEY = 'clinicPlan'
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null } }
export default function useClinicPlan(enabled = true) {
  const [plan, setPlan] = useState(read)
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    authFetch('/api/clinic/plan').then((d) => { if (!alive) return; setPlan(d); try { sessionStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode */ } }).catch(() => {})
    return () => { alive = false }
  }, [enabled])
  return { tier: plan?.tier || null, gamified: plan ? Boolean(plan.gamified) : null }
}
