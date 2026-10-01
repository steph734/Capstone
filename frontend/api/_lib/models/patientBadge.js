// A durable, timestamped record of a badge a patient actually earned —
// distinct from the on-the-fly "does this patient currently satisfy this
// badge's criteria" computation in evaluateUnlock.js. Earning is a one-time
// event (earned_at), and `seen` drives the reward-screen "New!" flag.
import mongoose from 'mongoose'

const patientBadgeSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    badge_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Badge' },
    badge_code: { type: String, required: true },
    earned_at: { type: Date, required: true, default: Date.now },
    game_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    session_id: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'GameSession' },
    seen: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'patient_badges',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

patientBadgeSchema.index({ patient_id: 1, badge_id: 1 }, { unique: true })

export const PatientBadge = mongoose.models.PatientBadge || mongoose.model('PatientBadge', patientBadgeSchema)
