const mongoose = require('mongoose');

// Matches the `branchs` collection in Atlas.
const branchSchema = new mongoose.Schema(
  {
    branch_name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact_number: { type: String, trim: true },
    status: { type: String, default: 'Active' },
  },
  { collection: 'branchs', versionKey: false }
);

module.exports = mongoose.model('Branch', branchSchema);
