// Matches the `emails` collection $jsonSchema validator in Atlas.
import mongoose from 'mongoose'

const attachmentSchema = new mongoose.Schema(
  {
    file_name: { type: String, required: true },
    file_path: { type: String, required: true }, // Supabase Storage path, not a public URL
    file_type: { type: String, required: true },
    file_size: { type: Number, required: true },
  },
  { _id: false }
)

const emailSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    recipient_ids: { type: [mongoose.Schema.Types.ObjectId], required: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
    email_status: { type: String, enum: ['draft', 'sent'], required: true },
    thread_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    reply_to_email_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    email_sent_at: { type: Date, default: null },
  },
  {
    collection: 'emails',
    versionKey: false,
    timestamps: { createdAt: 'email_created_at', updatedAt: 'email_updated_at' },
  }
)

emailSchema.index({ thread_id: 1, email_created_at: 1 })

export const Email = mongoose.models.Email || mongoose.model('Email', emailSchema)
