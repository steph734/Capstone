import { getDb } from './mongo.js'

// There's no Mongoose model for `patients` (it's read/written by several
// features via the raw driver already), so this looks the patient up by the
// email on their own account — the same email stored on their `users` doc.
export async function resolvePatientId(email) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null
  const db = await getDb()
  const patient = await db.collection('patients').findOne({ email: lower }, { projection: { _id: 1 } })
  return patient ? patient._id : null
}
