const mongoose = require('mongoose');

// Matches the `users` collection $jsonSchema validator in Atlas.
// created_at / updated_at are managed by the timestamps option below.
const userSchema = new mongoose.Schema(
  {
    username:  { type: String, required: true, trim: true },
    password:  { type: String, required: true }, // bcrypt hash, never plaintext
    full_name: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['Super Admin', 'Owner', 'Therapist', 'Patient'],
    },
    email: { type: String, required: true, trim: true, lowercase: true },

    is_verified: { type: Boolean, required: true, default: false },
    status:      { type: String, required: true, default: 'Active' },
    password_change_at: { type: Date, default: null },

    is_locked:   { type: Boolean, required: true, default: false },
    is_archived: { type: Boolean, required: true, default: false },
    archived_at: { type: Date, default: null },

    // validator wants BSON int, not double
    failed_login_attempts: { type: mongoose.Schema.Types.Int32, required: true, default: 0 },
    last_login_attempt: { type: Date, default: null },
    last_login:         { type: Date, default: null },
    lock_until:         { type: Date, default: null },
  },
  {
    collection: 'users',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Case-insensitive uniqueness for username + email.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

// Strip sensitive fields when sending a user to the client.
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.full_name,
    full_name: this.full_name,
    username: this.username,
    email: this.email,
    role: this.role,
    is_verified: this.is_verified,
    status: this.status,
    avatar: '/therapy-pro-logo.png',
  };
};

module.exports = mongoose.model('User', userSchema);
