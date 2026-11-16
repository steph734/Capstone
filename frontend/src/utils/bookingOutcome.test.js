// Tests for the booking confirmation page logic and the proof rules the checkout shares with the server
// (run with:  npx vitest run src/utils/bookingOutcome.test.js).
import { describe, expect, it } from 'vitest'
import { bookingOutcome, noticeNote } from './bookingOutcome'
import { checkReceiptFile } from './receiptImage'
import { formatReference, normalizeReference, validateReference, validateReceiptMeta } from '../../api/_lib/paymentProofRules'

const SUCCESS = /Appointment Booked|successfully|confirmed/i
const FAILURE = /couldn't|could not|not saved|failed|not completed/i

describe('the confirmation page shows ONE real state', () => {
  const states = [
    ['cash saving', { payMethod: 'cash', cash: { status: 'saving' } }],
    ['cash saved', { payMethod: 'cash', cash: { status: 'saved' } }],
    ['cash failed', { payMethod: 'cash', cash: { status: 'error', error: 'Please try again.' } }],
    ['online verified', { payMethod: 'stripe', online: { paymentStatus: 'verified' } }],
    ['online proof submitted', { payMethod: 'stripe', online: { paymentStatus: 'proof_submitted' }, therapist: 'Edward Briones' }],
    ['online with nothing', { payMethod: 'stripe', online: null }],
  ]
  it.each(states)('%s never mixes a success text with a failure text', (_name, input) => {
    const o = bookingOutcome(input)
    const text = `${o.heading} ${o.message}`
    expect(['saving', 'booked', 'awaiting_therapist', 'failed']).toContain(o.kind)
    if (o.kind === 'failed') { expect(text).not.toMatch(/Appointment Booked|successfully scheduled/i) }
    if (o.kind === 'booked' || o.kind === 'awaiting_therapist') { expect(text).not.toMatch(FAILURE) }
    expect(SUCCESS.test(o.heading) && FAILURE.test(o.heading)).toBe(false)
  })

  it('online payment with proof says "waiting for the therapist", NOT "Appointment Booked!"', () => {
    const o = bookingOutcome({ payMethod: 'stripe', online: { paymentStatus: 'proof_submitted' }, therapist: 'Edward Briones' })
    expect(o.kind).toBe('awaiting_therapist')
    expect(o.heading).toBe('Payment recorded')
    expect(o.message).toMatch(/Waiting for Edward Briones to confirm/)
  })
  it('only a verified payment or a saved cash booking is "Appointment Booked!"', () => {
    expect(bookingOutcome({ payMethod: 'stripe', online: { paymentStatus: 'verified' } }).heading).toBe('Appointment Booked!')
    const cash = bookingOutcome({ payMethod: 'cash', cash: { status: 'saved' }, amountLabel: '₱300.00' })
    expect(cash.heading).toBe('Appointment Booked!')
    expect(cash.message).toMatch(/Pay ₱300\.00 in cash at the clinic/)
  })
  it('a failed save is one clear failure with the reason, never "booked"', () => {
    const o = bookingOutcome({ payMethod: 'cash', cash: { status: 'error', error: 'That time slot was just taken.' } })
    expect(o).toMatchObject({ kind: 'failed', message: 'That time slot was just taken.' })
  })
})

describe('a failed text or email never changes the result', () => {
  it('is only a small note, and only when the booking really was saved', () => {
    expect(noticeNote('booked', { smsStatus: 'error' })).toBe("We couldn't send a text. Your booking is still saved.")
    expect(noticeNote('awaiting_therapist', { emailStatus: 'error' })).toBe("We couldn't send an email. Your booking is still saved.")
    expect(noticeNote('failed', { smsStatus: 'error', emailStatus: 'error' })).toBe(null)
    expect(noticeNote('saving', { smsStatus: 'error' })).toBe(null)
    // and the outcome itself is computed without them
    expect(bookingOutcome({ payMethod: 'cash', cash: { status: 'saved' } }).kind).toBe('booked')
  })
})

describe('reference number (shared with the server)', () => {
  it('strips spaces and non-digits and keeps a readable grouping', () => {
    expect(normalizeReference('5456 656-574.544')).toBe('5456656574544')
    expect(formatReference('5456656574544', 'gcash')).toBe('5456 656 574 544')
    expect(formatReference('54566', 'gcash')).toBe('5456 6')
  })
  it('GCash needs exactly 13 digits; Maya 10 to 16', () => {
    expect(validateReference('5456 656 574 544', 'gcash')).toMatchObject({ ok: true, count: 13, last4: '4544' })
    expect(validateReference('5456 656 574 54', 'gcash')).toMatchObject({ ok: false, error: 'Reference numbers have 13 digits' })
    expect(validateReference('', 'gcash').ok).toBe(false)
    expect(validateReference('1234567890', 'paymaya').ok).toBe(true)
    expect(validateReference('12345678901234567', 'paymaya').ok).toBe(false)
  })
})

describe('receipt screenshot (browser check)', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const fileOf = (bytes, name = 'r.png', size = bytes.length) => ({ name, size, slice: () => ({ arrayBuffer: async () => bytes.buffer }) })

  it('accepts a real PNG / JPG and refuses anything else, whatever its name says', async () => {
    expect((await checkReceiptFile(fileOf(png))).ok).toBe(true)
    expect((await checkReceiptFile(fileOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), 'r.jpg'))).ok).toBe(true)
    const fake = await checkReceiptFile(fileOf(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]), 'receipt.png'))
    expect(fake).toMatchObject({ ok: false, code: 'INVALID_FILE_TYPE' })
  })
  it('refuses files over 5 MB and missing files', async () => {
    expect(await checkReceiptFile(fileOf(png, 'big.png', 5 * 1024 * 1024 + 1))).toMatchObject({ ok: false, code: 'FILE_TOO_LARGE' })
    expect(await checkReceiptFile(null)).toMatchObject({ ok: false, code: 'PROOF_REQUIRED' })
    expect(validateReceiptMeta({ size: 0 }).ok).toBe(false)
  })
})
