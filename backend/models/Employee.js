const mongoose = require('mongoose');

// Matches the `employees` collection $jsonSchema validator in Atlas.
// created_at / updated_at are managed by the timestamps option below.
const employeeSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    branch_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Branch' },
    first_name: { type: String, required: true, trim: true },
    middle_name: { type: String, required: true, trim: true, default: '' },
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
    employment_type: { type: String, enum: ['full-time', 'part-time', 'contract', 'locum'] },
    license_expiry: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'on_leave', 'terminated'], default: 'active' },

    documents: {
      ptr: { type: String },
      prc: { type: String },
      diploma: { type: String },
      id: { type: String },
    },
  },
  {
    collection: 'employees',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

module.exports = mongoose.model('Employee', employeeSchema);
