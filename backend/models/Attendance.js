const mongoose = require('mongoose');

// One document per employee per day — `date` is a local 'YYYY-MM-DD' bucket
// (not a Date) so "does this employee already have a record today" is a
// plain equality lookup instead of a start/end-of-day range query.
const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    date: { type: String, required: true },
    time_in: { type: Date },
    time_out: { type: Date },
  },
  {
    collection: 'attendance',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
