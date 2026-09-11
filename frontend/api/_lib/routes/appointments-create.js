import mongoose from 'mongoose'
import { getDb } from '../mongo.js'

const { ObjectId } = mongoose.Types

// Maps the booking form's single "session mode" dropdown onto the schema's two
// axes (delivery mode + therapy focus).
const MODE_MAP = {
  'in-person': { session_mode: 'In-Person', session_type: null },
  cognitive: { session_mode: 'In-Person', session_type: 'Cognitive' },
  speech: { session_mode: 'In-Person', session_type: 'Speech' },
  behavioral: { session_mode: 'In-Person', session_type: 'Behavioral' },
}

const PAYMENT_MAP = { cash: 'Cash', stripe: 'Stripe', gcash: 'GCash QR' }

// "10:00 - 11:00 AM" / "1:00 - 2:00 PM"  ->  { start: "10:00", end: "11:00" }
function parseSlot(label) {
  const m = String(label || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return { start: '00:00', end: '00:00' }
  const mer = m[5].toUpperCase()
  const to24 = (h, mm) => {
    let hh = parseInt(h, 10)
    if (mer === 'PM' && hh !== 12) hh += 12
    if (mer === 'AM' && hh === 12) hh = 0
    return `${String(hh).padStart(2, '0')}:${mm}`
  }
  return { start: to24(m[1], m[2]), end: to24(m[3], m[4]) }
}

const asObjectId = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null)
const str = (v) => (v == null ? '' : String(v).trim())

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { patient = {}, therapist = {}, session = {}, payment = {}, bookedBy = {} } = req.body || {}

  if (!str(patient.firstName) || !str(patient.lastName)) {
    return res.status(400).json({ error: 'Patient first and last name are required.' })
  }
  if (!str(patient.birthdate) || !str(patient.address)) {
    return res.status(400).json({ error: 'Patient birthdate and address are required.' })
  }

  try {
    const db = await getDb()
    const now = new Date()

    // 1. Who booked it — an id if we have one, else look the user up by email.
    let bookedById = asObjectId(bookedBy.id)
    if (!bookedById && str(bookedBy.email)) {
      const u = await db.collection('users').findOne({ email: str(bookedBy.email).toLowerCase() })
      if (u) bookedById = u._id
    }

    // 2. Patient record (created straight from the booking; user_id may be null).
    // `patients` has a unique index on `PatientID` (a legacy *ID-style key,
    // same pattern as `OtpID` on user_otps) that the app never reads — it just
    // needs a unique value per insert so it doesn't collide on `null`.
    const patientDoc = {
      PatientID: new ObjectId().toString(),
      user_id: bookedById || null,
      first_name: str(patient.firstName),
      middle_name: null,
      last_name: str(patient.lastName),
      nickname: str(patient.nickname) || null,
      gender: ['Male', 'Female', 'Other'].includes(patient.gender) ? patient.gender : 'Other',
      birthdate: new Date(patient.birthdate),
      address: str(patient.address),
      contact_number: str(patient.contactNumber),
      email: str(patient.email) || null,
      guardian_first_name: str(patient.guardianFirst),
      guardian_last_name: str(patient.guardianLast),
      guardian_relationship: ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Other']
        .includes(patient.relationship) ? patient.relationship : 'Guardian',
      guardian_contact_number: str(patient.contactNumber) || null,
      guardian_email: str(patient.email) || null,
      created_at: now,
      updated_at: now,
    }
    const patientRes = await db.collection('patients').insertOne(patientDoc)
    const patientId = patientRes.insertedId

    // 2b. Best-effort: register the condition as a disorder + link it.
    if (str(patient.condition)) {
      try {
        const name = str(patient.condition)
        const d = await db.collection('disorders').findOneAndUpdate(
          { disorder_name: name },
          { $setOnInsert: { disorder_name: name } },
          { upsert: true, returnDocument: 'after' }
        )
        const disorderId = (d && (d.value?._id || d._id)) || null
        if (disorderId) {
          await db.collection('patient_disorders').insertOne({
            patient_id: patientId,
            disorder_id: disorderId,
          })
        }
      } catch {
        /* non-critical */
      }
    }

    // 3. Appointment.
    const { start, end } = parseSlot(session.timeSlot)
    const modeMap = MODE_MAP[session.mode] || { session_mode: 'In-Person', session_type: null }
    const year = Number(session.year)
    const month = Number(session.month) // 0-based, as the calendar keys it
    const day = Number(session.day)
    const sessionDate = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
      ? new Date(Date.UTC(year, month, day))
      : now

    const total = Number(payment.total) || null
    const method = PAYMENT_MAP[String(payment.method || '').toLowerCase()] || null

    const appointmentDoc = {
      employee_id: null, // mock therapists — no employees seeded yet
      patient_id: patientId,
      payment_id: null,
      booked_by: bookedById || null,

      patient_name: `${patientDoc.first_name} ${patientDoc.last_name}`.trim(),
      therapist_name: str(therapist.name) || null,
      therapist_role: str(therapist.role) || null,
      guardian_name: `${patientDoc.guardian_first_name} ${patientDoc.guardian_last_name}`.trim() || null,
      contact_number: patientDoc.contact_number || null,
      contact_email: patientDoc.email,

      session_date: sessionDate,
      start_time: start,
      end_time: end,
      time_slot_label: str(session.timeSlot) || null,

      session_mode: modeMap.session_mode,
      session_type: modeMap.session_type,
      condition: str(patient.condition) || null,

      status: 'Pending',
      cancelled_reason: null,

      session_fee: Number(payment.sessionFee) || null,
      service_charge: Number(payment.serviceCharge) || null,
      total_due: total,
      payment_method: method,

      created_at: now,
      updated_at: now,
      is_archived: false,
      archived_at: null,
    }
    const apptRes = await db.collection('appointments').insertOne(appointmentDoc)
    const appointmentId = apptRes.insertedId

    // 4. Best-effort payment row.
    if (method && total != null) {
      try {
        const payRes = await db.collection('payments').insertOne({
          appointment_id: appointmentId,
          patient_id: patientId,
          amount: total,
          method,
          payment_date: now,
          status: method === 'Cash' ? 'Pending' : 'Paid',
          created_at: now,
          updated_at: now,
        })
        await db.collection('appointments').updateOne(
          { _id: appointmentId },
          { $set: { payment_id: payRes.insertedId, updated_at: new Date() } }
        )
      } catch {
        /* non-critical */
      }
    }

    return res.status(201).json({ success: true, appointmentId, patientId })
  } catch (err) {
    console.error('appointments/create error:', err)
    return res.status(500).json({ error: err.message || 'Could not save the appointment.' })
  }
}
