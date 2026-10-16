// A therapist's "recommend another session" offer to a patient's guardian.
// Same `session_recommendations` collection the Atlas validator was created on.
import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const sessionRecommendationSchema = new mongoose.Schema(
  {
    appointment_id: { type: ObjectId, required: true }, // the completed session this follows
    patient_id: { type: ObjectId, required: true },
    therapist_id: { type: ObjectId, required: true }, // employees._id
    guardian_user_id: { type: ObjectId, default: null }, // users._id
    session_type: { type: String, enum: ['Cognitive', 'Speech', 'Occupational'], required: true },
    session_mode: { type: String, enum: ['In-Person', 'Online'], required: true },
    duration_minutes: { type: Number, required: true },
    session_fee: { type: Number, default: null },
    message: { type: String, maxlength: 1000, default: '' },
    sent_via: { type: [String], enum: ['chat', 'email', 'in_app'], default: [] },
    status: { type: String, enum: ['Sent', 'Booked', 'Expired', 'Cancelled'], default: 'Sent', required: true },
    booked_appointment_id: { type: ObjectId, default: null },
    expires_at: { type: Date, required: true },
  },
  { collection: 'session_recommendations', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

sessionRecommendationSchema.index({ patient_id: 1, status: 1 })
sessionRecommendationSchema.index({ therapist_id: 1, created_at: -1 })
sessionRecommendationSchema.index({ expires_at: 1 })

export const SessionRecommendation =
  mongoose.models.SessionRecommendation || mongoose.model('SessionRecommendation', sessionRecommendationSchema)
