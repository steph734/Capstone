// QR payment proof: the patient's reference number + receipt image. Built on the existing payment_attempts.
//
//   attempt.status      spec name           meaning
//   created             awaiting_payment    slot is held, no proof yet
//   pending_verification proof_submitted    proof recorded and sent to the therapist
//   succeeded           verified            therapist marked it paid (finalizePaid books it)
//   rejected            rejected            therapist: not received (slot stays held until the hold ends; patient can resubmit)
//
// Nothing here marks a QR payment as paid. Only the therapist can (reviewQr in paymentAttempts.js).
import crypto from 'crypto'
import { PAYMENT_HOLD_MS, validateReference } from './paymentProofRules.js'
import { prepareReceipt } from './receiptFile.js'
import { slotKey, extendSlotLock, releaseHold } from './bookingCore.js'

export const PROOF_MESSAGES = {
  PROOF_REQUIRED: 'Add the reference number and a screenshot of your receipt.',
  REFERENCE_ALREADY_USED: 'This reference number has already been used. Check your receipt or contact the clinic.',
  HOLD_EXPIRED: 'Your time slot hold has ended. Please choose a time again.',
  ALREADY_SUBMITTED: 'Your payment details were already sent. You can change them from your payment screen.',
  PAYMENT_ALREADY_VERIFIED: 'This payment was already verified, so it can no longer be changed.',
  NOT_ALLOWED: "You can't do that for this payment.",
}
export const proofError = (code, message, status = 400) => Object.assign(new Error(message || PROOF_MESSAGES[code] || 'Something went wrong.'), { status, code })

const QR_METHODS = ['gcash', 'paymaya']
const DEAD = ['expired', 'cancelled', 'failed']

export async function audit(db, attempt, action, actor, meta = {}) {
  try {
    await db.collection('payment_audit').insertOne({ attempt_id: attempt._id, appointment_id: attempt.appointment_id, action, actor: actor || 'patient', meta, at: new Date() })
  } catch (err) { console.error('payment audit failed:', err.message) }
}

// A QR payment is started: the slot is held for PAYMENT_HOLD_HOURS (not the short card hold).
export async function extendQrHold(db, appointment, now = new Date()) {
  const until = new Date(now.getTime() + PAYMENT_HOLD_MS)
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { hold_expires_at: until, updated_at: now } })
  if (appointment.employee_id) await extendSlotLock(db, slotKey(appointment.employee_id, appointment.session_date, appointment.start_time), appointment._id, PAYMENT_HOLD_MS, now)
  return until
}

// Step 2 of the checkout ("I sent exactly ₱300 ...").
export async function confirmSent(db, attempt, now = new Date()) {
  if (!QR_METHODS.includes(attempt.method)) throw proofError('NOT_ALLOWED', undefined, 403)
  if (attempt.status === 'succeeded') throw proofError('PAYMENT_ALREADY_VERIFIED', undefined, 409)
  if (DEAD.includes(attempt.status)) throw proofError('HOLD_EXPIRED', undefined, 410)
  if (!attempt.sent_confirmed_at) {
    await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { sent_confirmed_at: now, updated_at: now } })
    await audit(db, attempt, 'sent_confirmed', 'patient')
  }
  return { ...attempt, sent_confirmed_at: attempt.sent_confirmed_at || now }
}

// Step 3: record the proof. One call does everything, and the same key never makes a second record.
// `file` is the raw upload (Buffer). Returns { attempt, replay, changed }.
export async function submitProof(db, attempt, appointment, { reference, file, key, change = false, now = new Date() } = {}) {
  if (!QR_METHODS.includes(attempt.method)) throw proofError('NOT_ALLOWED', undefined, 403)
  if (!key) throw proofError('PROOF_REQUIRED', 'Missing submit key.')
  // Same key again (double click, retry after a dropped connection): hand back what is already stored.
  if (attempt.proof_key === key && attempt.status === 'pending_verification') return { attempt, replay: true, changed: false }

  if (attempt.status === 'succeeded') throw proofError('PAYMENT_ALREADY_VERIFIED', undefined, 409)
  if (DEAD.includes(attempt.status) || ['expired', 'cancelled', 'failed'].includes(appointment.payment_state) || appointment.status === 'Cancelled') throw proofError('HOLD_EXPIRED', undefined, 410)
  if (attempt.status === 'pending_verification' && !change) throw proofError('ALREADY_SUBMITTED', undefined, 409)
  if (appointment.hold_expires_at && new Date(appointment.hold_expires_at) <= now) {
    await releaseHold(db, appointment, 'expired')
    throw proofError('HOLD_EXPIRED', undefined, 410)
  }

  const ref = validateReference(reference, attempt.method)
  if (!ref.ok) throw proofError(ref.code, ref.error)
  if (!file || !file.length) throw proofError('PROOF_REQUIRED')
  const receipt = prepareReceipt(file) // magic bytes, size, EXIF removed; throws INVALID_FILE_TYPE / FILE_TOO_LARGE

  const used = await db.collection('payment_attempts').findOne({ reference_digits: ref.digits, method: attempt.method, _id: { $ne: attempt._id }, status: { $in: ['pending_verification', 'succeeded'] } })
  if (used) {
    // Flag the earlier payment for its therapist; never decide anything automatically.
    await db.collection('payment_attempts').updateOne({ _id: used._id }, { $set: { reference_reuse_flag: true, updated_at: now } }).catch(() => {})
    await audit(db, attempt, 'reference_reused', 'patient', { last4: ref.last4 })
    throw proofError('REFERENCE_ALREADY_USED', undefined, 409)
  }

  const publicId = crypto.randomBytes(16).toString('hex') // random file name; never a guessable id
  const stored = await db.collection('payment_receipts').insertOne({
    public_id: publicId, attempt_id: attempt._id, content_type: receipt.contentType, data: receipt.buffer, size_bytes: receipt.buffer.length, created_at: now,
  })
  if (attempt.receipt_id) await db.collection('payment_receipts').updateOne({ _id: attempt.receipt_id }, { $set: { replaced_at: now } }).catch(() => {})

  const changed = attempt.status === 'pending_verification'
  const patch = {
    status: 'pending_verification', provider_ref: ref.digits, reference_digits: ref.digits, reference_display: ref.display, reference_last4: ref.last4,
    receipt_id: stored.insertedId, receipt_size: receipt.buffer.length, receipt_type: receipt.type,
    proof_key: key, qr_details_sent: true, qr_submitted_at: attempt.qr_submitted_at || now, proof_submitted_at: now,
    ...(changed ? { proof_changed_at: now, proof_changed: true } : {}),
    rejected_at: null, rejected_reason: null, failure_code: null, failure_message: null, reference_reuse_flag: false, updated_at: now,
  }
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: patch })
  const until = new Date(now.getTime() + PAYMENT_HOLD_MS) // the therapist gets a full hold period to check it
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { payment_state: 'pending_verification', hold_expires_at: until, updated_at: now } })
  if (appointment.employee_id) await extendSlotLock(db, slotKey(appointment.employee_id, appointment.session_date, appointment.start_time), appointment._id, PAYMENT_HOLD_MS, now)
  await audit(db, attempt, changed ? 'proof_changed' : 'proof_submitted', 'patient', { last4: ref.last4, bytes: receipt.buffer.length })
  return { attempt: { ...attempt, ...patch }, replay: false, changed }
}

// What the receipt endpoint sends, only after the caller was authorised. Only the CURRENT receipt of the attempt is served.
export async function loadReceipt(db, attempt) {
  if (!attempt?.receipt_id) return null
  return db.collection('payment_receipts').findOne({ _id: attempt.receipt_id })
}

// The therapist decided "not received". The slot stays held until the hold ends and the patient may resubmit.
export async function markRejected(db, attempt, appointment, { reason = '', by = null, now = new Date() } = {}) {
  const clean = String(reason || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200)
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { status: 'rejected', rejected_at: now, rejected_reason: clean || null, rejected_by: by, failure_code: 'verification_rejected', updated_at: now } })
  await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { payment_state: 'awaiting_payment', updated_at: now } })
  await audit(db, attempt, 'rejected', by || 'therapist', { reason: clean })
  return { ...attempt, status: 'rejected', rejected_reason: clean || null }
}
