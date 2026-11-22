// Idle logout settings, in ONE place. The same numbers apply to every role (Super Admin, Owner, Therapist, Patient).
// QA can shorten them without touching code: VITE_IDLE_TIMEOUT_MS=20000 VITE_IDLE_WARNING_MS=10000
// (set IDLE_TIMEOUT_MS / IDLE_WARNING_MS the same way on the server, or the server will end the session later than the browser).
const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) && n >= 1000 ? n : fallback }

export const IDLE_TIMEOUT_MS = num(import.meta.env?.VITE_IDLE_TIMEOUT_MS, 10 * 60 * 1000) // no activity for this long -> warning
export const WARNING_MS = num(import.meta.env?.VITE_IDLE_WARNING_MS, 60 * 1000) // countdown in the warning, then logout
export const HEARTBEAT_MIN_INTERVAL_MS = 60 * 1000 // at most one "still here" ping to the server per minute while active
export const FINAL_COUNTDOWN_SECONDS = 10 // the modal switches to the red "Logging you out..." state for the last seconds
export const ACTIVITY_THROTTLE_MS = 1000

// Optional per-role override, e.g. { Patient: { idleMs: 15 * 60 * 1000 } }. Empty = every role uses the defaults above.
export const ROLE_OVERRIDES = {}
export const idleFor = (role) => ({
  idleMs: ROLE_OVERRIDES[role]?.idleMs ?? IDLE_TIMEOUT_MS,
  warningMs: ROLE_OVERRIDES[role]?.warningMs ?? WARNING_MS,
})

export const STORAGE_KEY = 'tp:lastActivityAt'
export const CHANNEL_NAME = 'therapypro-session'
