// One short-lived snapshot per therapist per day: what the day looked like before
// the last save, so the "Undo" toast can put it back. Also remembers the last
// request ids so a retried save/undo is idempotent. Kept in its own collection
// so the `therapist_availability` $jsonSchema validator stays untouched.
import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    therapist: { type: mongoose.Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    request_id: { type: String, default: null },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    previous: { type: mongoose.Schema.Types.Mixed, default: null }, // { existed, status, slots, confirmed_at }
    undo_request_id: { type: String, default: null },
    undo_response: { type: mongoose.Schema.Types.Mixed, default: null },
    undone: { type: Boolean, default: false },
    saved_at: { type: Date, default: Date.now },
  },
  { collection: 'therapist_availability_undo', versionKey: false }
)
schema.index({ therapist: 1, date: 1 }, { unique: true })
// Housekeeping: snapshots are useless after a day.
schema.index({ saved_at: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export const TherapistAvailabilityUndo =
  mongoose.models.TherapistAvailabilityUndo || mongoose.model('TherapistAvailabilityUndo', schema)
