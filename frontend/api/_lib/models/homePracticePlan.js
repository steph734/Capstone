// `home_practice_plans`: games a therapist keeps unlocked at home after a session, and when the patient may play them.
// Atlas $jsonSchema mirrors this. Weekdays are 0 (Sunday) to 6 (Saturday), all times are Asia/Manila.
import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const homeGameSchema = new mongoose.Schema(
  {
    game_id: { type: ObjectId, required: true },
    order: { type: Number, required: true, min: 1 },
    source: { type: String, enum: ['session', 'home_only', 'level_up'], default: 'session' },
  },
  { _id: false }
)

const homePracticePlanSchema = new mongoose.Schema(
  {
    patient_id: { type: ObjectId, required: true, index: true },
    therapist_id: { type: ObjectId, required: true, index: true }, // employees._id
    branch_id: { type: ObjectId, default: null },
    session_plan_id: { type: ObjectId, default: null },
    appointment_id: { type: ObjectId, default: null },
    starts_at: { type: Date, required: true },
    ends_at: { type: Date, required: true },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
    daily_start: { type: String, default: '16:00' },
    daily_end: { type: String, default: '19:00' },
    daily_limit_minutes: { type: Number, default: 15, min: 5, max: 120 },
    goal_per_game_per_week: { type: Number, default: 3, min: 1, max: 7 },
    notify_caregiver: { type: Boolean, default: true },
    save_to_progress: { type: Boolean, default: true },
    auto_level_up: { type: Boolean, default: false },
    games: { type: [homeGameSchema], default: [] },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  },
  { collection: 'home_practice_plans', versionKey: false, timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export const HomePracticePlan = mongoose.models.HomePracticePlan || mongoose.model('HomePracticePlan', homePracticePlanSchema)
