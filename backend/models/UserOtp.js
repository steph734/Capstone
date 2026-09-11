const mongoose = require('mongoose');

// One row per *generated* code — an audit trail, not a single row that gets
// overwritten on resend. This matches the $jsonSchema validator already set
// on the `user_otps` collection in Atlas (user_id, code, purpose,
// otp_created_at, otp_used_at, otp_expires_at). Re-issuing a code soft-expires
// the previous unused row for the same user+purpose instead of deleting it,
// so history of what was sent is kept; verifying a code marks it used rather
// than removing it.
const userOtpSchema = new mongoose.Schema(
  {
    // The other collections in this database (e.g. `patients.PatientID`) carry
    // a *ID-style key alongside Mongo's own `_id`, and `user_otps` already has
    // a unique index on `OtpID`. The app never reads it — it's only set so
    // inserts satisfy that index.
    OtpID: {
      type: String,
      required: true,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true, maxlength: 10 }, // the plain 6-digit code
    purpose: { type: String, required: true, default: 'signup', maxlength: 30 },
    otp_created_at: { type: Date, required: true, default: Date.now },
    otp_used_at: { type: Date, default: null },
    otp_expires_at: { type: Date, required: true },
    // Wrong-guess counter for lockout. Not part of the Atlas validator, but
    // the schema doesn't restrict extra properties, so this is allowed.
    attempts: { type: Number, default: 0 },
  },
  {
    collection: 'user_otps',
    versionKey: false,
  }
);

userOtpSchema.index({ user_id: 1, purpose: 1, otp_created_at: -1 });
// Auto-clean codes that were never used, once they've expired. Codes that
// were actually used (otp_used_at set) are kept as a permanent record.
userOtpSchema.index(
  { otp_expires_at: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { otp_used_at: null } }
);

module.exports = mongoose.model('UserOtp', userOtpSchema, 'user_otps');
