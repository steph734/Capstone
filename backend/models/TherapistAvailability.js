const mongoose = require('mongoose');

// One document per employee per calendar day — the same-day time slots they
// confirmed (or explicitly skipped) after clocking in. Kept as its own
// collection rather than a field on Attendance so it isn't constrained by
// the `attendance` collection's Atlas $jsonSchema validator (Attendance is
// one immutable row per scan event, not a place to bolt on same-day state).
// Matches the `therapist_availability` collection's $jsonSchema validator.
const slotSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // 'HH:mm', 24-hour, Philippine time
    end: { type: String, required: true },
    status: { type: String, enum: ['available', 'booked', 'blocked'], required: true, default: 'available' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { _id: false }
);

const therapistAvailabilitySchema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    therapist_name: { type: String, default: null },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branch_name: { type: String, default: null },
    date: { type: String, required: true }, // local calendar day, 'YYYY-MM-DD'
    timezone: { type: String, required: true, default: 'Asia/Manila' },
    // The time-in scan that triggered this same-day availability prompt.
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', default: null },
    slots: { type: [slotSchema], default: [] },
    status: { type: String, enum: ['confirmed', 'skipped'], required: true },
    confirmed_at: { type: Date, default: null },
    is_archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date, default: null },
  },
  {
    collection: 'therapist_availability',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// One availability answer per employee per day — upserts key off this.
therapistAvailabilitySchema.index({ therapist: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TherapistAvailability', therapistAvailabilitySchema);
