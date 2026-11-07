// Tests for the online-payment rules (run with:  npx vitest run api/_lib/payments.test.js).
// MongoDB is an in-memory stand-in, Stripe and the email/SMS senders are mocked: nothing real is touched.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ObjectId } from 'mongodb'

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(), cancel: vi.fn(), refund: vi.fn(), constructEvent: vi.fn(), email: vi.fn(), sms: vi.fn(), db: null,
}))
vi.mock('./stripeClient.js', () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: mocks.retrieve, cancel: mocks.cancel, create: vi.fn() },
    refunds: { create: mocks.refund }, webhooks: { constructEvent: mocks.constructEvent },
  }),
}))
vi.mock('./mongo.js', () => ({ getDb: async () => mocks.db, getMongo: async () => {} }))
vi.mock('./appointmentEmail.js', () => ({ sendAppointmentConfirmationEmail: mocks.email }))
vi.mock('./appointmentSms.js', () => ({ sendAppointmentConfirmationSms: mocks.sms }))

// ── in-memory MongoDB (just the operations these modules use) ──
let store
const same = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : String(a) === String(b))
function matches(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    if (k === '$or') return v.some((sub) => matches(doc, sub))
    const val = doc[k]
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
const col = (name) => ({
  findOne: async (q) => store[name].find((d) => matches(d, q)) || null,
  find: (q) => { let rows = store[name].filter((d) => matches(d, q)); const c = { sort: () => c, limit: (n) => { rows = rows.slice(0, n); return c }, toArray: async () => rows }; return c },
  insertOne: async (d) => { const doc = { _id: new ObjectId(), ...d }; store[name].push(doc); return { insertedId: doc._id } },
  createIndex: async () => {},
  updateMany: async (q, u) => { store[name].filter((d) => matches(d, q)).forEach((d) => Object.assign(d, u.$set)); return {} },
  updateOne: async (q, u, opts) => {
    let doc = store[name].find((d) => matches(d, q))
    if (!doc) {
      if (!opts?.upsert) return { matchedCount: 0 }
      if (q._id !== undefined && store[name].some((d) => String(d._id) === String(q._id))) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
      doc = { _id: q._id ?? new ObjectId() }; store[name].push(doc)
    }
    Object.assign(doc, u.$set || {})
    return { matchedCount: 1 }
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
    await pay.submitQr(db, attempt, appt, { reference: 'GC 123456789' })
    expect(store.payment_attempts[0]).toMatchObject({ status: 'pending_verification', provider_ref: 'GC 123456789' })
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
  it('rejecting it releases the slot and books nothing', async () => {
    const appt = await makeHold()
    const attempt = await newAttempt(appt, 'paymaya')
    await pay.submitQr(db, attempt, appt, {})
    const out = await pay.reviewQr(db, attempt._id, false)
    expect(out.ok).toBe(true)
    expect(store.payment_attempts[0].status).toBe('failed')
    expect(store.appointments[0]).toMatchObject({ status: 'Cancelled', payment_state: 'failed' })
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
