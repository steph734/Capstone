// Mongoose model for the existing `appointments` collection. Most of the app
// reads/writes this collection through the native driver, so this model is
// mainly the schema reference for the completion / recommendation fields.
// `strict: false` keeps older documents (which lack these fields) working.
import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema(
  {
    employee_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    session_date: { type: Date, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    session_mode: { type: String, enum: ['Face-to-Face', 'Online', 'In-Person'], required: true },
    session_type: { type: String, default: null },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No Show'],
      required: true,
      default: 'Pending',
    },
    is_archived: { type: Boolean, default: false },

    // Marked-as-completed details. Absent on older documents.
    completed_at: { type: Date, default: null },
    completed_by: { type: mongoose.Schema.Types.ObjectId, default: null },
    completion_remarks: { type: String, maxlength: 500, default: null },

    // How the appointment was created, and which recommendation (if any) it came from.
    source: { type: String, enum: ['booking', 'therapist', 'recommendation', null], default: null },
    recommendation_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { collection: 'appointments', strict: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

appointmentSchema.index({ recommendation_id: 1 }, { sparse: true })

export const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema)
