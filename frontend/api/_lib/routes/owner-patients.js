import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'

// GET /api/owner/patients -> every record in the `patients` collection, with
// the therapist / branch / session figures derived from `appointments` (there
// is no direct "assigned therapist" field on a patient; whoever they last
// booked with is their therapist). Owner and Super Admin only.
//
// Clinical status (Active / Needs Review / Critical) isn't tracked anywhere,
// so `status` is based only on activity: Active (a session in the last 60
// days or one booked ahead), Inactive, or New (never booked). SOAP notes are
// encrypted and never returned here.

const ACTIVE_WINDOW_DAYS = 60
const CANCELLED = new Set(['cancelled', 'declined', 'rejected'])

const dayIso = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10) }
const fullName = (...parts) => parts.filter(Boolean).join(' ').trim()

function ageFrom(birthdate) {
  if (!birthdate) return null
  const b = new Date(birthdate)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1
  return age
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Owner', 'Super Admin'] })
    if (!ctx) return
    const { db } = ctx

    const [patients, appts, employees, branches] = await Promise.all([
      db.collection('patients').find({}).toArray(),
      db.collection('appointments').find(
        { patient_id: { $ne: null } },
        { projection: { patient_id: 1, employee_id: 1, session_date: 1, status: 1, condition: 1, therapist_name: 1, patient_photo_url: 1, is_archived: 1 } }
      ).toArray(),
      db.collection('employees').find({}, { projection: { first_name: 1, last_name: 1, branch_id: 1 } }).toArray(),
      db.collection('branchs').find({}, { projection: { branch_name: 1 } }).toArray(),
    ])
    const branchName = new Map(branches.map((b) => [String(b._id), b.branch_name]))
    const empById = new Map(employees.map((e) => [String(e._id), e]))

    const byPatient = new Map()
    for (const a of appts) {
      const key = String(a.patient_id)
      if (!byPatient.has(key)) byPatient.set(key, [])
      byPatient.get(key).push(a)
    }

    const today = dayIso(new Date())
    const cutoff = dayIso(Date.now() - ACTIVE_WINDOW_DAYS * 86400000)
    const list = patients.map((p) => {
      const mine = (byPatient.get(String(p._id)) || []).filter((a) => !a.is_archived && !CANCELLED.has(String(a.status || '').toLowerCase()))
      mine.sort((a, b) => String(dayIso(a.session_date)).localeCompare(String(dayIso(b.session_date))))
      const past = mine.filter((a) => dayIso(a.session_date) && dayIso(a.session_date) <= today)
      const future = mine.filter((a) => dayIso(a.session_date) && dayIso(a.session_date) > today)
      const latest = mine[mine.length - 1] || null
      const emp = latest?.employee_id ? empById.get(String(latest.employee_id)) : null
      const lastVisit = past.length ? dayIso(past[past.length - 1].session_date) : null
      const status = !mine.length ? 'New' : future.length || (lastVisit && lastVisit >= cutoff) ? 'Active' : 'Inactive'
      return {
        id: String(p._id),
        name: fullName(p.first_name, p.last_name) || 'Unknown',
        age: ageFrom(p.birthdate),
        gender: p.gender || null,
        condition: [...mine].reverse().map((a) => a.condition).find((c) => c && c !== 'Other') || [...mine].reverse().map((a) => a.condition).find(Boolean) || '',
        status,
        branch: emp?.branch_id ? branchName.get(String(emp.branch_id)) || '' : '',
        therapist: emp ? fullName(emp.first_name, emp.last_name) : latest?.therapist_name || '',
        avatar: p.profile_photo?.url || (typeof p.profile_photo === 'string' ? p.profile_photo : null) || [...mine].reverse().map((a) => a.patient_photo_url).find(Boolean) || null,
        lastVisit,
        nextSession: future.length ? dayIso(future[0].session_date) : null,
        sessions: mine.length,
        guardian: fullName(p.guardian_first_name, p.guardian_last_name) || '',
        guardianRelationship: p.guardian_relationship || '',
        contact: p.guardian_contact_number || p.contact_number || '',
        email: p.guardian_email || p.email || '',
        address: p.address || '',
        joined: p.created_at ? dayIso(p.created_at) : null,
      }
    }).sort((a, b) => a.name.localeCompare(b.name))

    res.setHeader('Cache-Control', 'no-store')
    return res.json({ patients: list, branches: branches.map((b) => b.branch_name).filter(Boolean).sort() })
  } catch (err) {
    console.error('owner patients error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not load patients.' })
  }
}
