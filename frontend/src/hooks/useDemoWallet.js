import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { call } from '../pages/owner/billing/financeApi'

// One shared Owner "Demo Wallet" store, so Payouts, Subscription and Checkout always show the same balance and refetch
// after any change (set amount, reset, a payment). Money is integer CENTAVOS everywhere; format with `money()`.
export const DEMO_START_BALANCE = 1524000
export const DEMO_MAX_PESOS = 1000000

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
export const money = (centavos) => peso.format((Number(centavos) || 0) / 100)

let state = { balance: null, status: 'idle', error: '', subscription: null, revision: 0 }
const listeners = new Set()
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const snapshot = () => state

let inflight = null
export function refreshWallet() {
  if (inflight) return inflight
  if (state.balance === null) set({ status: 'loading', error: '' })
  inflight = call('demo-wallet')
    .then((d) => set({ balance: d.balance, status: 'ready', error: '' }))
    .catch((err) => set({ status: 'error', error: err.message || 'Could not load the demo wallet.' }))
    .finally(() => { inflight = null })
  return inflight
}

export async function refreshSubscription() {
  try {
    const d = await call('subscription/status')
    set({ balance: d.balance, subscription: d.subscription, status: 'ready', error: '', revision: state.revision + 1 })
    return d.subscription
  } catch (err) {
    set({ error: err.message || 'Could not load the subscription.' })
    return null
  }
}

// Used by actions that already know the new balance (set amount, reset, payment result).
export const setWalletBalance = (balance) => set({ balance, status: 'ready', error: '', revision: state.revision + 1 })
export const clearWalletStore = () => { state = { balance: null, status: 'idle', error: '', subscription: null, revision: 0 }; listeners.forEach((l) => l()) }

export default function useDemoWallet({ autoload = true } = {}) {
  const s = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => { if (autoload) refreshWallet() }, [autoload])
  const refresh = useCallback(() => refreshWallet(), [])
  return {
    balance: s.balance, loading: s.status === 'loading' || (s.status === 'idle' && autoload), error: s.error, ready: s.balance !== null,
    subscription: s.subscription, revision: s.revision, refresh, refreshSubscription, setBalance: setWalletBalance,
  }
}
