// One-off dev script (same pattern as api/_lib/seeders/employees.js) that
// seeds sample patients + appointments (and a matching payment row where the
// appointment has already been paid), so pages like Owner/Therapist
// Appointments, Reports, and Billing have real data to render instead of
// empty states. Writes with the raw driver via getDb() rather than a
// Mongoose model — there's no Appointment/Patient/Payment model under
// api/_lib/models (appointments-create.js itself writes these collections
// the same way, by hand, since they carry $jsonSchema validators).
//
// Depends on the employees seeded by employees.js (matched by email) — run
// that one first if the `employees` collection is empty.
//
// Safe to re-run: every doc this script writes carries a `seed_key` and is
// upserted on it, so reruns update the same rows instead of duplicating them.
//
// Usage (from the frontend/ folder, so it picks up frontend/.env):
//   node api/_lib/seeders/appointments.js
import { getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'

try {
  process.loadEnvFile?.()
} catch {
  // no .env in the cwd — fine if MONGO_URI is set some other way
}

const SESSION_FEE = 300
const SERVICE_CHARGE = 50
const TOTAL_DUE = SESSION_FEE + SERVICE_CHARGE

// "10:00 - 11:00 AM" style label -> { start, end } 24h 'HH:mm', matching
// AVAILABILITY_SLOTS / parseSlot() in appointments-create.js.
const SLOTS = {
  '8-9': { label: '8:00 - 9:00 AM', start: '08:00', end: '09:00' },
  '9-10': { label: '9:00 - 10:00 AM', start: '09:00', end: '10:00' },
  '10-11': { label: '10:00 - 11:00 AM', start: '10:00', end: '11:00' },
  '11-12': { label: '11:00 - 12:00 PM', start: '11:00', end: '12:00' },
  '1-2': { label: '1:00 - 2:00 PM', start: '13:00', end: '14:00' },
  '2-3': { label: '2:00 - 3:00 PM', start: '14:00', end: '15:00' },
  '3-4': { label: '3:00 - 4:00 PM', start: '15:00', end: '16:00' },
  '4-5': { label: '4:00 - 5:00 PM', start: '16:00', end: '17:00' },
}

// Each has its own seed_key so appointments below can reference it without
// juggling ObjectIds by hand.
const SEED_PATIENTS = [
  {
    seed_key: 'seed-patient-ella-marasigan',
    first_name: 'Ella', last_name: 'Marasigan', nickname: 'Ella',
    gender: 'Female', birthdate: new Date('2019-04-02'), address: '14 Kalayaan Ave, Quezon City',
    condition: 'Speech Delay',
    contact_number: '+63 9171112221', email: 'liza.marasigan@example.com',
    guardian_first_name: 'Liza', guardian_last_name: 'Marasigan', guardian_relationship: 'Mother',
  },
  {
    seed_key: 'seed-patient-josh-villareal',
    first_name: 'Josh', last_name: 'Villareal', nickname: 'Josh',
    gender: 'Male', birthdate: new Date('2018-09-14'), address: '77 Kamuning Rd, Quezon City',
    condition: 'Autism Spectrum Disorder',
    contact_number: '+63 9171112222', email: 'carlo.villareal@example.com',
    guardian_first_name: 'Carlo', guardian_last_name: 'Villareal', guardian_relationship: 'Father',
  },
  {
    seed_key: 'seed-patient-mikaela-ong',
    first_name: 'Mikaela', last_name: 'Ong', nickname: 'Mika',
    gender: 'Female', birthdate: new Date('2017-01-25'), address: '5 Salcedo St, Makati City',
    condition: 'ADHD',
    contact_number: '+63 9171112223', email: 'jenny.ong@example.com',
    guardian_first_name: 'Jenny', guardian_last_name: 'Ong', guardian_relationship: 'Mother',
  },
  {
    seed_key: 'seed-patient-rafael-cruz',
    first_name: 'Rafael', last_name: 'Cruz', nickname: 'Rafa',
    gender: 'Male', birthdate: new Date('2016-11-30'), address: '221 Commonwealth Ave, Quezon City',
    condition: 'Down Syndrome',
    contact_number: '+63 9171112224', email: 'ana.cruz@example.com',
    guardian_first_name: 'Ana', guardian_last_name: 'Cruz', guardian_relationship: 'Guardian',
  },
  {
    seed_key: 'seed-patient-sophia-lim',
    first_name: 'Sophia', last_name: 'Lim', nickname: 'Sofi',
    gender: 'Female', birthdate: new Date('2015-06-18'), address: '30 Gorordo Ave, Cebu City',
    condition: 'Cerebral Palsy',
    contact_number: '+63 9171112225', email: 'peter.lim@example.com',
    guardian_first_name: 'Peter', guardian_last_name: 'Lim', guardian_relationship: 'Father',
  },
  {
    seed_key: 'seed-patient-dominic-tan',
    first_name: 'Dominic', last_name: 'Tan', nickname: 'Dom',
    gender: 'Male', birthdate: new Date('2019-12-05'), address: '17 Salinas Drive, Lahug, Cebu City',
    condition: 'Developmental Delay',
    contact_number: '+63 9171112226', email: 'mary.tan@example.com',
    guardian_first_name: 'Mary', guardian_last_name: 'Tan', guardian_relationship: 'Mother',
  },
  {
    seed_key: 'seed-patient-isabel-reyes',
    first_name: 'Isabel', last_name: 'Reyes', nickname: 'Belle',
    gender: 'Female', birthdate: new Date('2014-03-21'), address: '14 Gil Puyat Ave, Makati City',
    condition: 'Learning Disability',
    contact_number: '+63 9171112227', email: 'noel.reyes@example.com',
    guardian_first_name: 'Noel', guardian_last_name: 'Reyes', guardian_relationship: 'Father',
  },
  {
    seed_key: 'seed-patient-nathan-garcia',
    first_name: 'Nathan', last_name: 'Garcia', nickname: 'Nate',
    gender: 'Male', birthdate: new Date('2020-02-09'), address: '40 Salcedo St, Makati City',
    condition: 'Other',
    contact_number: '+63 9171112228', email: 'rina.garcia@example.com',
    guardian_first_name: 'Rina', guardian_last_name: 'Garcia', guardian_relationship: 'Guardian',
  },
]

// dayOffset is resolved against "today" when the script runs, so the seeded
// spread of past/present/upcoming appointments always looks current instead
// of drifting stale the way hardcoded dates would.
const SEED_APPOINTMENTS = [
  { seed_key: 'seed-appt-01', patient: 'seed-patient-ella-marasigan', employeeEmail: 'jade.santos@therapypro.app', dayOffset: -10, slot: '9-10', sessionType: 'Speech', status: 'Completed', paymentMethod: 'Cash' },
  { seed_key: 'seed-appt-02', patient: 'seed-patient-josh-villareal', employeeEmail: 'miguel.reyes@therapypro.app', dayOffset: -7, slot: '10-11', sessionType: 'Occupational', status: 'Completed', paymentMethod: 'Stripe', onlineMethod: 'Card' },
  { seed_key: 'seed-appt-03', patient: 'seed-patient-mikaela-ong', employeeEmail: 'carla.tan@therapypro.app', dayOffset: -5, slot: '1-2', sessionType: 'Behavioral', status: 'No Show', paymentMethod: null },
  { seed_key: 'seed-appt-04', patient: 'seed-patient-rafael-cruz', employeeEmail: 'noel.bautista@therapypro.app', dayOffset: -3, slot: '2-3', sessionType: 'Physical', status: 'Cancelled', paymentMethod: null },
  { seed_key: 'seed-appt-05', patient: 'seed-patient-sophia-lim', employeeEmail: 'grace.uy@therapypro.app', dayOffset: -2, slot: '11-12', sessionType: 'Cognitive', status: 'Completed', paymentMethod: 'GCash QR', onlineMethod: 'GCash' },
  { seed_key: 'seed-appt-06', patient: 'seed-patient-dominic-tan', employeeEmail: 'paolo.ramos@therapypro.app', dayOffset: -1, slot: '3-4', sessionType: 'Developmental', status: 'Completed', paymentMethod: 'Cash' },
  { seed_key: 'seed-appt-07', patient: 'seed-patient-isabel-reyes', employeeEmail: 'andre.lim@therapypro.app', dayOffset: 0, slot: '8-9', sessionType: 'Behavioral', status: 'Confirmed', paymentMethod: 'Cash' },
  { seed_key: 'seed-appt-08', patient: 'seed-patient-nathan-garcia', employeeEmail: 'clara.delacruz@therapypro.app', dayOffset: 0, slot: '4-5', sessionType: null, status: 'Pending', paymentMethod: null },
  { seed_key: 'seed-appt-09', patient: 'seed-patient-josh-villareal', employeeEmail: 'kevin.santos@therapypro.app', dayOffset: 1, slot: '9-10', sessionType: 'Occupational', status: 'Confirmed', paymentMethod: 'Stripe', onlineMethod: 'Card' },
  { seed_key: 'seed-appt-10', patient: 'seed-patient-sophia-lim', employeeEmail: 'rica.domingo@therapypro.app', dayOffset: 2, slot: '2-3', sessionType: 'Behavioral', status: 'Pending', paymentMethod: 'Cash' },
  { seed_key: 'seed-appt-11', patient: 'seed-patient-ella-marasigan', employeeEmail: 'jade.santos@therapypro.app', dayOffset: 4, slot: '10-11', sessionType: 'Cognitive', status: 'Confirmed', paymentMethod: 'GCash QR', onlineMethod: 'GCash' },
  { seed_key: 'seed-appt-12', patient: 'seed-patient-nathan-garcia', employeeEmail: 'miguel.reyes@therapypro.app', dayOffset: 6, slot: '1-2', sessionType: 'Physical', status: 'Pending', paymentMethod: null },
]

// Maps the booking form's payment label onto the `payments` collection's
// strict method enum — mirrors resolvePaymentMethod() in appointments-create.js.
function resolvePaymentMethod(method, onlineMethod) {
  if (method === 'Cash') return 'cash'
  if (method === 'Stripe') {
    const online = String(onlineMethod || '').toLowerCase()
    if (online.includes('gcash')) return 'gcash'
    if (online.includes('maya')) return 'paymaya'
    return 'card'
  }
  if (method === 'GCash QR') return 'gcash'
  return null
}

function utcDateDaysFromNow(offset) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

async function upsertPatients(db) {
  const idBySeedKey = new Map()
  const now = new Date()
  for (const p of SEED_PATIENTS) {
    const { seed_key, ...fields } = p
    const res = await db.collection('patients').findOneAndUpdate(
      { seed_key },
      {
        $set: {
          ...fields,
          guardian_contact_number: fields.contact_number,
          guardian_email: fields.email,
          updated_at: now,
        },
        $setOnInsert: {
          seed_key,
          PatientID: `seed-${seed_key}`,
          user_id: null,
          middle_name: null,
          created_at: now,
        },
      },
      { upsert: true, returnDocument: 'after' }
    )
    const doc = res.value || res
    idBySeedKey.set(seed_key, doc._id)
    console.log(`Upserted patient  -> ${p.first_name} ${p.last_name} (${p.condition})`)
  }
  return idBySeedKey
}

async function loadEmployees() {
  const emails = [...new Set(SEED_APPOINTMENTS.map((a) => a.employeeEmail))]
  const employees = await Employee.find({ email: { $in: emails } }).lean()
  const byEmail = new Map(employees.map((e) => [e.email, e]))
  const missing = emails.filter((e) => !byEmail.has(e))
  if (missing.length) {
    console.warn(
      `Warning: ${missing.length} employee(s) not found — run api/_lib/seeders/employees.js first. Missing: ${missing.join(', ')}`
    )
  }
  return byEmail
}

async function upsertAppointments(db, patientIdBySeedKey, employeeByEmail) {
  const now = new Date()
  for (const a of SEED_APPOINTMENTS) {
    const employee = employeeByEmail.get(a.employeeEmail)
    const patientId = patientIdBySeedKey.get(a.patient)
    const patientSeed = SEED_PATIENTS.find((p) => p.seed_key === a.patient)
    if (!employee || !patientId || !patientSeed) {
      console.warn(`Skipping ${a.seed_key}: missing employee or patient reference.`)
      continue
    }

    const slot = SLOTS[a.slot]
    const therapistName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ')
    const sessionDate = utcDateDaysFromNow(a.dayOffset)

    const appointmentDoc = {
      employee_id: employee._id,
      patient_id: patientId,
      booked_by: null,

      patient_name: `${patientSeed.first_name} ${patientSeed.last_name}`.trim(),
      therapist_name: therapistName,
      therapist_role: employee.specialty || employee.position || null,
      guardian_name: `${patientSeed.guardian_first_name} ${patientSeed.guardian_last_name}`.trim(),
      contact_number: patientSeed.contact_number,
      contact_email: patientSeed.email,

      session_date: sessionDate,
      start_time: slot.start,
      end_time: slot.end,
      time_slot_label: slot.label,

      session_mode: 'In-Person',
      session_type: a.sessionType,
      condition: patientSeed.condition,

      status: a.status,
      cancelled_reason: a.status === 'Cancelled' ? 'Rescheduling requested by guardian' : null,

      session_fee: SESSION_FEE,
      service_charge: SERVICE_CHARGE,
      total_due: TOTAL_DUE,
      payment_method: a.paymentMethod,

      updated_at: now,
    }

    const apptRes = await db.collection('appointments').findOneAndUpdate(
      { seed_key: a.seed_key },
      { $set: appointmentDoc, $setOnInsert: { seed_key: a.seed_key, payment_id: null, created_at: now, is_archived: false, archived_at: null } },
      { upsert: true, returnDocument: 'after' }
    )
    const appointment = apptRes.value || apptRes
    console.log(`Upserted appointment -> ${a.seed_key} (${appointmentDoc.patient_name} w/ ${therapistName}, ${a.status}, ${sessionDate.toISOString().slice(0, 10)})`)

    // A paid appointment also gets a matching payment row, same as a real
    // booking would (see step 4 of appointments-create.js).
    const paymentMethod = resolvePaymentMethod(a.paymentMethod, a.onlineMethod)
    if (paymentMethod) {
      const paymentSeedKey = `${a.seed_key}-payment`
      const payRes = await db.collection('payments').findOneAndUpdate(
        { seed_key: paymentSeedKey },
        {
          $set: {
            appointment_id: appointment._id,
            patient_id: patientId,
            amount: TOTAL_DUE,
            currency: 'PHP',
            method: paymentMethod,
            payment_date: sessionDate,
            status: paymentMethod === 'cash' ? (a.status === 'Completed' ? 'completed' : 'pending') : 'completed',
            payment_for: 'appointment',
            updated_at: now,
          },
          $setOnInsert: { seed_key: paymentSeedKey, PaymentID: `seed-${paymentSeedKey}`, created_at: now },
        },
        { upsert: true, returnDocument: 'after' }
      )
      const payment = payRes.value || payRes
      await db.collection('appointments').updateOne({ _id: appointment._id }, { $set: { payment_id: payment._id, updated_at: now } })
    }
  }
}

async function main() {
  const db = await getDb()
  console.log('Connected to MongoDB.')

  const employeeByEmail = await loadEmployees()
  const patientIdBySeedKey = await upsertPatients(db)
  await upsertAppointments(db, patientIdBySeedKey, employeeByEmail)

  console.log('Done.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Seeder failed:', err)
  process.exit(1)
})
