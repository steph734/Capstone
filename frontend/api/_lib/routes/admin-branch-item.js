import mongoose from 'mongoose'
import { getMongo } from '../mongo.js'
import { Branch } from '../models/branch.js'
import { requireSession } from '../session.js'
import {
  SUBMIT_STATUSES, str, normalizeStatus, validateBranchInput, resolveOwner, loadOwners, loadBranchStats,
  serializeBranch, branchNameTaken, auditBranch, missingRequirements,
} from '../adminBranches.js'
import { tinProblem, billingChanges, readableValidatorError, TIN_NEEDED_MESSAGE } from '../branchBilling.js'

// GET   /api/admin/branches/:id  -> one branch (with its tax & billing details)
// PATCH /api/admin/branches/:id
//   { action: 'archive' | 'restore' | 'approve' | 'decline', reason? }  or
//   { name, city, ..., owner, services, hours, draft? }  -> edit fields.
// Super Admin only; every change is written to audit_logs.
export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) return res.status(422).json({ error: 'Invalid branch id.', code: 'VALIDATION_ERROR', fields: { id: 'Invalid branch id.' } })

  try {
    await getMongo()
    const ctx = await requireSession(req, res, { roles: ['Super Admin'] })
    if (!ctx) return

    const branch = await Branch.findById(id)
    if (!branch) return res.status(404).json({ error: 'Branch not found.', code: 'NOT_FOUND' })
    if (req.method === 'GET') {
      const [stats0, owners0] = await Promise.all([loadBranchStats(ctx.db), loadOwners(ctx.db, [branch.owner_id])])
      return res.json({ branch: serializeBranch(branch.toObject(), { stats: stats0, owner: owners0.get(String(branch.owner_id)) }) })
    }
    const body = req.body || {}
    const billingBefore = branch.toObject()
    const before = normalizeStatus(branch.status)
    const now = new Date()
    const bad = (error, extra = {}) => res.status(400).json({ error, ...extra })

    if (body.action) {
      if (body.action === 'archive') {
        if (before === 'Archived') return bad('This branch is already archived.')
        branch.status_before_archive = before
        branch.status = 'Archived'
        branch.archived_at = now
        branch.updated_at = now
        await branch.save()
        await auditBranch(ctx, 'branch_archived', branch, `Archived branch "${branch.branch_name}".`, { from: before })
      } else if (body.action === 'restore') {
        if (before !== 'Archived') return bad('This branch is not archived.')
        const prev = branch.status_before_archive
        branch.status = prev && prev !== 'Archived' ? prev : 'Active'
        branch.archived_at = null
        branch.updated_at = now
        await branch.save()
        await auditBranch(ctx, 'branch_restored', branch, `Restored branch "${branch.branch_name}" to ${branch.status}.`)
      } else if (body.action === 'approve') {
        if (before !== 'Under review') return bad('Only branches under review can be approved.')
        if (!branch.tin) return res.status(422).json({ error: TIN_NEEDED_MESSAGE, code: 'TIN_REQUIRED_FOR_ACTIVE', fields: { tin: TIN_NEEDED_MESSAGE } })
        const missing = missingRequirements(branch, Boolean(branch.owner_id || branch.owner_invite_email))
        if (missing.length) return bad(`Cannot approve yet. Missing: ${missing.join(', ')}.`, { missing })
        branch.status = 'Active'
        branch.decline_reason = ''
        branch.updated_at = now
        await branch.save()
        await auditBranch(ctx, 'branch_approved', branch, `Approved branch "${branch.branch_name}"; it is now Active.`)
      } else if (body.action === 'decline') {
        if (before !== 'Under review') return bad('Only branches under review can be declined.')
        const reason = str(body.reason)
        if (reason.length < 3) return bad('Give a reason for declining.', { fields: { reason: 'Give a reason for declining.' } })
        branch.status = 'Declined'
        branch.decline_reason = reason.slice(0, 500)
        branch.updated_at = now
        await branch.save()
        await auditBranch(ctx, 'branch_declined', branch, `Declined branch "${branch.branch_name}": ${reason.slice(0, 200)}`, { reason })
      } else {
        return bad('Unknown action.')
      }
    } else {
      if (before === 'Archived') return bad('Restore this branch before editing it.')
      const draft = Boolean(body.draft)
      if (draft && before !== 'Draft') return bad('Only drafts can be saved as drafts.')
      const { fields, value } = validateBranchInput(body, { draft })
      if (!fields.name && await branchNameTaken(Branch, value.branch_name, branch._id)) fields.name = 'A branch with this name already exists.'

      // A draft being submitted picks its status; a live branch keeps its own
      // (Under review <-> Active only changes through approve/decline).
      let status = before
      if (!draft && before === 'Draft') {
        status = String(body.status || 'Under review')
        if (!SUBMIT_STATUSES.includes(status)) fields.status = 'Choose Under review or Active.'
      }

      let ownerPatch = {}
      if ('owner' in body) {
        const owner = await resolveOwner(ctx.db, body.owner)
        if (owner.error) fields.owner = owner.error
        else ownerPatch = owner
      }
      const ownerId = 'owner' in body ? ownerPatch.owner_id : branch.owner_id
      const invite = 'owner' in body ? ownerPatch.owner_invite_email : branch.owner_invite_email
      if (!draft && status === 'Active' && !ownerId && !invite) fields.owner = 'An active branch needs an owner.'
      if (Object.keys(fields).length) return res.status(422).json({ error: 'Please fix the highlighted fields.', code: 'VALIDATION_ERROR', fields })

      // TIN: required to move a branch INTO Active (a draft submitted as Active). A branch that is already Active and has
      // a TIN cannot have it removed; the four older Active branches without one stay editable. Always unique.
      const resultingTin = 'tin' in body ? value.tin : branch.tin
      const needTin = before === 'Active' ? Boolean(branch.tin) : (!draft && status === 'Active')
      const tinIssue = await tinProblem(ctx.db, { tin: resultingTin, needTin, exceptId: branch._id })
      if (tinIssue) return res.status(tinIssue.status).json(tinIssue.body)

      Object.assign(branch, value, ownerPatch, { status, updated_at: now })
      if (!draft && before === 'Draft') branch.submitted_at = now
      await branch.save()
      await auditBranch(ctx, 'branch_updated', branch, `Edited branch "${branch.branch_name}".`, { status_before: before, status_after: status })
      // who / when / branch / field / old / new for every tax & billing field that really changed
      for (const c of billingChanges(billingBefore, branch.toObject())) {
        await auditBranch(ctx, 'branch_billing_changed', branch, `Changed ${c.field} of branch "${branch.branch_name}".`, c)
      }
    }

    const stats = await loadBranchStats(ctx.db)
    const lean = branch.toObject()
    const owners = await loadOwners(ctx.db, [lean.owner_id])
    return res.json({ branch: serializeBranch(lean, { stats, owner: owners.get(String(lean.owner_id)) }) })
  } catch (err) {
    if (err?.code === 121) return res.status(422).json({ error: readableValidatorError(err), code: 'VALIDATION_ERROR' })
    if (err?.code === 11000 && /tin/.test(String(err.message))) return res.status(409).json({ error: 'This TIN is already used by another branch.', code: 'DUPLICATE_TIN', fields: { tin: 'This TIN is already used by another branch.' } })
    console.error('admin branch item error:', err)
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not complete that request.' })
  }
}
