// Tests for the browser-side payment helpers (run with:  npx vitest run src/utils/payments.test.js).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { friendlyPaymentError, PAYMENT_MESSAGES } from './paymentMessages'

const store = new Map()
vi.stubGlobal('sessionStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) })

describe('friendly payment messages', () => {
  it('turns Stripe.js errors into plain sentences', () => {
    expect(friendlyPaymentError({ code: 'card_declined', decline_code: 'insufficient_funds' }).message).toMatch(/enough funds/)
    expect(friendlyPaymentError({ code: 'expired_card' }).message).toMatch(/expired/)
    expect(friendlyPaymentError({ code: 'incorrect_cvc' }).code).toBe('incorrect_cvc')
    expect(friendlyPaymentError({ code: 'payment_intent_authentication_failure' }).message).toMatch(/3D Secure/)
  })
  it('a dropped connection is reported as a network problem', () => {
    expect(friendlyPaymentError(new TypeError('Failed to fetch'))).toEqual({ code: 'network', message: PAYMENT_MESSAGES.network })
  })
  it('unknown errors never leak their code or text', () => {
    const f = friendlyPaymentError({ code: 'weird_new_code', message: 'Error: boom at line 99' })
    expect(f.code).toBe('unknown')
    expect(f.message).not.toMatch(/weird_new_code|boom|line 99/)
  })
})

describe('booking payment helpers', () => {
  beforeEach(() => store.clear())

  it('keys are long enough for the server and unique', async () => {
    const { newKey } = await import('./bookingPayments')
    const keys = new Set(Array.from({ length: 200 }, newKey))
    expect(keys.size).toBe(200)
    expect([...keys].every((k) => /^[\w-]{16,80}$/.test(k))).toBe(true)
  })

  it('remembers only the booking id, token and attempt for a refresh, and forgets them when finished', async () => {
    const { save, loadSaved, clearSaved } = await import('./bookingPayments')
    save({ bookingId: 'b1', token: 't1' })
    save({ attemptId: 'a1' })
    expect(loadSaved()).toEqual({ bookingId: 'b1', token: 't1', attemptId: 'a1' })
    clearSaved()
    expect(loadSaved()).toBe(null)
  })

  it('API errors become friendly messages, and a dropped connection is a "network" error', async () => {
    const { getStatus, startBooking } = await import('./bookingPayments')
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(getStatus('a1', 't')).rejects.toMatchObject({ code: 'network', message: PAYMENT_MESSAGES.network })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'That time slot is no longer available. Please pick another time.', code: 'SLOT_TAKEN' }) })))
    await expect(startBooking({}, 'k'.repeat(20))).rejects.toMatchObject({ code: 'SLOT_TAKEN', status: 409 })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('not json')) })))
    await expect(startBooking({}, 'k'.repeat(20))).rejects.toMatchObject({ message: PAYMENT_MESSAGES.unavailable })
  })

  it('sends the booking token in a header, never in the URL', async () => {
    const { getStatus } = await import('./bookingPayments')
    const spy = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 'processing' }) }))
    vi.stubGlobal('fetch', spy)
    await getStatus('a1', 'secret-token')
    const [url, init] = spy.mock.calls[0]
    expect(url).not.toContain('secret-token')
    expect(init.headers['x-booking-token']).toBe('secret-token')
  })
})

describe('Payment submitted screen helpers', () => {
  it('formats a reference in groups and keeps only digits', async () => {
    const { formatReference, referenceDigits } = await import('../components/PendingVerification.jsx')
    expect(formatReference('1234567890123')).toBe('1234 567 890 123')
    expect(formatReference('12a3-4 5')).toBe('1234 5')
    expect(formatReference('12345678901234567890')).toBe('1234 567 890 123 456') // capped at 16 digits
    expect(referenceDigits('1234 567 890 123')).toBe('1234567890123')
  })
  it('validates like the server: GCash exactly 13 digits, Maya 10 to 16, empty is fine', async () => {
    const { referenceError } = await import('../components/PendingVerification.jsx')
    expect(referenceError('')).toBe('')
    expect(referenceError('1234 567 890 123', false)).toBe('')
    expect(referenceError('1234 567', false)).toMatch(/13-digit/)
    expect(referenceError('1234567890', true)).toBe('')
    expect(referenceError('12345', true)).toMatch(/Maya/)
  })
})
