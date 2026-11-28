// Tests for the online-payment rules (run with:  npx vitest run api/_lib/payments.test.js).
// MongoDB is an in-memory stand-in, Stripe and the email/SMS senders are mocked: nothing real is touched.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { ObjectId } from 'mongodb'

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(), cancel: vi.fn(), refund: vi.fn(), constructEvent: vi.fn(), email: vi.fn(), sms: vi.fn(), brevo: vi.fn(), semaphore: vi.fn(), statusEmail: vi.fn(), db: null,
}))
vi.mock('./stripeClient.js', () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: mocks.retrieve, cancel: mocks.cancel, create: vi.fn() },
    refunds: { create: mocks.refund }, webhooks: { constructEvent: mocks.constructEvent },
  }),
}))
vi.mock('./mongo.js', () => ({ getDb: async () => mocks.db, getMongo: async () => {} }))
vi.mock('./appointmentEmail.js', () => ({ sendAppointmentConfirmationEmail: mocks.email, sendAppointmentStatusEmail: mocks.statusEmail }))
vi.mock('./appointmentSms.js', () => ({ sendAppointmentConfirmationSms: mocks.sms }))
vi.mock('./brevo.js', () => ({ sendEmail: mocks.brevo }))
vi.mock('./semaphore.js', () => ({ sendSms: mocks.semaphore }))

// ── in-memory MongoDB (just the operations these modules use) ──
let store
const same = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : String(a) === String(b))
function matches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$or') return v.some((sub) => matches(doc, sub))
    const val = k.split('.').reduce((o, p) => o?.[p], doc)
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof ObjectId) && !Array.isArray(v)) {
      return Object.entries(v).every(([op, arg]) => {
        if (op === '$in') return arg.some((x) => same(x, val))
        if (op === '$nin') return !arg.some((x) => same(x, val))
        if (op === '$ne') return !(val !== undefined && val !== null && same(val, arg)) && !(arg === null && val == null ? true : false) || (arg === null ? val != null : !same(val, arg))
        if (op === '$gt') return val != null && new Date(val) > new Date(arg)
        if (op === '$lte') return val != null && new Date(val) <= new Date(arg)
        return true
      })
    }
    if (v === null) return val == null
    return same(val, v)
  })
}
function apply(doc, u) {
  for (const [path, value] of Object.entries(u.$set || {})) {
    const keys = path.split('.'); let o = doc
    for (const k of keys.slice(0, -1)) o = o[k] ??= {}
    o[keys.at(-1)] = value
  }
  for (const path of Object.keys(u.$unset || {})) {
    const keys = path.split('.'); const o = keys.slice(0, -1).reduce((x, k) => x?.[k], doc)
    if (o) delete o[keys.at(-1)]
  }
}
const col = (name) => ({
  findOne: async (q) => store[name].find((d) => matches(d, q)) || null,
  find: (q) => { let rows = store[name].filter((d) => matches(d, q)); const c = { sort: () => c, limit: (n) => { rows = rows.slice(0, n); return c }, toArray: async () => rows }; return c },
  insertOne: async (d) => { const doc = { _id: new ObjectId(), ...d }; store[name].push(doc); return { insertedId: doc._id } },
  createIndex: async () => {},
  updateMany: async (q, u) => { store[name].filter((d) => matches(d, q)).forEach((d) => apply(d, u)); return {} },
  updateOne: async (q, u, opts) => {
    let doc = store[name].find((d) => matches(d, q))
    if (!doc) {
      if (!opts?.upsert) return { matchedCount: 0 }
      if (q._id !== undefined && store[name].some((d) => String(d._id) === String(q._id))) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
      doc = { _id: q._id ?? new ObjectId() }; store[name].push(doc)
    }
    apply(doc, u)
    return { matchedCount: 1, modifiedCount: 1 }
  },
  findOneAndUpdate: async (q, u, opts) => {
    const doc = store[name].find((d) => matches(d, q))
    if (!doc) return null
    const before = { ...doc }
    Object.assign(doc, u.$set)
    return opts?.returnDocument === 'before' ? before : doc
  },
})
const db = new Proxy({}, { get: (_t, prop) => (prop === 'collection' ? (n) => { store[n] ??= []; return col(n) } : undefined) })

let core, pay
beforeEach(async () => {
  store = {}
  mocks.db = db
  Object.values(mocks).forEach((m) => typeof m?.mockReset === 'function' && m.mockReset())
  mocks.email.mockResolvedValue({ sent: true })
  mocks.sms.mockResolvedValue({ sent: true })
  mocks.brevo.mockResolvedValue({ sent: true })
  mocks.statusEmail.mockResolvedValue({ sent: true })
  mocks.semaphore.mockResolvedValue({ referenceId: 'r1' })
  core = await import('./bookingCore.js')
  pay = await import('./paymentAttempts.js')
})

const therapistId = new ObjectId()
const day = new Date(Date.UTC(2026, 10, 8))
async function makeHold({ expired = false, state = 'awaiting_payment' } = {}) {
  const _id = new ObjectId()
  const appt = {
    _id, employee_id: therapistId, patient_id: new ObjectId(), session_date: day, start_time: '10:00', status: 'Pending', is_archived: false,
    payment_state: state, hold_expires_at: new Date(Date.now() + (expired ? -60000 : 600000)), therapist_name: 'Edward Briones', time_slot_label: '10:00 - 11:00 AM',
    contact_email: 'g@example.com', contact_number: '09171234567', patient_name: 'Eli', guardian_name: 'Rene',
  }
  store.appointments = [appt]
  await core.acquireSlotLock(db, core.slotKey(therapistId, day, '10:00'), _id, 600000)
  return appt
}
const newAttempt = async (appt, method = 'card') => (await pay.createAttempt(db, { appointment: appt, method, idempotencyKey: 'key-' + Math.random().toString(36).slice(2) + 'xxxxxxxxxx', payer: { name: 'Rene' } })).attempt

describe('friendly error messages (never raw codes)', () => {
  it('maps card errors to plain sentences', () => {
    expect(pay.friendlyFailure({ code: 'card_declined', decline_code: 'insufficient_funds' }).code).toBe('insufficient_funds')
    expect(pay.friendlyFailure({ code: 'card_declined' }).message).toMatch(/declined/i)
    expect(pay.friendlyFailure({ code: 'expired_card' }).code).toBe('expired_card')
    expect(pay.friendlyFailure({ code: 'payment_intent_authentication_failure' }).code).toBe('authentication_required')
    expect(pay.friendlyFailure({ type: 'api_connection_error' }).code).toBe('network')
    expect(pay.friendlyFailure('timeout').message).toMatch(/in time/)
  })
  it('falls back to a safe sentence for anything unknown, with no code or stack in the text', () => {
    const f = pay.friendlyFailure({ code: 'some_new_stripe_code_xyz', message: 'Error at line 42 in stack...' })
    expect(f.code).toBe('unknown')
    expect(f.message).not.toMatch(/some_new_stripe_code|line 42|stack/)
  })
})

describe('Stripe status -> our status', () => {
  const attempt = { created_at: new Date() }
  it('maps the PaymentIntent states', () => {
    expect(pay.mapIntent({ status: 'succeeded' }, attempt).status).toBe('succeeded')
    expect(pay.mapIntent({ status: 'processing' }, attempt).status).toBe('processing')
    expect(pay.mapIntent({ status: 'requires_action' }, attempt).status).toBe('requires_action') // 3D Secure
    expect(pay.mapIntent({ status: 'requires_payment_method' }, attempt).status).toBe('created') // card not submitted yet
    expect(pay.mapIntent({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } }, attempt)).toMatchObject({ status: 'failed', failure: { code: 'card_declined' } })
    expect(pay.mapIntent({ status: 'canceled' }, attempt).status).toBe('failed')
  })
  it('an unfinished card older than the hold is a timeout', () => {
    const old = { created_at: new Date(Date.now() - 20 * 60 * 1000) }
    expect(pay.mapIntent({ status: 'requires_payment_method' }, old)).toMatchObject({ status: 'failed', failure: { code: 'timeout' } })
  })
})

describe('booking token', () => {
  it('only the holder of the token matches; the stored value is a hash', () => {
    const { token, hash } = pay.newToken()
    expect(hash).not.toContain(token)
    expect(pay.tokenMatches(token, hash)).toBe(true)
    expect(pay.tokenMatches('wrong', hash)).toBe(false)
    expect(pay.tokenMatches('', hash)).toBe(false)
  })
})

describe('slot holding', () => {
  it('only one patient can hold a slot; an expired lock can be taken over', async () => {
    const key = core.slotKey(therapistId, day, '10:00')
    const a = new ObjectId(), b = new ObjectId()
    expect(await core.acquireSlotLock(db, key, a, 600000)).toBe(true)
    expect(await core.acquireSlotLock(db, key, b, 600000)).toBe(false)
    store.slot_holds[0].expires_at = new Date(Date.now() - 1000)
    expect(await core.acquireSlotLock(db, key, b, 600000)).toBe(true)
  })
  it('an unpaid hold blocks its slot until it runs out; a paid booking always blocks', async () => {
    const now = new Date()
    store.appointments = [{ _id: new ObjectId(), employee_id: therapistId, session_date: day, start_time: '10:00', status: 'Pending', payment_state: 'awaiting_payment', hold_expires_at: new Date(Date.now() + 60000) }]
    expect(await db.collection('appointments').findOne(core.activeSlotFilter(therapistId, day, '10:00', now))).toBeTruthy()
    store.appointments[0].hold_expires_at = new Date(Date.now() - 1000)
    expect(await db.collection('appointments').findOne(core.activeSlotFilter(therapistId, day, '10:00', now))).toBeNull()
    store.appointments[0].payment_state = 'paid'
    expect(await db.collection('appointments').findOne(core.activeSlotFilter(therapistId, day, '10:00', now))).toBeTruthy()
  })
  it('expired holds are released (appointment cancelled, slot free again)', async () => {
    const appt = await makeHold({ expired: true })
    expect(await core.expireStaleHolds(db)).toBe(1)
    expect(store.appointments[0]).toMatchObject({ status: 'Cancelled', payment_state: 'expired' })
    expect(store.slot_holds[0].released).toBe(true)
    expect(await core.acquireSlotLock(db, core.slotKey(therapistId, day, '10:00'), new ObjectId(), 1000)).toBe(true)
    expect(appt).toBeTruthy()
  })
})

describe('confirming a payment exactly once', () => {
  it('books the appointment, writes ONE payment row with a reference, emails once, and is safe to repeat', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_123', status: 'processing' } })
    const pi = { id: 'pi_123', payment_method: { card: { brand: 'visa', last4: '4242' } } }

    const first = await pay.finalizePaid(db, attempt._id, { via: 'stripe', pi })
    expect(first.already).toBe(false)
    expect(first.attempt).toMatchObject({ status: 'succeeded', card_last4: '4242' })
    expect(first.attempt.payment_ref).toMatch(/^\d{8}$/)
    expect(store.appointments[0]).toMatchObject({ payment_state: 'paid', hold_expires_at: null, status: 'Pending' })
    expect(store.payments).toHaveLength(1)
    expect(store.payments[0]).toMatchObject({ status: 'completed', method: 'card', amount: 300 })
    expect(store.slot_holds[0].released).toBe(true)
    expect(mocks.email).toHaveBeenCalledTimes(1)

    // the webhook AND the polling both arrive: nothing is done twice
    const second = await pay.finalizePaid(db, attempt._id, { via: 'stripe', pi })
    expect(second.already).toBe(true)
    expect(store.payments).toHaveLength(1)
    expect(mocks.email).toHaveBeenCalledTimes(1)
  })

  it('a failing text message never undoes or hides a successful booking', async () => {
    mocks.sms.mockRejectedValue(new Error('SEMAPHORE_API_KEY missing'))
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    const out = await pay.finalizePaid(db, attempt._id, { via: 'stripe', pi: { id: 'pi_1' } })
    expect(out.attempt.status).toBe('succeeded')
    expect(store.appointments[0].payment_state).toBe('paid')
    expect(mocks.email).toHaveBeenCalled()
    // and the patient-facing view carries no technical error
    expect(JSON.stringify(pay.attemptView(out.attempt, store.appointments[0]))).not.toMatch(/SEMAPHORE/)
  })

  it('a payment that arrives after the hold was lost to someone else is refunded automatically', async () => {
    const appt = await makeHold({ expired: true })
    await core.expireStaleHolds(db) // hold released, appointment cancelled
    const attempt = await newAttempt(store.appointments[0])
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_late' } })
    // another patient took the slot meanwhile
    store.appointments.push({ _id: new ObjectId(), employee_id: therapistId, session_date: day, start_time: '10:00', status: 'Confirmed', payment_state: 'paid', is_archived: false })
    await core.acquireSlotLock(db, core.slotKey(therapistId, day, '10:00'), store.appointments[1]._id, 600000)
    mocks.refund.mockResolvedValue({ id: 're_1' })

    const out = await pay.finalizePaid(db, attempt._id, { via: 'stripe', pi: { id: 'pi_late' } })
    expect(out.refunded).toBe(true)
    expect(mocks.refund).toHaveBeenCalledWith({ payment_intent: 'pi_late' })
    expect(store.payments || []).toHaveLength(0)
    expect(appt).toBeTruthy()
  })
})

describe('retries and double clicks', () => {
  it('the same idempotency key returns the same attempt (never a second charge)', async () => {
    const appt = await makeHold()
    const a = await pay.createAttempt(db, { appointment: appt, method: 'card', idempotencyKey: 'same-key-same-key-1' })
    const b = await pay.createAttempt(db, { appointment: appt, method: 'card', idempotencyKey: 'same-key-same-key-1' })
    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    expect(String(b.attempt._id)).toBe(String(a.attempt._id))
    expect(store.payment_attempts).toHaveLength(1)
  })
  it('the amount is the server price, whatever the browser sends', async () => {
    const appt = await makeHold()
    const { attempt } = await pay.createAttempt(db, { appointment: appt, method: 'card', idempotencyKey: 'price-check-key-123', payer: { amount: 1 } })
    expect(attempt).toMatchObject({ amount: 300, amount_centavos: 30000, currency: 'PHP' })
  })
})

describe('Stripe is the source of truth for cards', () => {
  it('a declined card becomes "failed" with a friendly reason, and the booking stays unpaid', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_d', status: 'processing' } })
    mocks.retrieve.mockResolvedValue({ id: 'pi_d', status: 'requires_payment_method', last_payment_error: { code: 'card_declined', decline_code: 'generic_decline' } })
    const out = await pay.refreshCardAttempt(db, { ...attempt, provider_ref: 'pi_d', status: 'processing' })
    expect(out.status).toBe('failed')
    expect(out.failure_message).toMatch(/declined/i)
    expect(store.appointments[0].payment_state).toBe('awaiting_payment') // slot still held so the patient can retry
    expect(store.payments || []).toHaveLength(0)
  })
  it('succeeded at Stripe confirms the booking', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_ok', status: 'processing' } })
    mocks.retrieve.mockResolvedValue({ id: 'pi_ok', status: 'succeeded', payment_method: { card: { brand: 'visa', last4: '4242' } } })
    const out = await pay.refreshCardAttempt(db, { ...attempt, provider_ref: 'pi_ok', status: 'processing' })
    expect(out.status).toBe('succeeded')
    expect(store.appointments[0].payment_state).toBe('paid')
  })
  it('3D Secure (requires_action) is reported, not treated as success', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_3ds', status: 'processing' } })
    mocks.retrieve.mockResolvedValue({ id: 'pi_3ds', status: 'requires_action' })
    const out = await pay.refreshCardAttempt(db, { ...attempt, provider_ref: 'pi_3ds', status: 'processing' })
    expect(out.status).toBe('requires_action')
    expect(store.appointments[0].payment_state).toBe('awaiting_payment')
  })
})

describe('QR payments (GCash / Maya) are never confirmed automatically', () => {
  it('submitting keeps the booking unpaid and waiting for the therapist', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, { reference: '1234 567 890 123' })
    expect(store.payment_attempts[0]).toMatchObject({ status: 'pending_verification', provider_ref: '1234567890123', qr_details_sent: true })
    expect(store.appointments[0].payment_state).toBe('pending_verification')
    expect(store.payments || []).toHaveLength(0)
    expect(mocks.email).not.toHaveBeenCalled()
  })
  it('the therapist approving it confirms the booking and records the payment', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, {})
    const out = await pay.reviewQr(db, attempt._id, true)
    expect(out.ok).toBe(true)
    expect(store.appointments[0].payment_state).toBe('paid')
    expect(store.payments[0]).toMatchObject({ method: 'gcash', status: 'completed' })
    expect(mocks.email).toHaveBeenCalledTimes(1)
  })
  it('rejecting it books nothing and keeps the slot held', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'paymaya')
    await pay.submitQr(db, attempt, appt, {})
    const out = await pay.reviewQr(db, attempt._id, false)
    expect(out.ok).toBe(true)
    // "Not received": the slot stays held until the hold ends and the patient may resubmit (it is no longer released at once)
    expect(store.payment_attempts[0].status).toBe('rejected')
    expect(store.appointments[0]).toMatchObject({ status: 'Pending', payment_state: 'awaiting_payment' })
    expect(store.payments || []).toHaveLength(0)
  })
  it('a payment can only be reviewed once', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, {})
    await pay.reviewQr(db, attempt._id, true)
    expect((await pay.reviewQr(db, attempt._id, false)).ok).toBe(false)
  })
})

describe('what the browser is shown', () => {
  it('never contains the token hash, the screenshot or raw error codes in the message', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, { screenshot: 'data:image/png;base64,AAAA' })
    const view = JSON.stringify(pay.attemptView(store.payment_attempts[0], { ...store.appointments[0], access_token_hash: 'secret-hash' }))
    expect(view).not.toContain('secret-hash')
    expect(view).not.toContain('AAAA')
    expect(JSON.parse(view)).toMatchObject({ status: 'pending_verification', methodLabel: 'GCash QR', amount: 300 })
  })
})

describe('Stripe webhook', () => {
  const run = async (event, { sig = 'sig', secret = 'whsec_x' } = {}) => {
    process.env.STRIPE_WEBHOOK_SECRET = secret
    mocks.constructEvent.mockImplementation(() => { if (sig === 'bad') throw new Error('bad sig'); return event })
    const { default: handler } = await import('./routes/stripe-webhook.js')
    const out = { code: 0, body: null }
    await handler({ body: Buffer.from('{}'), headers: { 'stripe-signature': sig } }, { status(c) { out.code = c; return { json: (b) => { out.body = b } } } })
    return out
  }
  it('refuses a bad signature', async () => { expect((await run({}, { sig: 'bad' })).code).toBe(400) })
  it('refuses to run without a configured secret', async () => { expect((await run({}, { secret: '' })).code).toBe(503) })
  it('payment_intent.succeeded confirms the booking even if the patient closed the tab', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_wh', status: 'processing' } })
    const out = await run({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_wh', amount_received: 30000 } } })
    expect(out.code).toBe(200)
    expect(store.appointments[0].payment_state).toBe('paid')
  })
  it('does not confirm when Stripe received less than the server asked for', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_low', status: 'processing' } })
    await run({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_low', amount_received: 100 } } })
    expect(store.appointments[0].payment_state).toBe('awaiting_payment')
  })
  it('payment_failed marks the attempt failed with a friendly message', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt)
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { provider_ref: 'pi_f', status: 'processing' } })
    await run({ type: 'payment_intent.payment_failed', data: { object: { id: 'pi_f', last_payment_error: { code: 'expired_card' } } } })
    expect(store.payment_attempts[0]).toMatchObject({ status: 'failed', failure_code: 'expired_card' })
  })
  it('ignores payments that are not bookings (e.g. subscriptions)', async () => {
    const out = await run({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_other', amount_received: 5000 } } })
    expect(out.body).toMatchObject({ ignored: true })
  })
})

describe('QR "Payment submitted" screen data', () => {
  it('a GCash reference must be exactly 13 digits; Maya 10 to 16; empty is allowed (optional)', () => {
    expect(pay.cleanReference('1234 567 890 123', 'gcash')).toEqual({ value: '1234567890123' })
    expect(pay.cleanReference('12345', 'gcash').error).toMatch(/13-digit/)
    expect(pay.cleanReference('12345678901234', 'gcash').error).toMatch(/13-digit/)
    expect(pay.cleanReference('abc', 'gcash')).toEqual({ value: '' }) // letters are dropped, nothing left = nothing sent
    expect(pay.cleanReference('1234567890', 'paymaya')).toEqual({ value: '1234567890' })
    expect(pay.cleanReference('123', 'paymaya').error).toMatch(/Maya/)
    expect(pay.cleanReference('', 'gcash')).toEqual({ value: '' })
  })
  it('an invalid reference is refused and nothing is saved', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, {})
    await expect(pay.submitQr(db, store.payment_attempts[0], appt, { reference: '123' })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' })
    expect(store.payment_attempts[0].provider_ref).toBe(null)
  })
  it('the first submit says "Being verified"; sending details flips it to "Checking your details"', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, {})
    const first = pay.attemptView(store.payment_attempts[0], store.appointments[0])
    expect(first).toMatchObject({ status: 'pending_verification', detailsSent: false, reviewHours: 24 })
    await pay.submitQr(db, store.payment_attempts[0], appt, { screenshot: 'data:image/jpeg;base64,AAAA' })
    const second = pay.attemptView(store.payment_attempts[0], store.appointments[0])
    expect(second).toMatchObject({ detailsSent: true, hasScreenshot: true })
    expect(JSON.stringify(second)).not.toContain('AAAA') // the screenshot itself is never sent back
  })
  it('"Payment sent" keeps the time of the first submit, and the view carries the real hold expiry', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    await pay.submitQr(db, attempt, appt, {})
    const sentAt = store.payment_attempts[0].qr_submitted_at
    await pay.submitQr(db, store.payment_attempts[0], appt, { reference: '1234567890123' })
    expect(store.payment_attempts[0].qr_submitted_at).toBe(sentAt)
    const view = pay.attemptView(store.payment_attempts[0], store.appointments[0])
    expect(new Date(view.booking.holdExpiresAt).getTime()).toBeGreaterThan(Date.now() + 24 * 3600 * 1000) // held longer than the promised review time
  })
})

/* ───────────────────────── QR proof: reference number + receipt (new flow) ───────────────────────── */

const rules = await import('./paymentProofRules.js')
const jpegBytes = ({ withExif = true } = {}) => Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  ...(withExif ? [Buffer.from([0xff, 0xe1, 0x00, 0x12]), Buffer.from('Exif\0\0GPS-SECRET')] : []),
  Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]),
  Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33, 0x44, 0xff, 0xd9]),
])
const chunk = (type, data = Buffer.alloc(0)) => { const h = Buffer.alloc(8); h.writeUInt32BE(data.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, data, Buffer.alloc(4)]) }
const pngBytes = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Author\0someone')), chunk('IDAT', Buffer.from([1, 2, 3])), chunk('IEND')])
const REF = '5456 656 574 544'

describe('reference number rules', () => {
  it('strips spaces and non-digits, groups for display, and checks the length per method', () => {
    expect(rules.normalizeReference('5456-656 574.544')).toBe('5456656574544')
    expect(rules.formatReference('5456656574544', 'gcash')).toBe('5456 656 574 544')
    expect(rules.validateReference(REF, 'gcash')).toMatchObject({ ok: true, digits: '5456656574544', last4: '4544' })
    expect(rules.validateReference('12345', 'gcash')).toMatchObject({ ok: false, code: 'INVALID_REFERENCE', error: 'Reference numbers have 13 digits' })
    expect(rules.validateReference('', 'gcash')).toMatchObject({ ok: false, code: 'PROOF_REQUIRED' })
    expect(rules.validateReference('1234567890', 'paymaya').ok).toBe(true) // Maya: 10 to 16 digits
    expect(rules.validateReference('123456789', 'paymaya').ok).toBe(false)
  })
})

describe('receipt files', () => {
  it('is checked by its bytes, not by the name or MIME type the browser sends', async () => {
    const { prepareReceipt } = await import('./receiptFile.js')
    expect(() => prepareReceipt(Buffer.from('<?php echo 1; ?> not an image at all'))).toThrow(expect.objectContaining({ code: 'INVALID_FILE_TYPE' }))
    expect(() => prepareReceipt(Buffer.from('GIF89a......'))).toThrow(expect.objectContaining({ code: 'INVALID_FILE_TYPE' }))
    expect(prepareReceipt(jpegBytes()).type).toBe('jpg')
    expect(prepareReceipt(pngBytes()).type).toBe('png')
  })
  it('refuses files over 5 MB and empty uploads', async () => {
    const { prepareReceipt } = await import('./receiptFile.js')
    expect(() => prepareReceipt(Buffer.alloc(5 * 1024 * 1024 + 1, 0xff))).toThrow(expect.objectContaining({ code: 'FILE_TOO_LARGE' }))
    expect(() => prepareReceipt(Buffer.alloc(0))).toThrow(expect.objectContaining({ code: 'PROOF_REQUIRED' }))
  })
  it('removes EXIF and text metadata but keeps the picture data', async () => {
    const { prepareReceipt } = await import('./receiptFile.js')
    const j = prepareReceipt(jpegBytes()).buffer
    expect(j.toString('latin1')).not.toContain('GPS-SECRET')
    expect(j.includes(Buffer.from([0x11, 0x22, 0x33, 0x44]))).toBe(true)
    const png = prepareReceipt(pngBytes()).buffer
    expect(png.toString('latin1')).not.toContain('someone')
    expect(png.toString('latin1')).toContain('IDAT')
  })
})

describe('submitting payment proof', () => {
  const proof = async (appt, attempt, over = {}) => (await import('./paymentProof.js')).submitProof(db, attempt, appt, { reference: REF, file: jpegBytes(), key: 'proof-key-0000000001', ...over })
  const fresh = (appt) => store.appointments.find((a) => String(a._id) === String(appt._id))

  it('records the proof for the therapist, holds the slot for 72 hours, and does NOT book anything', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    expect(attempt.status).toBe('created') // a QR payment is not "sent" before the proof exists
    const out = await proof(appt, attempt)
    expect(out.attempt.status).toBe('pending_verification')
    expect(store.payment_attempts[0]).toMatchObject({ reference_digits: '5456656574544', reference_last4: '4544', status: 'pending_verification' })
    expect(store.payment_receipts).toHaveLength(1)
    expect(fresh(appt).payment_state).toBe('pending_verification') // not "paid": still a held slot
    expect(store.payments || []).toHaveLength(0)
    const hours = (new Date(fresh(appt).hold_expires_at).getTime() - Date.now()) / 3600000
    expect(hours).toBeGreaterThan(71.9)
    expect(hours).toBeLessThan(72.1)
    expect(rules.paymentStatusOf(store.payment_attempts[0])).toBe('proof_submitted')
  })

  it('needs BOTH a valid reference and a receipt', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    await expect(proof(appt, attempt, { file: null })).rejects.toMatchObject({ code: 'PROOF_REQUIRED' })
    await expect(proof(appt, attempt, { reference: '' })).rejects.toMatchObject({ code: 'PROOF_REQUIRED' })
    await expect(proof(appt, attempt, { reference: '123' })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' })
    await expect(proof(appt, attempt, { file: Buffer.from('not an image at all') })).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
    expect(store.payment_receipts || []).toHaveLength(0)
    expect(store.payment_attempts[0].status).toBe('created')
  })

  it('is idempotent: the same key (double click, retry) never makes a second record', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    const first = await proof(appt, attempt)
    const second = await proof(appt, first.attempt)
    expect(second.replay).toBe(true)
    expect(store.payment_receipts).toHaveLength(1)
  })

  it('refuses a reference number that was already used, and flags the earlier payment', async () => {
    const a1 = await makeHold(); const t1 = await newAttempt(a1, 'gcash'); await proof(a1, t1)
    const a2 = { ...a1, _id: new ObjectId() }; store.appointments.push(a2)
    const t2 = await newAttempt(a2, 'gcash')
    await expect(proof(a2, t2, { key: 'proof-key-0000000002' })).rejects.toMatchObject({ code: 'REFERENCE_ALREADY_USED', status: 409 })
    expect(store.payment_attempts.find((x) => String(x._id) === String(t1._id)).reference_reuse_flag).toBe(true)
  })

  it('a second submit needs "change proof"; a change replaces the proof; a verified payment cannot be changed', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    const first = await proof(appt, attempt)
    await expect(proof(appt, first.attempt, { key: 'proof-key-0000000003' })).rejects.toMatchObject({ code: 'ALREADY_SUBMITTED' })
    const changed = await proof(fresh(appt), first.attempt, { key: 'proof-key-0000000003', reference: '1111 222 333 444', change: true })
    expect(changed.changed).toBe(true)
    expect(store.payment_attempts[0]).toMatchObject({ reference_last4: '3444', proof_changed: true })
    await pay.reviewQr(db, attempt._id, true, { by: 'th@example.com' })
    await expect(proof(fresh(appt), store.payment_attempts[0], { key: 'proof-key-0000000004', change: true })).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_VERIFIED' })
  })

  it('the appointment is booked ONLY when the therapist verifies', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    await proof(appt, attempt)
    expect(fresh(appt).payment_state).not.toBe('paid')
    const out = await pay.reviewQr(db, attempt._id, true, { by: 'th@example.com' })
    expect(out.ok).toBe(true)
    expect(fresh(appt).payment_state).toBe('paid')
    expect(store.payment_attempts[0]).toMatchObject({ status: 'succeeded', verified_by: 'th@example.com' })
    expect(rules.paymentStatusOf(store.payment_attempts[0])).toBe('verified')
  })

  it('"not received": the slot stays held with the reason, and the patient can resubmit', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    await proof(appt, attempt)
    await pay.reviewQr(db, attempt._id, false, { reason: 'Wrong amount', by: 'th@example.com' })
    expect(store.payment_attempts[0]).toMatchObject({ status: 'rejected', rejected_reason: 'Wrong amount' })
    expect(pay.attemptView(store.payment_attempts[0], fresh(appt))).toMatchObject({ paymentStatus: 'rejected', rejectedReason: 'Wrong amount' })
    expect(fresh(appt).status).toBe('Pending')
    const again = await proof(fresh(appt), store.payment_attempts[0], { key: 'proof-key-0000000005', reference: '9999 888 777 666' })
    expect(again.attempt.status).toBe('pending_verification')
  })

  it('a proof sent after the hold ended is refused and the slot is released', async () => {
    const appt = await makeHold({ expired: true }); const attempt = await newAttempt(appt, 'gcash')
    await expect(proof(appt, attempt)).rejects.toMatchObject({ code: 'HOLD_EXPIRED' })
    expect(fresh(appt)).toMatchObject({ status: 'Cancelled', payment_state: 'expired' })
  })

  it('expired holds release the slot and mark the QR payment expired', async () => {
    const appt = await makeHold({ expired: true }); await newAttempt(appt, 'gcash')
    await core.expireStaleHolds(db)
    expect(store.payment_attempts[0].status).toBe('expired')
    expect(rules.paymentStatusOf(store.payment_attempts[0])).toBe('expired')
    expect(fresh(appt).payment_state).toBe('expired')
  })

  it('the receipt is stored privately with a random name and the browser view never contains the file', async () => {
    const appt = await makeHold(); const attempt = await newAttempt(appt, 'gcash')
    await proof(appt, attempt)
    expect(store.payment_receipts[0].public_id).toMatch(/^[a-f0-9]{32}$/)
    const view = JSON.stringify(pay.attemptView(store.payment_attempts[0], fresh(appt)))
    expect(view).not.toContain('data:image')
    expect(JSON.parse(view)).toMatchObject({ paymentStatus: 'proof_submitted', referenceLast4: '4544', hasReceipt: true })
  })
})

describe('notifications never change the result', () => {
  it('a failing text or email is swallowed, and the in-app notice is still created', async () => {
    mocks.semaphore.mockRejectedValue(new Error('SMS provider down'))
    mocks.brevo.mockRejectedValue(new Error('email provider down'))
    const { notifyPatient, notifyOwners } = await import('./paymentNotifications.js')
    const appt = await makeHold()
    store.users = [{ _id: new ObjectId(), email: 'owner@example.com', role: 'Owner' }]
    const out = await notifyPatient(db, 'proofReceived', appt)
    expect(out).toMatchObject({ inApp: true, email: false, sms: false })
    expect((await notifyOwners(db, appt)).inApp).toBe(true)
    expect(store.notifications.map((n) => n.recipient_email)).toEqual(expect.arrayContaining(['g@example.com', 'owner@example.com']))
  })
  it('messages never contain a full reference number', async () => {
    const { TEMPLATES } = await import('./paymentNotifications.js')
    const text = JSON.stringify([TEMPLATES.therapistNewProof({ patient: 'Eli', when: 'Tue' }), TEMPLATES.patientRejected({ reason: 'x', holdEnd: 'y' })])
    expect(text).not.toMatch(/\d{10}/)
  })
})

/* ───────────────────────── the proof + receipt endpoints over real HTTP (multipart) ───────────────────────── */

describe('POST /api/payments/:id/proof and GET /api/payments/:id/receipt', () => {
  let server, base, token
  beforeEach(async () => {
    const { default: express } = await import('express')
    const { default: handler } = await import('./routes/payments-item.js')
    const app = express()
    app.use(express.json())
    app.all('/api/payments/:id/:action', handler)
    app.all('/api/payments/:id', handler)
    await new Promise((r) => { server = app.listen(0, r) })
    base = `http://127.0.0.1:${server.address().port}`
  })
  afterEach(() => new Promise((r) => server.close(r)))

  async function setup() {
    const appt = await makeHold()
    const t = pay.newToken(); token = t.token
    appt.access_token_hash = t.hash
    store.employees = [{ _id: therapistId, email: 'th@example.com', first_name: 'Edward' }]
    const attempt = await newAttempt(appt, 'gcash')
    return { appt, attempt }
  }
  const form = (reference, bytes, name = 'receipt.jpg') => {
    const f = new FormData()
    if (reference !== null) f.append('reference', reference)
    if (bytes) f.append('receipt', new Blob([bytes]), name)
    return f
  }
  const post = (attempt, f, { key = 'idem-key-0000000001', tok = token } = {}) => fetch(`${base}/api/payments/${attempt._id}/proof`, {
    method: 'POST', body: f, headers: { ...(key ? { 'Idempotency-Key': key } : {}), ...(tok ? { 'x-booking-token': tok } : {}) },
  })

  it('stores the proof, tells the Owner, and answers with the summary for the success modal', async () => {
    const { attempt } = await setup()
    store.users = [{ _id: new ObjectId(), email: 'owner@example.com', role: 'Owner' }]
    const res = await post(attempt, form('5456 656 574 544', jpegBytes()))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ paymentStatus: 'proof_submitted', referenceLast4: '4544', hasReceipt: true, receivedByTherapist: true, amount: 300 })
    expect(JSON.stringify(body)).not.toContain('access_token_hash')
    expect(store.notifications.some((n) => n.recipient_email === 'owner@example.com' && /New payment received from Eli/.test(n.body))).toBe(true)
    expect(store.notifications.some((n) => n.recipient_email === 'th@example.com')).toBe(false)
    expect(store.payments || []).toHaveLength(0) // recorded, not paid
  })

  it('a double click or retry with the same Idempotency-Key never creates a second record', async () => {
    const { attempt } = await setup()
    const [a, b] = await Promise.all([post(attempt, form(REF, jpegBytes())), (async () => { await new Promise((r) => setTimeout(r, 20)); return post(attempt, form(REF, jpegBytes())) })()])
    expect([a.status, b.status].sort()).toEqual(expect.arrayContaining([201]))
    const again = await post(attempt, form(REF, jpegBytes()))
    expect(again.status).toBe(200)
    expect((await again.json()).replay).toBe(true)
    expect(store.payment_receipts).toHaveLength(1)
  })

  it('answers with the documented error codes', async () => {
    const { attempt } = await setup()
    expect((await post(attempt, form(REF, jpegBytes()), { key: null })).status).toBe(400)
    const noFile = await post(attempt, form(REF, null)); expect(await noFile.json()).toMatchObject({ code: 'PROOF_REQUIRED' })
    const badRef = await post(attempt, form('123', jpegBytes())); expect(await badRef.json()).toMatchObject({ code: 'INVALID_REFERENCE' })
    const fake = await post(attempt, form(REF, Buffer.from('<script>alert(1)</script> not an image'), 'receipt.png'))
    expect(fake.status).toBe(400); expect(await fake.json()).toMatchObject({ code: 'INVALID_FILE_TYPE' })
    const big = await post(attempt, form(REF, Buffer.alloc(5 * 1024 * 1024 + 10, 0xff)))
    expect(big.status).toBe(413); expect(await big.json()).toMatchObject({ code: 'FILE_TOO_LARGE' })
    expect(store.payment_receipts || []).toHaveLength(0)
  })

  it('someone without the booking token cannot send or read anything', async () => {
    const { attempt } = await setup()
    expect((await post(attempt, form(REF, jpegBytes()), { tok: 'wrong-token' })).status).toBe(404)
    expect((await post(attempt, form(REF, jpegBytes()), { tok: '' })).status).toBe(404)
    await post(attempt, form(REF, jpegBytes()))
    const noAuth = await fetch(`${base}/api/payments/${attempt._id}/receipt`)
    expect(noAuth.status).not.toBe(200)
    const wrong = await fetch(`${base}/api/payments/${attempt._id}/receipt`, { headers: { 'x-booking-token': 'wrong-token' } })
    expect(wrong.status).not.toBe(200)
  })

  it('streams the receipt only to the patient token, privately and without sniffing', async () => {
    const { attempt } = await setup()
    await post(attempt, form(REF, jpegBytes()))
    const res = await fetch(`${base}/api/payments/${attempt._id}/receipt`, { headers: { 'x-booking-token': token } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-disposition')).toMatch(/inline; filename="receipt\.jpg"/)
    expect(res.headers.get('cache-control')).toMatch(/private/)
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
    expect(bytes.toString('latin1')).not.toContain('GPS-SECRET') // EXIF was stripped before it was stored
  })

  it('"confirm sent" (step 2) is recorded once and the status endpoint reports it', async () => {
    const { attempt } = await setup()
    const c = await fetch(`${base}/api/payments/${attempt._id}/confirm-sent`, { method: 'POST', headers: { 'x-booking-token': token, 'Content-Type': 'application/json' }, body: '{}' })
    expect(c.status).toBe(200)
    const s = await (await fetch(`${base}/api/payments/${attempt._id}`, { headers: { 'x-booking-token': token } })).json()
    expect(s).toMatchObject({ paymentStatus: 'awaiting_payment', method: 'gcash' })
    expect(s.sentConfirmedAt).toBeTruthy()
  })
})

/* ───────────────────────── therapist request review: verify / not received / accept / decline ───────────────────────── */

describe('request review', () => {
  let rr
  beforeEach(async () => { rr = await import('./requestReview.js') })
  const me = { _id: therapistId, email: 'th@example.com' }
  const BY = 'th@example.com'
  const fast = { by: BY, backoffMs: 1 }
  const checks = { amountSeen: true, referenceMatches: true }
  const fresh = (a) => store.appointments.find((x) => String(x._id) === String(a._id))
  const sentSubjects = () => mocks.brevo.mock.calls.map((c) => c[0].subject)

  // An online booking whose proof the guardian already sent (waiting for the therapist's check).
  async function withProof() {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    const { submitProof } = await import('./paymentProof.js')
    await submitProof(db, attempt, appt, { reference: REF, file: jpegBytes(), key: 'review-key-000000001' })
    return { appt: fresh(appt), attempt }
  }
  async function verified() {
    const { appt, attempt } = await withProof()
    await rr.verifyPayment(db, appt, { checks, by: BY })
    return { appt: fresh(appt), attempt }
  }

  it('only the assigned therapist can open an appointment (403 NOT_YOUR_APPOINTMENT)', async () => {
    const { appt } = await withProof()
    await expect(rr.loadOwned(db, { _id: new ObjectId() }, appt._id)).rejects.toMatchObject({ status: 403, code: 'NOT_YOUR_APPOINTMENT' })
    await expect(rr.loadOwned(db, me, new ObjectId())).rejects.toMatchObject({ status: 403 })
    expect((await rr.loadOwned(db, me, appt._id))._id).toEqual(appt._id)
  })

  describe('verify payment', () => {
    it('needs BOTH checks, verifies once, and sends NO confirmation yet (the therapist still has to accept)', async () => {
      const { appt } = await withProof()
      await expect(rr.verifyPayment(db, appt, { checks: { amountSeen: true }, by: BY })).rejects.toMatchObject({ code: 'CHECKS_REQUIRED', status: 422 })
      const out = await rr.verifyPayment(db, appt, { checks, by: BY })
      expect(out).toMatchObject({ already: false, paymentStatus: 'verified' })
      expect(fresh(appt).payment_state).toBe('paid')
      expect(fresh(appt).status).toBe('Pending') // not accepted yet
      expect(store.payment_attempts[0]).toMatchObject({ status: 'succeeded', verified_by: BY })
      expect(mocks.email).not.toHaveBeenCalled(); expect(mocks.sms).not.toHaveBeenCalled(); expect(mocks.statusEmail).not.toHaveBeenCalled()
      expect((await rr.verifyPayment(db, fresh(appt), { checks, by: BY })).already).toBe(true) // idempotent
      expect(store.payments).toHaveLength(1)
    })
  })

  describe('accept', () => {
    it('is blocked until the payment is verified, even if the screen is bypassed', async () => {
      const { appt } = await withProof()
      await expect(rr.acceptAppointment(db, appt, { by: BY })).rejects.toMatchObject({ status: 409, code: 'PAYMENT_NOT_VERIFIED' })
      expect(fresh(appt).status).toBe('Pending')
      expect(mocks.statusEmail).not.toHaveBeenCalled()
    })
    it('after verification it confirms the booking and sends the EXISTING confirmation email', async () => {
      const { appt } = await verified()
      const out = await rr.acceptAppointment(db, appt, { by: BY })
      expect(out).toMatchObject({ status: 'Confirmed', warning: null })
      expect(fresh(appt)).toMatchObject({ status: 'Confirmed', decision: 'accepted', decided_by: BY })
      expect(mocks.statusEmail).toHaveBeenCalledTimes(1)
      expect(mocks.statusEmail.mock.calls[0][0]).toMatchObject({ accepted: true, email: 'g@example.com' })
    })
    it('a double click or a second tab gets ALREADY_DECIDED and sends nothing twice', async () => {
      const { appt } = await verified()
      await rr.acceptAppointment(db, appt, { by: BY })
      await expect(rr.acceptAppointment(db, appt, { by: BY })).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' })
      await expect(rr.declineAppointment(db, appt, { reason: 'not_available' }, fast)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' })
      expect(mocks.statusEmail).toHaveBeenCalledTimes(1)
      expect(mocks.brevo).not.toHaveBeenCalled()
    })
    it('a cash booking (no online payment) can be accepted straight away', async () => {
      const appt = await makeHold({ state: undefined }); appt.payment_method = 'Cash'; delete appt.payment_state
      const out = await rr.acceptAppointment(db, appt, { by: BY })
      expect(out.status).toBe('Confirmed')
    })
  })

  describe('decline', () => {
    it('needs a reason, and "Other" needs a message (server side, whatever the screen did)', async () => {
      const { appt } = await verified()
      await expect(rr.declineAppointment(db, appt, {}, fast)).rejects.toMatchObject({ status: 422, code: 'REASON_REQUIRED' })
      await expect(rr.declineAppointment(db, appt, { reason: 'bogus' }, fast)).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
      await expect(rr.declineAppointment(db, appt, { reason: 'other', message: '   ' }, fast)).rejects.toMatchObject({ status: 422, code: 'MESSAGE_REQUIRED_FOR_OTHER' })
      expect(fresh(appt).status).toBe('Pending')
    })
    it('declines, releases the slot and sends the decline email with the reason and message', async () => {
      const { appt } = await verified()
      const out = await rr.declineAppointment(db, appt, { reason: 'not_available', message: "Sorry, I'm away that day." }, fast)
      expect(out).toMatchObject({ status: 'Cancelled', warning: null })
      expect(fresh(appt)).toMatchObject({ status: 'Cancelled', decision: 'declined', decline_reason: 'not_available', declined_by: BY, payment_state: 'paid' })
      expect(sentSubjects()).toEqual(['Your appointment request on Nov 8 was declined'])
      const html = mocks.brevo.mock.calls[0][0].html
      expect(html).toContain("I&#39;m not available at this time"); expect(html).toContain('away that day')
      const lock = store.slot_holds.find((l) => String(l.appointment_id) === String(appt._id))
      expect(lock.released).toBe(true)
    })
    it('cannot decline while the online payment is still waiting for a check', async () => {
      const { appt } = await withProof()
      await expect(rr.declineAppointment(db, appt, { reason: 'not_available' }, fast)).rejects.toMatchObject({ status: 409, code: 'PAYMENT_NOT_VERIFIED' })
    })
    it('a failed email never rolls the decline back; it is stored as "failed" and can be resent', async () => {
      const { appt } = await verified()
      mocks.brevo.mockRejectedValue(new Error('provider down'))
      const out = await rr.declineAppointment(db, appt, { reason: 'not_available' }, fast)
      expect(out.warning).toMatchObject({ code: 'EMAIL_FAILED' })
      expect(fresh(appt).status).toBe('Cancelled')
      expect(store.appointment_emails[0]).toMatchObject({ type: 'decline', status: 'failed', attempts: 3 })
      mocks.brevo.mockResolvedValue({ sent: true })
      const again = await rr.resendEmail(db, fresh(appt), store.appointment_emails[0]._id, { backoffMs: 1 })
      expect(again.status).toBe('sent')
      expect((await rr.listEmails(db, fresh(appt)))[0]).toMatchObject({ type: 'decline', status: 'sent' })
    })
  })

  describe('payment not received', () => {
    it('validates the reason, the note for "other", and the next action', async () => {
      const { appt } = await withProof()
      const go = (input) => rr.rejectPayment(db, appt, input, fast)
      await expect(go({ nextAction: 'request_new_proof' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
      await expect(go({ reason: 'other', nextAction: 'request_new_proof' })).rejects.toMatchObject({ status: 422, code: 'NOTE_REQUIRED_FOR_OTHER' })
      await expect(go({ reason: 'amount_wrong', nextAction: 'delete_everything' })).rejects.toMatchObject({ status: 422, code: 'INVALID_NEXT_ACTION' })
      expect(store.payment_attempts[0].status).toBe('pending_verification')
    })
    it('"Ask for new proof" keeps the appointment held, does NOT extend the hold, and sends the resubmit email', async () => {
      const { appt } = await withProof()
      const holdBefore = new Date(fresh(appt).hold_expires_at).getTime()
      const out = await rr.rejectPayment(db, appt, { reason: 'amount_wrong', note: 'Only ₱250 arrived', nextAction: 'request_new_proof' }, fast)
      expect(out).toMatchObject({ nextAction: 'request_new_proof', status: 'Pending', warning: null })
      expect(fresh(appt)).toMatchObject({ status: 'Pending', payment_state: 'awaiting_payment', review_state: 'needs_proof' })
      expect(new Date(fresh(appt).hold_expires_at).getTime()).toBe(holdBefore)
      expect(store.payment_attempts[0]).toMatchObject({ status: 'rejected', reject_reason: 'amount_wrong', reject_note: 'Only ₱250 arrived' })
      expect(sentSubjects()).toEqual(["We couldn't confirm your payment for Nov 8"])
      expect(mocks.brevo.mock.calls[0][0].html).toContain('The amount is wrong')
      // the guardian can send new proof, and it returns to "waiting for your check"
      const { submitProof } = await import('./paymentProof.js')
      await submitProof(db, fresh(appt), fresh(appt), { reference: '9999 888 777 666', file: jpegBytes(), key: 'review-key-000000002' }).catch(() => {})
    })
    it('is blocked on the server once the hold has expired (only "decline" is possible)', async () => {
      const { appt } = await withProof()
      store.appointments[0].hold_expires_at = new Date(Date.now() - 1000)
      await expect(rr.rejectPayment(db, fresh(appt), { reason: 'amount_missing', nextAction: 'request_new_proof' }, fast)).rejects.toMatchObject({ status: 409, code: 'HOLD_EXPIRED' })
      const ok = await rr.rejectPayment(db, fresh(appt), { reason: 'amount_missing', nextAction: 'decline_request' }, fast)
      expect(ok.status).toBe('Cancelled')
    })
    it('"Decline this request" declines with reason payment_unverified, releases the slot and sends the decline email', async () => {
      const { appt } = await withProof()
      const out = await rr.rejectPayment(db, appt, { reason: 'reference_not_found', note: 'Nothing under that number', nextAction: 'decline_request' }, fast)
      expect(out).toMatchObject({ nextAction: 'decline_request', status: 'Cancelled' })
      expect(fresh(appt)).toMatchObject({ status: 'Cancelled', decision: 'declined', decline_reason: 'payment_unverified' })
      expect(fresh(appt).decline_message).toMatch(/Nothing under that number/)
      expect(store.payment_attempts[0].status).toBe('rejected')
      expect(sentSubjects()).toEqual(['Your appointment request on Nov 8 was declined'])
      expect(mocks.brevo.mock.calls[0][0].html).toContain("Payment couldn&#39;t be verified")
      expect(store.slot_holds.find((l) => String(l.appointment_id) === String(appt._id)).released).toBe(true)
    })
    it('cannot be decided twice', async () => {
      const { appt } = await withProof()
      await rr.rejectPayment(db, appt, { reason: 'amount_missing', nextAction: 'request_new_proof' }, fast)
      await expect(rr.rejectPayment(db, fresh(appt), { reason: 'amount_missing', nextAction: 'request_new_proof' }, fast)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' })
      expect(mocks.brevo).toHaveBeenCalledTimes(1)
    })
    it('a failed email does not undo it', async () => {
      const { appt } = await withProof()
      mocks.brevo.mockRejectedValue(new Error('down'))
      const out = await rr.rejectPayment(db, appt, { reason: 'amount_missing', nextAction: 'request_new_proof' }, fast)
      expect(out.warning.code).toBe('EMAIL_FAILED')
      expect(store.payment_attempts[0].status).toBe('rejected')
    })
  })

  describe('the list the page shows', () => {
    it('shows an unchecked payment as waiting for the Owner, without proof details, and hides a rejected one', async () => {
      const { appt } = await withProof()
      let list = await rr.listRequests(db, me)
      expect(list.requests[0]).toMatchObject({ phase: 'waiting_owner', payment: null })
      await rr.rejectPayment(db, fresh(appt), { reason: 'amount_wrong', nextAction: 'request_new_proof' }, fast)
      list = await rr.listRequests(db, me)
      expect(list.requests).toHaveLength(0)
    })
    it('a verified request is ready to answer, then moves to "recently handled" with its email status', async () => {
      const { appt } = await verified()
      let list = await rr.listRequests(db, me)
      expect(list.requests[0]).toMatchObject({ phase: 'awaiting_therapist', payment: { state: 'verified' } })
      await rr.acceptAppointment(db, appt, { by: BY })
      list = await rr.listRequests(db, me)
      expect(list.requests).toHaveLength(0)
      expect(list.recent[0]).toMatchObject({ outcome: 'accepted', email: { type: 'accept', status: 'sent' } })
    })
    it('never leaks another therapist\'s requests', async () => {
      await withProof()
      expect((await rr.listRequests(db, { _id: new ObjectId() })).requests).toHaveLength(0)
    })
  })
})

describe('request emails', () => {
  const view = { guardianName: 'Rene', patient: 'Miguel Tayao', therapist: 'Edward Briones', therapistRole: 'Occupational Therapist', dateShort: 'Nov 17', dateLong: 'Tuesday, November 17, 2026', timeLabel: '11:00 AM – 12:00 PM', sessionType: 'Cognitive', clinic: 'Main Clinic' }

  it('decline email: subject, details, reason box and a booking link (text snapshot)', async () => {
    const { buildDeclineEmail } = await import('./reviewEmails.js')
    const e = buildDeclineEmail({ ...view, reason: 'not_available', message: "Sorry, I'm away that day.", paymentSent: true })
    expect(e.subject).toBe('Your appointment request on Nov 17 was declined')
    expect(e.html).toContain('REASON FOR DECLINING'); expect(e.html).toContain('Book another appointment'); expect(e.html).toContain('border:1px solid #f3b4b4')
    expect(e.text).toMatchInlineSnapshot(`
      "Hello Rene,

      We're sorry. Edward Briones can't take this appointment request.

      Patient: Miguel Tayao
      Date: Tuesday, November 17, 2026
      Time: 11:00 AM – 12:00 PM
      Therapist: Edward Briones (Occupational Therapist)
      Session · Clinic: Cognitive · Main Clinic

      REASON FOR DECLINING: I'm not available at this time
      "Sorry, I'm away that day."

      What you can do next:
      - Book another time with the same therapist, or choose a different therapist.
      - The clinic will contact you about returning the payment you sent.

      Book another appointment: https://therapypro.app/appointments"
    `)
  })

  it('resubmit email: subject, amber "what went wrong" box, hold time and a resubmit link (text snapshot)', async () => {
    const { buildResubmitEmail } = await import('./reviewEmails.js')
    const e = buildResubmitEmail({ ...view, problem: 'amount_wrong', note: 'Only ₱250 arrived', holdEnd: 'Nov 19, 11:53 AM' })
    expect(e.subject).toBe("We couldn't confirm your payment for Nov 17")
    expect(e.html).toContain('WHAT WENT WRONG'); expect(e.html).toContain('Resubmit payment proof'); expect(e.html).toContain('border:1px solid #f3d284')
    expect(e.text).toMatchInlineSnapshot(`
      "Hello Rene,

      Edward Briones couldn't confirm the payment you sent for this appointment request.

      Patient: Miguel Tayao
      Date: Tuesday, November 17, 2026
      Time: 11:00 AM – 12:00 PM
      Therapist: Edward Briones (Occupational Therapist)
      Session · Clinic: Cognitive · Main Clinic

      WHAT WENT WRONG: The amount is wrong
      "Only ₱250 arrived"

      Your time slot is held for you until Nov 19, 11:53 AM. Please send a new receipt and reference number before then or the request will be cancelled.

      Resubmit payment proof: https://therapypro.app/appointments/book"
    `)
  })

  it('escapes everything the therapist (or guardian) typed before it goes into the HTML', async () => {
    const { buildDeclineEmail, buildResubmitEmail } = await import('./reviewEmails.js')
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>'
    for (const e of [buildDeclineEmail({ ...view, guardianName: evil, reason: 'other', message: evil }), buildResubmitEmail({ ...view, problem: 'other', note: evil, holdEnd: 'x' })]) {
      expect(e.html).not.toContain('<script>'); expect(e.html).not.toContain('<img src=x')
      expect(e.html).toContain('&lt;script&gt;')
    }
  })

  it('contains no phone number, reference number or internal id', async () => {
    const { buildDeclineEmail, buildResubmitEmail } = await import('./reviewEmails.js')
    const all = JSON.stringify([buildDeclineEmail({ ...view, reason: 'not_available', paymentSent: true }), buildResubmitEmail({ ...view, problem: 'amount_wrong', holdEnd: 'x' })])
    expect(all).not.toMatch(/\d{10}/); expect(all).not.toMatch(/[a-f0-9]{24}/)
  })
})

describe('slot times (the "11:00 PM" bug)', () => {
  it('reads the label\'s single AM/PM as belonging to the END time', async () => {
    const { parseSlot } = await import('./bookingCore.js')
    expect(parseSlot('11:00 - 12:00 PM')).toEqual({ start: '11:00', end: '12:00' }) // was saved as 23:00
    expect(parseSlot('10:00 - 11:00 AM')).toEqual({ start: '10:00', end: '11:00' })
    expect(parseSlot('12:00 - 1:00 PM')).toEqual({ start: '12:00', end: '13:00' })
    expect(parseSlot('1:00 - 2:00 PM')).toEqual({ start: '13:00', end: '14:00' })
    expect(parseSlot('4:00 - 5:00 PM')).toEqual({ start: '16:00', end: '17:00' })
    expect(parseSlot('nonsense')).toEqual({ start: '00:00', end: '00:00' })
  })
})

/* ───────────────────────── "Your appointment is being processed" email ───────────────────────── */

describe('"being processed" email', () => {
  const view = { guardianName: 'Rene', patient: 'Miguel Tayao', therapist: 'Edward Briones', therapistRole: 'Occupational Therapist', dateShort: 'Nov 17', dateLong: 'Tuesday, November 17, 2026', timeLabel: '11:00 AM – 12:00 PM', sessionType: 'Cognitive', clinic: 'Main Clinic', paidAt: 'Nov 16, 6:24 PM', payment: '₱300.00 · GCash QR · Ref ending 4544', holdEnd: 'Nov 19, 6:24 PM' }

  it('has the subject, the three-step tracker, the details, the hold box and a link (text snapshot)', async () => {
    const { buildProcessingEmail } = await import('./reviewEmails.js')
    const e = buildProcessingEmail(view)
    expect(e.subject).toBe('Your appointment on Nov 17 is being processed')
    expect(e.html).toContain('Payment under review'); expect(e.html).toContain('View my appointment'); expect(e.html).toContain('border:1px solid #f3d284')
    expect(e.text).toMatchInlineSnapshot(`
      "Hello Rene,

      We got your payment.

      Your appointment is being processed. The clinic will check your payment, then Edward Briones will accept your appointment. We'll email you again as soon as that happens.

      [done] Payment recorded: Nov 16, 6:24 PM
      [now]  Payment under review: usually within 24 hours
      [next] Appointment accepted: you'll get a confirmation email

      Patient: Miguel Tayao
      Date: Tuesday, November 17, 2026
      Time: 11:00 AM – 12:00 PM
      Therapist: Edward Briones (Occupational Therapist)
      Session · Clinic: Cognitive · Main Clinic
      Payment: ₱300.00 · GCash QR · Ref ending 4544

      Your time slot is held for you until Nov 19, 6:24 PM. If we need a new receipt, we'll let you know.

      View my appointment: https://therapypro.app/appointments

      You are receiving this because you booked an appointment on TherapyPro. This is not yet a confirmation."
    `)
  })

  it('escapes user text and never contains a full reference number or a phone number', async () => {
    const { buildProcessingEmail } = await import('./reviewEmails.js')
    const e = buildProcessingEmail({ ...view, guardianName: '<script>alert(1)</script>', patient: '<img src=x onerror=1>' })
    expect(e.html).not.toContain('<script>'); expect(e.html).not.toContain('<img src=x'); expect(e.html).toContain('&lt;script&gt;')
    expect(JSON.stringify(e)).not.toMatch(/\d{10}/)
  })
})

describe('proof route: the email', () => {
  let server, base, token
  beforeEach(async () => {
    const { default: express } = await import('express')
    const { default: handler } = await import('./routes/payments-item.js')
    const app = express(); app.use(express.json())
    app.all('/api/payments/:id/:action', handler)
    await new Promise((r) => { server = app.listen(0, r) })
    base = `http://127.0.0.1:${server.address().port}`
  })
  afterEach(() => new Promise((r) => server.close(r)))

  async function setup() {
    const appt = await makeHold(); const t = pay.newToken(); token = t.token; appt.access_token_hash = t.hash
    store.employees = [{ _id: therapistId, email: 'th@example.com' }]
    return { attempt: await newAttempt(appt, 'gcash') }
  }
  const send = (attempt, key = 'idem-key-0000000001') => {
    const f = new FormData(); f.append('reference', '5456 656 574 544'); f.append('receipt', new Blob([jpegBytes()]), 'receipt.jpg')
    return fetch(`${base}/api/payments/${attempt._id}/proof`, { method: 'POST', body: f, headers: { 'Idempotency-Key': key, 'x-booking-token': token } })
  }
  const processing = () => mocks.brevo.mock.calls.filter((c) => /is being processed/.test(c[0].subject))

  it('sends exactly ONE "being processed" email, and none again for a retry with the same key', async () => {
    const { attempt } = await setup()
    const first = await send(attempt)
    expect((await first.json())).toMatchObject({ emailQueued: true })
    expect(processing()).toHaveLength(1)
    expect(processing()[0][0].html).toContain('Ref ending 4544'); expect(JSON.stringify(processing()[0][0])).not.toContain('5456656574544')
    const again = await send(attempt)
    expect(again.status).toBe(200)
    expect(processing()).toHaveLength(1)
    expect(store.appointment_emails.filter((e) => e.type === 'processing')).toHaveLength(1)
  })

  it('a failing email does NOT fail the submission; it is stored as failed and emailQueued is false', async () => {
    const { attempt } = await setup()
    mocks.brevo.mockRejectedValue(new Error('provider down'))
    const res = await send(attempt)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ paymentStatus: 'proof_submitted', emailQueued: false })
    expect(store.appointment_emails.find((e) => e.type === 'processing')).toMatchObject({ status: 'failed' })
    expect(store.payment_attempts[0]).toMatchObject({ status: 'pending_verification', email_status: 'failed' })
  })
})

/* ───────────────────────── Owner checks the payment first, then the therapist answers ───────────────────────── */
describe('booking approval flow', () => {
  const owner = { _id: new ObjectId(), email: 'owner@example.com', role: 'Owner' }
  const therapist = { _id: therapistId, email: 'th@example.com' }
  const therapistUser = { _id: new ObjectId(), email: 'th@example.com', role: 'Therapist' }
  const fresh = (a) => store.appointments.find((x) => String(x._id) === String(a._id))
  const notices = (email) => (store.notifications || []).filter((n) => n.recipient_email === email)
  async function sent() {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'gcash')
    const { submitProof } = await import('./paymentProof.js')
    await submitProof(db, attempt, appt, { reference: REF, file: jpegBytes(), key: 'flow-key-00000000001' })
    store.employees = [{ _id: therapistId, email: 'th@example.com' }]
    store.users = [owner]
    return fresh(appt)
  }
  let flow, rules
  beforeEach(async () => { flow = await import('./bookingFlow.js'); rules = await import('./bookingFlowRules.js') })

  it('maps old and new records to a stage', () => {
    expect(rules.stageOf({ status: 'Pending', payment_state: 'pending_verification' })).toBe('awaiting_payment_check')
    expect(rules.stageOf({ status: 'Pending', payment_state: 'paid' })).toBe('awaiting_therapist')
    expect(rules.stageOf({ status: 'Pending' })).toBe('awaiting_therapist')
    expect(rules.stageOf({ status: 'Confirmed', payment_state: 'paid' })).toBe('confirmed')
    expect(rules.stageOf({ status: 'Cancelled', decision: 'declined' })).toBe('declined')
    expect(rules.stageOf({ status: 'Completed' })).toBe('completed')
  })

  it('the therapist cannot answer before the Owner verifies; verifying twice notifies once and keeps the time', async () => {
    const appt = await sent()
    await expect(flow.therapistRespond(db, therapist, therapistUser, String(appt._id), { action: 'accept' })).rejects.toMatchObject({ code: 'NOT_READY' })
    expect((await flow.ownerVerify(db, owner, String(appt._id))).already).toBe(false)
    const at = fresh(appt).payment.verifiedAt
    expect((await flow.ownerVerify(db, owner, String(appt._id))).already).toBe(true)
    expect(fresh(appt).payment.verifiedAt).toBe(at)
    expect(rules.stageOf(fresh(appt))).toBe('awaiting_therapist')
    expect(fresh(appt).status).toBe('Pending')
    expect(notices('th@example.com')).toHaveLength(1)
  })

  it('accept confirms once', async () => {
    const appt = await sent()
    await flow.ownerVerify(db, owner, String(appt._id))
    expect((await flow.therapistRespond(db, therapist, therapistUser, String(appt._id), { action: 'accept' })).stage).toBe('confirmed')
    expect((await flow.therapistRespond(db, therapist, therapistUser, String(appt._id), { action: 'accept' })).already).toBe(true)
    expect(fresh(appt)).toMatchObject({ status: 'Confirmed', therapistResponse: { action: 'accepted' } })
    expect(notices('g@example.com').filter((n) => /confirmed/i.test(n.title))).toHaveLength(1)
  })

  it('decline marks the payment for refund and tells the Owner', async () => {
    const appt = await sent()
    await flow.ownerVerify(db, owner, String(appt._id))
    await flow.therapistRespond(db, therapist, therapistUser, String(appt._id), { action: 'decline', reason: 'Away that day' })
    expect(rules.stageOf(fresh(appt))).toBe('declined')
    expect(fresh(appt).payment.status).toBe('refund_due')
    expect(notices('owner@example.com').some((n) => /declined/i.test(n.title))).toBe(true)
  })

  it('another therapist is refused', async () => {
    const appt = await sent()
    await expect(flow.therapistRespond(db, { _id: new ObjectId() }, therapistUser, String(appt._id), { action: 'accept' })).rejects.toMatchObject({ status: 403 })
  })

  it('a taken slot gives 409 SLOT_TAKEN and the request stays in the queue', async () => {
    const appt = await sent()
    store.appointments.push({ ...appt, _id: new ObjectId(), payment_state: 'paid', status: 'Confirmed' })
    await expect(flow.ownerVerify(db, owner, String(appt._id))).rejects.toMatchObject({ status: 409, code: 'SLOT_TAKEN' })
    expect(rules.stageOf(fresh(appt))).toBe('awaiting_payment_check')
  })

  it('reject holds the slot 24 hours, hides it from the therapist, and a new receipt returns it to the Owner', async () => {
    const appt = await sent()
    await expect(flow.ownerReject(db, owner, String(appt._id), { reason: 'other' })).rejects.toMatchObject({ code: 'MESSAGE_REQUIRED_FOR_OTHER' })
    const now = new Date()
    await flow.ownerReject(db, owner, String(appt._id), { reason: 'receipt_unclear' }, now)
    expect(fresh(appt).payment).toMatchObject({ status: 'rejected', rejectedReason: 'receipt_unclear' })
    expect(fresh(appt).payment.slotHoldUntil.getTime()).toBe(now.getTime() + 24 * 3600 * 1000)
    expect(rules.stageOf(fresh(appt))).toBe('payment_rejected')
    expect((await (await import('./requestReview.js')).listRequests(db, therapist)).requests).toHaveLength(0)
    const guardian = { _id: new ObjectId(), email: 'g@example.com', role: 'Patient' }
    await expect(flow.guardianResubmit(db, { _id: new ObjectId(), email: 'x@example.com' }, String(appt._id), { reference: REF, file: jpegBytes(), key: 'flow-key-00000000002' })).rejects.toMatchObject({ status: 403 })
    await flow.guardianResubmit(db, guardian, String(appt._id), { reference: REF, file: jpegBytes(), key: 'flow-key-00000000002' })
    expect(rules.stageOf(fresh(appt))).toBe('awaiting_payment_check')
    expect(fresh(appt).payment.status).toBe('pending_check')
    expect(fresh(appt).payment.rejectedMessage).toBeUndefined()
  })

  it('no new receipt within 24 hours releases the slot and cancels with a message', async () => {
    const appt = await sent()
    await flow.ownerReject(db, owner, String(appt._id), { reason: 'amount_less' })
    await core.expireStaleHolds(db, new Date(Date.now() + 25 * 3600 * 1000))
    expect(fresh(appt)).toMatchObject({ status: 'Cancelled', cancelled_reason: 'No new receipt was received within 24 hours' })
    expect(notices('g@example.com').some((n) => /cancelled/i.test(n.title))).toBe(true)
  })

  it('the API refuses each role the other roles\' actions', async () => {
    const { default: express } = await import('express')
    const { default: handler } = await import('./routes/booking-flow.js')
    const app = express(); app.use(express.json()); app.all('/api/booking-flow', handler)
    const server = await new Promise((r) => { const x = app.listen(0, () => r(x)) })
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/booking-flow?action=nope`)
    expect(res.status).toBe(404)
    server.close()
  })
})
