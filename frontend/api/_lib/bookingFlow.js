// Server side of the booking approval flow (see bookingFlowRules.js for the stages).
// Every change is a conditional update, so doing it twice never changes timestamps or sends a second notice.
import { ObjectId } from 'mongodb'
import { activeSlotFilter, slotKey, extendSlotLock, expireStaleHolds, dateKeyOf } from './bookingCore.js'
import { reviewQr } from './paymentAttempts.js'
import { audit as paymentAudit, submitProof } from './paymentProof.js'
import { notifyPatient, notifyOwners, notifyTherapist, notifyGuardianInApp, sessionWhen } from './paymentNotifications.js'
import { validateReference } from './paymentProofRules.js'
import { ONLINE_AMOUNT_CENTAVOS } from './pricing.js'
import { ReviewError, latestAttempt, acceptAppointment, declineAppointment, recordTherapistResponse } from './requestReview.js'
import { stageOf, validateOwnerReject, OWNER_REJECT_REASONS, REJECT_HOLD_HOURS, GUARDIAN_LABELS, pesoFromCentavos } from './bookingFlowRules.js'

const isId = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''))
const METHOD = { gcash: 'GCash QR', paymaya: 'Maya QR', card: 'Card' }
const sessionStart = (a) => new Date(`${dateKeyOf(a.session_date)}T${a.start_time || '00:00'}:00+08:00`)
const centavos = (attempt) => attempt?.amount_centavos ?? Math.round(Number(attempt?.amount || 0) * 100)

async function appointmentById(db, id) {
  const a = isId(id) ? await db.collection('appointments').findOne({ _id: new ObjectId(String(id)) }) : null
  if (!a) throw new ReviewError(404, 'NOT_FOUND', 'Appointment not found.')
  return a
}
// Holds that ran out are released whenever someone opens one of these lists (the daily cron is the safety net).
const releaseDue = (db, now) => expireStaleHolds(db, now).catch((e) => console.error('expireStaleHolds failed:', e.message))

/* ───────── Owner ───────── */
export async function ownerQueue(db, now = new Date()) {
  await releaseDue(db, now)
  const appts = await db.collection('appointments').find({ status: 'Pending', payment_state: 'pending_verification', is_archived: { $ne: true } }).sort({ created_at: -1 }).limit(100).toArray()
  const [employees, branches] = await Promise.all([
    db.collection('employees').find({}, { projection: { branch_id: 1 } }).toArray(),
    db.collection('branchs').find({}, { projection: { branch_name: 1 } }).toArray(),
  ])
  const branchName = new Map(branches.map((b) => [String(b._id), b.branch_name]))
  const branchOf = new Map(employees.map((e) => [String(e._id), branchName.get(String(e.branch_id))]))
  const items = []
  for (const a of appts) {
    const attempt = await latestAttempt(db, a._id)
    if (!attempt || attempt.status !== 'pending_verification') continue
    const ref = validateReference(attempt.reference_digits || attempt.provider_ref, attempt.method)
    const reused = ref.digits ? await db.collection('payment_attempts').findOne({ reference_digits: ref.digits, method: attempt.method, _id: { $ne: attempt._id }, status: { $in: ['pending_verification', 'succeeded'] } }, { projection: { _id: 1 } }) : null
    const amount = centavos(attempt)
    const paidAt = attempt.proof_submitted_at || attempt.qr_submitted_at || null
    items.push({
      id: String(a._id), patientName: a.patient_name || 'Patient', guardianName: a.guardian_name || '', contact: a.contact_number || '', avatar: a.patient_photo_url || null,
      therapistName: a.therapist_name || '', service: a.session_type ? `${a.session_type} Therapy` : a.therapist_role || 'Therapy session',
      branch: branchOf.get(String(a.employee_id)) || 'Main Clinic', date: a.session_date, start: a.start_time, end: a.end_time, requestedAt: a.created_at,
      feeCentavos: ONLINE_AMOUNT_CENTAVOS, holdExpiresAt: a.hold_expires_at || null,
      proof: {
        attemptId: String(attempt._id), method: attempt.method, methodLabel: METHOD[attempt.method] || 'QR', referenceNo: attempt.reference_display || attempt.provider_ref || null,
        amountCentavos: amount, paidAt, receiptUrl: attempt.receipt_id ? `/api/payments/${attempt._id}/receipt` : null,
      },
      // Help for the Owner. They never block the buttons.
      checks: [
        { id: 'amount', ok: amount >= ONLINE_AMOUNT_CENTAVOS, label: amount >= ONLINE_AMOUNT_CENTAVOS ? `Amount matches the fee (${pesoFromCentavos(ONLINE_AMOUNT_CENTAVOS)})` : `Amount is below the fee (${pesoFromCentavos(ONLINE_AMOUNT_CENTAVOS)})` },
        { id: 'reference', ok: ref.ok && !reused, label: !ref.ok ? 'Reference number could not be read' : reused ? 'Reference number is used by another booking' : 'Reference number is readable and not used elsewhere' },
        { id: 'time', ok: Boolean(paidAt) && new Date(paidAt) < sessionStart(a), label: paidAt && new Date(paidAt) < sessionStart(a) ? 'Paid before the session' : 'Check the payment time against the session' },
      ],
    })
  }
  return { items }
}

export async function ownerVerify(db, user, appointmentId, now = new Date()) {
  const a = await appointmentById(db, appointmentId)
  if (a.payment?.status === 'verified') return { already: true, stage: stageOf(a) }
  if (stageOf(a) !== 'awaiting_payment_check') throw new ReviewError(409, 'ALREADY_DECIDED', 'This payment is no longer waiting for your check.')
  const taken = await db.collection('appointments').findOne(activeSlotFilter(a.employee_id, a.session_date, a.start_time, now, a._id), { projection: { _id: 1 } })
  const therapist = a.employee_id ? await db.collection('employees').findOne({ _id: a.employee_id }) : null
  const day = a.employee_id ? await db.collection('therapist_availability').findOne({ therapist: a.employee_id, date: dateKeyOf(a.session_date), is_archived: { $ne: true } }) : null
  if (taken || !therapist || therapist.is_archived || day?.status === 'skipped') throw new ReviewError(409, 'SLOT_TAKEN', 'This time is no longer available. The request stays here so you can contact the guardian.')

  const attempt = await latestAttempt(db, a._id)
  if (!attempt || !['pending_verification', 'succeeded'].includes(attempt.status)) throw new ReviewError(409, 'PROOF_NOT_SUBMITTED', 'There is no payment proof to check.')
  if (attempt.status === 'pending_verification') {
    // Records the payment and releases the card/QR hold. It does NOT confirm the appointment: the therapist still accepts.
    const out = await reviewQr(db, attempt._id, true, { by: user.email, notify: false })
    if (!out.ok) throw new ReviewError(409, 'ALREADY_DECIDED', out.error)
  }
  const after = await db.collection('appointments').findOne({ _id: a._id })
  if (after.payment_state !== 'paid') throw new ReviewError(409, 'SLOT_TAKEN', 'This time was taken before the payment could be confirmed.')

  const claim = await db.collection('appointments').updateOne({ _id: a._id, 'payment.status': { $ne: 'verified' } }, { $set: {
    'payment.status': 'verified', 'payment.method': attempt.method, ...(attempt.reference_digits ? { 'payment.referenceNo': attempt.reference_digits } : {}),
    'payment.amountCentavos': centavos(attempt), ...(attempt.proof_submitted_at ? { 'payment.paidAt': attempt.proof_submitted_at } : {}),
    'payment.verifiedBy': user._id, 'payment.verifiedAt': now, review_state: null, updated_at: now,
  } })
  if (!claim.modifiedCount) return { already: true, stage: 'awaiting_therapist' }
  await paymentAudit(db, attempt, 'verified_by_owner', user.email)
  await notifyTherapist(db, after, { title: 'New appointment request', body: `${after.patient_name || 'A patient'}'s payment is verified. Please accept or decline ${sessionWhen(after)}.` })
  return { already: false, stage: 'awaiting_therapist', appointment: after }
}

export async function ownerReject(db, user, appointmentId, input, now = new Date()) {
  const v = validateOwnerReject(input)
  if (!v.ok) throw new ReviewError(422, v.code, v.error)
  const a = await appointmentById(db, appointmentId)
  if (a.payment?.status === 'rejected') return { already: true, stage: 'payment_rejected' }
  if (stageOf(a) !== 'awaiting_payment_check') throw new ReviewError(409, 'ALREADY_DECIDED', 'This payment is no longer waiting for your check.')
  const attempt = await latestAttempt(db, a._id)
  if (!attempt) throw new ReviewError(409, 'PROOF_NOT_SUBMITTED', 'There is no payment proof to check.')
  const message = v.message || OWNER_REJECT_REASONS.find((r) => r.code === v.reason).message(pesoFromCentavos(ONLINE_AMOUNT_CENTAVOS))
  const claim = await db.collection('payment_attempts').updateOne({ _id: attempt._id, status: 'pending_verification' }, { $set: {
    status: 'rejected', reject_reason: v.reason, rejected_reason: message, rejected_at: now, rejected_by: user.email, failure_code: 'verification_rejected', updated_at: now,
  } })
  if (!claim.matchedCount) throw new ReviewError(409, 'ALREADY_DECIDED', 'This payment was already decided.')
  const until = new Date(now.getTime() + REJECT_HOLD_HOURS * 3600 * 1000)
  await db.collection('appointments').updateOne({ _id: a._id }, { $set: {
    payment_state: 'awaiting_payment', review_state: 'needs_proof', hold_expires_at: until,
    'payment.status': 'rejected', 'payment.rejectedReason': v.reason, 'payment.rejectedMessage': message, 'payment.rejectedAt': now, 'payment.slotHoldUntil': until, updated_at: now,
  } })
  if (a.employee_id) await extendSlotLock(db, slotKey(a.employee_id, a.session_date, a.start_time), a._id, until.getTime() - now.getTime(), now)
  await paymentAudit(db, attempt, 'rejected_by_owner', user.email, { reason: v.reason })
  const after = await db.collection('appointments').findOne({ _id: a._id })
  await notifyPatient(db, 'rejected', after, { reason: message }).catch((e) => console.error('guardian notice failed:', e.message))
  return { already: false, stage: 'payment_rejected', appointment: after }
}

/* ───────── Guardian ───────── */
const owns = (a, user) => String(a.booked_by || '') === String(user._id) || (a.contact_email && user.email && a.contact_email.toLowerCase() === user.email.toLowerCase())
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function guardianBookings(db, user, now = new Date()) {
  await releaseDue(db, now)
  const mine = [{ booked_by: user._id }, ...(user.email ? [{ contact_email: { $regex: `^${escapeRe(user.email)}$`, $options: 'i' } }] : [])]
  const rows = await db.collection('appointments').find({ $or: mine, is_archived: { $ne: true }, session_date: { $gte: new Date(now.getTime() - 14 * 86400000) } }).sort({ session_date: 1 }).limit(30).toArray()
  const items = []
  for (const a of rows) {
    const stage = stageOf(a)
    // Unfinished checkouts and silent expiries are not listed; a booking cancelled because of a payment is, so the guardian knows.
    if (stage === 'awaiting_payment' || (stage === 'cancelled' && !a.payment?.status)) continue
    const attempt = stage === 'payment_rejected' ? await latestAttempt(db, a._id) : null
    items.push({
      id: String(a._id), patientName: a.patient_name, therapistName: a.therapist_name, date: a.session_date, start: a.start_time, end: a.end_time,
      stage, label: GUARDIAN_LABELS[stage],
      ...(stage === 'payment_rejected' ? {
        message: a.payment?.rejectedMessage || attempt?.rejected_reason || 'Please send your payment proof again.', holdUntil: a.payment?.slotHoldUntil || a.hold_expires_at || null,
        method: attempt?.method || 'gcash',
      } : {}),
      ...(stage === 'cancelled' && a.cancelled_reason ? { message: a.cancelled_reason } : {}),
    })
  }
  return { items }
}

export async function guardianResubmit(db, user, appointmentId, { reference, file, key }, now = new Date()) {
  const a = await appointmentById(db, appointmentId)
  if (!owns(a, user)) throw new ReviewError(403, 'NOT_ALLOWED', 'This booking is not yours.')
  const attempt = await latestAttempt(db, a._id)
  if (attempt && attempt.proof_key === key && attempt.status === 'pending_verification') return { already: true, stage: 'awaiting_payment_check' }
  if (!attempt || stageOf(a) !== 'payment_rejected') throw new ReviewError(409, 'ALREADY_DECIDED', 'This booking is not waiting for a new receipt.')
  const out = await submitProof(db, attempt, a, { reference, file, key, now }) // same size / type / reference checks as the first upload
  if (!out.replay) await notifyOwners(db, a, { changed: true })
  return { already: Boolean(out.replay), stage: 'awaiting_payment_check' }
}

/* ───────── Therapist ───────── */
export async function therapistRespond(db, employee, user, appointmentId, { action, reason } = {}, now = new Date()) {
  if (!['accept', 'decline'].includes(action)) throw new ReviewError(422, 'INVALID_ACTION', 'Choose accept or decline.')
  const a = await appointmentById(db, appointmentId)
  if (!employee || String(a.employee_id) !== String(employee._id)) throw new ReviewError(403, 'NOT_YOUR_APPOINTMENT', 'This is not your appointment.')
  const done = action === 'accept' ? 'confirmed' : 'declined'
  if (stageOf(a) === done) return { already: true, stage: done }
  if (stageOf(a) !== 'awaiting_therapist') throw new ReviewError(409, 'NOT_READY', 'This request is not waiting for your answer.')
  const why = String(reason || '').trim().slice(0, 500)
  const out = action === 'accept'
    ? await acceptAppointment(db, a, { by: user.email, now })
    : await declineAppointment(db, a, { reason: 'other', message: why || 'The therapist is not able to take this time.' }, { by: user.email, now })
  await recordTherapistResponse(db, a, user, action, why, now)
  if (action === 'accept') {
    await notifyGuardianInApp(db, a, { title: 'Your appointment is confirmed', body: `${a.therapist_name || 'Your therapist'} accepted ${sessionWhen(a)}.` })
  } else {
    const refund = a.payment_state === 'paid'
    await notifyGuardianInApp(db, a, { title: 'Your appointment was declined', body: `${a.therapist_name || 'Your therapist'} could not take ${sessionWhen(a)}.${refund ? ' Your refund is on the way.' : ''}` })
    await notifyOwners(db, a, { title: 'Appointment declined', body: `${a.therapist_name || 'A therapist'} declined ${a.patient_name} (${sessionWhen(a)}).${refund ? ' Payment is marked for refund.' : ''}` })
  }
  return { already: false, stage: done, warning: out.warning || null, appointment: a }
}

/* ───────── sidebar count ───────── */
export async function badgeCount(db, role, employee) {
  const col = db.collection('appointments')
  if (role === 'Owner') return col.countDocuments({ status: 'Pending', payment_state: 'pending_verification', is_archived: { $ne: true } })
  if (role === 'Therapist' && employee) {
    return col.countDocuments({ employee_id: employee._id, status: 'Pending', is_archived: { $ne: true }, review_state: { $ne: 'needs_proof' }, payment_state: { $nin: ['awaiting_payment', 'pending_verification', 'expired', 'failed', 'cancelled'] } })
  }
  return 0
}
