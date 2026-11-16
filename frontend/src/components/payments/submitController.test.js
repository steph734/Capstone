// Tests for the "Sending your payment details" logic (run with:  npx vitest run src/components/payments/submitController.test.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSubmitController, formatElapsed, isSlow } from './submitController'
import { SLOW_AFTER_SECONDS, STALL_SECONDS, HARD_TIMEOUT_SECONDS } from './sendingConfig'


const sec = (n) => vi.advanceTimersByTimeAsync(n * 1000)
const VIEW = { paymentStatus: 'proof_submitted', receivedByTherapist: true }

// A submit() whose result the test controls, and which rejects like the real XHR when aborted.
function pendingSubmit() {
  const calls = []
  const submit = vi.fn(({ signal, onProgress }) => new Promise((resolve, reject) => {
    const call = { onProgress, signal, resolve: (v) => resolve(v), reject }
    calls.push(call)
    signal.addEventListener('abort', () => reject(Object.assign(new Error('Cancelled.'), { code: 'aborted' })), { once: true })
  }))
  return { submit, calls }
}

describe('sending modal logic', () => {
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('timer formatting', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatElapsed(9000)).toBe('0:09')
    expect(formatElapsed(65000)).toBe('1:05')
    expect(formatElapsed(3723000)).toBe('1:02:03')
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(-5)).toBe('0:00')
  })
  it('is computed from timestamps, so a throttled background tab still shows the right time', () => {
    const t0 = Date.now()
    vi.setSystemTime(t0 + 47_000) // the tab slept: no interval ticks happened
    expect(formatElapsed(Date.now() - t0)).toBe('0:47')
  })
})

describe('slow state', () => {
  it('turns slow when the elapsed time reaches SLOW_AFTER_SECONDS, even while bytes keep moving', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(0)
    for (let i = 0; i < SLOW_AFTER_SECONDS - 1; i += 1) { calls[0].onProgress(0.01 * i); await sec(1) }
    expect(c.getState().mode).toBe('normal')
    await sec(1)
    expect(c.getState().mode).toBe('slow')
    expect(c.getState().slowShown).toBe(true)
  })

  it('turns slow when the upload stalls for STALL_SECONDS, and returns to normal when progress resumes', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(0)
    calls[0].onProgress(0.3)
    await sec(STALL_SECONDS - 1)
    expect(c.getState().mode).toBe('normal')
    await sec(1)
    expect(c.getState().mode).toBe('slow')
    calls[0].onProgress(0.5) // progress is back
    expect(c.getState().mode).toBe('normal')
    expect(c.getState().uploadPercent).toBe(50)
  })

  it('does not call a finished upload "stalled" while the server is saving', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(0)
    calls[0].onProgress(1)
    await sec(STALL_SECONDS + 5)
    expect(c.getState()).toMatchObject({ mode: 'normal', uploadDone: true, uploadPercent: 100 })
  })

  it('isSlow is a pure rule', () => {
    const base = { elapsedMs: 5000, sinceProgressMs: 0, uploading: true, progressSupported: true }
    expect(isSlow(base)).toBe(false)
    expect(isSlow({ ...base, elapsedMs: 30000 })).toBe(true)
    expect(isSlow({ ...base, sinceProgressMs: 10000 })).toBe(true)
    expect(isSlow({ ...base, sinceProgressMs: 10000, progressSupported: false })).toBe(false)
  })
})

describe('no progress events available', () => {
  it('shows no percentage and never uses the stall rule', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(0)
    calls[0].onProgress(null)
    await sec(20)
    expect(c.getState()).toMatchObject({ uploadPercent: null, progressSupported: false, mode: 'normal' })
  })
})

describe('hard timeout and cancel', () => {
  it(`aborts by itself after ${HARD_TIMEOUT_SECONDS} seconds`, async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    const done = c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(HARD_TIMEOUT_SECONDS + 1)
    const out = await done
    expect(calls[0].signal.aborted).toBe(true)
    expect(out).toMatchObject({ ok: false, code: 'timeout', timedOut: true, message: 'This took too long. Check your connection and try again.' })
  })

  it('cancel aborts the request and reports "cancelled" (the screen keeps the inputs)', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    const done = c.run({ submit, checkStatus: vi.fn(), fileSize: 1000 })
    await sec(3)
    c.cancel()
    expect(calls[0].signal.aborted).toBe(true)
    expect(await done).toMatchObject({ ok: false, cancelled: true })
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('a retry after a cancel asks the server first and never creates a second record', async () => {
    const c = createSubmitController()
    const submit = vi.fn()
    const checkStatus = vi.fn().mockResolvedValue(VIEW) // the cancelled request had actually reached the server
    const out = await c.run({ submit, checkStatus, fileSize: 1000, checkFirst: true })
    expect(checkStatus).toHaveBeenCalledTimes(1)
    expect(submit).not.toHaveBeenCalled()
    expect(out).toMatchObject({ ok: true, alreadyRecorded: true })
  })

  it('a retry after a cancel sends again (same key) only when the server has nothing yet', async () => {
    const c = createSubmitController()
    const submit = vi.fn().mockResolvedValue(VIEW)
    const out = await c.run({ submit, checkStatus: vi.fn().mockResolvedValue({ paymentStatus: 'awaiting_payment' }), fileSize: 1, checkFirst: true })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(out.ok).toBe(true)
  })
})

describe('network errors', () => {
  const netErr = () => Object.assign(new Error('offline'), { code: 'network' })

  it('retries up to 2 more times, checks the server before each retry, and shows the attempt count', async () => {
    const c = createSubmitController()
    const seen = []
    c.subscribe((s) => { if (s.retrying) seen.push(`${s.attempt}/${s.maxAttempts}`) })
    const submit = vi.fn().mockRejectedValueOnce(netErr()).mockRejectedValueOnce(netErr()).mockResolvedValueOnce(VIEW)
    const checkStatus = vi.fn().mockResolvedValue({ paymentStatus: 'awaiting_payment' })
    const done = c.run({ submit, checkStatus, fileSize: 1 })
    await sec(10)
    const out = await done
    expect(out.ok).toBe(true)
    expect(submit).toHaveBeenCalledTimes(3)
    expect(checkStatus).toHaveBeenCalledTimes(2)
    expect(seen).toContain('1/3'); expect(c.getState().attempt).toBe(3)
  })

  it('skips straight to success when the server already has the payment', async () => {
    const c = createSubmitController()
    const submit = vi.fn().mockRejectedValue(netErr())
    const done = c.run({ submit, checkStatus: vi.fn().mockResolvedValue(VIEW), fileSize: 1 })
    await sec(5)
    expect(await done).toMatchObject({ ok: true, alreadyRecorded: true })
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('gives up after the last attempt and asks for "Try again"', async () => {
    const c = createSubmitController()
    const submit = vi.fn().mockRejectedValue(netErr())
    const done = c.run({ submit, checkStatus: vi.fn().mockResolvedValue({ paymentStatus: 'awaiting_payment' }), fileSize: 1 })
    await sec(20)
    expect(await done).toMatchObject({ ok: false, code: 'network', retry: true })
    expect(submit).toHaveBeenCalledTimes(3)
  })

  it('waits for the connection when offline, then continues', async () => {
    let online = false
    let back
    const c = createSubmitController({ isOnline: () => online, waitOnline: () => new Promise((r) => { back = r }) })
    const submit = vi.fn().mockRejectedValueOnce(netErr()).mockResolvedValueOnce(VIEW)
    const done = c.run({ submit, checkStatus: vi.fn().mockResolvedValue({ paymentStatus: 'awaiting_payment' }), fileSize: 1 })
    await sec(1)
    expect(c.getState().offline).toBe(true)
    expect(submit).toHaveBeenCalledTimes(1)
    online = true; back()
    await sec(1)
    expect(c.getState().offline).toBe(false)
    expect((await done).ok).toBe(true)
  })

  it('does not retry server answers (wrong reference, hold ended...) and keeps the code', async () => {
    for (const code of ['INVALID_REFERENCE', 'REFERENCE_ALREADY_USED', 'INVALID_FILE_TYPE', 'FILE_TOO_LARGE', 'SLOT_NO_LONGER_AVAILABLE', 'HOLD_EXPIRED']) {
      const c = createSubmitController()
      const submit = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code, status: 409 }))
      const out = await c.run({ submit, checkStatus: vi.fn(), fileSize: 1 })
      expect(out).toMatchObject({ ok: false, code })
      expect(submit).toHaveBeenCalledTimes(1)
    }
  })

  it('ALREADY_SUBMITTED goes to success when the server confirms the proof is stored', async () => {
    const c = createSubmitController()
    const submit = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'ALREADY_SUBMITTED', status: 409 }))
    const out = await c.run({ submit, checkStatus: vi.fn().mockResolvedValue(VIEW), fileSize: 1 })
    expect(out).toMatchObject({ ok: true, alreadyRecorded: true })
  })
})

describe('real step times and success', () => {
  it('records how long each step took', async () => {
    const c = createSubmitController(); const { submit, calls } = pendingSubmit()
    const done = c.run({ submit, checkStatus: vi.fn(), fileSize: 1200000 })
    await sec(0)
    await sec(4)
    calls[0].onProgress(0.5)
    expect(c.getState().uploadedBytes).toBe(600000)
    calls[0].resolve(VIEW)
    const out = await done
    expect(out.ok).toBe(true)
    expect(c.getState()).toMatchObject({ status: 'done', uploadPercent: 100 })
    expect(c.getState().steps.saveEndMs).toBe(4000)
    expect(out.metrics).toMatchObject({ totalMs: 4000, slowShown: false })
  })
})

})
