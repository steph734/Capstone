// Shared "who is making this request" lookup for the speech-features routes.
// Their $jsonSchema requires created_by to be an employees._id plus a
// created_by_role drawn from the employee's account role, so every STT/TTS
// write needs both an Employee and a User doc for the same email.
import { Employee } from './models/employee.js'
import { User } from './models/user.js'

const ROLE_MAP = { Owner: 'owner', Therapist: 'therapist', 'Super Admin': 'staff' }

export async function resolveSpeechCreator(email) {
  const lower = String(email || '').trim().toLowerCase()
  if (!lower) return null
  const [employee, user] = await Promise.all([
    Employee.findOne({ email: lower }).lean(),
    User.findOne({ email: lower }).lean(),
  ])
  if (!employee || !user) return null
  return {
    id: employee._id,
    role: ROLE_MAP[user.role] || 'staff',
    name: [employee.first_name, employee.last_name].filter(Boolean).join(' ') || user.full_name || null,
    branchId: employee.branch_id || null,
  }
}
