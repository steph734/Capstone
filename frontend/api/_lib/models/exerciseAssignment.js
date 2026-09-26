// A home-practice game assigned to a patient from the Assign Exercises
// session planner — one document per game in a session plan. No
// $jsonSchema validator was specified for this collection (unlike
// therapy_notes), so this Mongoose schema is the source of truth; it
// mirrors the shape the frontend's session planner already works with
// (see src/data/exerciseGames.js and TherapistAssignExercisesPage.jsx).
import mongoose from 'mongoose'

const exerciseAssignmentSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    patient_name: { type: String, required: true, trim: true },
    employee_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    employee_name: { type: String, default: null },
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    game_id: { type: String, trim: true, default: null },
    exercise_name: { type: String, required: true, trim: true },
    domain: { type: String, enum: ['Cognitive', 'Physical', 'Occupational', 'Speech'], default: null },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', null], default: null },
    duration_min: { type: Number, default: null },
    rounds: { type: Number, default: null },
    instructions: { type: String, default: null },
    due_date: { type: String, required: true }, // 'YYYY-MM-DD'
    status: { type: String, enum: ['Assigned', 'Completed', 'Skipped'], default: 'Assigned' },
    is_archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date, default: null },
  },
  {
    collection: 'exercise_assignments',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

exerciseAssignmentSchema.index({ employee_id: 1, is_archived: 1, created_at: -1 })
exerciseAssignmentSchema.index({ patient_id: 1 })

export const ExerciseAssignment =
  mongoose.models.ExerciseAssignment || mongoose.model('ExerciseAssignment', exerciseAssignmentSchema)
