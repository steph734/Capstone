import mongoose from 'mongoose'
import { ActivitySession } from './models/activitySession.js'
import { resolvePatientId } from './resolvePatient.js'

// Who a Pao request is for. A therapist-run session passes its activity
// session id, and that session's own patient is the only identity trusted.
// Otherwise the patient logs in on their own device and is identified by
// email. Returns { patientId, error } where error is a status-tagged object.
export async function resolveRequestPatient({ activitySessionId, patientEmail }) {
  if (activitySessionId) {
    if (!mongoose.isValidObjectId(activitySessionId)) return { error: { status: 400, message: 'Invalid activity session.' } }
    const session = await ActivitySession.findById(activitySessionId).lean()
    if (!session || session.status !== 'active') return { error: { status: 400, message: 'That session has ended.' } }
    if (session.mode !== 'patient' || !session.patient_id) {
      return { error: { status: 403, message: 'Practice mode does not save progress.' } }
    }
    return { patientId: session.patient_id }
  }
  const email = String(patientEmail || '').trim()
  if (!email) return { error: { status: 400, message: 'Missing patientEmail.' } }
  const patientId = await resolvePatientId(email)
  if (!patientId) return { error: { status: 404, message: 'No patient record is linked to this account yet.' } }
  return { patientId }
}
