// A saved voice recording from the Speech Features page — the audio blob
// itself lives in the browser's IndexedDB (keyed by `audio_key`, see
// src/utils/recordingsDb.js); this collection holds everything else:
// transcript, timing, and the AI-generated session summary.
import mongoose from 'mongoose'

const summarySchema = new mongoose.Schema(
  {
    overview: { type: String, default: '' },
    goals: { type: [String], default: [] },
    progress: { type: [String], default: [] },
    next_steps: { type: [String], default: [] },
    generated_at: { type: Date, default: null },
  },
  { _id: false }
)

const segmentSchema = new mongoose.Schema(
  {
    t: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
)

const sessionRecordingSchema = new mongoose.Schema(
  {
    therapist_email: { type: String, required: true, trim: true, lowercase: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    patient_name: { type: String, default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    transcript: { type: String, default: '' },
    segments: { type: [segmentSchema], default: [] },
    duration_sec: { type: Number, required: true, default: 0 },
    word_count: { type: Number, required: true, default: 0 },
    summary: { type: summarySchema, default: null },
    summary_status: { type: String, required: true, enum: ['pending', 'ready', 'failed', 'none'], default: 'none' },
    audio_key: { type: String, required: true },
  },
  {
    collection: 'session_recordings',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

sessionRecordingSchema.index({ therapist_email: 1, created_at: -1 })

export const SessionRecording = mongoose.models.SessionRecording || mongoose.model('SessionRecording', sessionRecordingSchema)
