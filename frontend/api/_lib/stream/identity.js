// Resolves "who is this" for Stream purposes from the email the client
// sends. There is no session/cookie anywhere in this app (see api/_lib/routes
// auth-login.js) so this is the same trust level as every other route here
// (e.g. patients-therapist-list.js trusts a bare ?email= query param) — not
// a hardened auth check, just enough to keep strangers off each other's
// threads. If this app ever adds real sessions, swap this for verifying one.
import { getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'
import { patientStreamId, therapistStreamId } from './serverClient.js'

// Returns one of:
//   { kind: 'therapist', employee, streamId, name }
//   { kind: 'patient', patient, streamId, name }
//   null  (email not recognized as either)
export async function resolveCallerIdentity(email) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null

  const employee = await Employee.findOne({ email: lower }).lean()
  if (employee) {
    const name = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'Therapist'
    return {
      kind: 'therapist',
      employee,
      streamId: therapistStreamId(employee._id),
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
      name: guardianName || patientName || 'Guardian',
    }
  }

  return null
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
