// ESM port of backend/models/Branch.js — same `branchs` collection (the
// name is a pre-existing typo baked into Atlas, not ours to fix here).
import mongoose from 'mongoose'

const branchSchema = new mongoose.Schema(
  {
    branch_name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact_number: { type: String, trim: true },
    status: { type: String, default: 'Active' },
  },
  { collection: 'branchs', versionKey: false }
)

// A warm serverless container re-imports this module across invocations but
// keeps the same Node process, so guard against "OverwriteModelError".
export const Branch = mongoose.models.Branch || mongoose.model('Branch', branchSchema)
