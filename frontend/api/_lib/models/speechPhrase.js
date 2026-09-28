// Matches the `speech_phrases` $jsonSchema validator exactly.
import mongoose from 'mongoose'

const speechPhraseSchema = new mongoose.Schema({
  created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  group: { type: String, required: true, enum: ['start', 'instructions', 'praise', 'end'] },
  text: { type: String, required: true, minlength: 1, maxlength: 200 },
  picture_cue: { type: String, enum: ['look', 'listen', 'your_turn', 'wait', 'great_job', null], default: null },
  sort_order: { type: Number, default: null },
  use_count: { type: Number, default: 0, min: 0 },

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
  collection: 'speech_phrases',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

speechPhraseSchema.index({ created_by: 1, group: 1 })

export const SpeechPhrase = mongoose.models.SpeechPhrase
  || mongoose.model('SpeechPhrase', speechPhraseSchema)
