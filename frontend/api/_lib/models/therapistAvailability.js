// ESM port of backend/models/TherapistAvailability.js — same
// `therapist_availability` collection, same $jsonSchema validator. One
// document per employee per calendar day: the same-day slots they confirmed
// (or explicitly skipped) after clocking in.
import mongoose from 'mongoose'

const slotSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // 'HH:mm', 24-hour, Philippine time
    end: { type: String, required: true },
    status: { type: String, enum: ['available', 'booked', 'blocked'], required: true, default: 'available' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { _id: false }
)

const therapistAvailabilitySchema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    therapist_name: { type: String, default: null },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branch_name: { type: String, default: null },
    date: { type: String, required: true }, // local calendar day, 'YYYY-MM-DD'
    timezone: { type: String, required: true, default: 'Asia/Manila' },
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
)

therapistAvailabilitySchema.index({ therapist: 1, date: 1 }, { unique: true })

export const TherapistAvailability =
  mongoose.models.TherapistAvailability || mongoose.model('TherapistAvailability', therapistAvailabilitySchema)
