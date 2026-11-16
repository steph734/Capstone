// The therapist's appointment-request review: verify / reject a QR payment, then accept or decline the appointment.
//
// Every state change is ONE conditional update ("only if the status is still what this action expects"), so a double click or a
// second tab cannot both succeed: the loser gets ALREADY_DECIDED. Emails are sent AFTER the change is saved; a failed email is
// stored (appointment_emails.status = "failed", with a "Resend email" action) and never rolls the decision back.
import { reviewQr } from './paymentAttempts.js'
import { slotKey, releaseSlotLock, markAvailability } from './bookingCore.js'
import { sendAppointmentStatusEmail } from './appointmentEmail.js'
import { buildDeclineEmail, buildResubmitEmail, sendTracked, deliver } from './reviewEmails.js'
import { PAYMENT_HOLD_HOURS } from './paymentProofRules.js'
import { checksOk, cleanText, declineLabel, problemLabel, validateDecline, validateReject, NOTE_MAX } from './requestReviewRules.js'

export class ReviewError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; Object.assign(this, extra) }
}

const CLINIC = 'Main Clinic'
// Payment states in which the money has NOT been confirmed (so the appointment cannot be accepted).
const UNCONFIRMED = ['awaiting_payment', 'pending_verification', 'expired', 'failed', 'cancelled']
const QR = ['gcash', 'paymaya']

/* ───────── formatting (the clinic's day, Asia/Manila; the stored date is the UTC date of the booking) ───────── */
export const fmt12 = (t) => {
  const [h, m] = String(t || '').split(':').map(Number)
  if (!Number.isFinite(h)) return ''
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
const dateLong = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
const dateShort = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const dateTab = (d) => new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
export const timeRange = (a) => (a.start_time && a.end_time ? `${fmt12(a.start_time)} – ${fmt12(a.end_time)}` : fmt12(a.start_time))
export const holdText = (d) => (d ? new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

export const emailView = (a, extra = {}) => ({
  guardianName: a.guardian_name, patient: a.patient_name, therapist: a.therapist_name, therapistRole: a.therapist_role,
  dateShort: dateShort(a.session_date), dateLong: dateLong(a.session_date), timeLabel: timeRange(a), sessionType: a.session_type || a.session_mode || '', clinic: CLINIC, ...extra,
})

export const latestAttempt = async (db, appointmentId) => (await db.collection('payment_attempts').find({ appointment_id: appointmentId, method: { $in: QR } }).sort({ created_at: -1 }).limit(1).toArray())[0] || null

export async function loadOwned(db, employee, appointmentId) {
  const a = appointmentId ? await db.collection('appointments').findOne({ _id: appointmentId }) : null
  if (!a || !employee || String(a.employee_id) !== String(employee._id)) throw new ReviewError(403, 'NOT_YOUR_APPOINTMENT', 'This is not your appointment.')
  return a
}

const warnOf = (r) => (r.status === 'failed' ? { code: 'EMAIL_FAILED', message: "The email couldn't be sent. You can resend it." } : null)

/* ───────── payment: verify ───────── */
export async function verifyPayment(db, appt, { checks, by } = {}) {
  if (!checksOk(checks)) throw new ReviewError(422, 'CHECKS_REQUIRED', 'Tick both checks before confirming the payment.')
  const attempt = await latestAttempt(db, appt._id)
  if (!attempt) throw new ReviewError(409, 'PAYMENT_NOT_VERIFIED', 'There is no online payment to verify for this appointment.')
  if (attempt.status === 'succeeded') return { already: true, paymentStatus: 'verified' } // idempotent
  if (appt.status !== 'Pending') throw new ReviewError(409, 'ALREADY_DECIDED', 'This request was already decided.')
  if (attempt.status !== 'pending_verification') throw new ReviewError(409, 'PROOF_NOT_SUBMITTED', "The guardian hasn't sent payment proof yet.")
  // The booking is NOT confirmed here (no email): the therapist still has to accept it. finalizePaid flips the status exactly once.
  const out = await reviewQr(db, attempt._id, true, { by, notify: false })
  if (!out.ok) throw new ReviewError(409, 'ALREADY_DECIDED', out.error)
  const now = new Date()
  await db.collection('payment_attempts').updateOne({ _id: attempt._id }, { $set: { verification_checks: { amountSeen: true, referenceMatches: true }, updated_at: now } })
  await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { review_state: null, updated_at: now } })
  return { already: false, paymentStatus: 'verified' }
}

/* ───────── decline (shared) ───────── */
async function declineCore(db, appt, { reason, message, by, now }) {
  const verified = appt.payment_state === 'paid'
  const set = {
    status: 'Cancelled', cancelled_reason: 'Declined by therapist', decision: 'declined', decline_reason: reason, decline_message: message || null,
    declined_at: now, declined_by: by, decided_at: now, review_state: null, hold_expires_at: null, updated_at: now,
    ...(verified ? {} : { payment_state: 'failed' }),
  }
  const r = await db.collection('appointments').updateOne({ _id: appt._id, status: 'Pending' }, { $set: set })
  if (!r.matchedCount) throw new ReviewError(409, 'ALREADY_DECIDED', 'This request was already decided.')
  // The slot goes back to other patients.
  if (appt.employee_id && appt.start_time) await releaseSlotLock(db, slotKey(appt.employee_id, appt.session_date, appt.start_time), appt._id).catch(() => {})
  await markAvailability(db, appt, false)
  return { paymentSent: verified }
}

export async function declineAppointment(db, appt, input, { by, now = new Date(), sender, backoffMs } = {}) {
  const v = validateDecline(input)
  if (!v.ok) throw new ReviewError(422, v.code, v.message)
  // The payment must have been checked first (an online payment still waiting for a decision cannot be declined from here).
  if (appt.payment_state === 'pending_verification') throw new ReviewError(409, 'PAYMENT_NOT_VERIFIED', 'Check the payment first.')
  const { paymentSent } = await declineCore(db, appt, { ...v.value, by, now })
  const email = await sendTracked(db, { appointmentId: appt._id, type: 'decline', to: appt.contact_email, toName: appt.guardian_name, email: buildDeclineEmail(emailView(appt, { ...v.value, paymentSent })), sender, backoffMs })
  return { status: 'Cancelled', email, warning: warnOf(email) }
}

/* ───────── payment: not received ───────── */
export async function rejectPayment(db, appt, input, { by, now = new Date(), sender, backoffMs } = {}) {
  const v = validateReject(input)
  if (!v.ok) throw new ReviewError(422, v.code, v.message)
  const { reason, note, nextAction } = v.value
  const attempt = await latestAttempt(db, appt._id)
  if (!attempt || attempt.status !== 'pending_verification' || appt.status !== 'Pending') throw new ReviewError(409, 'ALREADY_DECIDED', 'This payment was already decided.')
  const holdLeft = appt.hold_expires_at ? new Date(appt.hold_expires_at).getTime() - now.getTime() : 0
  if (nextAction === 'request_new_proof' && holdLeft <= 0) throw new ReviewError(409, 'HOLD_EXPIRED', 'The hold has expired, so you can only decline.')

  const shown = [problemLabel(reason), note].filter(Boolean).join(': ') // what the guardian sees
  const r = await db.collection('payment_attempts').updateOne({ _id: attempt._id, status: 'pending_verification' }, { $set: {
    status: 'rejected', reject_reason: reason, reject_note: note || null, rejected_reason: shown, rejected_at: now, rejected_by: by, failure_code: 'verification_rejected', updated_at: now,
  } })
  if (!r.matchedCount) throw new ReviewError(409, 'ALREADY_DECIDED', 'This payment was already decided.')

  if (nextAction === 'request_new_proof') {
    // The appointment stays held; the 72 h hold is NOT extended.
    await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { payment_state: 'awaiting_payment', review_state: 'needs_proof', updated_at: now } })
    const email = await sendTracked(db, { appointmentId: appt._id, type: 'resubmit', to: appt.contact_email, toName: appt.guardian_name, email: buildResubmitEmail(emailView(appt, { problem: reason, note, holdEnd: holdText(appt.hold_expires_at) })), sender, backoffMs })
    return { nextAction, status: 'Pending', email, warning: warnOf(email) }
  }
  // decline_request: "Payment couldn't be verified" plus the detail typed here
  const message = cleanText(shown, 500)
  await declineCore(db, { ...appt, payment_state: 'pending_verification' }, { reason: 'payment_unverified', message, by, now })
  const email = await sendTracked(db, { appointmentId: appt._id, type: 'decline', to: appt.contact_email, toName: appt.guardian_name, email: buildDeclineEmail(emailView(appt, { reason: 'payment_unverified', message, paymentSent: true })), sender, backoffMs })
  return { nextAction, status: 'Cancelled', email, warning: warnOf(email) }
}

/* ───────── accept ───────── */
export async function acceptAppointment(db, appt, { by, now = new Date() } = {}) {
  const r = await db.collection('appointments').updateOne(
    { _id: appt._id, status: 'Pending', payment_state: { $nin: UNCONFIRMED } },
    { $set: { status: 'Confirmed', decision: 'accepted', accepted_at: now, decided_at: now, decided_by: by, review_state: null, updated_at: now } },
  )
  if (!r.matchedCount) {
    const cur = await db.collection('appointments').findOne({ _id: appt._id })
    if (cur && cur.status !== 'Pending') throw new ReviewError(409, 'ALREADY_DECIDED', 'This request was already decided.')
    throw new ReviewError(409, 'PAYMENT_NOT_VERIFIED', 'Check the payment first.')
  }
  // The EXISTING confirmation email (same function the old Accept button used).
  const rec = { appointment_id: appt._id, type: 'accept', to: appt.contact_email || '', subject: `TherapyPro: Appointment accepted — ${dateLong(appt.session_date)}`, html: '', text: `${appt.therapist_name || 'Your therapist'} accepted ${appt.patient_name}'s appointment on ${dateLong(appt.session_date)}, ${timeRange(appt)}.`, status: 'queued', attempts: 0, error: null, created_at: now, sent_at: null }
  const ins = await db.collection('appointment_emails').insertOne(rec)
  const email = await deliver(db, ins.insertedId, { ...rec, _id: ins.insertedId }, {
    toName: appt.guardian_name,
    sender: () => sendAppointmentStatusEmail({ email: appt.contact_email, guardianName: appt.guardian_name, patient: appt.patient_name, therapist: appt.therapist_name, therapistRole: appt.therapist_role, dateStr: dateLong(appt.session_date), timeStr: timeRange(appt), accepted: true }),
  })
  return { status: 'Confirmed', email, warning: warnOf(email) }
}

/* ───────── emails ───────── */
export async function listEmails(db, appt) {
  const rows = await db.collection('appointment_emails').find({ appointment_id: appt._id }).sort({ created_at: -1 }).limit(20).toArray()
  return rows.map((e) => ({ id: String(e._id), type: e.type, status: e.status, sentAt: e.sent_at || null, createdAt: e.created_at, subject: e.subject, text: e.text, error: e.status === 'failed' ? e.error : null }))
}

export async function resendEmail(db, appt, emailId, { sender, backoffMs } = {}) {
  const e = (await db.collection('appointment_emails').find({ appointment_id: appt._id }).toArray()).find((x) => String(x._id) === String(emailId))
  if (!e) throw new ReviewError(404, 'NOT_FOUND', 'Email not found.')
  if (e.type === 'accept') return deliver(db, e._id, e, { toName: appt.guardian_name, sender: () => sendAppointmentStatusEmail({ email: appt.contact_email, guardianName: appt.guardian_name, patient: appt.patient_name, therapist: appt.therapist_name, therapistRole: appt.therapist_role, dateStr: dateLong(appt.session_date), timeStr: timeRange(appt), accepted: true }) })
  return deliver(db, e._id, e, { toName: appt.guardian_name, sender, backoffMs })
}

/* ───────── the list the page shows ───────── */
const METHOD_LABEL = { gcash: 'GCash QR', paymaya: 'Maya QR' }

export async function listRequests(db, employee, now = new Date()) {
  const appts = await db.collection('appointments').find({
    employee_id: employee._id, status: 'Pending', is_archived: { $ne: true },
    $or: [{ payment_state: { $nin: ['awaiting_payment', 'expired', 'failed', 'cancelled'] } }, { review_state: 'needs_proof' }],
  }).toArray()
  const requests = []
  for (const a of appts) {
    const attempt = a.payment_method === 'Cash' || a.payment_method === 'cash' ? null : await latestAttempt(db, a._id)
    let payment = null
    if (attempt) {
      const state = attempt.status === 'succeeded' ? 'verified' : attempt.status === 'rejected' ? 'rejected' : 'proof_submitted'
      payment = {
        attemptId: String(attempt._id), state, method: attempt.method, methodLabel: METHOD_LABEL[attempt.method] || 'QR', amount: attempt.amount,
        referenceDisplay: attempt.reference_display || attempt.provider_ref || null, referenceLast4: attempt.reference_last4 || null,
        submittedAt: attempt.proof_submitted_at || attempt.qr_submitted_at || null, holdExpiresAt: a.hold_expires_at || null,
        holdText: holdText(a.hold_expires_at), holdExpired: Boolean(a.hold_expires_at && new Date(a.hold_expires_at) <= now),
        receiptUrl: attempt.receipt_id ? `/api/payments/${attempt._id}/receipt` : null,
        rejectReason: attempt.reject_reason || null, rejectNote: attempt.reject_note || null, rejectedAt: attempt.rejected_at || null, verifiedAt: attempt.verified_at || null,
        referenceReused: Boolean(attempt.reference_reuse_flag),
      }
    }
    const phase = !payment ? 'decide' : payment.state === 'proof_submitted' ? 'check_payment' : payment.state === 'rejected' ? 'waiting_proof' : 'decide'
    requests.push({
      id: String(a._id), phase, patientName: a.patient_name, guardianName: a.guardian_name || '', condition: a.condition || '',
      dateLong: dateLong(a.session_date), dateTab: dateTab(a.session_date), whenLabel: `${dateTab(a.session_date)}, ${new Date(a.session_date).getUTCFullYear()} · ${timeRange(a)}`, dateShort: dateShort(a.session_date), timeLabel: timeRange(a), timeStart: fmt12(a.start_time),
      sessionType: a.session_type || a.session_mode || '', clinic: CLINIC, amount: payment?.amount ?? a.total_due ?? null, requestedAt: a.created_at, payment,
    })
  }
  requests.sort((x, y) => new Date(y.requestedAt) - new Date(x.requestedAt))

  const since = new Date(now.getTime() - 14 * 86400000)
  const handled = await db.collection('appointments').find({ employee_id: employee._id, decision: { $in: ['accepted', 'declined'] }, decided_at: { $gt: since } }).sort({ decided_at: -1 }).limit(10).toArray()
  const recent = []
  for (const a of handled) {
    const emails = await db.collection('appointment_emails').find({ appointment_id: a._id }).sort({ created_at: -1 }).limit(1).toArray()
    const e = emails[0]
    recent.push({
      id: String(a._id), patientName: a.patient_name, sessionLabel: `${dateTab(a.session_date)} · ${timeRange(a)}`, outcome: a.decision, handledAt: a.decided_at,
      reasonLabel: a.decision === 'declined' ? declineLabel(a.decline_reason) : null, message: a.decline_message || null,
      email: e ? { id: String(e._id), status: e.status, sentAt: e.sent_at, type: e.type } : null,
    })
  }
  return { requests, recent, holdHours: PAYMENT_HOLD_HOURS, noteMax: NOTE_MAX }
}
