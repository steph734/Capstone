// Creates the `patient_assign` rows (which patients each therapist is assigned to) from the appointments that already exist.
// "Assign Games", "Who is playing today?" and the Speech-to-Text patient picker all read this collection, so while it is empty
// a therapist sees no patients at all.
// Idempotent: a therapist/patient pair that already has a row is left alone. The schema is not changed.
//   node api/_lib/seeders/seedPatientAssign.js --dry     only print what would be created
//   node api/_lib/seeders/seedPatientAssign.js           create the missing rows
// Each row: role 'primary', status 'active', therapy_types from the session types the pair has booked, start_date = their first booking.
import { getMongo, getDb } from '../mongo.js'

process.loadEnvFile?.()
const DRY = process.argv.includes('--dry')
const TYPES = ['cognitive', 'speech', 'physical', 'occupational']
const typeOf = (t) => { const s = String(t || '').toLowerCase(); return TYPES.find((x) => s.includes(x.slice(0, 5))) || null }

await getMongo()
const db = await getDb()
const employees = await db.collection('employees').find({}).project({ first_name: 1, last_name: 1, branch_id: 1, status: 1 }).toArray()
const byId = new Map(employees.map((e) => [String(e._id), e]))
const appts = await db.collection('appointments').find({ is_archived: { $ne: true }, status: { $nin: ['Cancelled', 'Declined'] }, employee_id: { $ne: null }, patient_id: { $ne: null } })
  .project({ employee_id: 1, patient_id: 1, session_type: 1, session_date: 1 }).toArray()

const pairs = new Map()
for (const a of appts) {
  if (!byId.has(String(a.employee_id))) continue
  const k = `${a.employee_id}|${a.patient_id}`
  const cur = pairs.get(k) || { employee_id: a.employee_id, patient_id: a.patient_id, types: new Set(), first: a.session_date }
  const t = typeOf(a.session_type)
  if (t) cur.types.add(t)
  if (a.session_date < cur.first) cur.first = a.session_date
  pairs.set(k, cur)
}

const now = new Date()
let created = 0
let existing = 0
for (const p of pairs.values()) {
  const e = byId.get(String(p.employee_id))
  if (await db.collection('patient_assign').findOne({ patient_id: p.patient_id, employee_id: p.employee_id })) { existing += 1; continue }
  if (!e.branch_id) { console.log(`! ${e.first_name} ${e.last_name}: no branch, skipped`); continue }
  const doc = {
    patient_id: p.patient_id, employee_id: p.employee_id, branch_id: e.branch_id, role: 'primary',
    therapy_types: p.types.size ? [...p.types] : ['cognitive'], status: 'active', start_date: p.first, assigned_by: null, created_at: now, updated_at: now,
  }
  if (!DRY) await db.collection('patient_assign').insertOne(doc)
  created += 1
}
console.log(`${DRY ? 'Dry run: would create' : 'Created'} ${created} assignment(s); ${existing} already existed; ${pairs.size} therapist/patient pairs found.`)
process.exit(0)
