// ESM port of backend/models/EmailOtp.js — same `email_otps` collection.
import mongoose from 'mongoose'

const emailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    purpose: { type: String, required: true, default: 'signup' },
    code_hash: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    expires_at: { type: Date, required: true },
    last_sent_at: { type: Date, required: true, default: Date.now },
  },
  {
    collection: 'email_otps',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true })
emailOtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

export const EmailOtp = mongoose.models.EmailOtp || mongoose.model('EmailOtp', emailOtpSchema)
