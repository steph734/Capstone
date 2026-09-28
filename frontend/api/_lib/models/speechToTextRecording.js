// Matches the `speech_to_text_recordings` $jsonSchema validator exactly —
// field names here are the actual DB paths, not a mapped/renamed shape.
import mongoose from 'mongoose'

const segmentSchema = new mongoose.Schema({
  t: { type: Number, required: true, min: 0 },
  text: { type: String, required: true },
}, { _id: false })

const summarySchema = new mongoose.Schema({
  overview: { type: String, default: null },
  goals: { type: [String], default: [] },
  progress: { type: [String], default: [] },
  next_steps: { type: [String], default: [] },
  generated_at: { type: Date, default: null },
}, { _id: false })

const sttSchema = new mongoose.Schema({
  created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
  created_by_role: { type: String, required: true, enum: ['owner', 'therapist', 'staff'] },
  created_by_name: { type: String, default: null },
  patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  patient_name: { type: String, default: null },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  session_id: { type: String, default: null },
  title: { type: String, default: null, maxlength: 120 },
  transcript: { type: String, default: null },
  segments: { type: [segmentSchema], default: [] },
  word_count: { type: Number, default: null },
  summary: { type: summarySchema, default: null },
  summary_status: { type: String, required: true, enum: ['pending', 'ready', 'failed', 'none'], default: 'none' },
  language: { type: String, default: null },
  file_path: { type: String, default: null },
  mime_type: { type: String, default: null },
  file_size: { type: Number, default: null },
  duration_seconds: { type: Number, default: null },

  status: { type: String, required: true, enum: ['active', 'archived', 'deleted'], default: 'active' },
  is_archived: { type: Boolean, required: true, default: false },
  archived_at: { type: Date, default: null },
  archived_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  is_deleted: { type: Boolean, required: true, default: false },
  deleted_at: { type: Date, default: null },
  deleted_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  delete_reason: { type: String, default: null, maxlength: 200 },
  purge_after: { type: Date, default: null },
  restored_at: { type: Date, default: null },
  restored_by: { type: mongoose.Schema.Types.ObjectId, default: null },
}, {
  collection: 'speech_to_text_recordings',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

sttSchema.index({ created_by: 1, created_at: -1 })

export const SpeechToTextRecording = mongoose.models.SpeechToTextRecording
  || mongoose.model('SpeechToTextRecording', sttSchema)
