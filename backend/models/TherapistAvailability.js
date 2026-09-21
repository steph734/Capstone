const mongoose = require('mongoose');

// One document per employee per calendar day — the same-day time slots they
// confirmed (or explicitly skipped) after clocking in. Kept as its own
// collection rather than a field on Attendance so it isn't constrained by
// the `attendance` collection's Atlas $jsonSchema validator (Attendance is
// one immutable row per scan event, not a place to bolt on same-day state).
const therapistAvailabilitySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    date: { type: String, required: true }, // local calendar day, 'YYYY-MM-DD'
    slots: { type: [String], default: [] },
  },
  {
    collection: 'therapist_availability',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// One availability answer per employee per day — upserts key off this.
therapistAvailabilitySchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TherapistAvailability', therapistAvailabilitySchema);
