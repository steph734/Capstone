// A durable record of a wardrobe item or hairstyle a patient actually
// unlocked — same relationship to evaluateUnlock.js as patient_badges above.
import mongoose from 'mongoose'

const sourceSchema = new mongoose.Schema(
  {
    // free = everyone gets it, achievement = the item's own unlock rule,
    // badge = unlocked via a badge's unlock_item_code — matches the live
    // patient_unlocks validator's source.type enum exactly.
    type: { type: String, required: true, enum: ['free', 'achievement', 'badge'] },
    badge_code: { type: String, default: null },
    session_id: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'GameSession' },
  },
  { _id: false }
)

const patientUnlockSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    item_type: { type: String, required: true, enum: ['item', 'hair'] },
    item_code: { type: String, required: true },
    source: { type: sourceSchema, default: () => ({ type: 'free' }) },
    seen: { type: Boolean, required: true, default: false },
    unlocked_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'patient_unlocks',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

patientUnlockSchema.index({ patient_id: 1, item_type: 1, item_code: 1 }, { unique: true })

export const PatientUnlock = mongoose.models.PatientUnlock || mongoose.model('PatientUnlock', patientUnlockSchema)
