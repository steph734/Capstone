import { getMongo, getDb } from '../mongo.js'
import { Employee } from '../models/employee.js'

// GET /api/patients/therapist-list?email=... -> every distinct patient who
// has actually booked an appointment with this therapist, derived from the
// `appointments` collection the same way appointments-therapist-list.js
// does (there's no direct "assigned therapist" field on `patients` — a
// patient having chosen this therapist IS them having an appointment with
// them). Replaces the old hardcoded demo roster on the My Patients page.

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

function dateIso(d) {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
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

    const todayIso = new Date().toISOString().slice(0, 10)
    const byPatient = new Map()
    for (const doc of docs) {
      const key = doc.patient_id ? String(doc.patient_id) : `unlinked:${doc._id}`
      if (!byPatient.has(key)) byPatient.set(key, [])
      byPatient.get(key).push(doc)
    }

    const patients = Array.from(byPatient.entries()).map(([key, appts]) => {
      const p = appts[appts.length - 1].patient || {}
      const active = appts.filter((a) => !a.is_archived)
      const iso = (a) => dateIso(a.session_date)
      const past = active.filter((a) => iso(a) && iso(a) <= todayIso).sort((a, b) => iso(b).localeCompare(iso(a)))
      const future = active.filter((a) => iso(a) && iso(a) > todayIso).sort((a, b) => iso(a).localeCompare(iso(b)))
      const latest = appts[appts.length - 1]

      return {
        id: key,
        patientId: p._id ? `P-${String(p._id).slice(-6).toUpperCase()}` : null,
        name: latest.patient_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
        age: ageFromBirthdate(p.birthdate),
        condition: latest.condition || appts.map((a) => a.condition).find(Boolean) || '',
        // Clinical status (Active / Needs Review / Critical) isn't tracked
        // anywhere in the schema yet — default everyone to Active rather
        // than invent a signal.
        status: 'Active',
        lastSessionDate: past[0] ? iso(past[0]) : null,
        nextSessionDate: future[0] ? iso(future[0]) : null,
        sessions: active.length,
        guardian: latest.guardian_name || [p.guardian_first_name, p.guardian_last_name].filter(Boolean).join(' ') || 'Not specified',
        contact: latest.contact_number || p.contact_number || 'Not specified',
        email: latest.contact_email || p.email || null,
        joinedDate: p.created_at ? dateIso(p.created_at) : dateIso(appts[0].created_at),
        notes: 'No clinical notes yet.',
      }
    })

    return res.status(200).json({ patients })
  } catch (err) {
    console.error('patients/therapist-list error:', err)
    return res.status(500).json({ error: err.message || 'Could not load patients.' })
  }
}
