// There is no session/token auth anywhere in this app (see api/_lib/routes/
// auth-login.js — login returns the user but issues no token), so every
// /api/emails route identifies the caller the same way the rest of this app
// does: the email the client sends. Not hardened, just enough to keep
// strangers off threads they're not part of.
import { getDb } from './mongo.js'
import { User } from './models/user.js'
import { Employee } from './models/employee.js'

export async function resolveCaller(email) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null
  const user = await User.findOne({ email: lower }).lean()
  if (!user) return null

  if (user.role === 'Therapist') {
    const employee = await Employee.findOne({ email: lower }).lean()
    return { user, role: 'therapist', employee: employee || null }
  }

  // Guardians log in as a 'Patient'-role user whose email matches the
  // clinical `patients.email` field (same convention as resolvePatient.js
  // and the Stream identity helpers used elsewhere in this app).
  const db = await getDb()
  const patient = await db.collection('patients').findOne({ email: lower })
  return { user, role: 'guardian', patient: patient || null }
}

// Every patient this therapist has ever had an appointment with — same
// derivation as api/_lib/routes/patients-therapist-list.js, since there's no
// direct "assigned therapist" field on a patient record.
export async function therapistOwnsPatient(employeeId, patientId) {
  const db = await getDb()
  const count = await db.collection('appointments').countDocuments({
    employee_id: employeeId,
    patient_id: patientId,
  })
  return count > 0
}

// The Mongo `users._id` for the guardian of a given patient (their login
// account's email always equals `patients.email`).
export async function guardianUserIdForPatient(patientId) {
  const db = await getDb()
  const patient = await db.collection('patients').findOne({ _id: patientId })
  if (!patient?.email) return null
  const user = await User.findOne({ email: String(patient.email).toLowerCase() }).lean()
  return user?._id || null
}

export async function patientNameById(patientId) {
  if (!patientId) return null
  const db = await getDb()
  const patient = await db.collection('patients').findOne({ _id: patientId })
  if (!patient) return null
  return [patient.first_name, patient.last_name].filter(Boolean).join(' ') || null
}

// Display info for a list of Mongo users._id — therapists get their
// Employee name/photo, guardians get their patient's guardian name.
export async function userDisplayInfo(userIds) {
  const ids = userIds.filter(Boolean).map((id) => String(id))
  if (!ids.length) return new Map()

  const users = await User.find({ _id: { $in: ids } }).lean()
  const byId = new Map()
  const employees = await Employee.find({ user_id: { $in: ids } }).lean()
  const employeeByUserId = new Map(employees.map((e) => [String(e.user_id), e]))

  const db = await getDb()
  const patients = await db.collection('patients').find({ email: { $in: users.map((u) => u.email) } }).toArray()
  const patientByEmail = new Map(patients.map((p) => [p.email, p]))

  for (const user of users) {
    const employee = employeeByUserId.get(String(user._id))
    if (employee) {
      byId.set(String(user._id), {
        id: String(user._id),
        name: [employee.first_name, employee.last_name].filter(Boolean).join(' ') || user.full_name,
        image: employee.profile_picture?.url || null,
        role: 'therapist',
      })
      continue
    }
    const patient = patientByEmail.get(user.email)
    const guardianName = patient
      ? [patient.guardian_first_name, patient.guardian_last_name].filter(Boolean).join(' ')
      : ''
    byId.set(String(user._id), {
      id: String(user._id),
      name: guardianName || user.full_name,
      image: null,
      role: 'guardian',
    })
  }
  return byId
}
