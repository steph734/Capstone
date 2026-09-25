// ESM port of backend/models/LeaveRequest.js — same `leave_request`
// collection, same $jsonSchema validator.
import mongoose from 'mongoose'

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employee_name: { type: String, default: null },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    leave_type: {
      type: String,
      enum: ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Other'],
      required: true,
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    reason: { type: String, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
    requested_at: { type: Date, required: true, default: Date.now },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    review_note: { type: String, default: null },
    is_archived: { type: Boolean, default: false },
    archived_at: { type: Date, default: null },
  },
  {
    collection: 'leave_request',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

leaveRequestSchema.index({ employee: 1, start_date: -1 })

export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema)
