// Matches the `text_to_speech_messages` $jsonSchema validator exactly.
import mongoose from 'mongoose'

const ttsMessageSchema = new mongoose.Schema({
  created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
  created_by_role: { type: String, required: true, enum: ['owner', 'therapist', 'staff'] },
  created_by_name: { type: String, default: null },
  patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  patient_name: { type: String, default: null },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  session_id: { type: String, default: null },
  input_text: { type: String, required: true, minlength: 1, maxlength: 500 },
  phrase_group: { type: String, required: true, enum: ['start', 'instructions', 'praise', 'end', 'custom', 'typed'] },
  phrase_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  speed: { type: Number, default: null, min: 0.5, max: 1.5 },
  repeat_count: { type: Number, default: null, min: 1, max: 3 },
  picture_cue: { type: String, enum: ['look', 'listen', 'your_turn', 'wait', 'great_job', null], default: null },
  replay_count: { type: Number, default: 0, min: 0 },
  voice: { type: String, enum: ['pao', 'browser', null], default: 'browser' },
  language: { type: String, default: null },

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
  collection: 'text_to_speech_messages',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

ttsMessageSchema.index({ created_by: 1, created_at: -1 })

export const TextToSpeechMessage = mongoose.models.TextToSpeechMessage
  || mongoose.model('TextToSpeechMessage', ttsMessageSchema)
