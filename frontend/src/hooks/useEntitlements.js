import { useEffect, useSyncExternalStore } from 'react'
import { authFetch, getSessionToken } from '../utils/session'

// ONE source for "what plan is my clinic on, and what may I use": GET /api/me/entitlements. The server resolves the clinic
// from the signed-in user and its stored subscription on every request; nothing about the plan is kept in localStorage,
// sessionStorage or the login token. The store refetches when the page loads and when the window regains focus, and
// invalidateEntitlements() refreshes it (and every plan list) after a payment, renewal or downgrade.
let state = { ent: null, status: 'idle', error: '' }
const listeners = new Set()
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => state

const bus = typeof window !== 'undefined' ? new EventTarget() : null
export const PLAN_CHANGED = 'therapypro:plan-changed'
export const onPlanChanged = (fn) => { bus?.addEventListener(PLAN_CHANGED, fn); return () => bus?.removeEventListener(PLAN_CHANGED, fn) }

let inflight = null
export function refreshEntitlements() {
  if (!getSessionToken()) { set({ ent: null, status: 'idle' }); return Promise.resolve(null) }
  if (inflight) return inflight
  if (!state.ent) set({ status: 'loading', error: '' })
  inflight = authFetch('/api/me/entitlements')
    .then((ent) => { set({ ent, status: 'ready', error: '' }); return ent })
    .catch((err) => { set({ status: state.ent ? 'ready' : 'error', error: err.message || 'Could not load the plan.' }); return state.ent })
    .finally(() => { inflight = null })
  return inflight
}
// After a payment, renewal or downgrade: refetch the plan and tell every plan list to refetch too.
export const invalidateEntitlements = () => { bus?.dispatchEvent(new Event(PLAN_CHANGED)); return refreshEntitlements() }
export const clearEntitlements = () => set({ ent: null, status: 'idle', error: '' })
export const getEntitlementsSnapshot = () => state.ent

export const hasFeature = (ent, key) => Boolean(ent?.features?.includes(key))
// Coarse 'silver' | 'gold' | null view used by the menu configs: anything with gamified exercises counts as gold-level,
// anything with voice-to-text as silver-level, so Radiant (or a plan added later) unlocks everything below it.
export const tierOf = (ent) => (hasFeature(ent, 'gamified_exercises') ? 'gold' : hasFeature(ent, 'voice_to_text') ? 'silver' : null)

export default function useEntitlements({ enabled = true } = {}) {
  const s = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => {
    if (!enabled) return undefined
    refreshEntitlements()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshEntitlements() }
    window.addEventListener('focus', refreshEntitlements)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('focus', refreshEntitlements); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled])
  return { ent: s.ent, loading: enabled && s.status !== 'ready' && s.status !== 'error', error: s.error, has: (k) => hasFeature(s.ent, k), refresh: refreshEntitlements }
}
