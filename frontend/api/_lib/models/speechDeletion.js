// Matches the `speech_deletions` $jsonSchema validator exactly. This is an
// append-only audit log (no updated_at/timestamps plugin — deleted_at is set
// explicitly at write time), written whenever a speech record is purged for
// good so support can see what existed without keeping the transcript itself.
import mongoose from 'mongoose'

const speechDeletionSchema = new mongoose.Schema({
  collection_name: { type: String, required: true, enum: ['speech_to_text_recordings', 'text_to_speech_messages', 'speech_phrases'] },
  record_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  branch_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  label: { type: String, default: null, maxlength: 120 },
  method: { type: String, required: true, enum: ['manual', 'auto_purge', 'empty_trash'] },
  deleted_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  deleted_by_role: { type: String, enum: ['owner', 'therapist', 'staff', null], default: null },
  reason: { type: String, default: null, maxlength: 200 },
  had_audio_file: { type: Boolean, default: null },
  deleted_at: { type: Date, required: true, default: Date.now },
}, {
  collection: 'speech_deletions',
  versionKey: false,
})

export const SpeechDeletion = mongoose.models.SpeechDeletion
  || mongoose.model('SpeechDeletion', speechDeletionSchema)
