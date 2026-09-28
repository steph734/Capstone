// Seeds the `appointments` collection with plausible demo records, each
// linked to a real patient and a real active employee (therapist). Run
// directly (`node api/_lib/seeders/seedAppointments.js [count]`) or import
// `seedAppointments(db, count)` from another script.
import mongoose from 'mongoose'
import { getMongo, getDb } from '../mongo.js'
import { randomCondition, randomDateAround, randomSlot, pick } from './fakeData.js'

const SESSION_MODES = ['Face-to-Face', 'Online', 'In-Person']
const SESSION_TYPES = ['Cognitive', 'Speech', 'Behavioral', 'Occupational', 'Physical', 'Developmental', null]
// Weighted so most seeded appointments read as a normal, settled clinic
// history rather than an even 1/5 split across every status.
const STATUSES = [
  'Confirmed', 'Confirmed', 'Confirmed',
  'Completed', 'Completed', 'Completed', 'Completed',
  'Pending', 'Pending',
  'Cancelled',
  'No Show',
]
const PAYMENT_METHODS = ['Cash', 'Cash', 'Stripe', 'GCash QR']
const CANCEL_REASONS = [
  'Patient rescheduled to a later date', 'Family emergency', 'Therapist unavailable',
  'Weather/transportation issue', 'Patient recovering from illness',
]

const SESSION_FEE = 300
const SERVICE_CHARGE = 50
const TOTAL_DUE = SESSION_FEE + SERVICE_CHARGE

function fullName(first, last) {
  return `${first} ${last}`.trim()
}

export function buildAppointmentDoc({ patient, employee, now = new Date() }) {
  const status = pick(STATUSES)
  const { start, end, label } = randomSlot()
  // Completed/Cancelled/No Show read naturally as past sessions; Pending/
  // Confirmed as upcoming ones.
  const isPast = status === 'Completed' || status === 'Cancelled' || status === 'No Show'
  const sessionDate = isPast ? randomDateAround(120, -1) : randomDateAround(-1, 30)
  const paymentMethod = status === 'Cancelled' ? null : pick(PAYMENT_METHODS)

  return {
    employee_id: employee?._id || null,
    patient_id: patient._id,
    payment_id: null,
    booked_by: null,

    patient_name: fullName(patient.first_name, patient.last_name),
    patient_photo_id: patient.profile_photo?.photo_id || null,
    patient_photo_url: patient.profile_photo?.url || null,
    therapist_name: employee ? fullName(employee.first_name, employee.last_name) : null,
    therapist_role: employee?.position || null,
    guardian_name: fullName(patient.guardian_first_name, patient.guardian_last_name) || null,
    contact_number: patient.contact_number || null,
    contact_email: patient.email || null,

    session_date: sessionDate,
    start_time: start,
    end_time: end,
    time_slot_label: label,

    session_mode: pick(SESSION_MODES),
    session_type: pick(SESSION_TYPES),
    condition: randomCondition(),

    status,
    cancelled_reason: status === 'Cancelled' ? pick(CANCEL_REASONS) : null,

    session_fee: SESSION_FEE,
    service_charge: SERVICE_CHARGE,
    total_due: TOTAL_DUE,
    payment_method: paymentMethod,

    created_at: now,
    updated_at: now,
    is_archived: false,
    archived_at: null,
  }
}

export async function seedAppointments(db, count = 50, { patients, employees } = {}) {
  const patientList = patients || await db.collection('patients').find({}).toArray()
  const employeeList = employees || await db.collection('employees').find({ status: 'active' }).toArray()

  if (!patientList.length) {
    throw new Error('No patients found to link appointments to — seed patients first.')
  }

  const now = new Date()
  const docs = Array.from({ length: count }, () => buildAppointmentDoc({
    patient: pick(patientList),
    employee: employeeList.length ? pick(employeeList) : null,
    now,
  }))
  const result = await db.collection('appointments').insertMany(docs)
  return Object.values(result.insertedIds)
}

// Runnable directly: `node api/_lib/seeders/seedAppointments.js [count]`
if (import.meta.url === `file://${process.argv[1]}`) {
  process.loadEnvFile?.()
  const count = Number(process.argv[2]) || 50
  await getMongo()
  const db = await getDb()
  const ids = await seedAppointments(db, count)
  console.log(`Seeded ${ids.length} appointments.`)
  await mongoose.disconnect()
}
