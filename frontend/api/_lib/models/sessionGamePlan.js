// `session_game_plans`: the games a therapist picked for one patient's session today, and the time
// window in which the patient may play them. The $jsonSchema validator lives in MongoDB; this model
// mirrors it. Counts are always whole numbers (the driver stores integer-valued JS numbers as int32).
// Dates are UTC instants; `plan_date` is the Asia/Manila calendar day at 00:00 Manila time.
import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const planGameSchema = new mongoose.Schema(
  {
    game_id: { type: ObjectId, required: true },
    order: { type: Number, required: true, min: 1 },
    minutes: { type: Number, required: true, min: 1, max: 60 },
    status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
    completed_at: { type: Date, default: null },
  },
  { _id: false }
)

const sessionGamePlanSchema = new mongoose.Schema(
  {
    patient_id: { type: ObjectId, required: true, index: true },
    employee_id: { type: ObjectId, required: true, index: true },
    branch_id: { type: ObjectId, default: null },
    assignment_id: { type: ObjectId, default: null },
    appointment_id: { type: ObjectId, default: null },
    plan_date: { type: Date, required: true },
    games: { type: [planGameSchema], default: [] },
    play_start: { type: Date, required: true },
    play_end: { type: Date, required: true },
    start_manually: { type: Boolean, default: false },
    started_at: { type: Date, default: null },
    paused_at: { type: Date, default: null },
    extended_minutes: { type: Number, default: 0, min: 0, max: 30 },
    warn_before_minutes: { type: Number, default: 5, min: 0, max: 30 },
    allow_finish_current: { type: Boolean, default: true },
    status: { type: String, enum: ['scheduled', 'active', 'paused', 'ended', 'cancelled'], default: 'scheduled' },
  },
  {
    collection: 'session_game_plans',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const SessionGamePlan = mongoose.models.SessionGamePlan || mongoose.model('SessionGamePlan', sessionGamePlanSchema)
