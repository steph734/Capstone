// The brain of the "Sending your payment details" modal. Plain JavaScript (no React), so it can be tested with fake timers.
//
// It owns ONE submission: the request, its real upload progress, the timer-based slow / stalled detection, the hard timeout,
// cancel, automatic retries after network errors, and the "has the server already got it?" check before any retry.
// The React side only subscribes to its state (see usePaymentSubmit.js).
import { SENDING_CONFIG } from './sendingConfig'

// 9s -> "0:09", 65s -> "1:05", 3723s -> "1:02:03"
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// Slow when EITHER the total time passed the limit OR the upload stopped moving. Stall only counts while bytes are still
// going up and the browser reports progress at all.
export function isSlow({ elapsedMs, sinceProgressMs, uploading, progressSupported }, cfg = SENDING_CONFIG) {
  if (elapsedMs >= cfg.slowAfterMs) return true
  return Boolean(uploading && progressSupported && sinceProgressMs >= cfg.stallMs)
}

const isNetworkError = (err) => err?.code === 'network' || [502, 503, 504].includes(err?.status)
const SETTLED = ['proof_submitted', 'verified']

export function createSubmitController({
  config = SENDING_CONFIG,
  now = () => Date.now(),
  isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  waitOnline = () => new Promise((resolve) => { window.addEventListener('online', resolve, { once: true }) }),
} = {}) {
  let state = initial()
  const listeners = new Set()
  let abort = null
  let cancelled = false
  let timedOut = false
  let wake = null // wakes a backoff / offline wait early (cancel or timeout)

  function initial() {
    return {
      status: 'idle', // idle | sending | done | failed | cancelled
      mode: 'normal', // normal | slow
      startedAt: null, fileSize: 0, uploadedBytes: 0,
      uploadPercent: 0, progressSupported: true, uploadDone: false, lastProgressAt: 0,
      attempt: 1, maxAttempts: config.maxAttempts, retrying: false, offline: false,
      steps: { confirmedMs: 0, saveStartMs: 0, saveEndMs: null, sendEndMs: null },
      slowShown: false,
    }
  }
  const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)) }
  const setSteps = (patch) => set({ steps: { ...state.steps, ...patch } })

  const tick = () => {
    if (state.status !== 'sending') return
    const t = now()
    const elapsedMs = t - state.startedAt
    if (elapsedMs >= config.hardTimeoutMs && !timedOut) { timedOut = true; abort?.abort(); wake?.() }
    const slow = isSlow({ elapsedMs, sinceProgressMs: t - state.lastProgressAt, uploading: !state.uploadDone, progressSupported: state.progressSupported }, config)
    if (slow !== (state.mode === 'slow')) set({ mode: slow ? 'slow' : 'normal', slowShown: state.slowShown || slow })
  }

  const onProgress = (p) => {
    if (state.status !== 'sending') return
    if (p === null || p === undefined) { set({ progressSupported: false, uploadPercent: null }); return }
    const pct = Math.min(100, Math.round(p * 100))
    set({ uploadPercent: pct, uploadedBytes: state.fileSize * Math.min(1, p), lastProgressAt: now(), uploadDone: p >= 1, progressSupported: true })
    tick() // progress resumed: leave the stalled state at once instead of waiting for the next second
  }

  // Sleeps, but wakes early on cancel / timeout.
  const pause = (ms) => new Promise((resolve) => {
    const id = setTimeout(() => { wake = null; resolve() }, ms)
    wake = () => { clearTimeout(id); wake = null; resolve() }
  })
  const untilOnline = () => new Promise((resolve) => {
    wake = () => { wake = null; resolve() }
    waitOnline().then(() => { wake = null; resolve() })
  })

  const ok = (view, extra = {}) => {
    const t = now() - state.startedAt
    setSteps({ saveEndMs: state.steps.saveEndMs ?? t, sendEndMs: t })
    set({ status: 'done', uploadPercent: state.progressSupported ? 100 : null, uploadDone: true, retrying: false, offline: false, mode: 'normal' })
    return { ok: true, view, metrics: { totalMs: t, uploadMs: state.steps.saveEndMs, slowShown: state.slowShown }, ...extra }
  }
  const fail = (err, extra = {}) => {
    set({ status: 'failed', retrying: false, offline: false })
    return { ok: false, code: err?.code || 'unknown', message: err?.message || '', status: err?.status, ...extra, metrics: { totalMs: now() - state.startedAt, slowShown: state.slowShown } }
  }
  const checkNow = async (checkStatus) => { try { return await checkStatus() } catch { return null } }

  // submit({ onProgress, signal }) -> Promise<view>;  checkStatus() -> Promise<view>  (GET /api/payments/:id)
  // checkFirst: this is a RETRY of an earlier attempt, so ask the server before sending anything.
  async function run({ submit, checkStatus, fileSize = 0, checkFirst = false }) {
    cancelled = false; timedOut = false
    const startedAt = now()
    state = initial()
    set({ status: 'sending', startedAt, fileSize, lastProgressAt: startedAt, steps: { confirmedMs: 0, saveStartMs: 0, saveEndMs: null, sendEndMs: null } })
    const interval = setInterval(tick, 1000)
    try {
      if (checkFirst) {
        const v = await checkNow(checkStatus)
        if (v && SETTLED.includes(v.paymentStatus)) return ok(v, { alreadyRecorded: true })
      }
      for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
        abort = new AbortController()
        if (attempt === 1) { const t0 = now() - startedAt; setSteps({ confirmedMs: t0, saveStartMs: t0 }) } // step 1 ends where step 2 begins
        set({ attempt, retrying: false, offline: false, uploadPercent: state.progressSupported ? 0 : null, uploadDone: false, lastProgressAt: now() })
        try {
          const view = await submit({ signal: abort.signal, onProgress })
          return ok(view)
        } catch (err) {
          if (timedOut) return fail({ code: 'timeout', message: 'This took too long. Check your connection and try again.' }, { timedOut: true })
          if (cancelled || err?.code === 'aborted') return { ok: false, cancelled: true, code: 'aborted', metrics: { totalMs: now() - state.startedAt, slowShown: state.slowShown } }
          if (err?.code === 'ALREADY_SUBMITTED' || err?.code === 'PAYMENT_ALREADY_VERIFIED') {
            const v = await checkNow(checkStatus)
            return v && SETTLED.includes(v.paymentStatus) ? ok(v, { alreadyRecorded: true }) : fail(err)
          }
          if (!isNetworkError(err) || attempt === config.maxAttempts) return fail(err, { retry: isNetworkError(err) })
          // A network error: wait (until the connection is back, if it dropped), then ask the server before trying again.
          set({ retrying: true })
          if (!isOnline()) { set({ offline: true }); await untilOnline(); set({ offline: false }) } else { await pause(config.backoffMs * attempt) }
          if (timedOut) return fail({ code: 'timeout', message: 'This took too long. Check your connection and try again.' }, { timedOut: true })
          if (cancelled) return { ok: false, cancelled: true, code: 'aborted' }
          const v = await checkNow(checkStatus)
          if (v && SETTLED.includes(v.paymentStatus)) return ok(v, { alreadyRecorded: true })
        }
      }
      return fail({ code: 'unknown' })
    } finally {
      clearInterval(interval)
      abort = null
    }
  }

  return {
    run,
    cancel() { cancelled = true; if (state.status === 'sending') { abort?.abort(); wake?.(); set({ status: 'cancelled' }) } },
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    tick,
  }
}
