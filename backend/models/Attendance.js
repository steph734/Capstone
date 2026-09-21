const mongoose = require('mongoose');

// Matches the `attendance` collection $jsonSchema validator in Atlas — one
// document per scan EVENT (a time-in or a time-out), not one per employee
// per day. employee/employee_name/branch_id/branch_name are denormalized so
// the raw scan log stays readable without a join, and can still be kept
// (with employee: null) even if the badge couldn't be matched to a record.
const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employee_name: { type: String, default: null },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branch_name: { type: String, default: null },
    scanned_at: { type: Date, required: true },
    type: { type: String, enum: ['time_in', 'time_out'], required: true },
    source: { type: String, enum: ['webcam', null], default: 'webcam' },
    is_archived: { type: Boolean, default: false },
    archived_at: { type: Date, default: null },
  },
  {
    collection: 'attendance',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Every lookup here is "this employee's scans, most recent first" — either
// the single latest scan (to decide time-in vs. time-out) or a history page.
attendanceSchema.index({ employee: 1, scanned_at: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
