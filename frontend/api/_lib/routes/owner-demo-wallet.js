// Owner Demo Wallet API. OWNER ONLY (not Super Admin); owner_id always comes from the session, never from the request.
//   GET  /api/owner/demo-wallet                        balance (creates the wallet on first call)
//   GET  /api/owner/demo-wallet/transactions           history, newest first, cursor pagination
//   POST /api/owner/demo-wallet/set-amount             { amount }  pesos, REPLACES the balance
//   POST /api/owner/demo-wallet/reset                  back to PHP 15,240.00
//   GET  /api/owner/subscription/status                plan state + wallet balance (drives the red "can't be charged" banner)
//   POST /api/owner/subscription/checkout              { plan, billing_period, method }  Card -> Stripe PaymentIntent (TEST)
//   GET  /api/owner/subscription/payment-status?pi=    polled by the checkout page
//   POST /api/owner/subscription/gcash-demo            simulated GCash modal (no redirect)
//   POST /api/owner/subscription/downgrade             back to Free now
//   GET  /api/cron/demo-wallet-renewals                Vercel Cron, protected by CRON_SECRET
// Rules live in api/_lib/demoWallet.js.
import { ObjectId } from 'mongodb'
import { getMongo, getDb } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { getStripeClient } from '../stripeClient.js'
import {
  DEMO_START_BALANCE, WalletError, sendWalletError, pesosToCentavos, pesoText, parseCheckout, assertStripeTestMode,
  getOrCreateWallet, replaceBalance, deductWallet, assertEnoughBalance, recordFailedPayment, runRenewals,
  ensureDemoWalletIndexes, paymentDescription, planPrice, WALLETS, TXNS,
} from '../demoWallet.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

// Wrapper: method check, session, Owner-only (403 FORBIDDEN_ROLE), consistent errors.
function ownerRoute(label, handlers) {
  return async function handler(req, res) {
    const fn = handlers[req.method]
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '))
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
    }
    try {
      await getMongo()
      const ctx = await requireSession(req, res)
      if (!ctx) return // 401 already sent
      if (ctx.user.role !== 'Owner') return res.status(403).json({ error: 'Only the Owner can use the demo wallet.', code: 'FORBIDDEN_ROLE' })
      const out = await fn(ctx, req, res)
      if (out !== undefined && !res.headersSent) {
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).json(out)
      }
    } catch (err) {
      return sendWalletError(res, err, label)
    }
  }
}

const serializeTxn = (t) => ({
  _id: String(t._id), type: t.type, amount: t.amount, balance_after: t.balance_after, status: t.status,
  ...(t.description ? { description: t.description } : {}),
  ...(t.method ? { method: t.method } : {}),
  ...(t.stripe_payment_id ? { stripe_payment_id: t.stripe_payment_id } : {}),
  ...(t.plan ? { plan: t.plan } : {}),
  ...(t.billing_period ? { billing_period: t.billing_period } : {}),
  created_at: t.created_at,
})

export const serializeSubscription = (s) => (s ? {
  plan: s.plan, billing_period: s.billing_period, status: s.status, method: s.method || null,
  next_billing_at: s.next_billing_at || null, last_paid_at: s.last_paid_at || null, past_due_since: s.past_due_since || null,
  price: s.plan && s.billing_period ? planPrice(s.plan, s.billing_period) : null,
} : null)

const audit = (ctx, action, description, meta) => auditAdmin(ctx, action, description, meta).catch((e) => console.error('demo wallet audit failed:', e.message))

// ── wallet ───────────────────────────────────────────────────────────────────
export const walletRoute = ownerRoute('owner demo wallet', {
  GET: async (ctx) => {
    const w = await getOrCreateWallet(ctx.db, ctx.user._id)
    return { balance: w.balance, updated_at: w.updated_at }
  },
})

// ?limit=20&before=<created_at ISO | _id>. Cursor = the last row of the previous page.
export const transactionsRoute = ownerRoute('owner demo wallet transactions', {
  GET: async (ctx, req) => {
    await getOrCreateWallet(ctx.db, ctx.user._id)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const filter = { owner_id: ctx.user._id }
    const before = String(req.query.before || '')
    if (before) {
      let cur = null
      if (/^[a-f\d]{24}$/i.test(before)) cur = await ctx.db.collection(TXNS).findOne({ _id: new ObjectId(before), owner_id: ctx.user._id }, { projection: { created_at: 1 } })
      else if (!Number.isNaN(Date.parse(before))) cur = { _id: null, created_at: new Date(before) }
      if (!cur) throw new WalletError('INVALID_CURSOR', 'That page cursor is not valid.', 422)
      filter.$or = cur._id
        ? [{ created_at: { $lt: cur.created_at } }, { created_at: cur.created_at, _id: { $lt: cur._id } }]
        : [{ created_at: { $lt: cur.created_at } }]
    }
    const rows = await ctx.db.collection(TXNS).find(filter).sort({ created_at: -1, _id: -1 }).limit(limit + 1).toArray()
    const page = rows.slice(0, limit)
    return { transactions: page.map(serializeTxn), next_before: rows.length > limit ? String(page[page.length - 1]._id) : null }
  },
})

export const setAmountRoute = ownerRoute('owner demo wallet set amount', {
  POST: async (ctx, req) => {
    const centavos = pesosToCentavos(body(req).amount) // 422 INVALID_AMOUNT
    await replaceBalance(ctx.db, ctx.user._id, centavos, { type: 'set_amount', description: `Demo wallet set to ${pesoText(centavos)} by Owner` })
    await audit(ctx, 'demo_wallet_set_amount', `Set the demo wallet to ${pesoText(centavos)}.`, { balance: centavos })
    return { balance: centavos }
  },
})

export const resetRoute = ownerRoute('owner demo wallet reset', {
  POST: async (ctx) => {
    await replaceBalance(ctx.db, ctx.user._id, DEMO_START_BALANCE, { type: 'reset', description: 'Demo funds reset' })
    await audit(ctx, 'demo_wallet_reset', `Reset the demo wallet to ${pesoText(DEMO_START_BALANCE)}.`, { balance: DEMO_START_BALANCE })
    return { balance: DEMO_START_BALANCE }
  },
})

// ── subscription ─────────────────────────────────────────────────────────────
export const subscriptionStatusRoute = ownerRoute('owner subscription status', {
  GET: async (ctx) => {
    const w = await getOrCreateWallet(ctx.db, ctx.user._id)
    return { balance: w.balance, subscription: serializeSubscription(w.subscription) }
  },
})

// Step 1 of a payment. The server decides the price. Insufficient balance is refused BEFORE Stripe is called.
export const checkoutRoute = ownerRoute('owner subscription checkout', {
  POST: async (ctx, req) => {
    const { plan, period, method, price } = parseCheckout(body(req))
    assertStripeTestMode()
    const wallet = await assertEnoughBalance(ctx.db, ctx.user._id, price)
    if (method === 'GCash') return { mode: 'gcash_demo', price, balance: wallet.balance } // GCash is simulated in the modal, see gcash-demo
    const pi = await getStripeClient().paymentIntents.create({
      amount: price, currency: 'php', payment_method_types: ['card'],
      metadata: { demo_wallet: '1', owner_id: String(ctx.user._id), plan, billing_period: period },
    })
    return { mode: 'card', clientSecret: pi.client_secret, payment_intent: pi.id, price, balance: wallet.balance }
  },
})

// Polled by the checkout page after Stripe.js confirms. The wallet is charged by the webhook; if that has not arrived
// yet (or the webhook is not set up, e.g. local dev) the same idempotent handler runs here once Stripe says "succeeded",
// so one payment can never be deducted twice.
export const paymentStatusRoute = ownerRoute('owner subscription payment status', {
  GET: async (ctx, req) => {
    const piId = String(req.query.pi || '')
    if (!/^pi_\w+$/.test(piId)) throw new WalletError('INVALID_PAYMENT', 'Missing payment reference.', 422)
    const done = await ctx.db.collection(TXNS).findOne({ owner_id: ctx.user._id, stripe_payment_id: piId })
    const finish = async (r) => ({ status: 'succeeded', reference: piId, amount: r.transaction.amount, balance: r.balance, renews_at: r.renews_at || null })
    if (done) {
      const w = await ctx.db.collection(WALLETS).findOne({ owner_id: ctx.user._id })
      return finish({ transaction: done, balance: w?.balance ?? done.balance_after, renews_at: w?.subscription?.next_billing_at })
    }
    assertStripeTestMode()
    const pi = await getStripeClient().paymentIntents.retrieve(piId)
    if (pi.metadata?.owner_id !== String(ctx.user._id) || pi.metadata?.demo_wallet !== '1') throw new WalletError('FORBIDDEN_PAYMENT', 'That payment does not belong to you.', 403)
    if (pi.status === 'succeeded') {
      const r = await settleCardPayment(ctx.db, pi)
      if (r.failed) return { status: 'failed', reason: r.reason, balance: r.balance }
      return finish(r)
    }
    if (pi.status === 'canceled' || (pi.status === 'requires_payment_method' && pi.last_payment_error)) {
      return { status: 'failed', reason: pi.last_payment_error?.message || 'The payment was not completed.' }
    }
    return { status: 'pending' }
  },
})

// Deduct + payment row + subscription, once per PaymentIntent. Used by the webhook and by payment-status.
export async function settleCardPayment(db, pi) {
  const { owner_id, plan, billing_period: period } = pi.metadata || {}
  if (!owner_id || !/^[a-f\d]{24}$/i.test(owner_id)) throw new WalletError('INVALID_PAYMENT', 'Payment has no owner.', 422)
  const price = planPrice(String(plan), String(period)) // server price; metadata only names the plan
  if ((pi.amount_received ?? pi.amount) !== price) throw new WalletError('INVALID_PAYMENT', 'Payment amount does not match the plan price.', 422)
  try {
    return await deductWallet(db, owner_id, price, { plan, period, method: 'Card', stripe_payment_id: pi.id })
  } catch (err) {
    if (err instanceof WalletError && err.code === 'INSUFFICIENT_DEMO_BALANCE') {
      const f = await recordFailedPayment(db, owner_id, { price, plan, period, method: 'Card', reason: 'not enough demo balance' })
      return { failed: true, reason: err.message, balance: f.balance }
    }
    throw err
  }
}

// Called from the Stripe webhook (api/_lib/routes/stripe-webhook.js) for PaymentIntents created by checkout above.
export async function handleDemoWalletEvent(db, event) {
  const pi = event.data.object
  await ensureDemoWalletIndexes(db)
  if (event.type === 'payment_intent.succeeded') return settleCardPayment(db, pi)
  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const { owner_id, plan, billing_period: period } = pi.metadata || {}
    if (!owner_id || !/^[a-f\d]{24}$/i.test(owner_id)) return null
    return recordFailedPayment(db, owner_id, { price: planPrice(String(plan), String(period)), plan, period, method: 'Card', reason: pi.last_payment_error?.message?.slice(0, 80) || 'payment failed' }) // wallet untouched
  }
  return null
}

// Simulated GCash. 'authorize' charges the wallet (idempotent per key), 'fail' records a Failed row and charges nothing.
export const gcashDemoRoute = ownerRoute('owner subscription gcash demo', {
  POST: async (ctx, req) => {
    assertStripeTestMode()
    const b = body(req)
    const { plan, period, price } = parseCheckout({ ...b, method: 'GCash' })
    const outcome = String(b.outcome || '')
    const key = String(b.idempotency_key || '')
    if (!/^[\w-]{8,64}$/.test(key)) throw new WalletError('INVALID_REQUEST', 'Missing idempotency key.', 422)
    if (outcome === 'fail') {
      const f = await recordFailedPayment(ctx.db, ctx.user._id, { price, plan, period, method: 'GCash', reason: 'GCash payment failed' })
      return { status: 'failed', amount: price, balance: f.balance }
    }
    if (outcome !== 'authorize') throw new WalletError('INVALID_REQUEST', 'Outcome must be authorize or fail.', 422)
    // deductWallet replays a repeated key first, then checks the balance atomically (422 INSUFFICIENT_DEMO_BALANCE).
    const r = await deductWallet(ctx.db, ctx.user._id, price, { plan, period, method: 'GCash', stripe_payment_id: `gcash_demo_${key}` })
    if (!r.duplicate) await audit(ctx, 'demo_wallet_payment', `Paid ${paymentDescription(plan, period)} (${pesoText(price)}) from the demo wallet via GCash.`, { plan, period, amount: price })
    return { status: 'succeeded', reference: `gcash_demo_${key}`, amount: price, balance: r.balance, renews_at: r.renews_at, ...(r.duplicate ? { duplicate: true, code: 'DUPLICATE_PAYMENT' } : {}) }
  },
})

export const downgradeRoute = ownerRoute('owner subscription downgrade', {
  POST: async (ctx) => {
    const now = new Date()
    await getOrCreateWallet(ctx.db, ctx.user._id)
    await ctx.db.collection(WALLETS).updateOne({ owner_id: ctx.user._id }, { $set: { 'subscription.status': 'free', 'subscription.downgraded_at': now, updated_at: now }, $unset: { 'subscription.past_due_since': '' } })
    await audit(ctx, 'demo_subscription_downgrade', 'Downgraded the subscription to Free.', {})
    return { status: 'free' }
  },
})

// ── cron ─────────────────────────────────────────────────────────────────────
export async function renewalsCron(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const secret = process.env.CRON_SECRET
  if (!secret) { console.error('demo-wallet-renewals: CRON_SECRET is not set - refusing to run.'); return res.status(500).json({ error: 'CRON_SECRET is not configured on the server.' }) }
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized.' })
  try {
    assertStripeTestMode()
    await getMongo()
    return res.json({ ok: true, ...(await runRenewals(await getDb())) })
  } catch (err) {
    return sendWalletError(res, err, 'demo wallet renewals')
  }
}
