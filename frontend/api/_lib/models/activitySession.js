// Matches the LIVE `activity_sessions` collection's $jsonSchema validator —
// one document per "Who is playing today?" pick. `patient_id` is the only
// nullable identity field (null in practice mode); everything else required.
import mongoose from 'mongoose'

const activitySessionSchema = new mongoose.Schema(
  {
    therapist_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // employees._id
    branch_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    mode: { type: String, required: true, enum: ['patient', 'practice'] },
    language: { type: String, required: true, enum: ['en', 'tl', 'ceb'] },
    remember: { type: Boolean, required: true, default: true },
    status: { type: String, required: true, enum: ['active', 'ended'], default: 'active' },
    appointment_id: { type: mongoose.Schema.Types.ObjectId, default: null },

    games_started: { type: mongoose.Schema.Types.Int32, required: true, default: 0, min: 0 },
    games_completed: { type: mongoose.Schema.Types.Int32, required: true, default: 0, min: 0 },
    xp_earned: { type: mongoose.Schema.Types.Int32, required: true, default: 0, min: 0 },

    started_at: { type: Date, required: true, default: Date.now },
    last_active_at: { type: Date, required: true, default: Date.now },
    ended_at: { type: Date, default: null },
    end_reason: { type: String, default: null, enum: ['changed_player', 'closed', 'timeout', 'logout', null] },
  },
  {
    collection: 'activity_sessions',
    versionKey: false,
    timestamps: false, // the schema's own started_at/last_active_at/ended_at cover this
  }
)

// Only one active session per therapist at a time.
activitySessionSchema.index(
  { therapist_id: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
)

export const ActivitySession = mongoose.models.ActivitySession || mongoose.model('ActivitySession', activitySessionSchema)
