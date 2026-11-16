// /api/payments/:id/:action  (id = a payment attempt)
//
//   GET  /api/payments/:id/status        patient (booking token): where is this payment? Cards are checked against STRIPE here.
//   GET  /api/payments/:id               same as status (resume after a refresh)
//   POST /api/payments/:id/confirm-sent  patient: step 2 ("I sent exactly ₱300")
//   POST /api/payments/:id/proof         patient: multipart { reference, receipt } + header Idempotency-Key. Records the proof.
//   PUT  /api/payments/:id/proof         patient: replace the proof while it is not verified yet
//   GET  /api/payments/:id/receipt       the patient (token) or the BOOKED therapist: streams the receipt after an authorisation check
//   POST /api/payments/:id/review        (older route) the booked therapist: { action: "approve" | "reject" }. Same as /api/therapist/payments/:id/*
//
// Error codes: PROOF_REQUIRED, INVALID_REFERENCE, REFERENCE_ALREADY_USED, INVALID_FILE_TYPE, FILE_TOO_LARGE,
// SLOT_NO_LONGER_AVAILABLE, HOLD_EXPIRED, ALREADY_SUBMITTED, PAYMENT_ALREADY_VERIFIED, NOT_ALLOWED.
import multer from 'multer'
import { ObjectId } from 'mongodb'
import { getDb } from '../mongo.js'
import { requireSession } from '../session.js'
import { employeeFor } from '../noteAccess.js'
import { tooManyRequests } from '../rateLimit.js'
import { loadAttempt, tokenOf } from '../bookingAccess.js'
import { refreshCardAttempt, attemptView, submitQr, friendlyFailure, markFailed, tokenMatches, PAYMENT_MESSAGES } from '../paymentAttempts.js'
import { releaseHold } from '../bookingCore.js'
import { confirmSent, submitProof, loadReceipt, PROOF_MESSAGES } from '../paymentProof.js'
import { notifyPatient, notifyTherapistProof } from '../paymentNotifications.js'
import { MAX_RECEIPT_BYTES } from '../paymentProofRules.js'
import { decidePayment } from './therapist-payments.js'

const KEY_RE = /^[\w-]{16,80}$/
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RECEIPT_BYTES + 1, files: 1, fields: 4 } }).single('receipt')
const runUpload = (req, res) => new Promise((resolve, reject) => upload(req, res, (err) => {
  if (!err) return resolve()
  reject(Object.assign(new Error(err.code === 'LIMIT_FILE_SIZE' ? PROOF_MESSAGES.FILE_TOO_LARGE || 'That image is larger than 5 MB. Choose a smaller screenshot.' : 'We could not read your upload.'), { status: err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, code: err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'PROOF_REQUIRED' }))
}))

const ACTIONS = { status: 'GET', '': 'GET', 'confirm-sent': 'POST', proof: 'POST,PUT', receipt: 'GET', 'qr-submit': 'POST', review: 'POST' }

export default async function handler(req, res) {
  const action = req.params?.action ?? ''
  if (!(action in ACTIONS)) return res.status(404).json({ error: 'Not found.' })
  if (!ACTIONS[action].split(',').includes(req.method)) { res.setHeader('Allow', ACTIONS[action]); return res.status(405).json({ error: 'Method not allowed' }) }

  try {
    if (action === 'review') return await decidePayment(req, res, { id: req.params.id, decision: req.body?.action === 'approve' ? 'approve' : req.body?.action === 'reject' ? 'reject' : null, reason: req.body?.reason })
    if (action === 'receipt') return await receipt(req, res)

    const db = await getDb()
    const found = await loadAttempt(db, req, res, req.params.id)
    if (!found) return
    let { attempt, appointment } = found
    const now = new Date()
    const view = async () => attemptView(await db.collection('payment_attempts').findOne({ _id: attempt._id }), await db.collection('appointments').findOne({ _id: appointment._id }))

    if (action === 'status' || action === '') {
      // Cards: ask Stripe (the source of truth), and confirm the booking if it succeeded.
      if (attempt.method === 'card') attempt = await refreshCardAttempt(db, attempt, now).catch((e) => { console.error('status refresh failed:', e.message); return attempt })
      appointment = await db.collection('appointments').findOne({ _id: appointment._id })
      // A hold that ran out while the patient never finished paying.
      if (['created', 'processing', 'requires_action', 'rejected'].includes(attempt.status) && appointment.payment_state === 'awaiting_payment' && appointment.hold_expires_at && new Date(appointment.hold_expires_at) <= now) {
        attempt = await markFailed(db, attempt, friendlyFailure('timeout'))
        await releaseHold(db, appointment, 'expired')
        appointment = await db.collection('appointments').findOne({ _id: appointment._id })
      }
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(attemptView(attempt, appointment))
    }

    if (action === 'confirm-sent') {
      await confirmSent(db, attempt, now)
      return res.status(200).json(await view())
    }

    if (action === 'proof') {
      if (await tooManyRequests(res, `proof:${attempt._id}`, { max: 12, windowMs: 15 * 60 * 1000 })) return
      const key = String(req.headers['idempotency-key'] || '')
      if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Missing submit key.', code: 'PROOF_REQUIRED' })
      await runUpload(req, res)
      const out = await submitProof(db, attempt, appointment, { reference: req.body?.reference, file: req.file?.buffer, key, change: req.method === 'PUT', now })
      appointment = await db.collection('appointments').findOne({ _id: appointment._id })
      let receivedByTherapist = Boolean(out.replay) // a replay was already delivered the first time
      if (!out.replay) {
        // Best effort: a failed notice never undoes the stored proof.
        const t = await notifyTherapistProof(db, appointment, { changed: out.changed }).catch((e) => { console.error('therapist notice failed:', e.message); return { inApp: false } })
        receivedByTherapist = Boolean(t.inApp)
        if (!out.changed) await notifyPatient(db, 'proofReceived', appointment).catch((e) => console.error('patient notice failed:', e.message))
      }
      const stored = await db.collection('payment_attempts').findOne({ _id: attempt._id })
      res.setHeader('Cache-Control', 'no-store')
      return res.status(out.replay ? 200 : 201).json({ ...attemptView(stored, appointment), receivedByTherapist, replay: Boolean(out.replay) })
    }

    // qr-submit (older route, kept so an open page from before the update keeps working)
    if (attempt.method === 'card') return res.status(400).json({ error: 'This is a card payment.' })
    if (attempt.status !== 'pending_verification' && attempt.status !== 'created') return res.status(409).json({ error: 'This payment is no longer waiting for verification.' })
    if (!String(req.body?.reference || '').trim() && !req.body?.screenshot) return res.status(400).json({ error: 'Add a reference number or a screenshot first.', code: 'EMPTY_DETAILS' })
    try {
      await submitQr(db, attempt, appointment, { reference: req.body?.reference, screenshot: req.body?.screenshot })
    } catch (err) {
      if (err.code === 'INVALID_REFERENCE') return res.status(400).json({ error: err.message, code: err.code })
      throw err
    }
    return res.status(200).json(await view())
  } catch (err) {
    if (err.code && err.status && err.status < 500) return res.status(err.status).json({ error: err.message, code: err.code })
    console.error('payments/item error:', err)
    return res.status(500).json({ error: PAYMENT_MESSAGES.unknown })
  }
}

// MongoDB returns a BSON Binary (its .buffer is a Uint8Array); a plain Node Buffer must NOT go through .buffer (that is the shared pool).
const bytesOf = (d) => (Buffer.isBuffer(d) ? d : Buffer.from(d.buffer.subarray(0, typeof d.length === 'function' ? d.length() : d.buffer.length)))

// The receipt: the patient (booking token) or the therapist who received the booking. Nobody else, and no public URL.
async function receipt(req, res) {
  const db = await getDb()
  const id = String(req.params.id || '')
  if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(404).json({ error: 'Receipt not found.' })
  const attempt = await db.collection('payment_attempts').findOne({ _id: new ObjectId(id) })
  const appointment = attempt ? await db.collection('appointments').findOne({ _id: attempt.appointment_id }) : null
  if (!attempt || !appointment) return res.status(404).json({ error: 'Receipt not found.' })

  let allowed = false
  if (tokenOf(req)) allowed = tokenMatches(tokenOf(req), appointment.access_token_hash)
  if (!allowed) {
    const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
    if (!ctx) return
    const employee = await employeeFor(ctx.db, ctx.user)
    allowed = Boolean(employee && String(employee._id) === String(appointment.employee_id))
  }
  if (!allowed) return res.status(403).json({ error: PROOF_MESSAGES.NOT_ALLOWED, code: 'NOT_ALLOWED' })

  const file = await loadReceipt(db, attempt)
  if (!file) return res.status(404).json({ error: 'Receipt not found.' })
  const bytes = bytesOf(file.data)
  res.setHeader('Content-Type', file.content_type)
  res.setHeader('Content-Length', String(bytes.length))
  res.setHeader('Content-Disposition', `inline; filename="receipt.${file.content_type === 'image/png' ? 'png' : 'jpg'}"`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).end(bytes)
}
