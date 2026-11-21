// The booked therapist's side of QR (GCash / Maya) payments.
//
//   GET  /api/therapist/payments?status=proof_submitted   payments waiting for THIS therapist to verify
//   POST /api/therapist/payments/:id/verify                "Mark as paid": books the appointment
//   POST /api/therapist/payments/:id/reject  { reason }    "Not received": slot stays held, the patient can resubmit
//
// Only the therapist who received the booking can see the proof or decide. The receipt itself is streamed by
// GET /api/payments/:id/receipt (never a public URL).
import { ObjectId } from 'mongodb'
import { requireSession } from '../session.js'
import { employeeFor, audit } from '../noteAccess.js'
import { reviewQr } from '../paymentAttempts.js'
import { notifyPatient } from '../paymentNotifications.js'
import { REJECT_REASONS } from '../paymentProofRules.js'
import { registrationProofRows, decideRegistrationPayment, PatientError } from '../therapistPatients.js'

const METHOD_LABEL = { gcash: 'GCash QR', paymaya: 'Maya QR' }
const NEW_FOR_MS = 24 * 60 * 60 * 1000

export function proofRow(a, attempt, now = new Date()) {
  const submitted = attempt.proof_submitted_at || attempt.qr_submitted_at || attempt.created_at
  return {
    attemptId: String(attempt._id), appointmentId: String(a._id),
    patient: a.patient_name, guardian: a.guardian_name, contact: a.contact_number,
    date: a.session_date, timeLabel: a.time_slot_label,
    amount: attempt.amount, currency: attempt.currency,
    method: attempt.method, methodLabel: METHOD_LABEL[attempt.method] || 'QR',
    reference: attempt.reference_digits || attempt.provider_ref || null,
    referenceDisplay: attempt.reference_display || attempt.provider_ref || null,
    hasReceipt: Boolean(attempt.receipt_id), receiptUrl: attempt.receipt_id ? `/api/payments/${attempt._id}/receipt` : null,
    submittedAt: submitted, isNew: now.getTime() - new Date(submitted).getTime() < NEW_FOR_MS,
    holdExpiresAt: a.hold_expires_at || null,
    // Warnings only. Nothing is decided automatically.
    flags: { referenceReused: Boolean(attempt.reference_reuse_flag), proofChanged: Boolean(attempt.proof_changed) },
  }
}

async function therapistContext(req, res) {
  const ctx = await requireSession(req, res, { roles: ['Therapist'], auditDenied: true })
  if (!ctx) return null
  const employee = await employeeFor(ctx.db, ctx.user)
  if (!employee) { res.status(403).json({ error: 'Your account is not linked to a staff record.', code: 'NOT_ALLOWED' }); return null }
  return { ...ctx, employee }
}

// Shared by this route and the older POST /api/payments/:id/review.
export async function decidePayment(req, res, { id, decision, reason }) {
  const ctx = await therapistContext(req, res)
  if (!ctx) return
  const { db, user, ip, employee } = ctx
  if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return res.status(400).json({ error: 'Payment not found.', code: 'NOT_ALLOWED' })
  // A first-session fee paid when a patient was added (not tied to an appointment).
  try {
    const reg = await decideRegistrationPayment(db, employee, user, id, decision === 'approve', reason)
    if (reg) return res.status(200).json(reg)
  } catch (e) {
    if (e instanceof PatientError) return res.status(e.status).json({ error: e.message, code: e.code })
    throw e
  }
  const attempt = await db.collection('payment_attempts').findOne({ _id: new ObjectId(String(id)) })
  const appointment = attempt ? await db.collection('appointments').findOne({ _id: attempt.appointment_id }) : null
  if (!attempt || !appointment || String(appointment.employee_id) !== String(employee._id)) {
    await audit(db, { user, action: 'denied', ip, meta: { attempted: 'verify payment' } }).catch(() => {})
    return res.status(403).json({ error: 'Only the therapist who received this booking can verify its payment.', code: 'NOT_ALLOWED' })
  }
  if (attempt.status === 'succeeded') return res.status(409).json({ error: 'This payment was already verified.', code: 'PAYMENT_ALREADY_VERIFIED' })

  const approve = decision === 'approve'
  const out = await reviewQr(db, attempt._id, approve, { reason, by: user.email })
  if (!out.ok) return res.status(409).json({ error: out.error, code: 'ALREADY_SUBMITTED' })
  await audit(db, { user, action: approve ? 'payment_verified' : 'payment_rejected', patientId: appointment.patient_id, ip, meta: { attempt: String(attempt._id) } }).catch(() => {})

  // Tell the patient. A failure here never changes the decision.
  const fresh = await db.collection('appointments').findOne({ _id: appointment._id })
  await notifyPatient(db, approve ? 'verified' : 'rejected', fresh || appointment, { reason }).catch((e) => console.error('payment decision notice failed:', e.message))
  return res.status(200).json({ ok: true, paymentStatus: approve ? 'verified' : 'rejected', appointmentId: String(appointment._id) })
}

export default async function handler(req, res) {
  const action = req.params?.action
  try {
    if (!action) {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
      const ctx = await therapistContext(req, res)
      if (!ctx) return
      const { db, employee } = ctx
      const now = new Date()
      const appointments = await db.collection('appointments').find({ employee_id: employee._id, payment_state: 'pending_verification' }).sort({ updated_at: -1 }).limit(50).toArray()
      const payments = []
      for (const a of appointments) {
        const attempt = (await db.collection('payment_attempts').find({ appointment_id: a._id, status: 'pending_verification' }).sort({ created_at: -1 }).limit(1).toArray())[0]
        if (attempt) payments.push(proofRow(a, attempt, now))
      }
      payments.push(...await registrationProofRows(db, employee))
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({ payments, reasons: REJECT_REASONS })
    }
    if (!['verify', 'reject'].includes(action)) return res.status(404).json({ error: 'Not found.' })
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
    return await decidePayment(req, res, { id: req.params.id, decision: action === 'verify' ? 'approve' : 'reject', reason: req.body?.reason })
  } catch (err) {
    console.error('therapist/payments error:', err)
    return res.status(500).json({ error: 'Could not load payments.' })
  }
}
