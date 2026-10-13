// Shared helpers for the Super Admin Branches routes: input validation,
// computed branch stats (therapists / patients / sessions are never stored on
// the branch — they are derived from employees + appointments) and the
// audit-trail write every create/edit/archive/review goes through.
import { ObjectId } from 'mongodb'
import { audit } from './noteAccess.js'

export const SERVICES = ['Speech', 'Occupational', 'Physical', 'Cognitive', 'Behavioral']
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const SUBMIT_STATUSES = ['Under review', 'Active']

export const str = (v) => (v == null ? '' : String(v).trim())
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Legacy rows used 'Inactive' / 'Review'; present them with the current names.
export function normalizeStatus(status) {
  if (status === 'Inactive') return 'Archived'
  if (status === 'Review') return 'Under review'
  return status || 'Active'
}

// Philippine numbers: mobile (09xx / +639xx) or landline with area code.
export function isPhPhone(value) {
  const s = str(value)
  if (!/^[\d\s()+-]+$/.test(s)) return false
  const digits = s.replace(/\D/g, '')
  if (digits.startsWith('63')) return digits.length >= 11 && digits.length <= 12
  if (digits.startsWith('0')) return digits.length >= 9 && digits.length <= 11
  return false
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(v))

export function defaultHours() {
  const out = {}
  for (const d of DAYS) out[d] = { open: d !== 'sat' && d !== 'sun', from: '08:00', to: '17:00' }
  return out
}

function cleanHours(input) {
  if (!input || typeof input !== 'object') return null
  const out = {}
  for (const d of DAYS) {
    const h = input[d] || {}
    out[d] = { open: Boolean(h.open), from: str(h.from) || '08:00', to: str(h.to) || '17:00' }
  }
  return out
}

// Validates the editable branch fields. `draft` only requires a name, so an
// admin can save half-finished work at any step. Returns { fields, value }.
export function validateBranchInput(body, { draft }) {
  const fields = {}
  const v = {
    branch_name: str(body.name),
    city: str(body.city),
    province: str(body.province),
    street: str(body.street),
    contact_number: str(body.phone),
    email: str(body.email).toLowerCase(),
    services: Array.isArray(body.services) ? [...new Set(body.services.map(str))].filter((s) => SERVICES.includes(s)) : [],
    hours: cleanHours(body.hours),
  }
  const capRaw = body.capacity
  v.therapist_capacity = capRaw === '' || capRaw == null ? null : Number(capRaw)

  if (!v.branch_name) fields.name = 'Branch name is required.'
  else if (v.branch_name.length > 80) fields.name = 'Keep the name under 80 characters.'

  if (v.contact_number && !isPhPhone(v.contact_number)) fields.phone = 'Use a Philippine number, e.g. 0917 123 4567 or (033) 000 0000.'
  if (v.email && !isEmail(v.email)) fields.email = 'Enter a valid email address.'
  if (v.therapist_capacity != null && (!Number.isInteger(v.therapist_capacity) || v.therapist_capacity < 1 || v.therapist_capacity > 500)) {
    fields.capacity = 'Capacity must be a whole number from 1 to 500.'
  }
  if (v.hours) {
    for (const d of DAYS) {
      const h = v.hours[d]
      if (h.open && !(/^\d{2}:\d{2}$/.test(h.from) && /^\d{2}:\d{2}$/.test(h.to) && h.from < h.to)) {
        fields[`hours.${d}`] = 'Closing time must be after opening time.'
      }
    }
  }

  if (!draft) {
    if (!v.city) fields.city = 'City or municipality is required.'
    if (!v.province) fields.province = 'Choose a province.'
    if (!v.street) fields.street = 'Street address is required.'
    if (!v.contact_number) fields.phone = fields.phone || 'Contact number is required.'
    if (v.therapist_capacity == null) fields.capacity = fields.capacity || 'Therapist capacity is required.'
    if (!v.services.length) fields.services = 'Select at least one service.'
    if (!v.hours || !DAYS.some((d) => v.hours[d].open)) fields.hours = 'Open at least one day.'
  }
  return { fields, value: v }
}

export function fullAddress(b) {
  const parts = [b.street, b.city, b.province].filter(Boolean)
  return parts.length ? parts.join(', ') : b.address || ''
}

// What still stands between a branch and going live.
export function missingRequirements(b, hasOwner) {
  const missing = []
  if (!hasOwner) missing.push('Branch owner')
  if (!b.contact_number) missing.push('Contact number')
  if (!(b.services || []).length) missing.push('Services offered')
  if (!b.hours) missing.push('Operating hours')
  return missing
}

// Per-branch therapists / patients / sessions-this-month, all derived.
export async function loadBranchStats(db, range = null) {
  const employees = await db.collection('employees')
    .find({ branch_id: { $ne: null } }, { projection: { branch_id: 1, status: 1 } }).toArray()
  const branchOfEmployee = new Map()
  const stats = new Map()
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { therapists: 0, patients: new Set(), sessions: 0 })
    return stats.get(id)
  }
  for (const e of employees) {
    const id = String(e.branch_id)
    branchOfEmployee.set(String(e._id), id)
    if (e.status === 'active' || e.status === 'on_leave') get(id).therapists += 1
  }

  // Sessions are counted in `range` ({ from, to } as YYYY-MM-DD strings) or, by default, this month.
  const month = new Date().toISOString().slice(0, 7)
  const day = { $substrBytes: [{ $toString: '$session_date' }, 0, 10] }
  const inRange = range
    ? { $and: [{ $gte: [day, range.from] }, { $lte: [day, range.to] }] }
    : { $eq: [{ $substrBytes: [{ $toString: '$session_date' }, 0, 7] }, month] }
  const rows = await db.collection('appointments').aggregate([
    { $match: { employee_id: { $ne: null }, patient_id: { $ne: null }, status: { $nin: ['Cancelled', 'Declined', 'Rejected'] } } },
    {
      $group: {
        _id: { e: '$employee_id', p: '$patient_id' },
        sessions: { $sum: { $cond: [inRange, 1, 0] } },
      },
    },
  ]).toArray()
  for (const r of rows) {
    const branchId = branchOfEmployee.get(String(r._id.e))
    if (!branchId) continue
    const s = get(branchId)
    s.patients.add(String(r._id.p))
    s.sessions += r.sessions
  }
  return stats
}

export function serializeBranch(b, { stats, owner }) {
  const s = stats?.get(String(b._id)) || { therapists: 0, patients: new Set(), sessions: 0 }
  const status = normalizeStatus(b.status)
  const hasOwner = Boolean(owner || b.owner_invite_email)
  return {
    id: String(b._id),
    name: b.branch_name,
    status,
    city: b.city || '',
    province: b.province || '',
    street: b.street || '',
    address: fullAddress(b),
    phone: b.contact_number || '',
    email: b.email || '',
    capacity: b.therapist_capacity ?? null,
    services: b.services || [],
    hours: b.hours || null,
    therapists: s.therapists,
    patients: s.patients.size,
    sessionsThisMonth: s.sessions,
    owner: owner
      ? { id: String(owner._id), name: owner.full_name, email: owner.email, pending: false }
      : b.owner_invite_email ? { id: null, name: '', email: b.owner_invite_email, pending: true } : null,
    missing: status === 'Under review' || status === 'Draft' ? missingRequirements(b, hasOwner) : [],
    declineReason: b.decline_reason || '',
    submittedAt: b.submitted_at || null,
    createdAt: b.created_at || (b._id.getTimestamp ? b._id.getTimestamp() : null),
  }
}

// Writes the action to `audit_logs` (the app's insert-only trail, throws if it
// cannot be recorded) and mirrors it into `auditlogs`, which feeds the Super
// Admin Audit Logs page.
export async function auditBranch(ctx, action, branch, description, extra = {}) {
  const meta = { branch_id: String(branch._id), branch_name: branch.branch_name, ...extra }
  await audit(ctx.db, { user: ctx.user, action, ip: ctx.ip, meta })
  await ctx.db.collection('auditlogs').insertOne({
    user_id: ctx.user._id, action, ip_address: ctx.ip || 'unknown',
    description, created_at: new Date(),
  }).catch((err) => console.error('auditlogs mirror failed:', err.message))
}

// Step 2 of the modal: either an existing Owner account or an email to invite.
// Returns { owner_id, owner_invite_email } or { error }.
export async function resolveOwner(db, owner) {
  if (!owner) return { owner_id: null, owner_invite_email: '' }
  if (owner.id) {
    if (!ObjectId.isValid(owner.id)) return { error: 'Choose a valid owner.' }
    const u = await db.collection('users').findOne({ _id: new ObjectId(owner.id), role: 'Owner', is_archived: { $ne: true } })
    if (!u) return { error: 'That owner account no longer exists.' }
    return { owner_id: u._id, owner_invite_email: '' }
  }
  const email = str(owner.inviteEmail).toLowerCase()
  if (!email) return { owner_id: null, owner_invite_email: '' }
  if (!isEmail(email)) return { error: 'Enter a valid email address to invite.' }
  const existing = await db.collection('users').findOne({ email })
  if (existing) {
    if (existing.role !== 'Owner') return { error: 'That email belongs to a non-owner account.' }
    return { owner_id: existing._id, owner_invite_email: '' }
  }
  return { owner_id: null, owner_invite_email: email }
}

export async function loadOwners(db, ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))]
  if (!list.length) return new Map()
  const users = await db.collection('users')
    .find({ _id: { $in: list.map((i) => new ObjectId(i)) } }, { projection: { full_name: 1, email: 1 } }).toArray()
  return new Map(users.map((u) => [String(u._id), u]))
}

export async function branchNameTaken(Branch, name, excludeId) {
  const q = { branch_name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }
  if (excludeId) q._id = { $ne: excludeId }
  return Boolean(await Branch.exists(q))
}
