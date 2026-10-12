// Resolves "who is this" for Stream purposes from the email the client
// sends. There is no session/cookie anywhere in this app (see api/_lib/routes
// auth-login.js) so this is the same trust level as every other route here
// (e.g. patients-therapist-list.js trusts a bare ?email= query param) — not
// a hardened auth check, just enough to keep strangers off each other's
// threads. If this app ever adds real sessions, swap this for verifying one.
import { ObjectId } from 'mongodb'
import { getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { User } from '../models/user.js'
import { patientStreamId, therapistStreamId } from './serverClient.js'

// Returns one of:
//   { kind: 'therapist', employee, streamId, userId, name }
//   { kind: 'patient', patient, streamId, userId, name }
//   null  (email not recognized as either)
// `userId` is the Mongo `users._id` behind this login — the FK the
// `conversations`/`call_logs` collections actually reference (they model
// therapist/guardian as Users, not as `employees`/`patients` rows).
export async function resolveCallerIdentity(email) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null

  // `email` is always the login address (what resolveCallerIdentity is
  // called with), which is exactly `users.email` regardless of role.
  const user = await User.findOne({ email: lower }).lean()

  const employee = await Employee.findOne({ email: lower }).lean()
  if (employee) {
    const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Therapist'
    return {
      kind: 'therapist',
      employee,
      streamId: therapistStreamId(employee._id),
      userId: user?._id || employee.user_id || null,
      name,
      image: employee.profile_picture?.url || null,
    }
  }

  const db = await getDb()
  const patient = await db.collection('patients').findOne({ email: lower })
  if (patient) {
    const guardianName = [patient.guardian_first_name, patient.guardian_last_name].filter(Boolean).join(' ')
    const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ')
    return {
      kind: 'patient',
      patient,
      streamId: patientStreamId(patient._id),
      userId: user?._id || null,
      name: guardianName || patientName || 'Guardian',
    }
  }

  return null
}

function parseStreamId(streamId) {
  if (streamId?.startsWith('patient-')) return { kind: 'patient', id: streamId.slice('patient-'.length) }
  if (streamId?.startsWith('therapist-')) return { kind: 'therapist', id: streamId.slice('therapist-'.length) }
  return null
}

// The Mongo `users._id` behind a Stream user id — used when we only know
// "the other side of this channel/call" as a Stream id (e.g. from a
// message.new event) and need the FK for conversations/call_logs.
export async function userIdForStreamId(streamId) {
  const parsed = parseStreamId(streamId)
  if (!parsed) return null

  if (parsed.kind === 'therapist') {
    const employee = await Employee.findById(parsed.id).lean()
    if (!employee) return null
    if (employee.user_id) return employee.user_id
    const user = await User.findOne({ email: employee.email }).lean()
    return user?._id || null
  }

  const db = await getDb()
  const patient = await db.collection('patients').findOne({ _id: new ObjectId(parsed.id) })
  if (!patient?.email) return null
  const user = await User.findOne({ email: patient.email }).lean()
  return user?._id || null
}

// Every therapist this patient has ever booked with, newest first.
export async function therapistsForPatient(patientId) {
  const db = await getDb()
  const appts = await db.collection('appointments')
    .find({ patient_id: patientId })
    .sort({ created_at: -1 })
    .toArray()
  const seen = new Set()
  const employeeIds = []
  for (const a of appts) {
    if (!a.employee_id) continue
    const key = String(a.employee_id)
    if (seen.has(key)) continue
    seen.add(key)
    employeeIds.push(a.employee_id)
  }
  if (!employeeIds.length) return []
  return Employee.find({ _id: { $in: employeeIds } }).lean()
}

// Every patient this therapist has ever had an appointment with (same
// derivation patients-therapist-list.js uses), with guardian contact info.
export async function patientsForTherapist(employeeId) {
  const db = await getDb()
  const docs = await db.collection('appointments').aggregate([
    { $match: { employee_id: employeeId } },
    { $lookup: { from: 'patients', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
    { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
  ]).toArray()

  const byPatient = new Map()
  for (const doc of docs) {
    if (!doc.patient_id) continue
    const key = String(doc.patient_id)
    if (!byPatient.has(key)) byPatient.set(key, doc)
  }
  return Array.from(byPatient.values()).map((doc) => {
    const p = doc.patient || {}
    const guardianName = doc.guardian_name
      || [p.guardian_first_name, p.guardian_last_name].filter(Boolean).join(' ')
      || doc.patient_name
      || 'Guardian'
    return { patientId: doc.patient_id, guardianName, patientName: doc.patient_name || [p.first_name, p.last_name].filter(Boolean).join(' ') }
  })
}
