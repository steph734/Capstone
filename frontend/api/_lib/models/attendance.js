// ESM port of backend/models/Attendance.js — same `attendance` collection,
// same $jsonSchema validator. One document per scan EVENT (a time-in or a
// time-out), not one per employee per day.
import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employee_name: { type: String, default: null },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branch_name: { type: String, default: null },
    scanned_at: { type: Date, required: true },
    attendance_date: { type: String, required: true },
    timezone: { type: String, required: true, default: 'Asia/Manila' },
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
)

attendanceSchema.index({ employee: 1, scanned_at: -1 })

export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema)
