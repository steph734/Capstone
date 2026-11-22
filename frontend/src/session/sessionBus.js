// Shared state for idle logout, outside React so authFetch, screens and every tab can use it.
//   - lastActivityAt lives in localStorage (key tp:lastActivityAt), so a restored or second tab sees it
//   - tabs talk through BroadcastChannel('therapypro-session') (falls back to the localStorage "storage" event)
//   - "busy" holds: a screen that must not time out (upload, payment, game, speech) registers one and releases it when done
import { STORAGE_KEY, CHANNEL_NAME } from '../config/idle'

export const readLastActivity = () => {
  try { const n = Number(localStorage.getItem(STORAGE_KEY)); return Number.isFinite(n) && n > 0 ? n : 0 } catch { return 0 }
}
export const writeLastActivity = (t = Date.now()) => { try { localStorage.setItem(STORAGE_KEY, String(t)) } catch { /* storage blocked: this tab still tracks its own time */ } }
export const clearLastActivity = () => { try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ } }

// ── tabs ──
const listeners = new Set()
let channel = null
try { if (typeof BroadcastChannel !== 'undefined') { channel = new BroadcastChannel(CHANNEL_NAME); channel.onmessage = (e) => listeners.forEach((fn) => fn(e.data)) } } catch { channel = null }
const MSG_KEY = 'tp:session-msg'
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue && !channel) listeners.forEach((fn) => fn({ type: 'activity' })) // fallback only
    if (e.key === MSG_KEY && e.newValue && !channel) { try { listeners.forEach((fn) => fn(JSON.parse(e.newValue).msg)) } catch { /* ignore */ } }
  })
}
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
// type: 'activity' | 'warning-shown' | 'stay-logged-in' | 'logout'
export function broadcast(msg) {
  try {
    if (channel) channel.postMessage(msg)
    else localStorage.setItem(MSG_KEY, JSON.stringify({ msg, n: Date.now() + Math.random() })) // a changing value, so every tab gets a "storage" event
  } catch { /* ignore */ }
}

// ── activity noted by code (an authenticated call the user caused) ──
const activityHooks = new Set()
export const onActivity = (fn) => { activityHooks.add(fn); return () => activityHooks.delete(fn) }
export const noteActivity = () => activityHooks.forEach((fn) => fn())

// ── the session was ended by the server (401 SESSION_IDLE ...): tell the gate once ──
const endedHooks = new Set()
let endedFired = false
export const onSessionEnded = (fn) => { endedHooks.add(fn); return () => endedHooks.delete(fn) }
export function sessionEnded(code) {
  if (endedFired) return // guards redirect loops and duplicate toasts
  endedFired = true
  endedHooks.forEach((fn) => fn(code))
}
export const resetSessionEnded = () => { endedFired = false }

// ── busy holds ──
const holds = new Map()
let nextHold = 1
export function holdIdle(reason = 'busy') {
  const id = nextHold++
  holds.set(id, reason)
  return () => { holds.delete(id) }
}
export const isIdleHeld = () => holds.size > 0
export const idleHolds = () => [...holds.values()]
