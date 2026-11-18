// Owner "Demo Wallet": a number in MongoDB that stands in for the clinic's money in the Stripe TEST-mode demo.
// No real bank or GCash wallet is ever touched. Everything is INTEGER CENTAVOS (PHP 15,240.00 = 1524000).
//
// Collections (already created in Atlas with $jsonSchema validators; this file never recreates them):
//   demo_wallets              one doc per Owner { owner_id, balance, created_at, updated_at, subscription? }
//   demo_wallet_transactions  the history rows
// `subscription` is an embedded sub-document on the wallet (plan, billing_period, status, next_billing_at ...). The
// validator allows extra fields, and the plan-level `subscription` collection only holds plan definitions.
import { ObjectId } from 'mongodb'
import { getMongo } from './mongo.js'

export const DEMO_START_BALANCE = 1524000
export const DEMO_MAX_BALANCE = 100000000
export const WALLETS = 'demo_wallets'
export const TXNS = 'demo_wallet_transactions'

// Server-side prices in centavos. The client never sends an amount. Silver 299/mo, 3000/yr and Gold 499/mo, 5000/yr
// are the prices shown on the Owner Subscription page (src/pages/owner/OwnerSubscriptionPage.jsx).
export const PLAN_PRICES = {
  SILVER: { monthly: 29900, yearly: 300000 },
  GOLD: { monthly: 49900, yearly: 500000 },
}
export const PLAN_LABEL = { SILVER: 'Silver', GOLD: 'Gold' }
export const PERIODS = ['monthly', 'yearly']
export const METHODS = ['Card', 'GCash']

export class WalletError extends Error {
  constructor(code, message, status = 422, extra = {}) {
    super(message)
    this.code = code
    this.status = status
    this.extra = extra
  }
}

// One error format ({ error, code }) like the finance routes. Mongo validator failures (code 121) become a 422 and the
// details are logged on the server only.
export function sendWalletError(res, err, label) {
  if (err instanceof WalletError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra })
  if (err?.code === 121) {
    console.error(`${label}: document failed the collection validator`, JSON.stringify(err.errInfo?.details || {}).slice(0, 1500))
    return res.status(422).json({ error: 'The record did not pass database validation.', code: 'VALIDATION_FAILED' })
  }
  console.error(`${label}:`, err?.message)
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
}

// ── money ────────────────────────────────────────────────────────────────────
export const INVALID_AMOUNT_MSG = 'Enter an amount between ₱0.00 and ₱1,000,000.00'

// Pesos (a finite number with at most 2 decimals, 0..1,000,000) -> integer centavos. Anything else is a 422.
export function pesosToCentavos(pesos) {
  if (typeof pesos !== 'number' || !Number.isFinite(pesos) || pesos < 0 || pesos > DEMO_MAX_BALANCE / 100) {
    throw new WalletError('INVALID_AMOUNT', INVALID_AMOUNT_MSG)
  }
  const cents = Math.round(pesos * 100)
  if (Math.abs(pesos * 100 - cents) > 1e-6) throw new WalletError('INVALID_AMOUNT', INVALID_AMOUNT_MSG)
  return cents
}
export const pesoText = (centavos) => `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function planPrice(plan, period) {
  const price = PLAN_PRICES[plan]?.[period]
  if (!price) throw new WalletError('INVALID_PLAN', 'Choose the Silver or Gold plan, billed monthly or yearly.', 422)
  return price
}
export function parseCheckout(body) {
  const plan = String(body?.plan || '').toUpperCase()
  const period = String(body?.billing_period || '').toLowerCase()
  const method = String(body?.method || 'Card')
  if (!PLAN_PRICES[plan] || !PERIODS.includes(period)) throw new WalletError('INVALID_PLAN', 'Choose the Silver or Gold plan, billed monthly or yearly.', 422)
  if (!METHODS.includes(method)) throw new WalletError('INVALID_METHOD', 'Pay with Card or GCash.', 422)
  return { plan, period, method, price: planPrice(plan, period) }
}

// Stripe must be in TEST mode. Payment endpoints refuse to run with a live key.
export function assertStripeTestMode() {
  const key = String(process.env.STRIPE_SECRET_KEY || '')
  if (!key.startsWith('sk_test_')) {
    throw new WalletError('STRIPE_NOT_TEST_MODE', 'Demo payments only run with a Stripe TEST key (sk_test_...).', 503)
  }
}

export const toOwnerId = (id) => (id instanceof ObjectId ? id : new ObjectId(String(id)))

async function mongoClient() {
  return (await getMongo()).connection.getClient()
}

// ── indexes (idempotent; created once per warm container) ────────────────────
let indexesReady = null
export function ensureDemoWalletIndexes(db) {
  if (!indexesReady) {
    indexesReady = (async () => {
      await db.collection(WALLETS).createIndex({ owner_id: 1 }, { unique: true, name: 'owner_id_1' })
      await db.collection(TXNS).createIndex({ owner_id: 1, created_at: -1 }, { name: 'owner_id_1_created_at_-1' })
      await db.collection(TXNS).createIndex(
        { stripe_payment_id: 1 },
        { unique: true, name: 'stripe_payment_id_1_unique', partialFilterExpression: { stripe_payment_id: { $type: 'string' } } },
      )
    })().catch((err) => { indexesReady = null; throw err })
  }
  return indexesReady
}

// ── wallet ───────────────────────────────────────────────────────────────────
// One wallet per Owner, created on first use at DEMO_START_BALANCE with a "Starting demo funds" row. The unique
// owner_id index makes two simultaneous first calls race-safe (only the one that really inserted seeds the row).
export async function getOrCreateWallet(db, ownerId) {
  const owner_id = toOwnerId(ownerId)
  await ensureDemoWalletIndexes(db)
  const wallets = db.collection(WALLETS)
  const now = new Date()
  try {
    const r = await wallets.updateOne(
      { owner_id },
      { $setOnInsert: { balance: DEMO_START_BALANCE, created_at: now, updated_at: now } },
      { upsert: true },
    )
    if (r.upsertedId) {
      await db.collection(TXNS).insertOne({
        owner_id, type: 'reset', amount: DEMO_START_BALANCE, balance_after: DEMO_START_BALANCE,
        status: 'Succeeded', description: 'Starting demo funds', created_at: now,
      })
    }
  } catch (err) {
    if (err?.code !== 11000) throw err // lost the race to another request that created it: just read it below
  }
  return wallets.findOne({ owner_id })
}

// Replace the balance (Set Amount / Reset). Both write an audit-friendly history row with amount = balance_after = new balance.
export async function replaceBalance(db, ownerId, centavos, { type, description }) {
  const owner_id = toOwnerId(ownerId)
  await getOrCreateWallet(db, owner_id)
  const client = await mongoClient()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const now = new Date()
      const r = await db.collection(WALLETS).updateOne({ owner_id }, { $set: { balance: centavos, updated_at: now } }, { session })
      if (!r.matchedCount) throw new WalletError('WALLET_NOT_FOUND', 'Demo wallet not found.', 404)
      await db.collection(TXNS).insertOne({
        owner_id, type, amount: centavos, balance_after: centavos, status: 'Succeeded', description, created_at: now,
      }, { session })
    })
  } finally {
    await session.endSession()
  }
  return centavos
}

// Rows are stored with exactly the fields the validator knows; empty/undefined optionals are left out.
export function txnDoc({ owner_id, type = 'payment', amount, balance_after, status, description, method, stripe_payment_id, plan, billing_period }) {
  return {
    owner_id, type, amount, balance_after, status,
    ...(description ? { description: String(description).slice(0, 200) } : {}),
    ...(type === 'payment' && method ? { method } : {}),
    ...(stripe_payment_id ? { stripe_payment_id } : {}),
    ...(plan ? { plan } : {}),
    ...(billing_period ? { billing_period } : {}),
    created_at: new Date(),
  }
}
export const paymentDescription = (plan, period) => `${PLAN_LABEL[plan]} plan · ${period}`

// A payment that did not go through: nothing is deducted and the wallet is not touched.
export async function recordFailedPayment(db, ownerId, { price, plan, period, method, reason }) {
  const owner_id = toOwnerId(ownerId)
  const wallet = await getOrCreateWallet(db, owner_id)
  const doc = txnDoc({
    owner_id, amount: price, balance_after: wallet.balance, status: 'Failed', method, plan, billing_period: period,
    description: `${paymentDescription(plan, period)}${reason ? ` · ${reason}` : ''}`,
  })
  await db.collection(TXNS).insertOne(doc)
  return { balance: wallet.balance, transaction: doc }
}

// ── subscription state (embedded on the wallet) ──────────────────────────────
export function addPeriod(from, period) {
  const d = new Date(from)
  const day = d.getUTCDate()
  if (period === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  if (d.getUTCDate() < day) d.setUTCDate(0) // Jan 31 + 1 month -> Feb 28/29
  return d
}

// Used inside the deduct transaction: activate or renew the plan after a successful payment.
export async function activateSubscription(db, ownerId, { plan, period, method }, session, from = new Date()) {
  const next = addPeriod(from, period)
  await db.collection(WALLETS).updateOne(
    { owner_id: toOwnerId(ownerId) },
    {
      $set: { subscription: { plan, billing_period: period, ...(method ? { method } : {}), status: 'active', last_paid_at: from, next_billing_at: next }, updated_at: new Date() },
    },
    { session },
  )
  return next
}

// ── spending ─────────────────────────────────────────────────────────────────
// ATOMIC: the balance check and the decrement are ONE findOneAndUpdate, so two simultaneous payments can never overdraw.
// The deduct, the payment row and the subscription update commit together or not at all. A duplicate stripe_payment_id
// means "already processed": the original result is returned and nothing is deducted twice.
// meta: { plan, period, method, stripe_payment_id, description?, afterDeduct?(session) }
export async function deductWallet(db, ownerId, amount, meta) {
  const owner_id = toOwnerId(ownerId)
  if (!Number.isInteger(amount) || amount <= 0) throw new WalletError('INVALID_AMOUNT', INVALID_AMOUNT_MSG)
  await getOrCreateWallet(db, owner_id)

  const replay = async () => {
    if (!meta.stripe_payment_id) return null
    const prior = await db.collection(TXNS).findOne({ owner_id, stripe_payment_id: meta.stripe_payment_id })
    if (!prior) return null
    const wallet = await db.collection(WALLETS).findOne({ owner_id })
    return { duplicate: true, balance: wallet?.balance ?? prior.balance_after, transaction: prior, renews_at: wallet?.subscription?.next_billing_at || null }
  }
  const already = await replay()
  if (already) return already

  const client = await mongoClient()
  const session = client.startSession()
  try {
    let out = null
    await session.withTransaction(async () => {
      const after = await db.collection(WALLETS).findOneAndUpdate(
        { owner_id, balance: { $gte: amount } },
        { $inc: { balance: -amount }, $set: { updated_at: new Date() } },
        { returnDocument: 'after', session },
      )
      const wallet = after?.value !== undefined && after?.ok !== undefined ? after.value : after // driver 5 wrapped it, 6+ returns the doc
      if (!wallet) throw new WalletError('INSUFFICIENT_DEMO_BALANCE', 'Insufficient demo wallet balance. Add funds with Set demo amount on Payouts, then try again.', 422)
      const doc = txnDoc({
        owner_id, amount, balance_after: wallet.balance, status: 'Succeeded', method: meta.method,
        stripe_payment_id: meta.stripe_payment_id, plan: meta.plan, billing_period: meta.period,
        description: meta.description || paymentDescription(meta.plan, meta.period),
      })
      await db.collection(TXNS).insertOne(doc, { session })
      const renews = meta.afterDeduct ? await meta.afterDeduct(session) : await activateSubscription(db, owner_id, meta, session)
      out = { duplicate: false, balance: wallet.balance, transaction: doc, renews_at: renews }
    })
    return out
  } catch (err) {
    if (err?.code === 11000 && meta.stripe_payment_id) {
      const again = await replay()
      if (again) return again
    }
    throw err
  } finally {
    await session.endSession()
  }
}

// Read-only check used BEFORE calling Stripe.
export async function assertEnoughBalance(db, ownerId, price) {
  const wallet = await getOrCreateWallet(db, ownerId)
  if (wallet.balance < price) {
    throw new WalletError('INSUFFICIENT_DEMO_BALANCE', 'Insufficient demo wallet balance. Add funds with Set demo amount on Payouts, then try again.', 422, { balance: wallet.balance, price })
  }
  return wallet
}

// ── renewals (Vercel Cron) ───────────────────────────────────────────────────
export const graceDays = () => {
  const n = Number(process.env.DEMO_RENEWAL_GRACE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : 3
}

// Finds subscriptions due now and tries to charge each from its Owner's wallet.
//  paid      -> payment row, next billing date moved forward, status active
//  too low   -> Failed row, status past_due (red banner). After the grace period the plan drops to Free.
export async function runRenewals(db, now = new Date()) {
  await ensureDemoWalletIndexes(db)
  const due = await db.collection(WALLETS).find({ 'subscription.status': { $in: ['active', 'past_due'] }, 'subscription.next_billing_at': { $lte: now } }).toArray()
  const summary = { due: due.length, renewed: 0, failed: 0, downgraded: 0 }
  for (const w of due) {
    const { plan, billing_period: period, method } = w.subscription
    try {
      const price = planPrice(plan, period)
      const day = now.toISOString().slice(0, 10)
      await deductWallet(db, w.owner_id, price, {
        plan, period, method, stripe_payment_id: `renewal_${w.owner_id}_${day}`,
        description: `${paymentDescription(plan, period)} · renewal`,
        // renew from the date it was due, not from "now", so a late retry doesn't shift the cycle
        afterDeduct: (session) => activateSubscription(db, w.owner_id, { plan, period, method }, session, w.subscription.next_billing_at > now ? now : w.subscription.next_billing_at),
      })
      summary.renewed += 1
    } catch (err) {
      if (!(err instanceof WalletError) || err.code !== 'INSUFFICIENT_DEMO_BALANCE') { console.error('demo renewal failed:', err?.message); continue }
      const since = w.subscription.past_due_since || now
      await recordFailedPayment(db, w.owner_id, { price: planPrice(plan, period), plan, period, method, reason: 'renewal failed' })
      const expired = now.getTime() - new Date(since).getTime() >= graceDays() * 86400000 && w.subscription.past_due_since
      await db.collection(WALLETS).updateOne({ owner_id: w.owner_id }, { $set: expired ? { 'subscription.status': 'free', 'subscription.downgraded_at': now, updated_at: now } : { 'subscription.status': 'past_due', 'subscription.past_due_since': since, updated_at: now } })
      if (expired) summary.downgraded += 1
      else summary.failed += 1
    }
  }
  return summary
}
