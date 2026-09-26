// Matches the `therapy_notes` collection's $jsonSchema validator.
import mongoose from 'mongoose'

const therapyNoteSchema = new mongoose.Schema(
  {
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    employee_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Employee' },
    employee_name: { type: String, default: null },
    patient_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    patient_name: { type: String, default: null },
    diagnosis: { type: String, default: null },
    // Doubles as the "domain" tag (Cognitive/Physical/Occupational/Speech)
    // shown on a parent-shared note — the schema has no dedicated domain
    // field, and this is exactly what `title` is for generically.
    title: { type: String, maxlength: 150, default: null },
    session_date: { type: String, required: true }, // 'YYYY-MM-DD', Philippine local day
    timezone: { type: String, default: 'Asia/Manila' },
    subjective: { type: String, default: null },
    objective: { type: String, default: null },
    assessment: { type: String, default: null },
    plan: { type: String, default: null },
    status: { type: String, enum: ['draft', 'signed'], required: true },
    signature_image: { type: String, default: null },
    signed_at: { type: Date, default: null },
    signed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    shared_with_guardian: { type: Boolean, default: false },
    shared_summary: { type: String, default: null },
    shared_at: { type: Date, default: null },
    addendum_to: { type: mongoose.Schema.Types.ObjectId, ref: 'TherapyNote', default: null },
    is_archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date, default: null },
  },
  {
    collection: 'therapy_notes',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

therapyNoteSchema.index({ employee_id: 1, session_date: -1 })
therapyNoteSchema.index({ patient_id: 1, session_date: -1 })

export const TherapyNote = mongoose.models.TherapyNote || mongoose.model('TherapyNote', therapyNoteSchema)
