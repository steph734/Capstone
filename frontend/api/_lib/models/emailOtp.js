// ESM port of backend/models/EmailOtp.js — same `email_otps` collection, whose
// $jsonSchema validator requires a `status`, a BSON-int `attempts` and a
// `created_at`, and only allows these `purpose` values: login2fa,
// signup_verify, password_reset, email_change.
//
// Routes keep using the short names 'signup' and 'reset'; the setter below
// translates them to the stored values (it also runs on query filters, so
// `findOne({ purpose: 'signup' })` still matches).
import mongoose from 'mongoose'

const PURPOSE_ALIASES = { signup: 'signup_verify', reset: 'password_reset' }

const emailOtpSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    email: { type: String, required: true, trim: true, lowercase: true },
    purpose: {
      type: String,
      required: true,
      default: 'signup_verify',
      enum: ['login2fa', 'signup_verify', 'password_reset', 'email_change'],
      set: (v) => PURPOSE_ALIASES[v] || v,
    },
    code_hash: { type: String, required: true },
    status: { type: String, required: true, default: 'pending', enum: ['pending', 'used', 'expired', 'replaced', 'locked'] },
    // The validator wants a BSON int (a plain JS number is stored as a double).
    attempts: { type: mongoose.Schema.Types.Int32, required: true, default: 0 },
    expires_at: { type: Date, required: true },
    last_sent_at: { type: Date, required: true, default: Date.now },
    used_at: { type: Date, default: null },
    closed_at: { type: Date, default: null },
  },
  {
    collection: 'email_otps',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Issuing a code for an email+purpose replaces any earlier one in place, so
// the re-sent record always starts out pending again.
emailOtpSchema.pre('findOneAndUpdate', function resetStatus() {
  this.set({ status: 'pending', used_at: null, closed_at: null })
})

emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true })
emailOtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

export const EmailOtp = mongoose.models.EmailOtp || mongoose.model('EmailOtp', emailOtpSchema)
