// Records the Owner's plan payments in the same collections patient payments use:
//   payment_attempts  one per payment (QR: pending_verification -> succeeded / rejected; card: succeeded)
//   payment_audit     what happened to it, and who did it
//   payment_receipts  the uploaded receipt image (QR only; card payments have no image)
//   payments          the money, once it is confirmed (payment_for: "subscription")
// Everything is keyed so that running it twice never creates a second record. These attempts have no appointment.
import crypto from 'crypto'
import { insertPaymentWithRef } from './paymentRef.js'

const bytes = (b) => (b ? Buffer.from(b.buffer && !Buffer.isBuffer(b) ? b.buffer : b) : null)

async function ensureAttempt(db, key, doc) {
  const col = db.collection('payment_attempts')
  const found = await col.findOne({ idempotency_key: key })
  if (found) return found
  const full = { idempotency_key: key, purpose: 'subscription', currency: 'PHP', failure_code: null, failure_message: null, ...doc }
  try {
    const { insertedId } = await col.insertOne(full)
    return { ...full, _id: insertedId }
  } catch (err) {
    if (err.code === 11000) return col.findOne({ idempotency_key: key })
    throw err
  }
}

async function auditOnce(db, attempt, action, actor, at, meta = {}) {
  await db.collection('payment_audit').updateOne(
    { attempt_id: attempt._id, action },
    { $setOnInsert: { attempt_id: attempt._id, appointment_id: null, action, actor, meta: { purpose: 'subscription', ...meta }, at } },
    { upsert: true },
  )
}

// The row in `payments`. Returns { _id, payment_ref }.
async function ensurePayment(db, attempt, { planKey, amount, method, paidAt, reference }) {
  const col = db.collection('payments')
  let row = await col.findOne({ idempotency_key: attempt.idempotency_key })
  if (!row) {
    const plan = await db.collection('subscription').findOne({ slug: planKey.toLowerCase() }, { projection: { _id: 1 } })
    row = await insertPaymentWithRef(col, {
      PaymentID: `PAY-${crypto.randomUUID()}`,
      idempotency_key: attempt.idempotency_key,
      payment_for: 'subscription',
      ...(plan ? { subscription_id: plan._id } : {}),
      amount: Number(amount),
      currency: 'PHP',
      method,
      payment_date: paidAt,
      status: 'completed',
      ...(reference ? { reference_number: String(reference).slice(0, 120) } : {}),
    })
  }
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { payment_id: row._id, payment_ref: row.payment_ref } })
  return row
}

// Brings the four collections up to date with one document of `subscription_qr_payments`.
export async function syncQrPayment(db, request, receipt = null) {
  const key = `sub-qr-${request._id}`
  const sent = request.submitted_at
  const attempt = await ensureAttempt(db, key, {
    owner_id: request.owner_id, subscription_request_id: request._id, plan_key: request.plan_key, billing_period: request.billing_period,
    method: request.method, amount: request.amount, amount_centavos: Math.round(request.amount * 100),
    status: 'pending_verification', provider_ref: request.reference_digits, reference_digits: request.reference_digits,
    reference_display: request.reference_display, reference_last4: request.reference_digits.slice(-4),
    payer: { name: request.owner_name, email: request.owner_email },
    qr_details_sent: true, qr_submitted_at: sent, proof_submitted_at: sent, created_at: sent, updated_at: sent,
  })

  const image = receipt?.buffer || bytes(request.receipt)
  if (!attempt.receipt_id && image) {
    const receipts = db.collection('payment_receipts')
    const existing = await receipts.findOne({ attempt_id: attempt._id }, { projection: { _id: 1 } })
    const type = receipt?.contentType || request.receipt_type
    const receiptId = existing?._id || (await receipts.insertOne({
      public_id: crypto.randomBytes(16).toString('hex'), attempt_id: attempt._id, content_type: type, data: image, size_bytes: image.length, created_at: sent,
    })).insertedId
    attempt.receipt_id = receiptId
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { receipt_id: receiptId, receipt_size: image.length, receipt_type: type === 'image/png' ? 'png' : 'jpg' } })
    await db.collection('subscription_qr_payments').updateOne({ _id: request._id }, { $set: { receipt_id: receiptId, attempt_id: attempt._id } })
  }
  await auditOnce(db, attempt, 'proof_submitted', 'owner', sent, { last4: request.reference_digits.slice(-4) })

  const at = request.reviewed_at
  const by = request.reviewed_by || 'super_admin'
  if (request.status === 'approved') {
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { status: 'succeeded', verified_at: at, verified_by: by, paid_at: at, updated_at: at } })
    await ensurePayment(db, attempt, { planKey: request.plan_key, amount: request.amount, method: request.method, paidAt: at, reference: request.reference_digits })
    await auditOnce(db, attempt, 'verified', by, at)
  } else if (request.status === 'rejected') {
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { status: 'rejected', rejected_at: at, rejected_reason: request.rejected_reason || null, rejected_by: by, failure_code: 'verification_rejected', updated_at: at } })
    await auditOnce(db, attempt, 'rejected', by, at, { reason: request.rejected_reason || '' })
  }
  return attempt
}

// A card subscription the server has just confirmed with Stripe (first charge).
export async function recordCardPayment(db, { subscriptionId, planKey, billingPeriod, amount, owner, paidAt = new Date() }) {
  const attempt = await ensureAttempt(db, `sub-card-${subscriptionId}`, {
    owner_id: owner._id, plan_key: planKey, billing_period: billingPeriod, method: 'card',
    amount, amount_centavos: Math.round(amount * 100), status: 'succeeded', provider_ref: subscriptionId,
    payer: { email: owner.email || null }, paid_at: paidAt, created_at: paidAt, updated_at: paidAt,
  })
  await ensurePayment(db, attempt, { planKey, amount, method: 'card', paidAt, reference: subscriptionId })
  await auditOnce(db, attempt, 'verified', 'stripe', paidAt, { subscription_id: subscriptionId })
  return attempt
}
