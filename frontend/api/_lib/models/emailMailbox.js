// Matches the `email_mailboxes` collection $jsonSchema validator in Atlas —
// one row per (user, email), so read/starred/trash state is per recipient.
import mongoose from 'mongoose'

const emailMailboxSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    email_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Email' },
    folder: { type: String, enum: ['inbox', 'sent', 'drafts', 'trash'], required: true },
    previous_folder: { type: String, default: null },
    is_read: { type: Boolean, default: false },
    is_starred: { type: Boolean, default: false },
    read_at: { type: Date, default: null },
    deleted_at: { type: Date, default: null },
  },
  {
    collection: 'email_mailboxes',
    versionKey: false,
    timestamps: { createdAt: 'mailbox_created_at', updatedAt: false },
  }
)

emailMailboxSchema.index({ user_id: 1, email_id: 1 }, { unique: true })
emailMailboxSchema.index({ user_id: 1, folder: 1 })

export const EmailMailbox = mongoose.models.EmailMailbox || mongoose.model('EmailMailbox', emailMailboxSchema)
