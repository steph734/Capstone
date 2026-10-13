// ESM port of backend/models/Branch.js — same `branchs` collection (the
// name is a pre-existing typo baked into Atlas, not ours to fix here).
import mongoose from 'mongoose'

const branchSchema = new mongoose.Schema(
  {
    branch_name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact_number: { type: String, trim: true },
    // 'Active' | 'Under review' | 'Draft' | 'Declined' | 'Archived' (legacy rows may say 'Inactive').
    status: { type: String, default: 'Active' },

    // Added by the Super Admin Branches page. All optional so older rows still load.
    city: { type: String, trim: true },
    province: { type: String, trim: true },
    street: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    // Assigned therapists are never stored: they are counted from `employees`.
    therapist_capacity: { type: Number, min: 0 },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    owner_invite_email: { type: String, trim: true, lowercase: true },
    services: [{ type: String }],
    hours: { type: mongoose.Schema.Types.Mixed },

    submitted_at: { type: Date },
    decline_reason: { type: String },
    archived_at: { type: Date, default: null },
    status_before_archive: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date },
  },
  { collection: 'branchs', versionKey: false }
)

// A warm serverless container re-imports this module across invocations but
// keeps the same Node process, so guard against "OverwriteModelError".
export const Branch = mongoose.models.Branch || mongoose.model('Branch', branchSchema)
