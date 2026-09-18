const mongoose = require('mongoose');

// Matches the `employees` collection $jsonSchema validator in Atlas.
// created_at / updated_at are managed by the timestamps option below.
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
    status: { type: String, enum: ['active', 'inactive', 'on_leave', 'terminated'], default: 'active' },

    documents: {
      ptr: { type: String },
      prc: { type: String },
      diploma: { type: String },
      id: { type: String },
    },
    // GridFS file id (staff_documents bucket) for the profile photo — optional.
    photo: { type: String },

    // Set when the owner sends the setup invite; cleared once the hire
    // finishes self-setup (single-use). Never returned by default queries.
    invite_token_hash: { type: String, select: false },
    invite_expires_at: { type: Date },

    // Set only once the owner reviews the hire's uploaded documents and
    // approves them — this is what actually moves them into the Employees
    // list (finishing setup only makes them show up in "For Review").
    approved_at: { type: Date, default: null },
  },
  {
    collection: 'employees',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Employee', employeeSchema);
