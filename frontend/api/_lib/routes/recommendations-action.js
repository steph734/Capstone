import crypto from 'crypto'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { audit } from '../noteAccess.js'
import { insertPaymentWithRef } from '../paymentRef.js'
import {
  HOLD_MS, DEFAULT_SLOTS, oid, dayKey, dayDate, manilaToday, expireStale, isGuardianOf, notify,
  fmtLongDate, fmt12, slotLabel, LIVE_STATUSES,
} from '../sessionRecommendations.js'

// The guardian books the recommended session.
//   GET  /api/recommendations/:id/slots?date=YYYY-MM-DD  -> the therapist's free slots that day
//   POST /api/recommendations/:id/hold  { date, start }   -> reserve a slot for 30 minutes while paying
//   POST /api/recommendations/:id/book  { date, start, note?, payment }  -> create the appointment
//
// A slot is free when the therapist's availability allows it (or, if they haven't
// set any for that day, the default clinic slots), no live appointment already
// sits on it, and nobody else is holding it.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const str = (v) => (v == null ? '' : String(v).trim())

async function ensureHoldIndexes(db) {
  if (ensureHoldIndexes.done) return
  ensureHoldIndexes.done = true
  try {
    const c = db.collection('slot_holds')
    await c.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }) // Mongo clears expired holds itself
    await c.createIndex({ therapist_id: 1, date: 1, start: 1 }, { unique: true })
  } catch (err) {
    console.error('slot_holds indexes:', err.message)
  }
}

async function loadOpenRecommendation(db, user, res, _id) {
  await expireStale(db).catch((err) => console.error('expireStale:', err.message))
  const rec = await db.collection('session_recommendations').findOne({ _id })
  if (!rec || !(await isGuardianOf(db, user, rec.patient_id))) {
    res.status(404).json({ error: 'Recommendation not found.' })
    return null
  }
  if (rec.status === 'Expired' || (rec.status === 'Sent' && rec.expires_at < new Date())) {
    res.status(410).json({ error: 'This recommendation has expired. Please message your therapist.' })
    return null
  }
  if (rec.status !== 'Sent') {
    res.status(409).json({ error: rec.status === 'Booked' ? 'This session has already been booked.' : 'This recommendation is no longer available.' })
    return null
  }
  return rec
}

// Slots a guardian may pick on `date`, as [{ start, end, label }].
async function freeSlots(db, rec, date) {
  const today = manilaToday()
  if (date < today) return []

  const avail = await db.collection('therapist_availability').findOne({ therapist: rec.therapist_id, date, is_archived: { $ne: true } })
  let base
  if (avail && Array.isArray(avail.slots)) {
    base = avail.slots.filter((s) => s.status === 'available').map((s) => ({ start: s.start, end: s.end, label: slotLabel(s.start, s.end) }))
  } else {
    base = DEFAULT_SLOTS.map((s) => ({ ...s }))
  }

  const [taken, holds] = await Promise.all([
    db.collection('appointments').find({
      employee_id: rec.therapist_id, session_date: dayDate(date), status: { $in: [...LIVE_STATUSES, 'Completed'] }, is_archived: { $ne: true },
    }, { projection: { start_time: 1 } }).toArray(),
    db.collection('slot_holds').find({ therapist_id: rec.therapist_id, date, expires_at: { $gt: new Date() } }).toArray(),
  ])
  const takenStarts = new Set(taken.map((a) => a.start_time))
  const heldByOthers = new Set(holds.filter((h) => String(h.recommendation_id) !== String(rec._id)).map((h) => h.start))
  const nowManila = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16)

  return base.filter((s) => !takenStarts.has(s.start) && !heldByOthers.has(s.start) && !(date === today && s.start <= nowManila))
}

async function placeHold(db, rec, date, start) {
  await ensureHoldIndexes(db)
  const c = db.collection('slot_holds')
  const expiresAt = new Date(Date.now() + HOLD_MS)
  const key = { therapist_id: rec.therapist_id, date, start }
  await c.deleteMany({ ...key, expires_at: { $lte: new Date() } }) // an old, lapsed hold shouldn't block this one
  await c.deleteMany({ recommendation_id: rec._id, $nor: [{ date, start }] }) // one hold per recommendation
  try {
    await c.updateOne({ ...key, recommendation_id: rec._id }, { $set: { expires_at: expiresAt }, $setOnInsert: { created_at: new Date() } }, { upsert: true })
    return expiresAt
  } catch (err) {
    if (err.code === 11000) return null // someone else holds it
    throw err
  }
}

export default async function handler(req, res) {
  const action = String(req.params?.action || '')
  const _id = oid(String(req.params?.id || ''))
  if (!_id) return res.status(400).json({ error: 'Invalid recommendation id.' })
  if (!['slots', 'hold', 'book'].includes(action)) return res.status(404).json({ error: 'Not found.' })
  const wantMethod = action === 'slots' ? 'GET' : 'POST'
  if (req.method !== wantMethod) {
    res.setHeader('Allow', wantMethod)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Patient'] })
    if (!ctx) return
    const { db, user, ip } = ctx

    const rec = await loadOpenRecommendation(db, user, res, _id)
    if (!rec) return

    if (action === 'slots') {
      const date = str(req.query.date)
      if (!DATE_RE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD.' })
      return res.status(200).json({ date, slots: await freeSlots(db, rec, date) })
    }

    const date = str(req.body?.date)
    const start = str(req.body?.start)
    if (!DATE_RE.test(date) || !/^\d{2}:\d{2}$/.test(start)) return res.status(400).json({ error: 'Choose a date and a time.' })
    const slot = (await freeSlots(db, rec, date)).find((s) => s.start === start)
    if (!slot) return res.status(409).json({ error: 'That time was just taken. Please pick another.' })

    if (action === 'hold') {
      const heldUntil = await placeHold(db, rec, date, start)
      if (!heldUntil) return res.status(409).json({ error: 'That time was just taken. Please pick another.' })
      return res.status(200).json({ ok: true, heldUntil })
    }

    // ── book ──
    const heldUntil = await placeHold(db, rec, date, start) // (re)confirm we own the slot
    if (!heldUntil) return res.status(409).json({ error: 'That time was just taken. Please pick another.' })

    const source = await db.collection('appointments').findOne({ _id: rec.appointment_id })
    if (!source) return res.status(409).json({ error: 'The original session could not be found.' })

    const payment = req.body?.payment || {}
    const cash = String(payment.method || '').toLowerCase() === 'cash'
    const online = str(payment.onlineMethod).toLowerCase()
    const payMethod = cash ? 'cash' : online.includes('gcash') ? 'gcash' : online.includes('maya') ? 'paymaya' : 'card'
    const fee = Number(rec.session_fee) || null
    const now = new Date()
    const note = str(req.body?.note).slice(0, 500) || null

    const apptDoc = {
      employee_id: rec.therapist_id, patient_id: rec.patient_id, payment_id: null, booked_by: user._id,
      patient_name: source.patient_name || null, patient_photo_id: source.patient_photo_id || null, patient_photo_url: source.patient_photo_url || null,
      therapist_name: source.therapist_name || null, therapist_role: source.therapist_role || null,
      guardian_name: source.guardian_name || null, contact_number: source.contact_number || null, contact_email: source.contact_email || null,
      session_date: dayDate(date), start_time: slot.start, end_time: slot.end, time_slot_label: slot.label,
      session_mode: rec.session_mode, session_type: rec.session_type, condition: source.condition || null,
      // Paid online → confirmed. Cash is settled at the clinic, so it waits for the therapist like a normal booking.
      status: cash ? 'Pending' : 'Confirmed', cancelled_reason: null,
      session_fee: fee, service_charge: 0, total_due: fee, payment_method: cash ? 'Cash' : 'Stripe',
      source: 'recommendation', recommendation_id: rec._id, parent_note: note,
      completed_at: null, completed_by: null, completion_remarks: null,
      created_at: now, updated_at: now, is_archived: false, archived_at: null,
    }
    const { insertedId: appointmentId } = await db.collection('appointments').insertOne(apptDoc)

    // Mark the recommendation booked — only if it is still open, so two tabs can't both win.
    const flipped = await db.collection('session_recommendations').updateOne(
      { _id: rec._id, status: 'Sent' }, { $set: { status: 'Booked', booked_appointment_id: appointmentId, updated_at: now } }
    )
    if (!flipped.modifiedCount) {
      await db.collection('appointments').deleteOne({ _id: appointmentId })
      return res.status(409).json({ error: 'This recommendation was already booked.' })
    }

    // Mark the therapist's availability slot taken (if they set one for that day).
    await db.collection('therapist_availability').updateOne(
      { therapist: rec.therapist_id, date, slots: { $elemMatch: { start: slot.start, status: 'available' } } },
      { $set: { 'slots.$.status': 'booked', 'slots.$.appointment': appointmentId, updated_at: now } }
    ).catch((err) => console.error('recommendation book: availability flip failed:', err.message))
    await db.collection('slot_holds').deleteMany({ recommendation_id: rec._id })

    let paymentRef = null
    if (fee != null) {
      try {
        const pay = await insertPaymentWithRef(db.collection('payments'), {
          PaymentID: `PAY-${crypto.randomUUID()}`, payment_for: 'appointment', appointment_id: appointmentId, patient_id: rec.patient_id,
          amount: fee, currency: 'PHP', method: payMethod, payment_date: now, status: cash ? 'pending' : 'completed',
        })
        paymentRef = pay.payment_ref
        await db.collection('appointments').updateOne({ _id: appointmentId }, { $set: { payment_id: pay._id, updated_at: new Date() } })
      } catch (err) {
        console.error('recommendation book: payment row failed:', err.message)
      }
    }

    await audit(db, { user, action: 'session_recommendation_booked', patientId: rec.patient_id, ip, meta: { recommendationId: String(rec._id), appointmentId: String(appointmentId) } })

    // Tell the therapist.
    const emp = await db.collection('employees').findOne({ _id: rec.therapist_id }, { projection: { email: 1 } })
    const first = String(source.patient_name || 'the patient').split(/\s+/)[0]
    await notify(db, {
      email: emp?.email, type: 'recommendation_booked', title: 'Next session booked',
      body: `${source.guardian_name || 'A parent'} booked ${first}'s next session for ${fmtLongDate(date)}, ${fmt12(slot.start)}.`,
      link: '/therapist/appointments', requestId: appointmentId,
    })

    return res.status(201).json({
      ok: true, appointmentId: String(appointmentId), status: apptDoc.status, date, start: slot.start, label: slot.label,
      paymentRef, therapistName: source.therapist_name || '', patientName: source.patient_name || '',
    })
  } catch (err) {
    console.error('recommendations/action error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
