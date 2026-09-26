import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'

// GET /api/appointments/therapist-list?email=... -> every appointment booked
// with this therapist (matched via the employees collection, same lookup key
// used across the attendance endpoints), straight from the `appointments`
// collection — this is what patients actually picked this therapist for,
// replacing the old hardcoded demo list on the Therapist Appointments page.
// Includes archived ones; the frontend splits by `isArchived`/`status`.

function minutesBetween(start, end) {
  const [sh, sm] = String(start || '00:00').split(':').map(Number)
  const [eh, em] = String(end || '00:00').split(':').map(Number)
  const diff = (eh * 60 + em) - (sh * 60 + sm)
  return diff > 0 ? diff : 60
}

function ageFromBirthdate(birthdate) {
  if (!birthdate) return null
  const now = new Date()
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const email = String(req.query.email || '').trim().toLowerCase()
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' })
  }

  try {
    // Mongoose queries buffer (and eventually time out) if issued before the
    // connection is actually established — explicitly await it first rather
    // than assuming some other route on this container already warmed it up.
    await getMongo()
    const employee = await Employee.findOne({ email }).lean()
    if (!employee) {
      return res.status(404).json({ error: 'No staff record is linked to this account yet.' })
    }

    const db = await getDb()
    const docs = await db.collection('appointments').aggregate([
      { $match: { employee_id: employee._id } },
      { $lookup: { from: 'patients', localField: 'patient_id', foreignField: '_id', as: 'patient' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $sort: { session_date: 1, start_time: 1 } },
    ]).toArray()

    const appointments = docs.map((doc) => ({
      id: String(doc._id),
      patientId: doc.patient_id ? String(doc.patient_id) : null,
      patientName: doc.patient_name || [doc.patient?.first_name, doc.patient?.last_name].filter(Boolean).join(' ') || 'Unknown',
      condition: doc.condition || '',
      age: ageFromBirthdate(doc.patient?.birthdate),
      date: new Date(doc.session_date).toISOString().slice(0, 10),
      time: doc.start_time,
      endTime: doc.end_time,
      duration: `${minutesBetween(doc.start_time, doc.end_time)} min`,
      type: doc.session_type || doc.session_mode || 'Session',
      sessionMode: doc.session_mode,
      status: doc.is_archived ? 'Archived' : doc.status,
      isArchived: !!doc.is_archived,
      archivedAt: doc.archived_at,
      guardianName: doc.guardian_name || '',
      contactNumber: doc.contact_number || '',
      contactEmail: doc.contact_email || '',
      createdAt: doc.created_at,
    }))

    return res.status(200).json({ appointments })
  } catch (err) {
    console.error('appointments/therapist-list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load appointments.' })
  }
}
