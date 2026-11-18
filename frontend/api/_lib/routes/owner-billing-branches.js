// "Clinic details on invoices" for the Owner: READ ONLY.
//   GET /api/owner/billing/branches       -> the branches this user may see, with their TIN and invoice details
//   GET /api/owner/billing/branches/:id   -> one of them (404 when it is not theirs)
// The Owner only sees branches whose owner_id is their own user id (the Super Admin sees all). The details are written by the
// Super Admin on the Branches page; every write method here is a 403 FORBIDDEN, whatever the body says.
import { ObjectId } from 'mongodb'
import { getMongo } from '../mongo.js'
import { requireSession } from '../session.js'
import { fullAddress, normalizeStatus } from '../adminBranches.js'
import { billingView } from '../branchBilling.js'

const ROLES = ['Owner', 'Super Admin']

// Branches visible to this user. Never built from request input.
export function visibleFilter(user) {
  return user.role === 'Super Admin' ? {} : { owner_id: user._id }
}

function serialize(b, clinicName) {
  return {
    id: String(b._id), name: b.branch_name, status: normalizeStatus(b.status), address: fullAddress(b), phone: b.contact_number || '',
    ...billingView(b), clinicName,
  }
}

export default async function handler(req, res) {
  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ROLES }) // Therapists and Patients: 403 FORBIDDEN
    if (!ctx) return
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(403).json({ error: 'These details are managed by the Super Admin under Branches.', code: 'FORBIDDEN' })
    }
    const clinic = await ctx.db.collection('clinic_settings').findOne({ _id: 'clinic' }, { projection: { clinic_name: 1 } })
    const clinicName = clinic?.clinic_name || 'TherapyPro'
    res.setHeader('Cache-Control', 'private, no-store')

    const id = req.params?.id
    if (id !== undefined) {
      if (!/^[a-f\d]{24}$/i.test(String(id))) return res.status(404).json({ error: 'Branch not found.', code: 'NOT_FOUND' })
      const b = await ctx.db.collection('branchs').findOne({ _id: new ObjectId(String(id)), ...visibleFilter(ctx.user) })
      if (!b) return res.status(404).json({ error: 'Branch not found.', code: 'NOT_FOUND' }) // also what another owner's branch returns
      return res.json({ branch: serialize(b, clinicName) })
    }
    const list = await ctx.db.collection('branchs').find({ ...visibleFilter(ctx.user), status: { $nin: ['Archived', 'Draft', 'Declined'] } }).sort({ branch_name: 1 }).toArray()
    return res.json({ clinicName, branches: list.map((b) => serialize(b, clinicName)) })
  } catch (err) {
    console.error('owner billing branches error:', err?.message)
    return res.status(err?.status || 500).json({ error: err?.status ? err.message : 'Could not complete that request.' })
  }
}
