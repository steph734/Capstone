// ESM port of backend/models/Employee.js — same `employees` collection,
// same $jsonSchema validator.
import mongoose from 'mongoose'

const employeeSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    branch_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Branch' },
    first_name: { type: String, required: true, trim: true },
    // Not everyone has a middle name — plain `default: ''` won't satisfy
    // `required` here since Mongoose treats an empty string as "missing" for
    // String paths, so this must stay optional rather than required.
    middle_name: { type: String, trim: true, default: '' },
    last_name: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    hired_at: { type: Date, required: true },

    email: { type: String, trim: true, lowercase: true },
    phone: {
      country_code: { type: String, trim: true },
      number: { type: String, trim: true },
    },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    address: { type: String, trim: true },
    emergency_contact: { type: String, trim: true },
    emergency_phone: { type: String, trim: true },

    specialty: { type: String, trim: true },
    employee_id: { type: String, trim: true },
    prc_number: { type: String, trim: true },
    experience: { type: Number, min: 0 },
    employment_type: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Locum'] },
    license_expiry: { type: Date },
    // 'for_review' is where a hire sits from creation until the owner
    // approves them (see `approved_at` below) — the approve route flips this
    // to 'active' once that happens.
    status: { type: String, enum: ['for_review', 'active', 'inactive', 'on_leave', 'terminated'], default: 'active' },

    documents: {
      ptr: { type: String },
      prc: { type: String },
      diploma: { type: String },
      id: { type: String },
    },
    profile_picture: {
      url: { type: String },
      storage_key: { type: String },
      uploaded_at: { type: Date },
    },

    invite_token_hash: { type: String, select: false },
    invite_expires_at: { type: Date },

    approved_at: { type: Date, default: null },
  },
  {
    collection: 'employees',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// A warm serverless container re-imports this module across invocations but
// keeps the same Node process, so guard against "OverwriteModelError".
export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema)
