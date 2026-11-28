// Paying the clinic's plan by QR (GCash / Maya). Like patient QR payments, nothing is "paid" until a person checks it:
// the Owner sends a reference number + receipt, and the Super Admin approves or rejects it. Approving activates the plan.
//
//   GET  /api/owner/subscription/qr                          Owner: the latest QR payment (to show "waiting" / "rejected")
//   POST /api/owner/subscription/qr                          Owner: multipart { plan, period, method, reference, receipt }
//   GET  /api/admin/subscription-payments                    Super Admin: payments waiting for review
//   GET  /api/admin/subscription-payments/:id/receipt        Super Admin: the receipt image
//   POST /api/admin/subscription-payments/:id/:action        Super Admin: approve | reject { reason }
// The amount always comes from the plan in the database, never from the browser.
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { auditAdmin } from '../adminAudit.js'
import { tooManyRequests } from '../rateLimit.js'
import { getStripeClient } from '../stripeClient.js'
import { loadPlansAndFeatures, planName, serializePlan } from '../plans.js'
import { getEntitlements, writeRecord, CLINIC_ID } from '../entitlements.js'
import { MAX_RECEIPT_BYTES, validateReference } from '../paymentProofRules.js'
import { prepareReceipt } from '../receiptFile.js'
import { syncQrPayment } from '../subscriptionLedger.js'

const COLLECTION = 'subscription_qr_payments'
const METHODS = ['gcash', 'paymaya']
const PERIODS = ['monthly', 'yearly']
const fail = (res, status, code, error) => res.status(status).json({ error, code })

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECEIPT_BYTES + 1, files: 1, fields: 6 } }).single('receipt')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => {
  if (!err) return resolve()
  const big = err.code === 'LIMIT_FILE_SIZE'
  reject(Object.assign(new Error(big ? 'That image is larger than 5 MB. Choose a smaller screenshot.' : 'We could not read your upload.'), { status: big ? 413 : 400, code: big ? 'FILE_TOO_LARGE' : 'PROOF_REQUIRED' }))
}))

function route(label, role, fn) {
  return async (req, res) => {
    try {
      await getMongo()
      const ctx = await requireSession(req, res, { idle: false })
      if (!ctx) return
      if (ctx.user.role !== role) return fail(res, 403, 'FORBIDDEN_ROLE', `Only the ${role} can do this.`)
      res.setHeader('Cache-Control', 'no-store')
      return await fn(ctx, req, res)
    } catch (err) {
      console.error(`${label}:`, err.message)
      return res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.', code: err.code })
    }
  }
}

const view = (p) => p && ({
  id: String(p._id), plan: p.plan_key.toLowerCase(), planName: p.plan_name, period: p.billing_period, method: p.method,
  amount: p.amount, referenceDisplay: p.reference_display, status: p.status, reason: p.rejected_reason || null,
  submittedAt: p.submitted_at, reviewedAt: p.reviewed_at || null, ownerName: p.owner_name, ownerEmail: p.owner_email,
})

export const ownerGetRoute = route('subscription qr latest', 'Owner', async (ctx, req, res) => {
  const last = await ctx.db.collection(COLLECTION).find({ clinic_id: CLINIC_ID }, { projection: { receipt: 0 } }).sort({ submitted_at: -1 }).limit(1).next()
  return res.json({ payment: view(last) || null })
})

export const ownerSubmitRoute = route('subscription qr submit', 'Owner', async (ctx, req, res) => {
  if (await tooManyRequests(res, `sub-qr:${ctx.user._id}`, { max: 8, windowMs: 15 * 60 * 1000 })) return
  await runUpload(req, res)
  const slug = String(req.body?.plan || '').toLowerCase()
  const period = String(req.body?.period || 'monthly')
  const method = String(req.body?.method || '')
  if (!METHODS.includes(method)) return fail(res, 422, 'INVALID_METHOD', 'Choose GCash or Maya.')
  if (!PERIODS.includes(period)) return fail(res, 422, 'INVALID_PERIOD', 'Choose monthly or yearly billing.')
  const { plans } = await loadPlansAndFeatures(ctx.db)
  const plan = plans.find((p) => serializePlan(p, {}).slug === slug)
  const info = plan && serializePlan(plan, {})
  const email = String(ctx.user.email || '').toLowerCase()
  const visible = info && (info.status === 'live' || (info.status === 'beta' && (plan.beta_testers || []).some((e) => String(e).toLowerCase() === email)))
  const amount = Number(period === 'yearly' ? info?.priceYearly : info?.priceMonthly)
  if (!visible || !(amount > 0)) return fail(res, 422, 'INVALID_PLAN', 'That plan is not available for payment.')

  const ref = validateReference(req.body?.reference, method)
  if (!ref.ok) return fail(res, 400, ref.code, ref.error)
  const receipt = prepareReceipt(req.file?.buffer) // magic bytes, size, EXIF removed

  const col = ctx.db.collection(COLLECTION)
  if (await col.findOne({ clinic_id: CLINIC_ID, status: 'pending' }, { projection: { _id: 1 } })) return fail(res, 409, 'ALREADY_PENDING', 'A payment is already waiting to be checked.')
  const used = { method, reference_digits: ref.digits }
  if (await col.findOne({ ...used, status: { $in: ['pending', 'approved'] } }, { projection: { _id: 1 } })
    || await ctx.db.collection('payment_attempts').findOne({ ...used, status: { $in: ['pending_verification', 'succeeded'] } }, { projection: { _id: 1 } })) {
    return fail(res, 409, 'REFERENCE_ALREADY_USED', 'This reference number has already been used. Check your receipt.')
  }

  const doc = {
    clinic_id: CLINIC_ID, owner_id: ctx.user._id, owner_email: ctx.user.email || null,
    owner_name: [ctx.user.first_name, ctx.user.last_name].filter(Boolean).join(' ') || ctx.user.name || ctx.user.email || 'Owner',
    plan_key: slug.toUpperCase(), plan_name: planName(plan), billing_period: period, method, amount,
    reference_digits: ref.digits, reference_display: ref.display,
    receipt_type: receipt.contentType, status: 'pending', submitted_at: new Date(),
  }
  const { insertedId } = await col.insertOne(doc)
  try {
    await syncQrPayment(ctx.db, { ...doc, _id: insertedId }, receipt) // payment_attempts, payment_receipts, payment_audit
  } catch (err) {
    await col.deleteOne({ _id: insertedId }) // without its receipt the payment cannot be checked: let the Owner send it again
    throw err
  }
  await auditAdmin(ctx, 'clinic_plan_qr_submitted', `Sent a QR payment for the ${doc.plan_name} plan.`, { plan_key: slug, amount }).catch(() => {})
  return res.status(201).json({ payment: view({ ...doc, _id: insertedId }) })
})

export const adminListRoute = route('subscription qr list', 'Super Admin', async (ctx, req, res) => {
  const rows = await ctx.db.collection(COLLECTION).find({ status: 'pending' }, { projection: { receipt: 0 } }).sort({ submitted_at: 1 }).limit(100).toArray()
  return res.json({ payments: rows.map(view) })
})

const byId = (id) => (/^[a-f0-9]{24}$/i.test(id) ? { _id: new ObjectId(id) } : null)

export const adminReceiptRoute = route('subscription qr receipt', 'Super Admin', async (ctx, req, res) => {
  const q = byId(req.params.id)
  const p = q && await ctx.db.collection(COLLECTION).findOne(q, { projection: { receipt: 1, receipt_type: 1, receipt_id: 1 } })
  const stored = p?.receipt_id ? await ctx.db.collection('payment_receipts').findOne({ _id: p.receipt_id }) : null
  const data = stored?.data || p?.receipt // payments sent before receipts moved to payment_receipts
  if (!data) return fail(res, 404, 'NOT_FOUND', 'Receipt not found.')
  res.setHeader('Content-Type', stored?.content_type || p.receipt_type)
  return res.send(Buffer.from(data.buffer || data))
})

function periodEnd(from, period) {
  const d = new Date(from)
  const day = d.getDate()
  d.setMonth(d.getMonth() + (period === 'yearly' ? 12 : 1))
  if (d.getDate() < day) d.setDate(0)
  return d
}

export const adminDecideRoute = route('subscription qr decide', 'Super Admin', async (ctx, req, res) => {
  const { action } = req.params
  const q = byId(req.params.id)
  if (!q || !['approve', 'reject'].includes(action)) return fail(res, 404, 'NOT_FOUND', 'Not found.')
  const now = new Date()
  const reason = String(req.body?.reason || '').trim().slice(0, 200)
  const col = ctx.db.collection(COLLECTION)
  // Claim it atomically: two clicks (or two admins) can never activate the plan twice.
  const claim = await col.updateOne({ ...q, status: 'pending' }, { $set: { status: action === 'approve' ? 'approved' : 'rejected', rejected_reason: action === 'reject' ? reason || null : null, reviewed_at: now, reviewed_by: ctx.user._id } })
  if (!claim.modifiedCount) return fail(res, 409, 'ALREADY_REVIEWED', 'This payment was already reviewed.')
  const p = await col.findOne(q, { projection: { receipt: 0 } })

  if (action === 'approve') {
    try {
      const settings = await ctx.db.collection('clinic_settings').findOne({ _id: CLINIC_ID }, { projection: { subscription: 1 } })
      const old = settings?.subscription
      // Paying early for the same plan adds time after what is already paid for.
      const renewing = old?.status === 'active' && old.plan_key === p.plan_key && old.current_period_end && new Date(old.current_period_end) > now
      const start = renewing ? new Date(old.current_period_end) : now
      await writeRecord(ctx.db, {
        plan_key: p.plan_key, billing_period: p.billing_period, status: 'active', owner_id: p.owner_id,
        current_period_start: start, current_period_end: periodEnd(start, p.billing_period),
        price_snapshot: Math.round(p.amount * 100), payment_method: p.method, checked_at: now,
      })
      // A card subscription still running at Stripe would charge the clinic a second time.
      if (old?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
        await getStripeClient().subscriptions.cancel(old.stripe_subscription_id).catch((err) => console.error('stripe cancel failed:', err.message))
      }
    } catch (err) {
      await col.updateOne(q, { $set: { status: 'pending' }, $unset: { reviewed_at: '', reviewed_by: '' } }) // not activated: leave it reviewable
      throw err
    }
  }
  await syncQrPayment(ctx.db, await col.findOne(q)).catch((err) => console.error('subscription ledger failed:', err.message))
  await auditAdmin(ctx, action === 'approve' ? 'clinic_plan_qr_approved' : 'clinic_plan_qr_rejected', `${action === 'approve' ? 'Approved' : 'Rejected'} a QR payment for the ${p.plan_name} plan.`, { payment_id: String(p._id), amount: p.amount }).catch(() => {})
  return res.json({ payment: view(p), current: action === 'approve' ? await getEntitlements(ctx.db, ctx.user) : undefined })
})
