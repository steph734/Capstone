import { getMongo } from '../mongo.js'
import { Branch } from '../models/branch.js'
import { requireSession } from '../session.js'
import { sendEmail } from '../brevo.js'
import {
  SUBMIT_STATUSES, validateBranchInput, resolveOwner, loadOwners, loadBranchStats,
  serializeBranch, branchNameTaken, auditBranch,
} from '../adminBranches.js'

// GET  /api/admin/branches -> every branch with derived stats, for the Super Admin page.
// POST /api/admin/branches -> creates a branch (or a draft). Super Admin only.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return

    if (req.method === 'GET') {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const [rows, stats, therapistsThisMonth] = await Promise.all([
        Branch.find({}).lean(),
        loadBranchStats(ctx.db),
        ctx.db.collection('employees').countDocuments({ branch_id: { $ne: null }, created_at: { $gte: monthStart } }),
      ])
      const owners = await loadOwners(ctx.db, rows.map((b) => b.owner_id))
      return res.json({
        branches: rows.map((b) => serializeBranch(b, { stats, owner: owners.get(String(b.owner_id)) })),
        therapistsThisMonth,
      })
    }

    const body = req.body || {}
    const draft = Boolean(body.draft)
    const { fields, value } = validateBranchInput(body, { draft })
    if (!fields.name && await branchNameTaken(Branch, value.branch_name)) fields.name = 'A branch with this name already exists.'

    const status = draft ? 'Draft' : String(body.status || 'Under review')
    if (!draft && !SUBMIT_STATUSES.includes(status)) fields.status = 'Choose Under review or Active.'

    const owner = await resolveOwner(ctx.db, body.owner)
    if (owner.error) fields.owner = owner.error
    if (!draft && status === 'Active' && !owner.owner_id && !owner.owner_invite_email) {
      fields.owner = 'An active branch needs an owner. Pick or invite one in step 2.'
    }
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields })

    const now = new Date()
    const branch = await Branch.create({
      ...value,
      status,
      owner_id: owner.owner_id,
      owner_invite_email: owner.owner_invite_email,
      submitted_at: draft ? undefined : now,
      created_at: now,
      updated_at: now,
    })

    await auditBranch(ctx, draft ? 'branch_draft_saved' : 'branch_created', branch,
      `${draft ? 'Saved draft of' : 'Created'} branch "${branch.branch_name}" (${status}).`, { status })

    if (owner.owner_invite_email && !draft) {
      const text = `You have been named the owner of ${branch.branch_name} on TherapyPro. A Super Admin will contact you with your sign-in details.`
      sendEmail({
        to: owner.owner_invite_email,
        subject: `You have been invited to manage ${branch.branch_name} on TherapyPro`,
        html: `<p>${text.replace(branch.branch_name, `<strong>${branch.branch_name.replace(/</g, '&lt;')}</strong>`)}</p>`,
        plain: text,
      }).catch((err) => console.error('branch owner invite email failed:', err.message))
    }

    const lean = branch.toObject()
    const owners = await loadOwners(ctx.db, [lean.owner_id])
    return res.status(201).json({ branch: serializeBranch(lean, { stats: null, owner: owners.get(String(lean.owner_id)) }) })
  } catch (err) {
    console.error('admin branches error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
